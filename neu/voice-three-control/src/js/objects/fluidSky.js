import * as THREE from "three";
import { CONFIG } from "../config.js";

/**
 * 流体背景：GPU 上的稳定流体（速度场平流 → 涡度 → 散度 → 压力求解 → 去散度），
 * 染料用 NEU 品牌色（青绿 / 珊瑚橙）。出声时从风车附近吹出墨流，安静时慢慢散开淡去。
 * 结果渲染进一张贴图，作为场景背景；设备不支持浮点渲染时退回静态渐变。
 */

const baseVertex = /* glsl */ `
  uniform vec2 texelSize;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  void main() {
    vUv = uv;
    vL = vUv - vec2(texelSize.x, 0.0);
    vR = vUv + vec2(texelSize.x, 0.0);
    vT = vUv + vec2(0.0, texelSize.y);
    vB = vUv - vec2(0.0, texelSize.y);
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const shaders = {
  splat: /* glsl */ `
    uniform sampler2D uTarget;
    uniform float aspectRatio;
    uniform vec3 color;
    uniform vec2 point;
    uniform float radius;
    varying vec2 vUv;
    void main() {
      vec2 p = vUv - point;
      p.x *= aspectRatio;
      vec3 splat = exp(-dot(p, p) / radius) * color;
      gl_FragColor = vec4(texture2D(uTarget, vUv).xyz + splat, 1.0);
    }
  `,
  advection: /* glsl */ `
    uniform sampler2D uVelocity;
    uniform sampler2D uSource;
    uniform vec2 texelSize;
    uniform float dt;
    uniform float dissipation;
    varying vec2 vUv;
    void main() {
      vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
      gl_FragColor = texture2D(uSource, coord) / (1.0 + dissipation * dt);
    }
  `,
  curl: /* glsl */ `
    uniform sampler2D uVelocity;
    varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
    void main() {
      float L = texture2D(uVelocity, vL).y;
      float R = texture2D(uVelocity, vR).y;
      float T = texture2D(uVelocity, vT).x;
      float B = texture2D(uVelocity, vB).x;
      gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
    }
  `,
  vorticity: /* glsl */ `
    uniform sampler2D uVelocity;
    uniform sampler2D uCurl;
    uniform float curl;
    uniform float dt;
    varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
    void main() {
      float L = texture2D(uCurl, vL).x;
      float R = texture2D(uCurl, vR).x;
      float T = texture2D(uCurl, vT).x;
      float B = texture2D(uCurl, vB).x;
      float C = texture2D(uCurl, vUv).x;
      vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
      force /= length(force) + 0.0001;
      force *= curl * C;
      force.y *= -1.0;
      vec2 vel = texture2D(uVelocity, vUv).xy + force * dt;
      gl_FragColor = vec4(clamp(vel, -1000.0, 1000.0), 0.0, 1.0);
    }
  `,
  divergence: /* glsl */ `
    uniform sampler2D uVelocity;
    varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
    void main() {
      float L = texture2D(uVelocity, vL).x;
      float R = texture2D(uVelocity, vR).x;
      float T = texture2D(uVelocity, vT).y;
      float B = texture2D(uVelocity, vB).y;
      vec2 C = texture2D(uVelocity, vUv).xy;
      if (vL.x < 0.0) { L = -C.x; }
      if (vR.x > 1.0) { R = -C.x; }
      if (vT.y > 1.0) { T = -C.y; }
      if (vB.y < 0.0) { B = -C.y; }
      gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
    }
  `,
  clear: /* glsl */ `
    uniform sampler2D uTexture;
    uniform float value;
    varying vec2 vUv;
    void main() { gl_FragColor = value * texture2D(uTexture, vUv); }
  `,
  pressure: /* glsl */ `
    uniform sampler2D uPressure;
    uniform sampler2D uDivergence;
    varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
    void main() {
      float L = texture2D(uPressure, vL).x;
      float R = texture2D(uPressure, vR).x;
      float T = texture2D(uPressure, vT).x;
      float B = texture2D(uPressure, vB).x;
      float divergence = texture2D(uDivergence, vUv).x;
      gl_FragColor = vec4((L + R + B + T - divergence) * 0.25, 0.0, 0.0, 1.0);
    }
  `,
  gradientSubtract: /* glsl */ `
    uniform sampler2D uPressure;
    uniform sampler2D uVelocity;
    varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
    void main() {
      float L = texture2D(uPressure, vL).x;
      float R = texture2D(uPressure, vR).x;
      float T = texture2D(uPressure, vT).x;
      float B = texture2D(uPressure, vB).x;
      vec2 vel = texture2D(uVelocity, vUv).xy - vec2(R - L, T - B);
      gl_FragColor = vec4(vel, 0.0, 1.0);
    }
  `,
  // 显示：炭灰底 + 柔和压缩后的染料，四周再收暗一点；输出线性色，交给后期统一转 sRGB
  display: /* glsl */ `
    uniform sampler2D uDye;
    uniform vec3 skyTop;
    uniform vec3 skyBottom;
    uniform float intensity;
    varying vec2 vUv;
    void main() {
      vec3 bg = mix(skyBottom, skyTop, smoothstep(0.0, 1.0, vUv.y));
      vec3 dye = texture2D(uDye, vUv).rgb * intensity;
      float m = max(dye.r, max(dye.g, dye.b));
      dye = dye / (1.0 + m);
      gl_FragColor = vec4(bg + dye, 1.0);
    }
  `,
};

function srgbToLinear(hex) {
  const c = new THREE.Color(hex);   // three 的 Color 以线性存储，传入的十六进制按 sRGB 解析
  return new THREE.Vector3(c.r, c.g, c.b);
}

function supportsFloatTargets(renderer) {
  const gl = renderer.getContext();
  return !!(gl.getExtension("EXT_color_buffer_float") || gl.getExtension("EXT_color_buffer_half_float"));
}

function staticSky() {
  const look = CONFIG.look;
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, look.sky[0]);
  grad.addColorStop(1, look.sky[2]);
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { texture: tex, update() {}, resize() {} };
}

export function createFluidSky(renderer) {
  if (!supportsFloatTargets(renderer)) return staticSky();
  const fl = CONFIG.look.fluid;

  const quadScene = new THREE.Scene();
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  quadScene.add(quad);

  const mats = {};
  for (const [name, frag] of Object.entries(shaders)) {
    mats[name] = new THREE.ShaderMaterial({
      vertexShader: baseVertex,
      fragmentShader: frag,
      uniforms: {
        texelSize: { value: new THREE.Vector2() },
        uTarget: { value: null }, aspectRatio: { value: 1 }, color: { value: new THREE.Vector3() },
        point: { value: new THREE.Vector2() }, radius: { value: 0.01 },
        uVelocity: { value: null }, uSource: { value: null }, dt: { value: 0.016 }, dissipation: { value: 0 },
        uCurl: { value: null }, curl: { value: fl.curl },
        uTexture: { value: null }, value: { value: 0 },
        uPressure: { value: null }, uDivergence: { value: null },
        uDye: { value: null }, skyTop: { value: srgbToLinear(CONFIG.look.sky[0]) },
        skyBottom: { value: srgbToLinear(CONFIG.look.sky[2]) }, intensity: { value: fl.intensity },
      },
      depthTest: false,
      depthWrite: false,
    });
  }

  const rtOpts = {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
  };
  function double(w, h) {
    let read = new THREE.WebGLRenderTarget(w, h, rtOpts);
    let write = new THREE.WebGLRenderTarget(w, h, rtOpts);
    return {
      get read() { return read; },
      get write() { return write; },
      swap() { const t = read; read = write; write = t; },
      dispose() { read.dispose(); write.dispose(); },
      w, h,
    };
  }

  let velocity, dye, pressure, divergenceRT, curlRT, displayRT;
  let simTexel = new THREE.Vector2(), dyeTexel = new THREE.Vector2();
  let aspect = 1;

  function allocate() {
    [velocity, dye, pressure].forEach((d) => d && d.dispose());
    [divergenceRT, curlRT, displayRT].forEach((t) => t && t.dispose());
    // 窗口还没布局好时（宽高为 0）也要给出有效尺寸
    const vw = Math.max(1, window.innerWidth), vh = Math.max(1, window.innerHeight);
    aspect = vw / vh;
    const small = window.innerWidth < 720;
    const simShort = small ? fl.simResolution * 0.75 : fl.simResolution;
    const dyeShort = small ? fl.dyeResolution * 0.5 : fl.dyeResolution;
    const size = (s) => (aspect >= 1 ? [s * aspect, s] : [s, s / aspect]).map((v) => Math.max(8, Math.min(2048, Math.round(v))));
    const [sw, sh] = size(simShort);
    const [dw, dh] = size(dyeShort);
    velocity = double(sw, sh);
    pressure = double(sw, sh);
    dye = double(dw, dh);
    divergenceRT = new THREE.WebGLRenderTarget(sw, sh, rtOpts);
    curlRT = new THREE.WebGLRenderTarget(sw, sh, rtOpts);
    // 显示贴图也用半浮点：背景很暗，8 位会出现明显色带
    displayRT = displayRT || new THREE.WebGLRenderTarget(dw, dh, rtOpts);
    displayRT.setSize(dw, dh);
    simTexel.set(1 / sw, 1 / sh);
    dyeTexel.set(1 / dw, 1 / dh);
  }

  function pass(name, target, uniforms) {
    const m = mats[name];
    for (const k in uniforms) m.uniforms[k].value = uniforms[k];
    quad.material = m;
    renderer.setRenderTarget(target);
    renderer.render(quadScene, quadCamera);
  }

  function splat(x, y, dx, dy, color, radius) {
    pass("splat", velocity.write, {
      texelSize: simTexel, uTarget: velocity.read.texture, aspectRatio: aspect,
      point: new THREE.Vector2(x, y), color: new THREE.Vector3(dx, dy, 0), radius,
    });
    velocity.swap();
    pass("splat", dye.write, {
      texelSize: dyeTexel, uTarget: dye.read.texture, aspectRatio: aspect,
      point: new THREE.Vector2(x, y), color, radius,
    });
    dye.swap();
  }

  function step(dt) {
    const prev = renderer.getRenderTarget();
    const prevAutoClear = renderer.autoClear;
    renderer.autoClear = false;

    pass("curl", curlRT, { texelSize: simTexel, uVelocity: velocity.read.texture });
    pass("vorticity", velocity.write, { texelSize: simTexel, uVelocity: velocity.read.texture, uCurl: curlRT.texture, curl: fl.curl, dt });
    velocity.swap();
    pass("divergence", divergenceRT, { texelSize: simTexel, uVelocity: velocity.read.texture });
    pass("clear", pressure.write, { texelSize: simTexel, uTexture: pressure.read.texture, value: fl.pressureDecay });
    pressure.swap();
    for (let i = 0; i < fl.pressureIterations; i++) {
      pass("pressure", pressure.write, { texelSize: simTexel, uPressure: pressure.read.texture, uDivergence: divergenceRT.texture });
      pressure.swap();
    }
    pass("gradientSubtract", velocity.write, { texelSize: simTexel, uPressure: pressure.read.texture, uVelocity: velocity.read.texture });
    velocity.swap();
    pass("advection", velocity.write, { texelSize: simTexel, uVelocity: velocity.read.texture, uSource: velocity.read.texture, dt, dissipation: fl.velocityDissipation });
    velocity.swap();
    pass("advection", dye.write, { texelSize: simTexel, uVelocity: velocity.read.texture, uSource: dye.read.texture, dt, dissipation: fl.dyeDissipation });
    dye.swap();
    pass("display", displayRT, { texelSize: dyeTexel, uDye: dye.read.texture, intensity: fl.intensity });

    renderer.setRenderTarget(prev);
    renderer.autoClear = prevAutoClear;
  }

  // ── 声音 → 墨流 ──────────────────────────────
  const teal = srgbToLinear(fl.colors[0]);
  const coral = srgbToLinear(fl.colors[1]);
  const mint = srgbToLinear(fl.mint);
  let level = 0;
  let emitAcc = 0;
  let hue = 0;
  const pointer = { x: 0, y: 0, dx: 0, dy: 0, moved: false };
  window.addEventListener("pointermove", (e) => {
    const x = e.clientX / window.innerWidth, y = 1 - e.clientY / window.innerHeight;
    pointer.dx = x - pointer.x; pointer.dy = y - pointer.y;
    pointer.x = x; pointer.y = y;
    pointer.moved = true;
  }, { passive: true });

  function update(dt, state, hub) {
    dt = Math.min(dt, 1 / 30);
    const target = Math.min(1, Math.max(state?.energy || 0, (state?.instantEnergy || 0) * 0.8) * fl.gain);
    level += (target - level) * Math.min(1, dt * 5);

    // 出声：从风车附近向外吹出墨流，越响越多、越猛
    const rate = level > 0.03 ? fl.emitRate * (0.25 + level) : 0;
    emitAcc += rate * dt;
    const hx = hub ? hub.x : 0.5, hy = hub ? hub.y : 0.5;
    while (emitAcc >= 1) {
      emitAcc -= 1;
      hue = (hue + 0.17 + Math.random() * 0.2) % 1;
      // 从模型轮廓外围的一圈吹出（中心被蘑菇和风车挡住），方向向外再带一点旋转，像风车把气流甩出去
      const a = Math.random() * Math.PI * 2;
      const r = fl.emitRadius * (0.85 + Math.random() * 0.4);
      const x = hx + Math.cos(a) * r / Math.max(1, aspect), y = hy + Math.sin(a) * r * Math.min(1, aspect);
      const dir = a + 0.55 + (Math.random() - 0.5) * 0.5;
      const force = fl.force * (0.35 + level);
      // 平时青绿 / 薄荷；声音大时偶尔吹出一缕珊瑚橙，两色不混在同一团里，避免发褐
      const base = level > 0.5 && Math.random() < (level - 0.5) * 0.8 ? coral : (hue < 0.5 ? teal : mint);
      splat(x, y, Math.cos(dir) * force, Math.sin(dir) * force,
        base.clone().multiplyScalar(fl.dyeStrength * (0.5 + level)), fl.radius * (0.7 + level * 0.8));
    }
    // 光标划过：轻轻搅动
    if (pointer.moved) {
      pointer.moved = false;
      const sp = Math.hypot(pointer.dx, pointer.dy);
      if (sp > 0.0005) {
        splat(pointer.x, pointer.y, pointer.dx * fl.pointerForce, pointer.dy * fl.pointerForce,
          mint.clone().multiplyScalar(fl.dyeStrength * 0.3), fl.radius * 0.5);
      }
    }
    step(dt);
  }

  allocate();
  return {
    get texture() { return displayRT.texture; },
    update,
    resize: allocate,
  };
}
