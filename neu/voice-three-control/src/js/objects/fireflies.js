import * as THREE from "three";

// ── 场景参数（配合 normalizeContent targetSize=14）──────────
const FLOOR_Y        = 0.4;   // 粒子不能低于此高度（地面）
const CENTER_R       = 1.4;   // 中心圆柱排斥半径（模型主体区域）
const SCENE_HUES = [0.48, 0.40, 0.54, 0.74, 0.04, 0.12]; // teal/mint/cyan/violet/coral/gold

export function createFireflies(scene) {
  const count = 180;

  const pos        = new Float32Array(count * 3);
  const home       = new Float32Array(count * 3);
  const vel        = new Float32Array(count * 3);
  const velTarget  = new Float32Array(count * 3);
  const wanderT    = new Float32Array(count);

  const speedScale = new Float32Array(count);
  const turnRate   = new Float32Array(count);
  const maxDrift   = new Float32Array(count);
  const homeHue    = new Float32Array(count);
  const layer      = new Uint8Array(count);    // 0=低层 1=中层 2=高层

  const colorCur  = new Float32Array(count * 3);
  const colorDisp = new Float32Array(count * 3);
  const colorTgt  = new Float32Array(count * 3);
  const colorT    = new Float32Array(count);

  const bri    = new Float32Array(count);
  const briTgt = new Float32Array(count);
  const briT   = new Float32Array(count);

  const helper = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const s     = i * 3;
    const angle = Math.random() * Math.PI * 2;

    // ── 三层分布，各有占比 ─────────────────────────
    let radius, height, thisLayer;
    const r = Math.random();
    if (r < 0.50) {
      // 中层主体：围绕模型漂浮
      radius = 2.0 + Math.random() * 3.5;
      height = 0.8 + Math.random() * 4.5;
      thisLayer = 1;
    } else if (r < 0.75) {
      // 高层：风车顶部以上
      radius = 1.2 + Math.random() * 3.0;
      height = 5.0 + Math.random() * 5.0;
      thisLayer = 2;
    } else {
      // 外围低层：远一些，贴近地面
      radius = 4.5 + Math.random() * 3.5;
      height = 0.5 + Math.random() * 2.5;
      thisLayer = 0;
    }

    home[s]     = pos[s]     = Math.cos(angle) * radius;
    home[s + 1] = pos[s + 1] = height;
    home[s + 2] = pos[s + 2] = Math.sin(angle) * radius;
    layer[i] = thisLayer;

    // ── 个性参数 ────────────────────────────────────
    speedScale[i] = 0.2  + Math.random() * 1.4;  // 慢到快 7 倍差距
    turnRate[i]   = 0.35 + Math.random() * 2.6;  // 迟钝到灵活
    maxDrift[i]   = 1.2  + Math.random() * 3.0;  // 漂移范围

    // 色相：优先取场景主题色，偶尔完全随机
    homeHue[i] = Math.random() < 0.65
      ? SCENE_HUES[Math.floor(Math.random() * SCENE_HUES.length)]
        + (Math.random() - 0.5) * 0.06   // 小幅偏移让同色系不完全一样
      : Math.random();

    // lightness 0.50：饱和度最高，乘以 bri 后也不会变白
    helper.setHSL(homeHue[i], 1.0, 0.50);
    colorCur[s]      = colorTgt[s]      = helper.r;
    colorCur[s + 1]  = colorTgt[s + 1]  = helper.g;
    colorCur[s + 2]  = colorTgt[s + 2]  = helper.b;
    colorDisp[s]     = helper.r;
    colorDisp[s + 1] = helper.g;
    colorDisp[s + 2] = helper.b;

    // bri 控制可见度，最高 0.95（不超 1，防止截断变白）
    bri[i] = briTgt[i] = 0.55 + Math.random() * 0.35;

    // 完全错开计时器
    wanderT[i] = Math.random() * 2.0;
    colorT[i]  = Math.random() * 2.0;
    briT[i]    = Math.random() * 1.0;
  }

  const geometry  = new THREE.BufferGeometry();
  const posAttr   = new THREE.BufferAttribute(pos,      3);
  const colorAttr = new THREE.BufferAttribute(colorDisp, 3);
  geometry.setAttribute("position", posAttr);
  geometry.setAttribute("color",    colorAttr);

  const material = new THREE.PointsMaterial({
    size: 0.30,
    map: createGlowTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    alphaTest: 0.01,
  });

  scene.add(new THREE.Points(geometry, material));

  // ─── 排斥力：让粒子绕开模型中心 ─────────────────
  function applyExclusion(i) {
    const s  = i * 3;
    const px = pos[s];
    const py = pos[s + 1];
    const pz = pos[s + 2];

    // 地板排斥：Y 太低就向上推速度
    if (py < FLOOR_Y) {
      pos[s + 1] = FLOOR_Y;
      if (vel[s + 1] < 0) vel[s + 1] = Math.abs(vel[s + 1]) * 0.6;
    }

    // 中心圆柱排斥（xz 平面距离）
    const hr  = Math.sqrt(px * px + pz * pz);
    if (hr < CENTER_R && hr > 0.001) {
      // 推到圆柱外表面
      const scale = CENTER_R / hr;
      pos[s]     = px * scale;
      pos[s + 2] = pz * scale;
      // 速度投影到切线方向（去掉径向分量）
      const nx = px / hr;
      const nz = pz / hr;
      const dot = vel[s] * nx + vel[s + 2] * nz;
      if (dot < 0) { // 正在往里钻
        vel[s]     -= dot * nx * 1.2;
        vel[s + 2] -= dot * nz * 1.2;
      }
    }
  }

  // ─── 换方向目标 ───────────────────────────────────
  function pickVelTarget(i, soundDrive, towardHome) {
    const s   = i * 3;
    const spd = speedScale[i] * (0.35 + Math.random() * 0.8) * (1 + soundDrive * 2.0);

    if (towardHome) {
      const dx  = home[s]     - pos[s];
      const dy  = home[s + 1] - pos[s + 1];
      const dz  = home[s + 2] - pos[s + 2];
      const len = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;
      velTarget[s]     = (dx/len + (Math.random()-0.5)*0.7) * spd;
      velTarget[s + 1] = (dy/len + (Math.random()-0.5)*0.3) * spd;
      velTarget[s + 2] = (dz/len + (Math.random()-0.5)*0.7) * spd;
    } else {
      const theta = Math.random() * Math.PI * 2;
      // 高层粒子偏向横向漂移；低层偏向往上
      const phiRange = layer[i] === 2 ? 0.3 : 0.5;
      const phi      = (Math.random() - 0.5) * Math.PI * phiRange;
      const upBias   = layer[i] === 0 ? 0.3 + soundDrive * 0.4 : 0;
      velTarget[s]     = Math.cos(theta) * Math.cos(phi) * spd;
      velTarget[s + 1] = Math.sin(phi) * spd * 0.55 + upBias + soundDrive * 0.5;
      velTarget[s + 2] = Math.sin(theta) * Math.cos(phi) * spd;
    }
  }

  // ─── 换颜色目标 ───────────────────────────────────
  function pickColorTarget(i, soundDrive, micActive) {
    const s = i * 3;
    let hue;
    if (micActive && soundDrive > 0.05) {
      // 开麦：完全随机色相，跳变感更强
      hue = Math.random();
    } else {
      // 静默：主题色 + 小幅漂移
      const baseHue = SCENE_HUES[Math.floor(Math.random() * SCENE_HUES.length)];
      hue = (baseHue + (Math.random() - 0.5) * 0.12 + 1) % 1;
    }
    // lightness 固定 0.50，保持最高饱和度，不会变白
    helper.setHSL(hue, 1.0, 0.50);
    colorTgt[s]     = helper.r;
    colorTgt[s + 1] = helper.g;
    colorTgt[s + 2] = helper.b;
  }

  // ─── 主循环 ──────────────────────────────────────
  function update(dt, _t, reactiveState) {
    const safeDt     = Math.min(dt, 0.05);
    const instant    = Math.min(reactiveState.instantEnergy ?? reactiveState.energy ?? 0, 1);
    const soundDrive = Math.min(1, (reactiveState.energy ?? 0) * 0.8 + instant * 1.2);
    const micActive  = reactiveState.active === true;

    for (let i = 0; i < count; i++) {
      const s = i * 3;

      // ── 漂移方向 ─────────────────────────────────
      wanderT[i] -= safeDt;
      const dx    = pos[s]     - home[s];
      const dy    = pos[s + 1] - home[s + 1];
      const dz    = pos[s + 2] - home[s + 2];
      const dist2 = dx*dx + dy*dy + dz*dz;
      const tooFar = dist2 > maxDrift[i] * maxDrift[i];

      if (wanderT[i] <= 0 || tooFar) {
        pickVelTarget(i, soundDrive, tooFar);
        wanderT[i] = tooFar
          ? 0.15 + Math.random() * 0.35
          : micActive
            ? 0.25 + Math.random() * 0.8 / (1 + soundDrive)
            : 0.8  + Math.random() * 1.8;
      }

      // ── 速度插值（各粒子 turnRate 不同）──────────
      const lerp = Math.min(turnRate[i] * safeDt, 1);
      vel[s]     += (velTarget[s]     - vel[s])     * lerp;
      vel[s + 1] += (velTarget[s + 1] - vel[s + 1]) * lerp;
      vel[s + 2] += (velTarget[s + 2] - vel[s + 2]) * lerp;

      // ── 位置更新 ─────────────────────────────────
      pos[s]     += vel[s]     * safeDt;
      pos[s + 1] += vel[s + 1] * safeDt;
      pos[s + 2] += vel[s + 2] * safeDt;

      // ── 排斥（地面 + 模型中心）───────────────────
      applyExclusion(i);

      // ── 颜色插值 ─────────────────────────────────
      colorT[i] -= safeDt;
      if (colorT[i] <= 0) {
        pickColorTarget(i, soundDrive, micActive);
        colorT[i] = micActive && soundDrive > 0.05
          ? 0.05 + Math.random() * 0.25 / (1 + soundDrive * 2)
          : 0.4  + Math.random() * 1.2;
      }
      const cLerp = Math.min((micActive ? 0.06 + soundDrive * 0.22 : 0.018) * safeDt * 60, 1);
      colorCur[s]     += (colorTgt[s]     - colorCur[s])     * cLerp;
      colorCur[s + 1] += (colorTgt[s + 1] - colorCur[s + 1]) * cLerp;
      colorCur[s + 2] += (colorTgt[s + 2] - colorCur[s + 2]) * cLerp;

      // ── 亮度闪烁 ─────────────────────────────────
      briT[i] -= safeDt;
      if (briT[i] <= 0) {
        const flashChance = micActive ? 0.45 + soundDrive * 0.5 : 0.28;
        // bri 最高 0.95，不超 1.0，颜色永远不会截断成白
        briTgt[i] = Math.random() < flashChance
          ? 0.75 + Math.random() * 0.20  // 亮起：0.75~0.95
          : 0.25 + Math.random() * 0.30; // 暗下：0.25~0.55
        briT[i] = micActive && soundDrive > 0.05
          ? 0.04 + Math.random() * 0.22
          : 0.25 + Math.random() * 1.0;
      }
      bri[i] += (briTgt[i] - bri[i]) * Math.min(0.16 * safeDt * 60, 1);

      // 颜色永远保持原始色相，bri 只控制明暗
      colorDisp[s]     = colorCur[s]     * bri[i];
      colorDisp[s + 1] = colorCur[s + 1] * bri[i];
      colorDisp[s + 2] = colorCur[s + 2] * bri[i];
    }

    posAttr.needsUpdate   = true;
    colorAttr.needsUpdate = true;

    // 亮起靠 size 膨胀表现，不靠颜色超白
    const avgBri = bri.reduce((a, b) => a + b, 0) / count;
    material.opacity = 0.82 + reactiveState.brightness * 0.1 + soundDrive * 0.12;
    material.size    = 0.26 + avgBri * 0.18 + reactiveState.energy * 0.12 + instant * 0.16;
  }

  return { update };
}

// ── 更柔和的发光纹理 ─────────────────────────────────
function createGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const g   = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0,    "rgba(255, 255, 255, 1)");
  g.addColorStop(0.08, "rgba(230, 248, 255, 0.95)");
  g.addColorStop(0.25, "rgba(180, 230, 255, 0.75)");
  g.addColorStop(0.50, "rgba(120, 200, 255, 0.35)");
  g.addColorStop(0.78, "rgba(80,  160, 255, 0.08)");
  g.addColorStop(1,    "rgba(60,  140, 255, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
