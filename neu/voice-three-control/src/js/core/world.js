import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "../addons/postprocessing/EffectComposer.js";
import { RenderPass } from "../addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "../addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "../addons/postprocessing/ShaderPass.js";
import { OutputPass } from "../addons/postprocessing/OutputPass.js";
import { CONFIG } from "../config.js";
import { createFluidSky } from "../objects/fluidSky.js";

// 调色与暗角：四周轻微压暗，整体饱和度微调；只影响画面边缘，不改模型本身的颜色
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    vignette: { value: CONFIG.look.vignette },
    saturation: { value: CONFIG.look.saturation },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float vignette;
    uniform float saturation;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, saturation);
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - vignette * smoothstep(0.25, 0.85, dot(d, d) * 2.2);
      gl_FragColor = c;
    }
  `,
};

export function createWorld() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(CONFIG.scene.fog.color, CONFIG.scene.fog.near, CONFIG.scene.fog.far);

  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(0, 2.8, 8);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  // 背景：GPU 流体（不支持时自动退回静态渐变）
  const sky = createFluidSky(renderer);
  scene.background = sky.texture;

  // 后期：泛光让萤火虫和发光蘑菇有柔和的光晕；失败时退回直接渲染
  let composer = null;
  let bloomPass = null;
  try {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      CONFIG.look.bloom.strength,
      CONFIG.look.bloom.radius,
      CONFIG.look.bloom.threshold
    );
    composer.addPass(bloomPass);
    composer.addPass(new ShaderPass(GradeShader));
    composer.addPass(new OutputPass());
  } catch (error) {
    console.warn("[world] postprocessing disabled", error);
    composer = null;
  }

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 5;
  controls.maxDistance = 12;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.autoRotate = false;

  function isMobileViewport() {
    return window.innerWidth <= 720;
  }

  function getCurrentPolarAngle() {
    const offset = camera.position.clone().sub(controls.target);
    const radius = offset.length();
    if (radius === 0) {
      return Math.PI * 0.5;
    }

    return Math.acos(THREE.MathUtils.clamp(offset.y / radius, -1, 1));
  }

  function applyInteractionMode() {
    const isMobile = isMobileViewport();
    controls.enableZoom = !isMobile;

    if (isMobile) {
      const polar = getCurrentPolarAngle();
      controls.minPolarAngle = polar;
      controls.maxPolarAngle = polar;
      controls.rotateSpeed = 0.85;
    } else {
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = Math.PI * 0.49;
      controls.rotateSpeed = 1;
    }
  }

  let lastTouchEnd = 0;
  renderer.domElement.addEventListener(
    "touchend",
    (event) => {
      const now = window.performance.now();
      if (now - lastTouchEnd < 320) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    },
    { passive: false }
  );

  ["gesturestart", "gesturechange", "gestureend"].forEach((eventName) => {
    document.addEventListener(
      eventName,
      (event) => {
        event.preventDefault();
      },
      { passive: false }
    );
  });

  let framedObject = null;
  let framedPadding = 0.86;
  function frameObject(object, padding = 0.86) {
    framedObject = object;
    framedPadding = padding;
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) {
      return;
    }

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxSize = Math.max(size.x, size.y, size.z);
    const fitHeightDistance =
      maxSize / (2 * Math.tan((Math.PI * camera.fov) / 360));
    const fitWidthDistance = fitHeightDistance / camera.aspect;
    const isMobile = window.innerWidth <= 720;
    // 竖屏也要把整座岛放进画面：按宽度取景的距离也计入一部分
    const framingDistance = isMobile
      ? Math.max(fitHeightDistance, fitWidthDistance * 0.62)
      : Math.max(fitHeightDistance, fitWidthDistance);
    const framingPadding = isMobile ? 0.86 : padding;
    const distance = framingPadding * framingDistance;
    const direction = isMobile
      ? new THREE.Vector3(0, -0.03, 1).normalize()
      : new THREE.Vector3(0, 0.018, 1).normalize();
    const frontLift = isMobile
      ? new THREE.Vector3(0, maxSize * 0.09 - 0.9, 0)
      : new THREE.Vector3(0, maxSize * -0.012, 0);

    camera.position.copy(center).add(frontLift).add(direction.multiplyScalar(distance));
    camera.near = Math.max(distance / 100, 0.1);
    camera.far = Math.max(distance * 40, 200);
    camera.updateProjectionMatrix();

    controls.target.copy(center).add(frontLift);
    controls.minDistance = Math.max(distance * 0.25, 1.5);
    controls.maxDistance = Math.max(distance * 4, 12);
    applyInteractionMode();
    controls.update();
  }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    if (composer) {
      composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      composer.setSize(window.innerWidth, window.innerHeight);
    }
    sky.resize();
    // 横竖屏切换后重新取景
    if (framedObject) frameObject(framedObject, framedPadding);
    else applyInteractionMode();
  }

  function render() {
    controls.update();
    if (composer) composer.render();
    else renderer.render(scene, camera);
  }

  return {
    // 墨流从镜头对准的中心（风车附近）吹出：把它投影到屏幕坐标
    updateSky: (dt, t, state) => {
      const p = controls.target.clone().project(camera);
      sky.update(dt, state, { x: (p.x + 1) / 2, y: (p.y + 1) / 2 });
      scene.background = sky.texture;
    },
    camera,
    controls,
    frameObject,
    render,
    renderer,
    resize,
    scene,
  };
}
