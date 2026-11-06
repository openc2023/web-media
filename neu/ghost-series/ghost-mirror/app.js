// 破碎鬼镜 v0.2：有人靠近 → 镜面慢慢出现随机裂痕、污痕、四周冰霜 → 脸上长出裂痕、出现与本人不符的表情
import { FaceLandmarker, FilesetResolver, ImageSegmenter } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
// 多类分割：0 背景 1 头发 2 身体皮肤 3 脸部皮肤 4 衣服 5 其他（眼镜、帽子等）
const SEG_URL = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite";

const $ = (s) => document.querySelector(s);
const canvas = $("#stage");
const ctx = canvas.getContext("2d");
const video = $("#cam");
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ramp = (v, a, b) => clamp((v - a) / (b - a), 0, 1);
const rnd = (a, b) => a + Math.random() * (b - a);
const easeOut = (t) => 1 - (1 - t) ** 3;

// ---------- 参数 ----------
const DEFAULTS = {
  lang: "zh", deviceId: "", res: "720",
  rot: 0, tilt: 0, mirror: true, flipY: false, fit: "cover", zoom: 1, offX: 0, offY: 0,
  bright: 1, contrast: 1, sat: 1, sheen: 0.5, vignette: 0.6,
  nearRatio: 0.18, farScan: "off", faceConf: 0.5, yawLimit: 45, lostGrace: 0.5, recede: 8, smooth: 1.2, occlusion: true, debug: false, mesh: false,
  build: 30, frost: true, frostAmt: 0.85, stains: true, stainAmt: 0.75, cracks: true, crackCount: 6,
  light: true, lightAmt: 1, lightMode: "random", lightFlicker: true, ghostMask: true, maskTex: "random", maskAmt: 0.92, maskOffY: 0, maskScale: 1, maskGrow: 1, edgeFeather: 0.25, mouthLock: 1, maskFlicker: true, flickRate: 1,
  jumpFlash: true, jumpRate: 1, crackAmt: 0.9, maxFaces: 3, idleFx: 0.6, glitch: true, glitchRate: 1, pale: true, paleAmt: 0.85, faceCracks: true, expr: true, exprAmt: 1, eyes: true, volume: 0.7, ambience: true,
};
const CFG_KEY = "ghostMirrorCfg.v2";
let cfg = loadCfg();
function loadCfg() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(CFG_KEY) || "{}") }; }
  catch { return { ...DEFAULTS }; }
}
function saveCfg() { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch {} }

// 演出各层在“到场程度 level(0~1)”上的出现区间
const STAGE = { frost: [0, 0.6], stain: [0.08, 0.7], crack: [0.12, 0.82], light: [0.2, 0.6], pale: [0.3, 0.7], mask: [0.5, 0.8], face: [0.45, 0.8], expr: [0.6, 0.95], eyes: [0.85, 1] };

// ---------- 多语言 ----------
const T = (zh, en, ko) => ({ zh, en, ko });
const tr = (o) => (typeof o === "string" ? o : o[cfg.lang] || o.zh);

// ---------- 画布与视图 ----------
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, matchMedia("(pointer: coarse)").matches ? 1.5 : 2); // 手机像素比太高时限制到 1.5，省性能
  W = innerWidth; H = innerHeight;
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  fxLayer.width = canvas.width; fxLayer.height = canvas.height;
  frostDirty = true;
}
// 脸部效果先画在这层，再用脸部皮肤遮罩裁掉头发、手等挡住的部分
const fxLayer = document.createElement("canvas");
const fxCtx = fxLayer.getContext("2d");
addEventListener("resize", resize);

// 摄像头先按 0/90/180/270 转正到 frame，识别和显示都用 frame
const frame = document.createElement("canvas");
const fctx = frame.getContext("2d");
function updateFrame() {
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || video.readyState < 2) return false;
  const side = cfg.rot % 180 !== 0;
  const fw = side ? vh : vw, fh = side ? vw : vh;
  if (frame.width !== fw || frame.height !== fh) { frame.width = fw; frame.height = fh; }
  fctx.setTransform(1, 0, 0, 1, fw / 2, fh / 2);
  fctx.rotate(cfg.rot * Math.PI / 180);
  fctx.drawImage(video, -vw / 2, -vh / 2);
  return true;
}

// frame 像素 → 屏幕：缩放适配、微调角度、镜像、偏移
let VM = new DOMMatrix();
function updateView() {
  const fw = frame.width || 1280, fh = frame.height || 720;
  let s = cfg.fit === "cover" ? Math.max(W / fw, H / fh) : Math.min(W / fw, H / fh);
  s *= cfg.zoom;
  VM = new DOMMatrix()
    .translateSelf(W / 2 + cfg.offX * W, H / 2 + cfg.offY * H)
    .rotateSelf(cfg.tilt)
    .scaleSelf(cfg.mirror ? -s : s, cfg.flipY ? -s : s)
    .translateSelf(-fw / 2, -fh / 2);
}
const scr = (p) => ({ x: VM.a * p.x + VM.c * p.y + VM.e, y: VM.b * p.x + VM.d * p.y + VM.f });
const lmPx = (l) => ({ x: l.x * frame.width, y: l.y * frame.height });
function imageFilter() {
  return cfg.bright === 1 && cfg.contrast === 1 && cfg.sat === 1 ? "none"
    : `brightness(${cfg.bright}) contrast(${cfg.contrast}) saturate(${cfg.sat})`;
}
function drawFrameAt(c, src, sx, sy, sw, sh) {
  c.save(); c.transform(VM.a, VM.b, VM.c, VM.d, VM.e, VM.f); c.filter = imageFilter();
  if (sw) c.drawImage(src, sx, sy, sw, sh); else c.drawImage(src, 0, 0);
  c.restore();
}

// ---------- 声音（WebAudio 合成） ----------
let ac = null, master = null, droneGain = null;
function initAudio() {
  if (ac) { if (ac.state === "suspended") ac.resume(); return; }
  ac = new (window.AudioContext || window.webkitAudioContext)();
  const comp = ac.createDynamicsCompressor();
  master = ac.createGain(); master.gain.value = cfg.volume;
  master.connect(comp); comp.connect(ac.destination);
  // 持续低频嗡声，音量跟随 level
  droneGain = ac.createGain(); droneGain.gain.value = 0;
  const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 260;
  for (const [type, fr] of [["sawtooth", 44], ["sine", 47.3], ["triangle", 88.5]]) {
    const o = ac.createOscillator(); o.type = type; o.frequency.value = fr; o.connect(f); o.start();
  }
  const n = noise(4); n.loop = true; const nf = ac.createBiquadFilter(); nf.type = "bandpass"; nf.frequency.value = 3200; nf.Q.value = 0.7;
  const ng = ac.createGain(); ng.gain.value = 0.25; n.connect(nf); nf.connect(ng); ng.connect(droneGain); n.start();
  f.connect(droneGain); droneGain.connect(master);
}
function noise(dur) {
  const b = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource(); src.buffer = b; return src;
}
function env(g, t, peak, attack, decay) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}
function burst(t, dur, type, freq, vol) {
  const n = noise(dur + 0.05), f = ac.createBiquadFilter(), g = ac.createGain();
  f.type = type; f.frequency.value = freq; env(g, t, vol, 0.003, dur);
  n.connect(f); f.connect(g); g.connect(master); n.start(t);
}
function ping(t, freq, vol, decay) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.frequency.value = freq; env(g, t, vol, 0.002, decay);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + decay + 0.05);
}
function sndCrack(big) {
  if (!ac) return; const t = ac.currentTime;
  for (let i = 0; i < (big ? 9 : 5); i++) burst(t + i * 0.025 + Math.random() * 0.03, 0.02, "highpass", 3000, big ? 0.4 : 0.22);
  for (let i = 0; i < 4; i++) ping(t + Math.random() * 0.1, 3500 + Math.random() * 4000, 0.04, 0.06);
}
function sndTick() { if (ac) burst(ac.currentTime, 0.012, "highpass", 6000, 0.06); }

// ---------- 裂纹 ----------
function buildCrack(cx, cy, maxR, K) {
  const rings = [0];
  for (let r = maxR * rnd(0.12, 0.2); r < maxR; r *= rnd(1.5, 1.9)) rings.push(r);
  rings.push(maxR);
  const base = Math.random() * Math.PI * 2;
  const rays = [];
  for (let i = 0; i < K; i++) {
    const a = base + (i + rnd(-0.3, 0.3)) * Math.PI * 2 / K;
    const len = rnd(0.45, 1); // 每条射线长度不同，更像真实裂纹
    const pts = [{ x: cx, y: cy, r: 0 }];
    for (let j = 1; j < rings.length; j++) {
      const r = rings[j] * len, prev = pts[pts.length - 1];
      const aj = a + rnd(-0.12, 0.12);
      const B = { x: cx + Math.cos(aj) * r, y: cy + Math.sin(aj) * r, r };
      for (let k = 1; k < 3; k++) {
        const t = k / 3, off = rnd(-0.06, 0.06) * (B.r - prev.r);
        const nx = -(B.y - prev.y), ny = B.x - prev.x, nl = Math.hypot(nx, ny) || 1;
        pts.push({ x: lerp(prev.x, B.x, t) + nx / nl * off, y: lerp(prev.y, B.y, t) + ny / nl * off, r: lerp(prev.r, B.r, t) });
      }
      pts.push(B);
    }
    rays.push({ pts, ring: rings.map((r) => ({ x: cx + Math.cos(a) * r * len, y: cy + Math.sin(a) * r * len, r: r * len })) });
  }
  const links = [];
  for (let j = 1; j < rings.length - 1; j++)
    for (let i = 0; i < K; i++)
      if (Math.random() < (j < 2 ? 0.8 : 0.35)) links.push({ i, j, bend: rnd(-0.15, 0.15) });
  return { cx, cy, K, rays, links, maxR };
}

function drawCrack(c, cr, R, alpha) {
  if (alpha <= 0 || R <= 0) return;
  c.save(); c.globalAlpha = alpha; c.lineCap = "round"; c.lineJoin = "round";
  for (const pass of [0, 1]) {
    c.strokeStyle = pass ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.5)";
    c.lineWidth = pass ? 1.1 : 2.8;
    c.beginPath();
    for (const ray of cr.rays) {
      const p = ray.pts; c.moveTo(p[0].x, p[0].y);
      for (let k = 1; k < p.length; k++) {
        if (p[k].r <= R) { c.lineTo(p[k].x, p[k].y); continue; }
        const t = (R - p[k - 1].r) / (p[k].r - p[k - 1].r);
        if (t > 0) c.lineTo(lerp(p[k - 1].x, p[k].x, t), lerp(p[k - 1].y, p[k].y, t));
        break;
      }
    }
    for (const l of cr.links) {
      const A = cr.rays[l.i].ring[l.j], B = cr.rays[(l.i + 1) % cr.K].ring[l.j];
      if (Math.max(A.r, B.r) > R) continue;
      c.moveTo(A.x, A.y);
      c.quadraticCurveTo((A.x + B.x) / 2 + (A.y - B.y) * l.bend, (A.y + B.y) / 2 + (B.x - A.x) * l.bend, B.x, B.y);
    }
    c.stroke();
  }
  const gr = Math.min(40, cr.maxR * 0.22);
  const g = c.createRadialGradient(cr.cx, cr.cy, 0, cr.cx, cr.cy, gr);
  g.addColorStop(0, "rgba(255,255,255,0.75)"); g.addColorStop(0.4, "rgba(230,240,240,0.25)"); g.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = g; c.beginPath(); c.arc(cr.cx, cr.cy, gr, 0, Math.PI * 2); c.fill();
  c.restore();
}

// ---------- 污痕（程序生成的小贴图） ----------
function makeStain(type) {
  const c = document.createElement("canvas");
  const x = c.getContext("2d");
  if (type === "hand") {
    c.width = 260; c.height = 300;
    x.filter = "blur(1.5px)"; x.fillStyle = x.strokeStyle = "rgba(170,160,145,0.22)"; x.lineCap = "round";
    x.beginPath(); x.ellipse(130, 200, 52, 62, 0, 0, Math.PI * 2); x.fill();
    const fingers = [[-0.42, 78, 20], [-0.14, 96, 21], [0.12, 100, 21], [0.38, 82, 19]];
    for (const [a, len, w] of fingers) {
      x.lineWidth = w; x.beginPath(); x.moveTo(130 + Math.sin(a) * 40, 160);
      x.lineTo(130 + Math.sin(a) * (40 + len), 160 - Math.cos(a) * len); x.stroke();
    }
    x.lineWidth = 22; x.beginPath(); x.moveTo(85, 215); x.lineTo(35, 160); x.stroke();
    // 指纹纹路：挖掉细圈
    x.filter = "none"; x.globalCompositeOperation = "destination-out"; x.strokeStyle = "rgba(0,0,0,0.5)"; x.lineWidth = 1.2;
    for (let i = 4; i < 70; i += 4) { x.beginPath(); x.ellipse(130, 195, i, i * 1.15, 0.2, 0, Math.PI * 2); x.stroke(); }
    // 往下拖的油痕
    x.globalCompositeOperation = "source-over"; x.filter = "blur(3px)"; x.fillStyle = "rgba(160,150,135,0.1)";
    x.fillRect(95, 230, 70, 70);
  } else if (type === "drip") {
    c.width = 160; c.height = 420;
    x.filter = "blur(0.8px)";
    for (let d = 0; d < 6; d++) {
      let px = rnd(15, 145), w = rnd(2.5, 6);
      const len = rnd(120, 400);
      x.strokeStyle = `rgba(${rnd(60, 90) | 0},${rnd(40, 55) | 0},${rnd(35, 45) | 0},${rnd(0.25, 0.45)})`;
      x.lineCap = "round"; x.beginPath(); x.moveTo(px, 0);
      for (let y = 0; y < len; y += 10) { px += rnd(-1.2, 1.2); x.lineWidth = w * (1 - y / len * 0.6); x.lineTo(px, y); x.stroke(); x.beginPath(); x.moveTo(px, y); }
      x.fillStyle = x.strokeStyle; x.beginPath(); x.ellipse(px, len, w * 0.9, w * 1.3, 0, 0, Math.PI * 2); x.fill();
    }
  } else if (type === "mold") {
    c.width = c.height = 240;
    x.filter = "blur(2px)";
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() ** 0.6 * 100;
      x.fillStyle = `rgba(${rnd(25, 45) | 0},${rnd(30, 45) | 0},${rnd(20, 30) | 0},${rnd(0.1, 0.3)})`;
      x.beginPath(); x.arc(120 + Math.cos(a) * r, 120 + Math.sin(a) * r, rnd(2, 12) * (1 - r / 140), 0, Math.PI * 2); x.fill();
    }
  } else {
    c.width = c.height = 280;
    x.filter = "blur(7px)";
    for (let i = 0; i < 30; i++) {
      x.fillStyle = Math.random() < 0.6 ? `rgba(130,120,105,${rnd(0.04, 0.09)})` : `rgba(255,255,255,${rnd(0.03, 0.07)})`;
      x.beginPath(); x.ellipse(rnd(60, 220), rnd(60, 220), rnd(15, 60), rnd(8, 30), rnd(0, 3), 0, Math.PI * 2); x.fill();
    }
    x.filter = "blur(1px)"; x.strokeStyle = "rgba(200,190,175,0.12)"; x.lineWidth = 2; // 擦拭的弧线
    for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(140, 160, 40 + i * 12, rnd(3.4, 3.8), rnd(5.6, 6.0)); x.stroke(); }
  }
  return c;
}

// ---------- 冰霜（按离边缘的深度分层预渲染，逐层显现） ----------
const FROST_BANDS = 8, FROST_SCALE = 0.6;
let frostLayers = [], frostDirty = true, frostCacheAt = -1e9;
const frostCache = document.createElement("canvas"), frostCacheX = frostCache.getContext("2d");
function buildFrost() {
  frostDirty = false;
  const fw = Math.round(W * FROST_SCALE), fh = Math.round(H * FROST_SCALE);
  frostLayers = Array.from({ length: FROST_BANDS }, () => {
    const c = document.createElement("canvas"); c.width = fw; c.height = fh;
    const x = c.getContext("2d"); x.lineCap = "round"; x.strokeStyle = "rgba(228,242,252,0.55)";
    return x;
  });
  const reach = Math.min(fw, fh) * 0.3;
  // 边界加低频噪声，冰霜前沿不会是方框
  const ph = [rnd(0, 9), rnd(0, 9), rnd(0, 9)];
  const wob = (px, py) => 0.22 * Math.sin(px * 0.011 + ph[0]) * Math.sin(py * 0.013 + ph[1]) + 0.13 * Math.sin((px + py) * 0.027 + ph[2]);
  const band = (px, py) => {
    const d = Math.min(px, py, fw - px, fh - py) / reach + wob(px, py);
    return d >= 1 ? -1 : Math.max(0, Math.floor(d * FROST_BANDS)); // 超出范围的不画，中间保持干净
  };
  // 磨砂雾块
  for (let i = 0; i < 900; i++) {
    const e = Math.random() * 4 | 0, t = Math.random(), d = Math.random() ** 1.6 * reach * 1.1;
    const px = e === 0 ? t * fw : e === 1 ? fw - d : e === 2 ? t * fw : d;
    const py = e === 0 ? d : e === 1 ? t * fh : e === 2 ? fh - d : t * fh;
    const b = band(px, py); if (b < 0) continue;
    const l = frostLayers[b], r = rnd(8, 40);
    const g = l.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, `rgba(225,238,248,${rnd(0.04, 0.1)})`); g.addColorStop(1, "rgba(225,238,248,0)");
    l.fillStyle = g; l.fillRect(px - r, py - r, r * 2, r * 2);
  }
  const seg = (x0, y0, x1, y1, w) => {
    const b = band(x1, y1); if (b < 0) return;
    const l = frostLayers[b]; l.lineWidth = w; l.beginPath(); l.moveTo(x0, y0); l.lineTo(x1, y1); l.stroke();
  };
  const grow = (px, py, ang, len, gen) => {
    const step = 4;
    for (let d = 0; d < len; d += step) {
      ang += rnd(-0.04, 0.04); // 冰晶基本是直的
      const nx = px + Math.cos(ang) * step, ny = py + Math.sin(ang) * step;
      if (nx < 0 || ny < 0 || nx > fw || ny > fh) return;
      seg(px, py, nx, ny, [1.1, 0.8, 0.55, 0.4][gen]);
      if (d % 8 < step) { // 两侧对称的 60° 羽状细刺，越往尖端越短
        const tl = (gen < 2 ? rnd(4, 10) : rnd(2, 5)) * (1 - d / len);
        for (const sgn of [1, -1]) {
          const ta = ang + sgn * Math.PI / 3;
          seg(nx, ny, nx + Math.cos(ta) * tl, ny + Math.sin(ta) * tl, 0.35);
        }
      }
      if (gen < 3 && Math.random() < 0.05) grow(nx, ny, ang + (Math.random() < 0.5 ? 1 : -1) * Math.PI / 3, (len - d) * rnd(0.35, 0.6), gen + 1);
      px = nx; py = ny;
    }
  };
  const seeds = 260;
  for (let i = 0; i < seeds; i++) {
    let px, py, ang;
    const e = Math.random() * 4 | 0, t = Math.random() < 0.35 ? (Math.random() < 0.5 ? Math.random() * 0.15 : 1 - Math.random() * 0.15) : Math.random();
    if (e === 0) { px = t * fw; py = 0; ang = Math.PI / 2; }
    else if (e === 1) { px = fw; py = t * fh; ang = Math.PI; }
    else if (e === 2) { px = t * fw; py = fh; ang = -Math.PI / 2; }
    else { px = 0; py = t * fh; ang = 0; }
    grow(px, py, ang + rnd(-0.9, 0.9), reach * (0.06 + Math.random() ** 2 * 0.55), 0);
  }
  // 细小冰晶点
  for (let i = 0; i < 1500; i++) {
    const px = Math.random() * fw, py = Math.random() * fh, b = band(px, py);
    if (b < 0) continue;
    const l = frostLayers[b]; l.fillStyle = `rgba(235,245,255,${rnd(0.1, 0.4)})`; l.fillRect(px, py, rnd(0.6, 1.6), rnd(0.6, 1.6));
  }
}

function drawFrost(c, f, now) {
  if (f <= 0) return;
  const tt = now / 1000;
  // 边缘白雾
  const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * lerp(0.7, 0.52, f), W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, "rgba(200,222,238,0)"); g.addColorStop(1, `rgba(205,225,240,${0.32 * f})`);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // 8 层先合成到一张缓存图（每秒更新约 10 次），每帧只画一次
  if (now - frostCacheAt > 100 || frostCache.width !== frostLayers[0].canvas.width) {
    frostCacheAt = now;
    const fc = frostLayers[0].canvas;
    if (frostCache.width !== fc.width || frostCache.height !== fc.height) { frostCache.width = fc.width; frostCache.height = fc.height; }
    frostCacheX.clearRect(0, 0, frostCache.width, frostCache.height);
    for (let k = 0; k < FROST_BANDS; k++) {
      // 每层带一点各自的起伏，冰霜前沿像在慢慢生长、退缩
      const a = clamp(f * FROST_BANDS * 1.15 - k + 0.35 * Math.sin(tt * 0.6 + k * 1.7), 0, 1);
      if (a <= 0) continue;
      frostCacheX.globalAlpha = a; frostCacheX.drawImage(frostLayers[k].canvas, 0, 0);
    }
    frostCacheX.globalAlpha = 1;
  }
  c.drawImage(frostCache, 0, 0, W, H);
  c.fillStyle = `rgba(150,185,215,${0.07 * f})`; c.fillRect(0, 0, W, H);
}

// ---------- 演出状态 ----------
let level = 0, force = false;
let fx = null;
function resetFx() {
  fx = { cracks: [], stains: [], faceCracks: [], faceTarget: -1, used: false };
  const n = cfg.crackCount;
  for (let i = 0; i < n; i++) {
    const thr = lerp(STAGE.crack[0], STAGE.crack[1], (i + Math.random() * 0.7) / n);
    fx.cracks.push({ thr, u: rnd(0.06, 0.94), v: rnd(0.06, 0.94), r: rnd(0.08, 0.22), K: 5 + (Math.random() * 6 | 0), cr: null, born: 0 });
  }
  const types = ["smudge", "drip", "mold", "smudge", "drip"]; // 手印已去掉，之后换成提供的素材
  types.forEach((type, i) => {
    let u, v;
    do { u = rnd(0.05, 0.95); v = type === "drip" ? rnd(0, 0.35) : rnd(0.08, 0.92); }
    while (Math.abs(u - 0.5) < 0.18 && Math.abs(v - 0.45) < 0.25);
    fx.stains.push({ img: makeStain(type), u, v, rot: type === "drip" ? rnd(-0.05, 0.05) : rnd(-0.6, 0.6), s: rnd(0.75, 1.2),
      thr: lerp(STAGE.stain[0], STAGE.stain[1], i / types.length) });
  });
}

// ---------- 每个人随机的“面相” ----------
const LOOKS = [
  { id: "corpse", light: "cold", tint: [190, 212, 228], pale: 1.0 },   // 尸白冷光
  { id: "sick", light: "green", tint: [160, 215, 150], pale: 0.9 },    // 发绿病态
  { id: "blood", light: "red", tint: [235, 150, 140], pale: 0.55 },    // 发红血色
  { id: "torch", light: "warm", tint: [205, 205, 212], pale: 0.8 },    // 手电暖光
];
function makeProfile() {
  const look = LOOKS[Math.random() * LOOKS.length | 0];
  return {
    look,
    lightColor: cfg.lightMode === "random" ? look.light : cfg.lightMode,
    lightX: rnd(-0.6, 0.6),          // 光从左下 / 正下 / 右下
    offset: rnd(-0.06, 0.08),        // 各阶段整体提前或推后
    expr: Math.random() < 0.8, eyes: Math.random() < 0.6,
    exprAmt: rnd(0.7, 1.3), crackN: 2 + (Math.random() * 3 | 0),
    mask: Math.random() < 0.85, maskTex: ["base", "blink", "veins"][Math.random() * 3 | 0],
    crackColor: CRACK_COLORS[Math.random() * CRACK_COLORS.length | 0],
  };
}

// ---------- 识别 ----------
let landmarker = null, faces = [], people = [], nextPersonId = 1, faceVis = 0, track = "none";
let lastVideoTime = -1;

function analyze(res) {
  const out = [];
  const lms = res.faceLandmarks || [], mats = res.facialTransformationMatrixes || [], bss = res.faceBlendshapes || [];
  const aspect = frame.height / frame.width;
  for (let i = 0; i < lms.length; i++) {
    const l = lms[i], a = l[234], b = l[454];
    const width = Math.hypot(a.x - b.x, (a.y - b.y) * aspect);
    const m = mats[i] && mats[i].data;
    const yaw = m ? Math.atan2(m[8], m[10]) * 180 / Math.PI : NaN; // 头部姿态矩阵的绕 Y 轴分量
    let smile = 0;
    if (bss[i]) for (const c of bss[i].categories) if (c.categoryName === "mouthSmileLeft" || c.categoryName === "mouthSmileRight") smile += c.score / 2;
    const near = width >= cfg.nearRatio, frontal = Number.isFinite(yaw) && Math.abs(yaw) <= cfg.yawLimit;
    out.push({ lm: l, width, yaw, smile, cx: l[1].x, cy: l[1].y, near, frontal, ok: near && frontal });
  }
  return out;
}

// ---------- 远距离：分块检测 ----------
// 整幅画面送进模型会被缩小，远处的小脸（只占画面宽 5% 左右）检测不到。
// 打开后把画面切成几块、每帧轮流检测一块；已经找到的小脸再每帧在他附近裁一块精确跟踪。
let tileLm = null, tileLoading = false, tileIdx = 0, tileFaces = [], roiFaces = [];
const tileC = document.createElement("canvas"), tctx = tileC.getContext("2d");
function tileRects() {
  const [nx, ny] = cfg.farScan === "3x2" ? [3, 2] : [2, 2], ov = 1.3, out = [];
  const w = Math.min(1, ov / nx), h = Math.min(1, ov / ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++)
    out.push({ x: clamp((i + 0.5) / nx - w / 2, 0, 1 - w), y: clamp((j + 0.5) / ny - h / 2, 0, 1 - h), w, h });
  return out;
}
function roiRect(p) { // 以鼻尖为中心、约 3.5 倍脸宽的方块
  const fw = frame.width, fh = frame.height, side = clamp(p.width * fw * 3.5, 160, Math.min(fw, fh));
  const w = side / fw, h = side / fh;
  return { x: clamp(p.cx - w / 2, 0, 1 - w), y: clamp(p.cy - h / 2, 0, 1 - h), w, h };
}
function detectCrop(r) {
  const fw = frame.width, fh = frame.height, sw = r.w * fw, sh = r.h * fh, k = Math.min(1, 640 / Math.max(sw, sh));
  tileC.width = Math.round(sw * k); tileC.height = Math.round(sh * k);
  tctx.drawImage(frame, r.x * fw, r.y * fh, sw, sh, 0, 0, tileC.width, tileC.height);
  const res = tileLm.detect(tileC);
  const lms = (res.faceLandmarks || []).map((l) => l.map((q) => ({ x: r.x + q.x * r.w, y: r.y + q.y * r.h, z: q.z * r.w })));
  return analyze({ faceLandmarks: lms, facialTransformationMatrixes: res.facialTransformationMatrixes, faceBlendshapes: res.faceBlendshapes });
}
function mergeFar(base, now) {
  if (cfg.farScan === "off") return base;
  if (!tileLm) {
    if (!tileLoading) { tileLoading = true; loadLandmarker("IMAGE").then((m) => { tileLm = m; }).catch((e) => { console.warn("分块检测模型加载失败", e); tileLoading = false; }); }
    return base;
  }
  const rects = tileRects();
  try {
    tileIdx = (tileIdx + 1) % rects.length;
    tileFaces[tileIdx] = { t: now, faces: detectCrop(rects[tileIdx]) };
    tileFaces.length = rects.length;
    roiFaces = [];
    for (const p of people.filter((q) => q.seen && q.width < 0.12).slice(0, 4)) roiFaces.push(...detectCrop(roiRect(p)));
  } catch (e) { console.warn(e); }
  // 合并去重：整幅画面的结果优先，其次每帧裁的，最后是轮流扫的块
  const all = [...base];
  const add = (f) => { if (!all.some((g) => Math.hypot(g.cx - f.cx, g.cy - f.cy) < Math.max(g.width, f.width) * 0.6)) all.push(f); };
  roiFaces.forEach(add);
  for (const tf of tileFaces) if (tf && now - tf.t < rects.length * 70 + 250) tf.faces.forEach(add);
  return all;
}

// 多人跟踪：每张脸按位置匹配到已有的人；新出现的人拿到新的随机面相和自己的进度
const pickFace = (f) => ({ lm: f.lm, cx: f.cx, cy: f.cy, width: f.width, yaw: f.yaw, smile: f.smile, near: f.near, frontal: f.frontal, ok: f.ok });
function newPerson(f, now) {
  const prof = makeProfile();
  const cracks = [];
  for (let i = 0; i < prof.crackN; i++) cracks.push({ thr: lerp(STAGE.face[0], STAGE.face[1], (i + Math.random() * 0.6) / prof.crackN), path: null, born: 0 });
  return { id: nextPersonId++, ...pickFace(f), level: 0, lastSeen: now, seen: true, vis: 0, sm: null, slm: null, exprMode: 0, prof, cracks, active: false,
    flk: { until: 0, next: now + rnd(1500, 4000) }, crackSnd: false };
}
// 返回 ok（有合格的人）/ hold（有人但不合格，或短暂丢失）/ none
function updatePeople(now, dt, fresh) {
  if (fresh) {
    const pairs = [];
    people.forEach((p, pi) => faces.forEach((f, fi) => {
      const d = Math.hypot(f.cx - p.cx, f.cy - p.cy); if (d < clamp(p.width * 1.2, 0.03, 0.15)) pairs.push([d, pi, fi]); // 匹配距离跟脸大小走
    }));
    pairs.sort((a, b) => a[0] - b[0]);
    const usedP = new Set(), usedF = new Set();
    for (const [, pi, fi] of pairs) {
      if (usedP.has(pi) || usedF.has(fi)) continue;
      usedP.add(pi); usedF.add(fi);
      Object.assign(people[pi], pickFace(faces[fi]), { lastSeen: now, seen: true });
    }
    people.forEach((p, pi) => { if (!usedP.has(pi)) p.seen = false; });
    faces.forEach((f, fi) => { if (!usedF.has(fi)) people.push(newPerson(f, now)); });
  }
  // 短暂丢失（容忍时间内）保留，避免闪烁
  people = people.filter((p) => p.seen || now - p.lastSeen < cfg.lostGrace * 1000);
  people.sort((a, b) => b.width - a.width);
  let anyOk = false;
  people.forEach((p, i) => {
    p.active = i < cfg.maxFaces;
    if (p.active && p.ok && p.seen) { p.level = Math.min(1, p.level + dt / cfg.build); anyOk = true; }
    p.vis = p.seen ? Math.min(1, p.vis + dt * 4) : Math.max(0, p.vis - dt * 3);
    if (fresh && p.seen) p.slm = smoothLandmarks(p, now);
    p.exprMode += ((p.smile > 0.35 ? 1 : 0) - p.exprMode) * Math.min(1, dt * 2);
  });
  return anyOk ? "ok" : people.length ? "hold" : "none";
}

// One Euro 防抖：静止时强平滑，快速移动时放开，减少拖影。
// 整张脸共用一个截止频率（按鼻尖速度算），这样平滑时脸形不会变形。
function smoothLandmarks(p, now) {
  const lm = p.lm, n = lm.length, fw = frame.width, fh = frame.height;
  let sm = p.sm;
  if (!sm || sm.n !== n) {
    sm = p.sm = { n, t: now, x: new Float32Array(n), y: new Float32Array(n), v: 0, nx: lm[1].x * fw, ny: lm[1].y * fh,
      out: lm.map((q) => ({ x: q.x, y: q.y, z: q.z })) };
    for (let i = 0; i < n; i++) { sm.x[i] = lm[i].x * fw; sm.y[i] = lm[i].y * fh; }
    return sm.out;
  }
  const dt = Math.max(1e-3, (now - sm.t) / 1000); sm.t = now;
  const alpha = (cut) => 1 / (1 + 1 / (2 * Math.PI * cut * dt));
  const nx = lm[1].x * fw, ny = lm[1].y * fh;
  const speed = Math.hypot(nx - sm.nx, ny - sm.ny) / dt; sm.nx = nx; sm.ny = ny;
  sm.v += alpha(1) * (speed - sm.v);
  const a = alpha(cfg.smooth + 0.012 * sm.v);
  for (let i = 0; i < n; i++) {
    sm.x[i] += a * (lm[i].x * fw - sm.x[i]); sm.y[i] += a * (lm[i].y * fh - sm.y[i]);
    sm.out[i].x = sm.x[i] / fw; sm.out[i].y = sm.y[i] / fh; sm.out[i].z = lm[i].z;
  }
  return sm.out;
}

// 脸部皮肤遮罩：低分辨率分割，结果放在 maskC（与 frame 同比例）
// 另有一张“非手非衣服”遮罩 occC（保留头发 / 脸 / 其他），给鬼脸贴图用：手挡住时扣掉，眼睛眉毛不受影响
let segmenter = null, maskReady = false, occReady = false, maskAt = 0, maskImg = null, occImg = null;
const segIn = document.createElement("canvas"), segCtx = segIn.getContext("2d");
const maskC = document.createElement("canvas"), maskX = maskC.getContext("2d");
const occC = document.createElement("canvas"), occX = occC.getContext("2d");
function runSegment(now) {
  const sw = 320, sh = Math.max(8, Math.round(320 * frame.height / frame.width));
  if (segIn.width !== sw || segIn.height !== sh) {
    segIn.width = maskC.width = occC.width = sw; segIn.height = maskC.height = occC.height = sh;
    maskImg = maskX.createImageData(sw, sh); occImg = occX.createImageData(sw, sh); maskReady = occReady = false;
  }
  segCtx.drawImage(frame, 0, 0, sw, sh);
  segmenter.segmentForVideo(segIn, now, (res) => {
    const m = res.categoryMask; if (!m) return;
    const a = m.getAsUint8Array(); if (a.length !== sw * sh) return;
    const d = maskImg.data, o = occImg.data;
    for (let i = 0; i < a.length; i++) { d[i * 4 + 3] = a[i] === 3 ? 255 : 0; o[i * 4 + 3] = a[i] === 2 || a[i] === 4 ? 0 : 255; }
    maskX.putImageData(maskImg, 0, 0); occX.putImageData(occImg, 0, 0); maskReady = occReady = true; maskAt = now;
  });
}

function updateLevel(dt) {
  const prev = level;
  if (track === "ok" || force) level = Math.min(1, level + dt / cfg.build);
  else if (track === "none") level = Math.max(0, level - dt / cfg.recede);
  if (level > prev && Math.random() < dt * 6 * level && cfg.frost) sndTick(); // 结霜细响
  if (level === 0 && fx.used) resetFx();
  if (level > 0) fx.used = true;
  if (droneGain) droneGain.gain.setTargetAtTime(cfg.ambience ? level * 0.22 : 0, ac.currentTime, 0.4);
}

// ---------- 脸部裂痕：自由生长的细碎裂纹，用网格三角面的重心坐标“钉”在脸上，跟着脸动 ----------
// 形状不沿网格连线走，所以看不出网格
const FACE_STARTS = [10, 109, 338, 67, 297, 50, 280, 152, 148, 377, 234, 454];
function baryOf(P, x, y) {
  for (let q = 0; q < TRIS.length; q += 3) {
    const a = P[TRIS[q]], b = P[TRIS[q + 1]], c = P[TRIS[q + 2]];
    const d = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
    if (Math.abs(d) < 1e-9) continue;
    const u = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / d;
    const v = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / d;
    const w = 1 - u - v;
    if (u >= -1e-3 && v >= -1e-3 && w >= -1e-3) return { q, u, v, w };
  }
  return null;
}
function buildFacePath(lm) {
  if (!TRIS) buildTris();
  const P = lm.slice(0, 468).map(lmPx);
  const fwid = Math.hypot(P[234].x - P[454].x, P[234].y - P[454].y);
  const step = fwid * 0.018;
  const walk = (x, y, heading, len) => {
    const pts = [], base = heading;
    for (let d = 0; d <= len; d += step) {
      const b = baryOf(P, x, y); if (!b) break; // 走出脸就停
      pts.push(b);
      // 小幅抖动 + 偶尔急转，整体仍朝原方向，像真的裂纹
      heading += rnd(-0.38, 0.38) + (Math.random() < 0.1 ? rnd(-0.9, 0.9) : 0);
      heading = lerp(heading, base, 0.12);
      const s = step * rnd(0.6, 1.4);
      x += Math.cos(heading) * s; y += Math.sin(heading) * s;
    }
    return pts;
  };
  const si = FACE_STARTS[Math.random() * FACE_STARTS.length | 0];
  // 起点从轮廓往里挪一点，确保在网格内
  const sx = lerp(P[si].x, P[1].x, 0.08), sy = lerp(P[si].y, P[1].y, 0.08);
  const toC = Math.atan2(P[1].y - sy, P[1].x - sx);
  const main = walk(sx, sy, toC + rnd(-0.7, 0.7), fwid * rnd(0.3, 0.65));
  const branches = [];
  for (let i = 3; i < main.length - 2; i++) {
    if (Math.random() < 0.1) {
      const A = baryPx(P, main[i]), B = baryPx(P, main[i + 1]);
      const a = Math.atan2(B.y - A.y, B.x - A.x) + (Math.random() < 0.5 ? 1 : -1) * rnd(0.5, 1.1);
      const br = walk(A.x, A.y, a, fwid * rnd(0.05, 0.18));
      if (br.length > 2) branches.push({ at: i, pts: br });
    }
  }
  return { main, branches };
}
// 重心坐标 → 当前关键点下的位置
function baryPx(P, b) {
  const A = P[TRIS[b.q]], B = P[TRIS[b.q + 1]], C = P[TRIS[b.q + 2]];
  return { x: A.x * b.u + B.x * b.v + C.x * b.w, y: A.y * b.u + B.y * b.v + C.y * b.w };
}

// 三层：外圈淡阴影（皮肤凹陷）→ 深色裂缝 → 下缘一道细高光（裂口边）
const CRACK_PASSES = [
  { color: "rgba(60,20,12,0.22)", w: 2.6, off: 0 },
  { color: "rgba(28,8,6,0.82)", w: 1, off: 0 },
  { color: "rgba(255,232,220,0.38)", w: 0.3, off: 0.7 },
];
function strokePath(c, pts, prog, w) {
  const n = (pts.length - 1) * prog;
  if (n <= 0) return;
  for (const pass of CRACK_PASSES) {
    c.strokeStyle = pass.color;
    for (let k = 0; k < Math.ceil(n); k++) {
      const A = pts[k], B = pts[k + 1], t = Math.min(1, n - k);
      c.lineWidth = pass.w * w * (1 - k / pts.length * 0.75) * (0.75 + 0.5 * ((k * 7919) % 13) / 13); // 粗细不均
      c.beginPath();
      c.moveTo(A.x + pass.off, A.y + pass.off);
      c.lineTo(lerp(A.x, B.x, t) + pass.off, lerp(A.y, B.y, t) + pass.off);
      c.stroke();
    }
  }
}

const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
function drawFaceCracks(c, now, lm) {
  const S = (i) => scr(lmPx(lm[i]));
  const a = S(234), b = S(454), w = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y) * 0.008);
  const L = fxCtx;
  L.setTransform(1, 0, 0, 1, 0, 0); L.clearRect(0, 0, fxLayer.width, fxLayer.height);
  L.setTransform(DPR, 0, 0, DPR, 0, 0);
  L.save();
  // 先裁到脸部外轮廓，裂痕不会跑到脸外
  L.beginPath(); FACE_OVAL.forEach((i, k) => { const p = S(i); if (k) L.lineTo(p.x, p.y); else L.moveTo(p.x, p.y); }); L.closePath(); L.clip();
  L.lineCap = "round";
  let any = false;
  const P = lm.slice(0, 468).map(lmPx);
  const toS = (b) => scr(baryPx(P, b));
  for (const fc of cur.cracks) {
    if (!fc.path || fc.path.main.length < 2) continue;
    any = true;
    const prog = easeOut(clamp((now - fc.born) / 2500, 0, 1)) * clamp((cur.level - cur.prof.offset - fc.thr) / 0.04 + 1, 0, 1);
    strokePath(L, fc.path.main.map(toS), prog, w);
    for (const br of fc.path.branches) {
      const bp = clamp((prog * (fc.path.main.length - 1) - br.at) / (br.pts.length * 0.6), 0, 1);
      if (bp > 0) strokePath(L, br.pts.map(toS), bp, w * 0.6);
    }
  }
  L.restore();
  if (!any) return;
  applySkinMask(L, now, 1);
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = faceVis; c.drawImage(fxLayer, 0, 0); c.restore();
}

// 只保留“脸部皮肤”像素：头发、手、眼镜挡住的地方被盖住
let fakeActive = false;
function applySkinMask(L, now, blur) {
  if (fakeActive || !(cfg.occlusion && maskReady && now - maskAt < 400)) return;
  L.save(); L.setTransform(DPR, 0, 0, DPR, 0, 0); L.globalCompositeOperation = "destination-in";
  L.transform(VM.a, VM.b, VM.c, VM.d, VM.e, VM.f); L.filter = `blur(${blur}px)`;
  L.drawImage(maskC, 0, 0, frame.width, frame.height);
  L.restore();
}

// ---------- 底光：用人脸网格三角面的法线做几何近似补光（思路同 Relight-Lite） ----------
let TRIS = null;
function buildTris() {
  const adj = Array.from({ length: 468 }, () => new Set());
  for (const e of FaceLandmarker.FACE_LANDMARKS_TESSELATION) {
    if (e.start < 468 && e.end < 468) { adj[e.start].add(e.end); adj[e.end].add(e.start); }
  }
  const out = [];
  for (let a = 0; a < 468; a++) for (const b of adj[a]) if (b > a) for (const c of adj[b]) if (c > b && adj[a].has(c)) out.push(a, b, c);
  TRIS = new Uint16Array(out);
}
const LIGHT_COLORS = { warm: [255, 214, 160], cold: [170, 205, 255], green: [150, 255, 175], red: [255, 90, 70] };
const LIGHT_SCALE = 0.2;
const shadeC = document.createElement("canvas"), shadeX = shadeC.getContext("2d");
const glowC = document.createElement("canvas"), glowX = glowC.getContext("2d");
const blurC = document.createElement("canvas"), blurX = blurC.getContext("2d");
let flick = 1;
function drawUnderLight(c, now, lm, amt) {
  if (!TRIS) buildTris();
  const sw = Math.max(8, Math.round(W * LIGHT_SCALE)), sh = Math.max(8, Math.round(H * LIGHT_SCALE));
  if (shadeC.width !== sw || shadeC.height !== sh) { shadeC.width = glowC.width = sw; shadeC.height = glowC.height = sh; }
  // 手电筒式闪烁：慢慢起伏，偶尔一暗
  const t = now / 1000;
  const target = cfg.lightFlicker ? 0.9 + 0.08 * Math.sin(t * 17) * Math.sin(t * 5.3) - (Math.random() < 0.025 ? 0.35 : 0) : 1;
  flick += (target - flick) * 0.5;
  const k = amt * flick;
  const col = LIGHT_COLORS[cur.prof.lightColor] || LIGHT_COLORS.warm;

  // 顶点换到屏幕空间（z 按同样比例），法线朝向镜头
  const zs = Math.sqrt(Math.abs(VM.a * VM.d - VM.b * VM.c)) * frame.width;
  const V = new Float32Array(468 * 3);
  for (let i = 0; i < 468; i++) {
    const p = scr(lmPx(lm[i]));
    V[i * 3] = p.x * LIGHT_SCALE; V[i * 3 + 1] = p.y * LIGHT_SCALE; V[i * 3 + 2] = lm[i].z * zs * LIGHT_SCALE;
  }
  // 光从下方、略靠前照上来（屏幕 y 向下，z 越小越靠近镜头）
  let lx = cur.prof.lightX, ly = 1, lz = -0.5; const ll = Math.hypot(lx, ly, lz); lx /= ll; ly /= ll; lz /= ll;
  shadeX.setTransform(1, 0, 0, 1, 0, 0); shadeX.clearRect(0, 0, sw, sh);
  glowX.setTransform(1, 0, 0, 1, 0, 0); glowX.clearRect(0, 0, sw, sh);
  // 顶点法线 = 相邻三角面法线累加（按面积加权），再按顶点算明暗，三角面取三个顶点的平均：过渡平滑，看不出三角块
  const N = new Float32Array(468 * 3);
  for (let q = 0; q < TRIS.length; q += 3) {
    const a = TRIS[q] * 3, b = TRIS[q + 1] * 3, d = TRIS[q + 2] * 3;
    const ux = V[b] - V[a], uy = V[b + 1] - V[a + 1], uz = V[b + 2] - V[a + 2];
    const vx = V[d] - V[a], vy = V[d + 1] - V[a + 1], vz = V[d + 2] - V[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nz > 0) { nx = -nx; ny = -ny; nz = -nz; }
    for (const i of [a, b, d]) { N[i] += nx; N[i + 1] += ny; N[i + 2] += nz; }
  }
  const SV = new Float32Array(468);
  for (let i = 0; i < 468; i++) {
    const nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2], nl = Math.hypot(nx, ny, nz) || 1;
    SV[i] = Math.max(0, (nx * lx + ny * ly + nz * lz) / nl) ** 1.5;
  }
  for (let q = 0; q < TRIS.length; q += 3) {
    const a = TRIS[q] * 3, b = TRIS[q + 1] * 3, d = TRIS[q + 2] * 3;
    const s = (SV[TRIS[q]] + SV[TRIS[q + 1]] + SV[TRIS[q + 2]]) / 3;
    const v = Math.round(255 * (0.28 + 0.72 * s));
    shadeX.fillStyle = `rgb(${v},${v},${v})`;
    glowX.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${(0.6 * s ** 1.2).toFixed(3)})`;
    for (const X of [shadeX, glowX]) {
      X.beginPath(); X.moveTo(V[a], V[a + 1]); X.lineTo(V[b], V[b + 1]); X.lineTo(V[d], V[d + 1]); X.closePath(); X.fill();
      X.strokeStyle = X.fillStyle; X.lineWidth = 0.6; X.stroke(); // 盖住三角形之间的细缝
    }
  }
  const S = (i) => scr(lmPx(lm[i]));
  const fa = S(234), fb = S(454), fw = Math.hypot(fa.x - fb.x, fa.y - fb.y);
  // 在低分辨率小图上模糊（便宜），放大时双线性插值自然平滑
  const blur = Math.max(0.8, fw * 0.04 * LIGHT_SCALE);
  for (const [src, X] of [[shadeC, shadeX], [glowC, glowX]]) {
    if (blurC.width !== sw || blurC.height !== sh) { blurC.width = sw; blurC.height = sh; }
    blurX.setTransform(1, 0, 0, 1, 0, 0); blurX.clearRect(0, 0, sw, sh); blurX.filter = `blur(${blur}px)`; blurX.drawImage(src, 0, 0); blurX.filter = "none";
    X.setTransform(1, 0, 0, 1, 0, 0); X.clearRect(0, 0, sw, sh); X.drawImage(blurC, 0, 0);
  }
  const L = fxCtx;
  // 背景整体压暗，让脸上的光更突出（多人时每帧只压一次）
  if (!frameDarkened) {
    frameDarkened = true;
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = `rgba(0,0,0,${0.28 * amt})`; c.fillRect(0, 0, canvas.width, canvas.height); c.restore();
  }
  // 暗部：multiply
  for (const [src, mode, alpha] of [[shadeC, "multiply", k], [glowC, "screen", k]]) {
    L.setTransform(1, 0, 0, 1, 0, 0); L.clearRect(0, 0, fxLayer.width, fxLayer.height);
    L.setTransform(DPR, 0, 0, DPR, 0, 0);
    L.drawImage(src, 0, 0, W, H);
    applySkinMask(L, now, 1.5);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = mode; c.globalAlpha = alpha * faceVis;
    c.drawImage(fxLayer, 0, 0); c.restore();
  }
  // 下巴下方的光源光晕（照到脖子和衣服）
  const ch = S(152), gx = ch.x, gy = ch.y + fw * 0.55;
  const g = c.createRadialGradient(gx, gy, 0, gx, gy, fw * 1.1);
  g.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${0.35 * k * faceVis})`); g.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
  c.save(); c.globalCompositeOperation = "screen"; c.fillStyle = g; c.fillRect(gx - fw * 1.1, gy - fw * 1.1, fw * 2.2, fw * 2.2); c.restore();
}

// 脸色惨白：把当前画面（已含表情变形）去色提亮、偏青灰，限制在脸部范围
function drawPale(c, now, lm, amt) {
  const S = (i) => scr(lmPx(lm[i]));
  const L = fxCtx;
  L.setTransform(1, 0, 0, 1, 0, 0); L.clearRect(0, 0, fxLayer.width, fxLayer.height);
  const look = cur.prof.look, tc = look.tint;
  // 只处理脸所在的区域（加边），不对整屏做滤镜
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const i of FACE_OVAL) { const p = S(i); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
  const pad = (x1 - x0) * 0.1;
  const bx = Math.max(0, (x0 - pad) * DPR) | 0, by = Math.max(0, (y0 - pad) * DPR) | 0;
  const bw = Math.min(canvas.width - bx, (x1 - x0 + pad * 2) * DPR) | 0, bh = Math.min(canvas.height - by, (y1 - y0 + pad * 2) * DPR) | 0;
  if (bw < 4 || bh < 4) return;
  L.filter = `grayscale(${0.85 * amt * look.pale}) brightness(${1 + 0.38 * amt * look.pale}) contrast(${1 - 0.12 * amt})`;
  L.drawImage(canvas, bx, by, bw, bh, bx, by, bw, bh);
  L.filter = "none";
  L.setTransform(DPR, 0, 0, DPR, 0, 0);
  L.globalCompositeOperation = "source-atop";
  L.fillStyle = `rgba(${tc[0]},${tc[1]},${tc[2]},${(look.id === "corpse" || look.id === "torch" ? 0.22 : 0.32) * amt})`; L.fillRect(0, 0, W, H);
  // 眼下青黑
  for (const [a, b, d] of [[33, 133, 145], [263, 362, 374]]) {
    const A = S(a), B = S(b), D = S(d);
    const r = Math.hypot(A.x - B.x, A.y - B.y) * 0.7, cx = (A.x + B.x) / 2, cy = D.y + r * 0.25;
    const g = L.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(55,45,70,${0.45 * amt})`); g.addColorStop(1, "rgba(55,45,70,0)");
    L.fillStyle = g; L.beginPath(); L.ellipse(cx, cy, r, r * 0.5, Math.atan2(B.y - A.y, B.x - A.x), 0, Math.PI * 2); L.fill();
  }
  // 软边脸部轮廓
  L.globalCompositeOperation = "destination-in";
  const a = S(234), b = S(454), fw = Math.hypot(a.x - b.x, a.y - b.y);
  L.filter = `blur(${Math.max(2, fw * 0.04)}px)`; L.fillStyle = "#000";
  L.beginPath(); FACE_OVAL.forEach((i, k) => { const p = S(i); if (k) L.lineTo(p.x, p.y); else L.moveTo(p.x, p.y); }); L.closePath(); L.fill();
  L.filter = "none"; L.globalCompositeOperation = "source-over";
  applySkinMask(L, now, 2);
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = faceVis; c.drawImage(fxLayer, 0, 0); c.restore();
}

// ---------- 鬼脸贴图：官方 canonical_face_model 的 UV，用 WebGL 把贴图贴到观众脸上 ----------
// 贴图按 MediaPipe 人脸 UV 布局绘制；GIF 用 ImageDecoder 逐帧解码后循环播放
const FACE_TEX = [
  { id: "base", url: "assets/face_base.webp" },
  { id: "blink", url: "assets/face_blink.gif" },
  { id: "veins", url: "assets/face_veins.gif" },
];
const glC = document.createElement("canvas");
// 测试用假脸：用官方模型的 3D 顶点投影出一张轻轻晃动的脸（“模拟有人”且没检测到真脸时使用）
let canonVerts = null;
function fakeFace(now) {
  const t = now / 1000, yaw = Math.sin(t * 0.5) * 0.35, k = 0.3 / 15.3, ky = k * frame.width / frame.height;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), lm = [];
  const yM = canonVerts[13 * 3 + 1], open = Math.max(0, Math.sin(t * 1.1)) * 1.6; // 假脸一张一合，用来看锁嘴
  for (let i = 0; i < 468; i++) {
    const x = canonVerts[i * 3], z = canonVerts[i * 3 + 2];
    let y = canonVerts[i * 3 + 1];
    if (y < yM - 0.05 && i !== 13) y -= open * clamp((yM - y) / 1.5, 0, 1);
    const rx = x * cy + z * sy, rz = -x * sy + z * cy;
    lm.push({ x: 0.5 + rx * k + Math.sin(t * 0.3) * 0.02, y: 0.42 - y * ky, z: -rz * k });
  }
  for (let i = 468; i < 478; i++) lm.push({ ...lm[i < 473 ? 468 - 1 : 1] }); // 虹膜点占位
  const width = Math.hypot(lm[234].x - lm[454].x, (lm[234].y - lm[454].y) * frame.height / frame.width);
  return { lm, width, yaw: yaw * 180 / Math.PI, smile: 0, cx: lm[1].x, cy: lm[1].y, near: true, frontal: true, ok: true, fake: true };
}
let gl = null, glLoc = null, glPos = null, faceTris = null, faceReady = false;
let meshUV = null, glUVDefault = null, meshFeat = null, crackAffine = null;
// 脸部轮廓外再加一圈顶点（36 个），把面具往外扩：额头扩得多（带出头发），两侧少（避开耳朵）
const NV = 468 + 36;
let ringG = null, drawTris = null, vEdge = null, glAlphaBuf = null, alphaFor = -1;
function edgeAlpha(f) {
  const out = new Float32Array(NV), w = Math.max(0.01, f);
  for (let i = 0; i < NV; i++) {
    const t = clamp((vEdge[i * 2 + 1] - vEdge[i * 2]) / w, 0, 1);
    out[i] = t * t * (3 - 2 * t);
  }
  return out;
}
const glPosData = new Float32Array(NV * 3);
function extendUV(uv) {
  const out = new Float32Array(NV * 2); out.set(uv);
  let cu = 0, cv = 0; for (const i of FACE_OVAL) { cu += uv[i * 2] / FACE_OVAL.length; cv += uv[i * 2 + 1] / FACE_OVAL.length; }
  FACE_OVAL.forEach((i, k) => {
    out[(468 + k) * 2] = clamp(cu + (uv[i * 2] - cu) * ringG[k], 0, 1);
    out[(468 + k) * 2 + 1] = clamp(cv + (uv[i * 2 + 1] - cv) * ringG[k], 0, 1);
  });
  return out;
}
// 裂纹 GIF（透明底、正脸布局）：9 帧先长后退；三处裂纹圈中心（GIF 归一化坐标，量自第 5 帧）
const CRACK_SRC = { id: "cracks", url: "assets/face_cracks.gif" };
const CRACK_FEAT = [[0.28, 0.41], [0.67, 0.40], [0.50, 0.78]];
const CRACK_COLORS = [[150, 10, 20], [40, 150, 60], [60, 200, 230], [130, 40, 170], [10, 6, 6], [210, 150, 40]];
// 三对点求仿射 [x' y'] = A·[x y 1]，返回两行系数
function solveAffine(src, dst) {
  const [[x1, y1], [x2, y2], [x3, y3]] = src;
  const det = x1 * (y2 - y3) - y1 * (x2 - x3) + (x2 * y3 - x3 * y2);
  const row = (k) => {
    const [a, b, c] = [dst[0][k], dst[1][k], dst[2][k]];
    return [(a * (y2 - y3) - y1 * (b - c) + (b * y3 - c * y2)) / det,
      (x1 * (b - c) - a * (x2 - x3) + (x2 * c - x3 * b)) / det,
      (x1 * (y2 * c - y3 * b) - y1 * (x2 * c - x3 * b) + a * (x2 * y3 - x3 * y2)) / det];
  };
  return [row(0), row(1)];
}
// 在贴图里找画出来的黑眼洞和嘴（暗像素加权重心），和网格的眼睛、嘴比较
function measureTexture(img) {
  const N = 256, c = document.createElement("canvas"); c.width = c.height = N;
  const x = c.getContext("2d"); x.drawImage(img, 0, 0, N, N);
  const px = x.getImageData(0, 0, N, N).data;
  const blob = (c0, rx, ry, thr) => {
    let sx = 0, sy = 0, n = 0;
    for (let v = Math.max(0, (c0[1] - ry) * N | 0); v < Math.min(N, (c0[1] + ry) * N); v++)
      for (let u = Math.max(0, (c0[0] - rx) * N | 0); u < Math.min(N, (c0[0] + rx) * N); u++) {
        const i = (v * N + u) * 4, L = 0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2];
        if (L < thr && px[i + 3] > 128) { const w = thr - L; sx += u * w; sy += v * w; n += w; }
      }
    return n ? [sx / n / N, sy / n / N] : null;
  };
  return { R: blob(meshFeat.R, 0.09, 0.1, 40), L: blob(meshFeat.L, 0.09, 0.1, 40), M: blob(meshFeat.M, 0.07, 0.035, 70) };
}
// 去掉贴图背景（底图是浅灰底、GIF 是黑底）：从四边洪水填充出和边框连通的背景色区域，
// 往里多收 2px 再羽化，作为透明遮罩。只认连通区域，脸上颜色相近的皮肤和黑眼洞不会被抠掉
function bgMaskCanvas(img) {
  const w = img.width, h = img.height, c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d"); x.drawImage(img, 0, 0);
  const px = x.getImageData(0, 0, w, h).data;
  const corner = [0, w - 1, (h - 1) * w, h * w - 1].map((i) => [px[i * 4], px[i * 4 + 1], px[i * 4 + 2]]);
  const bg = [0, 1, 2].map((k) => corner.reduce((s, c0) => s + c0[k], 0) / 4);
  const tol = (bg[0] + bg[1] + bg[2]) / 3 > 128 ? 34 : 7; // 黑底时收紧，否则会吃进深色头发
  const isBg = new Uint8Array(w * h), q = new Int32Array(w * h);
  let qh = 0, qt = 0;
  const near = (i) => Math.abs(px[i * 4] - bg[0]) + Math.abs(px[i * 4 + 1] - bg[1]) + Math.abs(px[i * 4 + 2] - bg[2]) < tol * 3 || px[i * 4 + 3] < 20;
  const push = (i) => { if (!isBg[i] && near(i)) { isBg[i] = 1; q[qt++] = i; } };
  for (let u = 0; u < w; u++) { push(u); push((h - 1) * w + u); }
  for (let v = 0; v < h; v++) { push(v * w); push(v * w + w - 1); }
  while (qh < qt) {
    const i = q[qh++], u = i % w;
    if (u > 0) push(i - 1); if (u < w - 1) push(i + 1); if (i >= w) push(i - w); if (i < w * (h - 1)) push(i + w);
  }
  const m = x.createImageData(w, h);
  for (let i = 0; i < w * h; i++) m.data[i * 4 + 3] = isBg[i] ? 0 : 255;
  x.putImageData(m, 0, 0);
  // 收边 + 羽化：先模糊，再把半透明边往里压
  const e = Math.max(2, Math.round(w / 300));
  const o = document.createElement("canvas"); o.width = w; o.height = h;
  const ox = o.getContext("2d"); ox.filter = `blur(${e}px)`; ox.drawImage(c, 0, 0); ox.filter = "none";
  const md = ox.getImageData(0, 0, w, h);
  for (let i = 3; i < md.data.length; i += 4) md.data[i] = clamp((md.data[i] - 140) * 2.2, 0, 255);
  ox.putImageData(md, 0, 0);
  return o;
}
function applyBgMask(img, mask) {
  const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
  const x = c.getContext("2d"); x.drawImage(img, 0, 0);
  x.globalCompositeOperation = "destination-in"; x.drawImage(mask, 0, 0, c.width, c.height);
  return c;
}
// 按测量结果在眼睛、嘴附近局部平滑地挪 UV（高斯衰减），其他部位不动
function calibratedUV(feat) {
  const out = new Float32Array(meshUV);
  const pts = [];
  for (const [k, sig] of [["R", 0.07], ["L", 0.07], ["M", 0.05]]) {
    const f = feat[k], m = meshFeat[k]; if (!f) continue;
    const dx = clamp(f[0] - m[0], -0.06, 0.06), dy = clamp(f[1] - m[1], -0.08, 0.08);
    pts.push({ m, dx, dy, s2: 2 * sig * sig });
  }
  for (let i = 0; i < 468; i++) {
    const u = meshUV[i * 2], v = meshUV[i * 2 + 1];
    for (const p of pts) {
      const w = Math.exp(-((u - p.m[0]) ** 2 + (v - p.m[1]) ** 2) / p.s2);
      out[i * 2] += p.dx * w; out[i * 2 + 1] += p.dy * w;
    }
  }
  return out;
}
async function loadFaceAssets() {
  const d = await (await fetch("assets/face_uv.json")).json();
  faceTris = new Uint16Array(d.tris);
  canonVerts = d.verts;
  // 外圈扩张系数：按轮廓点在 UV 里的方向，朝上的（额头）多扩
  {
    let cu = 0, cv = 0; for (const i of FACE_OVAL) { cu += d.uv[i * 2] / FACE_OVAL.length; cv += d.uv[i * 2 + 1] / FACE_OVAL.length; }
    ringG = FACE_OVAL.map((i) => {
      const du = d.uv[i * 2] - cu, dv = d.uv[i * 2 + 1] - cv, l = Math.hypot(du, dv) || 1;
      return 1.02 + 0.25 * Math.max(0, -dv / l) ** 1.5; // 两侧几乎不扩（不带出耳朵），往上带出头发
    });
  }
  // 轮廓和外圈之间补三角面
  const ring = [];
  FACE_OVAL.forEach((a, k) => {
    const k2 = (k + 1) % FACE_OVAL.length, b = FACE_OVAL[k2], A = 468 + k, B = 468 + k2;
    ring.push(a, b, B, a, B, A);
  });
  drawTris = new Uint16Array([...faceTris, ...ring]);
  // 边缘渐变：每个顶点在 UV 里离中心的距离 d（轮廓 = 1），和它那个方向外圈的位置 dRing；
  // 透明度 = smoothstep((dRing - d) / 渐变宽度)，外圈全透明，往里逐渐不透明
  {
    let cu = 0, cv = 0; for (const i of FACE_OVAL) { cu += d.uv[i * 2] / FACE_OVAL.length; cv += d.uv[i * 2 + 1] / FACE_OVAL.length; }
    const polar = FACE_OVAL.map((i, k) => ({ a: Math.atan2(d.uv[i * 2 + 1] - cv, d.uv[i * 2] - cu), r: Math.hypot(d.uv[i * 2] - cu, d.uv[i * 2 + 1] - cv), g: ringG[k] }))
      .sort((p, q) => p.a - q.a);
    const at = (a) => {
      let j = polar.findIndex((p) => p.a > a); if (j < 0) j = 0;
      const p1 = polar[j], p0 = polar[(j - 1 + polar.length) % polar.length];
      let span = p1.a - p0.a; if (span <= 0) span += Math.PI * 2;
      let off = a - p0.a; if (off < 0) off += Math.PI * 2;
      const t = clamp(off / span, 0, 1);
      return [lerp(p0.r, p1.r, t), lerp(p0.g, p1.g, t)];
    };
    vEdge = new Float32Array(NV * 2);
    for (let i = 0; i < 468; i++) {
      const du = d.uv[i * 2] - cu, dv = d.uv[i * 2 + 1] - cv, [R, G] = at(Math.atan2(dv, du));
      vEdge[i * 2] = Math.hypot(du, dv) / R; vEdge[i * 2 + 1] = G;
    }
    for (let k = 0; k < FACE_OVAL.length; k++) { vEdge[(468 + k) * 2] = ringG[k]; vEdge[(468 + k) * 2 + 1] = ringG[k]; }
    for (const i of FACE_OVAL) vEdge[i * 2] = 1;
  }
  const alpha = edgeAlpha(cfg.edgeFeather); alphaFor = cfg.edgeFeather;
  gl = glC.getContext("webgl", { premultipliedAlpha: false, alpha: true, depth: true, antialias: true });
  if (!gl) throw new Error("WebGL 不可用");
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, `
    attribute vec3 aPos; attribute vec2 aUV, aCUV; attribute float aA; uniform vec2 uRes;
    varying vec2 vUV, vCUV; varying float vA;
    void main() { vUV = aUV; vCUV = aCUV; vA = aA; vec2 p = aPos.xy / uRes * 2.0 - 1.0; gl_Position = vec4(p.x, -p.y, clamp(aPos.z, -1.0, 1.0), 1.0); }`));
  // 片元：鬼脸贴图（校准后的 UV + 手动偏移/缩放）叠上裂纹 GIF（仿射映射到网格 UV，染成随机颜色）
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, `
    precision mediump float;
    uniform sampler2D uTex, uCrack; uniform float uMaskOp, uCrackOp, uScale; uniform vec2 uOff;
    uniform vec3 uCA, uCB, uCrackCol; varying vec2 vUV, vCUV; varying float vA;
    void main() {
      vec4 b = texture2D(uTex, (vUV - 0.5) / uScale + 0.5 - uOff);
      float ba = b.a * uMaskOp;
      vec3 cu = vec3(vCUV, 1.0);
      vec2 c2 = vec2(dot(uCA, cu), dot(uCB, cu));
      float ca = 0.0;
      if (c2.x > 0.0 && c2.x < 1.0 && c2.y > 0.0 && c2.y < 1.0) ca = texture2D(uCrack, c2).a * uCrackOp;
      float a = ba + ca * (1.0 - ba);
      vec3 rgb = (b.rgb * ba * (1.0 - ca) + uCrackCol * ca) / max(a, 0.0001);
      gl_FragColor = vec4(rgb, a * vA);
    }`));
  gl.linkProgram(prog); gl.useProgram(prog);
  const U = (n) => gl.getUniformLocation(prog, n);
  glLoc = { pos: gl.getAttribLocation(prog, "aPos"), uv: gl.getAttribLocation(prog, "aUV"), cuv: gl.getAttribLocation(prog, "aCUV"),
    a: gl.getAttribLocation(prog, "aA"), res: U("uRes"), maskOp: U("uMaskOp"), crackOp: U("uCrackOp"), scale: U("uScale"), off: U("uOff"),
    ca: U("uCA"), cb: U("uCB"), crackCol: U("uCrackCol") };
  gl.uniform1i(U("uTex"), 0); gl.uniform1i(U("uCrack"), 1);
  const buf = (data, loc, size, usage) => {
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, usage);
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); return b;
  };
  meshUV = new Float32Array(d.uv);
  glUVDefault = buf(extendUV(meshUV), glLoc.uv, 2, gl.STATIC_DRAW);
  buf(extendUV(meshUV), glLoc.cuv, 2, gl.STATIC_DRAW); // 裂纹按原始网格 UV 映射，始终对准真眼睛和嘴
  glAlphaBuf = buf(alpha, glLoc.a, 1, gl.DYNAMIC_DRAW);
  // 裂纹 GIF 的仿射：网格 UV（右眼、左眼、嘴中心）→ GIF 里三处裂纹圈的中心
  const avg = (ids) => ids.reduce((s, i) => [s[0] + meshUV[i * 2] / ids.length, s[1] + meshUV[i * 2 + 1] / ids.length], [0, 0]);
  meshFeat = { R: avg([33, 133, 159, 145]), L: avg([263, 362, 386, 374]), M: avg([13, 14, 78, 308]) };
  crackAffine = solveAffine([meshFeat.R, meshFeat.L, meshFeat.M], CRACK_FEAT);
  glPos = buf(glPosData, glLoc.pos, 3, gl.DYNAMIC_DRAW);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, drawTris, gl.STATIC_DRAW);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  faceReady = true;
  await Promise.all([...FACE_TEX.map((s) => loadTexSource(s, true)), loadTexSource(CRACK_SRC, false)]);
}
async function loadTexSource(s, calibrate) {
  s.frames = [];
  try {
    if (s.url.endsWith(".gif") && "ImageDecoder" in window) {
      const dec = new ImageDecoder({ data: await (await fetch(s.url)).arrayBuffer(), type: "image/gif" });
      await dec.tracks.ready;
      const n = dec.tracks.selectedTrack.frameCount;
      for (let i = 0; i < n; i++) {
        const r = await dec.decode({ frameIndex: i });
        const dur = r.image.duration ? r.image.duration / 1000 : 100; // 微秒 → 毫秒
        s.frames.push({ img: await createImageBitmap(r.image), dur: Math.max(20, dur) });
        r.image.close();
      }
    } else {
      // 用 onload 而不是 img.decode()：后者在后台标签页里可能一直不返回
      const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error("load " + s.url)); im.src = s.url; });
      s.frames.push({ img, dur: 1e9 });
    }
    s.total = s.frames.reduce((a, f) => a + f.dur, 0);
    if (calibrate) {
      s.feat = measureTexture(s.frames[0].img);
      const mask = bgMaskCanvas(s.frames[0].img); // 用第一帧算背景遮罩，套到所有帧
      for (const f of s.frames) f.img = applyBgMask(f.img, mask);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, extendUV(calibratedUV(s.feat)), gl.STATIC_DRAW);
      s.uvBuf = b;
    }
    gl.activeTexture(gl.TEXTURE0);
    s.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, s.tex);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    s.cur = -1; s.ready = true;
  } catch (e) { console.warn("贴图加载失败", s.url, e); }
}
function texFor(pr) {
  const want = cfg.maskTex === "random" ? pr.maskTex : cfg.maskTex;
  return FACE_TEX.find((s) => s.id === want && s.ready) || FACE_TEX.find((s) => s.ready);
}
const gifFrame = (src, now) => {
  let t = now % src.total, fi = 0;
  while (fi < src.frames.length - 1 && t >= src.frames[fi].dur) { t -= src.frames[fi].dur; fi++; }
  return fi;
};
function bindFrame(unit, src, fi) {
  gl.activeTexture(unit); gl.bindTexture(gl.TEXTURE_2D, src.tex);
  if (src.cur !== fi) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src.frames[fi].img); src.cur = fi; }
}
// maskOp：鬼脸贴图不透明度；crackOp / crackFi / crackCol：裂纹 GIF 的不透明度、帧、颜色
function drawGhostMask(c, now, lm, maskOp, src, crackOp, crackFi, crackCol) {
  if (!faceReady || (!src && crackOp <= 0)) return;
  if (maskOp <= 0.001 && crackOp <= 0.001) return;
  if (glC.width !== canvas.width || glC.height !== canvas.height) { glC.width = canvas.width; glC.height = canvas.height; }
  const base = src || FACE_TEX.find((s) => s.ready); if (!base) return;
  bindFrame(gl.TEXTURE0, base, gifFrame(base, now));
  if (CRACK_SRC.ready) bindFrame(gl.TEXTURE1, CRACK_SRC, clamp(crackFi, 0, CRACK_SRC.frames.length - 1));
  else { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, base.tex); crackOp = 0; }
  gl.bindBuffer(gl.ARRAY_BUFFER, base.uvBuf || glUVDefault); gl.vertexAttribPointer(glLoc.uv, 2, gl.FLOAT, false, 0, 0);
  gl.uniform1f(glLoc.maskOp, src ? maskOp : 0); gl.uniform1f(glLoc.crackOp, crackOp);
  gl.uniform1f(glLoc.scale, cfg.maskScale); gl.uniform2f(glLoc.off, 0, cfg.maskOffY);
  gl.uniform3f(glLoc.ca, ...crackAffine[0]); gl.uniform3f(glLoc.cb, ...crackAffine[1]);
  gl.uniform3f(glLoc.crackCol, crackCol[0] / 255, crackCol[1] / 255, crackCol[2] / 255);
  // 顶点：屏幕像素 + 深度（MediaPipe z 越小越靠近镜头），开深度测试让鼻子挡住转向另一侧的脸颊
  for (let i = 0; i < 468; i++) {
    const p = scr(lmPx(lm[i]));
    glPosData[i * 3] = p.x * DPR; glPosData[i * 3 + 1] = p.y * DPR; glPosData[i * 3 + 2] = lm[i].z * 4;
  }
  // 锁嘴：张嘴时上唇一侧往下、下唇一侧往上各收一半（高斯衰减到下巴和脸颊），面具的嘴不会被拉开
  const ox = glPosData[14 * 3] - glPosData[13 * 3], oy = glPosData[14 * 3 + 1] - glPosData[13 * 3 + 1];
  if (cfg.mouthLock > 0 && Math.hypot(ox, oy) > 0.5) {
    const [mu, mv] = meshFeat.M;
    for (let i = 0; i < 468; i++) {
      const du = meshUV[i * 2] - mu, dv = meshUV[i * 2 + 1] - mv;
      const w = Math.exp(-(du * du) / (2 * 0.09 * 0.09) - (dv * dv) / (2 * 0.075 * 0.075));
      if (w < 0.01) continue;
      const side = dv < 0 || i === 13 ? 0.5 : -0.5; // 上半往下（+开口方向），下半往上
      glPosData[i * 3] += ox * side * w * cfg.mouthLock; glPosData[i * 3 + 1] += oy * side * w * cfg.mouthLock;
    }
  }
  // 外圈：从轮廓中心往外推
  let cx = 0, cy = 0; for (const i of FACE_OVAL) { cx += glPosData[i * 3] / FACE_OVAL.length; cy += glPosData[i * 3 + 1] / FACE_OVAL.length; }
  FACE_OVAL.forEach((i, k) => {
    const g = 1 + (ringG[k] - 1) * cfg.maskGrow, o = (468 + k) * 3;
    glPosData[o] = cx + (glPosData[i * 3] - cx) * g; glPosData[o + 1] = cy + (glPosData[i * 3 + 1] - cy) * g; glPosData[o + 2] = glPosData[i * 3 + 2];
  });
  if (alphaFor !== cfg.edgeFeather) { // 设置里调了渐变宽度就重算透明度
    alphaFor = cfg.edgeFeather; gl.bindBuffer(gl.ARRAY_BUFFER, glAlphaBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, edgeAlpha(cfg.edgeFeather));
  }
  gl.viewport(0, 0, glC.width, glC.height);
  gl.uniform2f(glLoc.res, glC.width, glC.height);
  gl.bindBuffer(gl.ARRAY_BUFFER, glPos); gl.bufferSubData(gl.ARRAY_BUFFER, 0, glPosData);
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.drawElements(gl.TRIANGLES, drawTris.length, gl.UNSIGNED_SHORT, 0);
  // 手挡住的地方扣掉（身体皮肤 / 衣服）
  const L = fxCtx;
  L.setTransform(1, 0, 0, 1, 0, 0); L.clearRect(0, 0, fxLayer.width, fxLayer.height);
  L.drawImage(glC, 0, 0);
  if (!fakeActive && cfg.occlusion && occReady && now - maskAt < 400) {
    L.save(); L.setTransform(DPR, 0, 0, DPR, 0, 0); L.globalCompositeOperation = "destination-in";
    L.transform(VM.a, VM.b, VM.c, VM.d, VM.e, VM.f); L.filter = "blur(2px)";
    L.drawImage(occC, 0, 0, frame.width, frame.height); L.restore();
  }
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = faceVis; c.drawImage(fxLayer, 0, 0); c.restore();
}

// ---------- 鬼脸闪到屏幕前面：有人时随机出现，整张脸贴在屏幕正中一闪 ----------
let jump = { until: 0, next: 0, src: null, frames: 0 };
const jumpC = document.createElement("canvas"), jumpX = jumpC.getContext("2d");
function updateJump(now) {
  if (!cfg.jumpFlash || !faceReady) return;
  const present = people.some((p) => p.active && p.seen && p.level > 0.25);
  if (!present) { jump.next = Math.max(jump.next, now + 3000); return; }
  if (now < jump.next) return;
  const ready = FACE_TEX.filter((s) => s.ready); if (!ready.length) return;
  jump.src = ready[Math.random() * ready.length | 0];
  jump.until = now + rnd(140, 320);
  jump.next = jump.until + rnd(7000, 18000) / cfg.jumpRate;
  glitch.until = Math.max(glitch.until, jump.until); glitch.s = 1; // 同时来一下毛刺
  shake = Math.max(shake, 14);
  sndJump();
}
function drawJump(now) {
  if (!cfg.jumpFlash || now > jump.until || !jump.src) return;
  if (Math.random() < 0.3) return; // 频闪：有几帧空掉
  const img = jump.src.frames[gifFrame(jump.src, now)].img;
  const s = Math.max(W, H) * rnd(0.95, 1.15), x = (W - s) / 2 + rnd(-20, 20), y = (H - s) / 2 + rnd(-20, 20);
  // 贴图背景是灰 / 黑底，用椭圆渐隐只留脸
  if (jumpC.width !== 512) { jumpC.width = jumpC.height = 512; }
  jumpX.globalCompositeOperation = "copy"; jumpX.drawImage(img, 0, 0, 512, 512);
  jumpX.globalCompositeOperation = "destination-in";
  const g = jumpX.createRadialGradient(256, 270, 120, 256, 270, 250);
  g.addColorStop(0, "#000"); g.addColorStop(1, "rgba(0,0,0,0)"); jumpX.fillStyle = g; jumpX.fillRect(0, 0, 512, 512);
  ctx.save(); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = `rgba(0,0,0,${rnd(0.4, 0.8)})`; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = rnd(0.75, 1); ctx.drawImage(jumpC, x, y, s, s);
  ctx.restore();
}
function sndJump() {
  if (!ac) return; const t = ac.currentTime;
  burst(t, 0.35, "bandpass", 1800, 0.35);
  const o = ac.createOscillator(), g = ac.createGain(); o.type = "sawtooth";
  o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(300, t + 0.3);
  env(g, t, 0.25, 0.01, 0.3); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.4);
  const b = ac.createOscillator(), bg = ac.createGain(); b.frequency.setValueAtTime(70, t); b.frequency.exponentialRampToValueAtTime(30, t + 0.4);
  env(bg, t, 0.7, 0.005, 0.45); b.connect(bg); bg.connect(master); b.start(t); b.stop(t + 0.5);
}

// ---------- 反向表情：本人不笑 → 咧嘴怪笑；本人在笑 → 嘴角下拉、皱眉 ----------
const work = document.createElement("canvas");
const wctx = work.getContext("2d", { willReadFrequently: true });
let exprMode = 0; // 0 怪笑 → 1 苦脸
function drawExpression(c, lm, amt) {
  const P = (i) => lmPx(lm[i]);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let i = 0; i < 468; i++) { const p = P(i); if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; }
  const pw = (x1 - x0) * 0.25, ph = (y1 - y0) * 0.25;
  const rx = Math.max(0, x0 - pw), ry = Math.max(0, y0 - ph);
  const rw = Math.min(frame.width, x1 + pw) - rx, rh = Math.min(frame.height, y1 + ph) - ry;
  if (rw < 20 || rh < 20) return;
  const k = Math.min(1, 220 / rw), ww = Math.max(8, Math.round(rw * k)), wh = Math.max(8, Math.round(rh * k));
  if (work.width !== ww || work.height !== wh) { work.width = ww; work.height = wh; }
  wctx.drawImage(frame, rx, ry, rw, rh, 0, 0, ww, wh);
  const src = wctx.getImageData(0, 0, ww, wh), out = wctx.createImageData(ww, wh);

  const L = (i) => { const p = P(i); return { x: (p.x - rx) * k, y: (p.y - ry) * k }; };
  const top = L(10), chin = L(152);
  let ux = top.x - chin.x, uy = top.y - chin.y; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
  const fw = Math.hypot(L(234).x - L(454).x, L(234).y - L(454).y);
  const mc = { x: (L(13).x + L(14).x) / 2, y: (L(13).y + L(14).y) / 2 };
  const ctrl = [];
  const add = (i, out, up, sig, m = 1) => {
    const p = L(i); let ox = p.x - mc.x, oy = p.y - mc.y; const ol = Math.hypot(ox, oy) || 1; ox /= ol; oy /= ol;
    const dx = (ox * out + ux * up) * fw * amt * m, dy = (oy * out + uy * up) * fw * amt * m;
    ctrl.push({ x: p.x + dx, y: p.y + dy, dx, dy, s2: 2 * (sig * fw) ** 2 });
  };
  const g = 1 - exprMode, f = exprMode;
  // 嘴角：怪笑向外上拉，苦脸向下
  add(61, 0.05 * g - 0.01 * f, 0.075 * g - 0.055 * f, 0.07); add(291, 0.05 * g - 0.01 * f, 0.075 * g - 0.055 * f, 0.07);
  add(14, 0, -0.02 * g - 0.03 * f, 0.05); add(17, 0, -0.015 * g - 0.03 * f, 0.06);
  add(50, 0, 0.02 * g, 0.07); add(280, 0, 0.02 * g, 0.07);
  // 眼睛睁大
  add(159, 0, 0.028, 0.035); add(386, 0, 0.028, 0.035); add(145, 0, -0.012, 0.03); add(374, 0, -0.012, 0.03);
  // 眉毛：怪笑上挑，苦脸眉心压低
  add(105, 0, 0.022 * g, 0.05); add(334, 0, 0.022 * g, 0.05); add(55, 0, -0.03 * f, 0.04); add(285, 0, -0.03 * f, 0.04);

  const sd = src.data, od = out.data, feather = Math.max(4, ww * 0.12);
  for (let y = 0; y < wh; y++) {
    for (let x = 0; x < ww; x++) {
      let sx = x, sy = y;
      for (const p of ctrl) {
        const ex = x - p.x, ey = y - p.y, wgt = Math.exp(-(ex * ex + ey * ey) / p.s2);
        sx -= p.dx * wgt; sy -= p.dy * wgt;
      }
      sx = clamp(sx, 0, ww - 1.001); sy = clamp(sy, 0, wh - 1.001);
      const ix = sx | 0, iy = sy | 0, fx_ = sx - ix, fy_ = sy - iy;
      const i00 = (iy * ww + ix) * 4, i10 = i00 + 4, i01 = i00 + ww * 4, i11 = i01 + 4;
      const o = (y * ww + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        od[o + ch] = (sd[i00 + ch] * (1 - fx_) + sd[i10 + ch] * fx_) * (1 - fy_) + (sd[i01 + ch] * (1 - fx_) + sd[i11 + ch] * fx_) * fy_;
      }
      od[o + 3] = 255 * clamp(Math.min(x, y, ww - 1 - x, wh - 1 - y) / feather, 0, 1);
    }
  }
  wctx.putImageData(out, 0, 0);
  c.save(); c.globalAlpha = faceVis; drawFrameAt(c, work, rx, ry, rw, rh); c.restore();
}

function drawBlackEyes(c, lm, amt) {
  const S = (i) => scr(lmPx(lm[i]));
  c.save(); c.globalAlpha = amt * faceVis;
  for (const [a, b, t, d] of [[33, 133, 159, 145], [263, 362, 386, 374]]) {
    const A = S(a), B = S(b), Tp = S(t), D = S(d);
    const cx = (A.x + B.x) / 2, cy = (Tp.y + D.y) / 2, r = Math.hypot(A.x - B.x, A.y - B.y) * 0.62;
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, "rgba(0,0,0,0.97)"); g.addColorStop(0.6, "rgba(0,0,0,0.9)"); g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g; c.beginPath(); c.ellipse(cx, cy, r, r * 0.75, Math.atan2(B.y - A.y, B.x - A.x), 0, Math.PI * 2); c.fill();
    c.fillStyle = `rgba(255,255,255,${0.8 * ramp(amt, 0.6, 1)})`;
    c.beginPath(); c.arc(cx - r * 0.12, cy - r * 0.1, Math.max(1, r * 0.06), 0, Math.PI * 2); c.fill();
  }
  c.restore();
}

// ---------- 一个人的脸部效果 ----------
let cur = null, frameDarkened = false;
function drawPersonFx(p, now) {
  cur = p; faceVis = p.vis; exprMode = p.exprMode;
  const lm = p.slm, pr = p.prof, lv = p.level - pr.offset;
  // 预设的程序效果（怪笑变形、惨白、黑眼、程序裂纹）已停用，改用提供的贴图和裂纹 GIF
  // 鬼脸贴图：按进度显形；此外时不时一阵频闪（显形前也会偶尔闪出来），毛刺瞬间也闪现
  const useMask = cfg.ghostMask && pr.mask;
  let ma = ramp(lv, ...STAGE.mask) * cfg.maskAmt;
  if (now > p.flk.next) { p.flk.until = now + rnd(120, 400); p.flk.next = p.flk.until + rnd(2500, 8000) / cfg.flickRate; }
  if (cfg.maskFlicker && now < p.flk.until && p.level > 0.15) ma = Math.random() < 0.45 ? 0 : Math.max(ma, 0.85 * cfg.maskAmt);
  else if (ma > 0 && ma < 0.98 * cfg.maskAmt) ma *= rnd(0.55, 1); // 显形过程一闪一闪
  if (now < glitch.until && p.level > 0.15) ma = Math.max(ma, 0.75 * glitch.s * cfg.maskAmt);
  if (!useMask) ma = 0;
  // 裂纹 GIF：前 5 帧按进度慢慢长出来，长满后偶尔在 3–5 帧之间“呼吸”
  let ca = 0, cfi = 0;
  if (cfg.faceCracks) {
    const cp = ramp(lv, ...STAGE.face);
    if (cp > 0) {
      ca = cfg.crackAmt * Math.min(1, cp * 3);
      cfi = Math.round(cp * 4);
      if (cp >= 1) cfi = 4 + Math.round(Math.sin(now / 1000 * 1.3 + p.id) * 0.6);
      if (!p.crackSnd && cp > 0.02) { p.crackSnd = true; sndCrack(false); }
    }
  }
  drawGhostMask(ctx, now, lm, ma, useMask ? texFor(pr) : null, ca, cfi, pr.crackColor);
  // 程序底光也已停用：脸上只用提供的贴图和裂纹 GIF
}

// ---------- 待机吸引：边缘少量一直在动的污痕 ----------
let drifters = [];
function spawnDrifter(now) {
  const type = ["smudge", "drip", "mold", "smudge"][Math.random() * 4 | 0];
  const e = Math.random() * 4 | 0, t = rnd(0.05, 0.95), d = rnd(0.03, 0.12);
  const u = e === 1 ? 1 - d : e === 3 ? d : t, v = e === 0 ? d : e === 2 ? 1 - d : t;
  return { img: makeStain(type), u: type === "drip" ? t : u, v: type === "drip" ? rnd(-0.05, 0.1) : v,
    vu: type === "drip" ? 0 : rnd(-0.004, 0.004), vv: type === "drip" ? rnd(0.006, 0.014) : rnd(-0.004, 0.004),
    rot: type === "drip" ? rnd(-0.05, 0.05) : rnd(-0.6, 0.6), vr: type === "drip" ? 0 : rnd(-0.03, 0.03), s: rnd(0.6, 1),
    born: now + rnd(0, 6000), life: rnd(9000, 18000) };
}
function drawDrifters(c, now) {
  const want = cfg.idleFx > 0 ? 3 : 0;
  while (drifters.length < want) drifters.push(spawnDrifter(now));
  drifters = drifters.slice(0, want);
  for (let i = 0; i < drifters.length; i++) {
    const d = drifters[i], age = (now - d.born) / d.life;
    if (age >= 1) { drifters[i] = spawnDrifter(now); continue; }
    if (age <= 0) continue;
    const sec = (now - d.born) / 1000;
    const a = Math.sin(Math.PI * age) * cfg.idleFx * 0.7;
    const sc = d.s * Math.min(W, H) / 900;
    c.save(); c.globalAlpha = a;
    c.translate((d.u + d.vu * sec) * W, (d.v + d.vv * sec) * H); c.rotate(d.rot + d.vr * sec); c.scale(sc, sc);
    c.drawImage(d.img, -d.img.width / 2, -d.img.height / 2); c.restore();
  }
}

// ---------- 信号毛刺：错位条、RGB 分离、扫描线、噪声条 ----------
let glitch = { until: 0, next: 0, s: 0 };
const gC = document.createElement("canvas"), gX = gC.getContext("2d");
const gT = document.createElement("canvas"), gTX = gT.getContext("2d");
let scanPattern = null;
function updateGlitch(now) {
  if (!cfg.glitch || now < glitch.next) return;
  const idle = level < 0.1 && track === "none";
  const dur = idle ? rnd(90, 450) : rnd(60, 220);
  glitch.until = now + dur; glitch.s = idle ? rnd(0.5, 1) : rnd(0.25, 0.6);
  glitch.next = glitch.until + (idle ? rnd(1800, 6000) : rnd(5000, 14000)) / cfg.glitchRate;
  sndStatic(dur / 1000, glitch.s);
}
function drawGlitch(now) {
  if (!cfg.glitch || now > glitch.until) return;
  const s = glitch.s, cw = canvas.width, chh = canvas.height;
  if (gC.width !== cw || gC.height !== chh) { gC.width = gT.width = cw; gC.height = gT.height = chh; }
  gX.globalCompositeOperation = "copy"; gX.drawImage(canvas, 0, 0);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  // 横向错位条
  const n = 3 + (Math.random() * 9 * s | 0);
  for (let i = 0; i < n; i++) {
    const y = Math.random() * chh, h = rnd(3, 50) * DPR * s, dx = rnd(-70, 70) * DPR * s;
    ctx.drawImage(gC, 0, y, cw, h, dx, y, cw, h);
  }
  // RGB 分离：红、青两份错开叠加
  const off = rnd(3, 14) * DPR * s;
  for (const [col, dx] of [["#ff0000", off], ["#00ffff", -off]]) {
    gTX.globalCompositeOperation = "copy"; gTX.drawImage(gC, 0, 0);
    gTX.globalCompositeOperation = "multiply"; gTX.fillStyle = col; gTX.fillRect(0, 0, cw, chh);
    gTX.globalCompositeOperation = "destination-in"; gTX.drawImage(gC, 0, 0);
    ctx.globalCompositeOperation = "screen"; ctx.globalAlpha = 0.45 * s; ctx.drawImage(gT, dx, 0);
  }
  ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
  // 扫描线
  if (!scanPattern) {
    const p = document.createElement("canvas"); p.width = 1; p.height = 3;
    const px = p.getContext("2d"); px.fillStyle = "rgba(0,0,0,0.35)"; px.fillRect(0, 0, 1, 1);
    scanPattern = ctx.createPattern(p, "repeat");
  }
  ctx.fillStyle = scanPattern; ctx.globalAlpha = s; ctx.fillRect(0, 0, cw, chh); ctx.globalAlpha = 1;
  // 噪声条
  const by = Math.random() * chh, bh = rnd(8, 40) * DPR;
  for (let i = 0; i < 160 * s; i++) {
    const g = Math.random() * 255 | 0;
    ctx.fillStyle = `rgba(${g},${g},${g},${rnd(0.2, 0.6)})`;
    ctx.fillRect(Math.random() * cw, by + Math.random() * bh, rnd(4, 60) * DPR, rnd(1, 3) * DPR);
  }
  // 偶尔整屏闪一下
  if (Math.random() < 0.12 * s) { ctx.fillStyle = Math.random() < 0.6 ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.12)"; ctx.fillRect(0, 0, cw, chh); }
  ctx.restore();
}
function sndStatic(dur, s) {
  if (!ac) return; const t = ac.currentTime;
  burst(t, dur, "bandpass", rnd(1200, 3500), 0.12 * s);
  if (Math.random() < 0.5) burst(t + dur * 0.5, 0.03, "highpass", 5000, 0.1 * s);
}

// ---------- 每帧绘制 ----------
function drawScene(now, dt) {
  drawFrameAt(ctx, frame);

  // 脸部层：每个人按自己的进度和随机面相
  frameDarkened = false;
  for (const p of people) {
    if (!p.active || !p.slm || p.vis <= 0) continue;
    drawPersonFx(p, now);
  }

  // 镜面层：边缘常驻的活动污痕 → 污痕 → 裂痕 → 冰霜
  drawDrifters(ctx, now);
  if (cfg.stains) {
    for (const s of fx.stains) {
      const a = ramp(level, s.thr, s.thr + 0.12) * cfg.stainAmt;
      if (a <= 0) continue;
      const sc = s.s * Math.min(W, H) / 900;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(s.u * W, s.v * H); ctx.rotate(s.rot); ctx.scale(sc, sc);
      ctx.drawImage(s.img, -s.img.width / 2, -s.img.height / 2); ctx.restore();
    }
  }
  if (cfg.cracks) {
    for (const k of fx.cracks) {
      if (!k.cr && level >= k.thr) {
        k.cr = buildCrack(k.u * W, k.v * H, k.r * Math.max(W, H), k.K); k.born = now; sndCrack(k.r > 0.15); shake = Math.max(shake, 4);
      }
      if (!k.cr) continue;
      const alpha = clamp((level - k.thr) / 0.05 + 1, 0, 1);
      if (alpha <= 0) { k.cr = null; continue; }
      const t = (now - k.born) / 1000;
      const R = k.cr.maxR * (0.55 * easeOut(clamp(t / 0.15, 0, 1)) + 0.45 * easeOut(clamp(t / 4, 0, 1)));
      drawCrack(ctx, k.cr, R, alpha);
    }
  }
  if (cfg.frost) {
    if (frostDirty) buildFrost();
    // 没人时边缘也留一点冰霜，慢慢呼吸
    const idle = cfg.idleFx * (0.1 + 0.05 * Math.sin(now / 1000 * 0.45));
    drawFrost(ctx, Math.max(ramp(level, ...STAGE.frost) * cfg.frostAmt, idle), now);
  }

  // 镜面反光、暗角，level 高时偶尔像灯一样闪暗
  const gl = ctx.createLinearGradient(0, 0, W, H);
  gl.addColorStop(0, `rgba(255,255,255,${0.08 * cfg.sheen})`); gl.addColorStop(0.45, "rgba(255,255,255,0)");
  gl.addColorStop(0.55, `rgba(255,255,255,${0.05 * cfg.sheen})`); gl.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, `rgba(0,0,0,${cfg.vignette * (0.8 + level * 0.2)})`);
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  let dark = level * 0.15;
  if (level > 0.65 && Math.random() < 0.02) dark += 0.4;
  if (dark > 0) { ctx.fillStyle = `rgba(0,0,0,${dark})`; ctx.fillRect(0, 0, W, H); }
}

function drawDebug() {
  ctx.save(); ctx.font = "12px Consolas, monospace"; ctx.lineWidth = 1.5;
  for (const f of people) {
    if (!f.seen) continue;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const i of [10, 152, 234, 454]) { const p = scr(lmPx(f.lm[i])); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    ctx.strokeStyle = ctx.fillStyle = !f.active ? "#71717a" : f.ok ? "#7fd1a8" : "#e5b26f";
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    const yawTxt = Number.isFinite(f.yaw) ? f.yaw.toFixed(0) + "°" : "--";
    ctx.fillText(`#${f.id} ${f.prof.look.id}  lv ${(f.level * 100).toFixed(0)}%`, x0, y0 - 22);
    ctx.fillText(`conf ≥ ${cfg.faceConf.toFixed(2)}  w ${f.width.toFixed(2)}${f.near ? "" : " far"}  yaw ${yawTxt}${f.frontal ? "" : " side"}  smile ${f.smile.toFixed(2)}`, x0, y0 - 6);
    if (cfg.mesh) for (let i = 0; i < 468; i += 2) { const p = scr(lmPx(f.lm[i])); ctx.fillRect(p.x - 0.7, p.y - 0.7, 1.4, 1.4); }
  }
  if (cfg.mesh && maskReady) { // 脸部皮肤遮罩显示成暗色区域
    ctx.save(); ctx.globalAlpha = 0.35; ctx.transform(VM.a, VM.b, VM.c, VM.d, VM.e, VM.f); ctx.drawImage(maskC, 0, 0, frame.width, frame.height); ctx.restore();
  }
  ctx.fillStyle = "rgba(12,12,13,0.75)"; ctx.fillRect(10, 10, 300, 46);
  ctx.fillStyle = "#e4e4e7"; ctx.fillText(`track ${track.padEnd(6)}${force ? " (force)" : ""}  faces ${String(faces.length).padStart(2)}  fps ${String(fps.toFixed(0)).padStart(3)}  conf ≥ ${cfg.faceConf.toFixed(2)}  scan ${cfg.farScan}`, 20, 28);
  ctx.fillStyle = "#c4a1f0"; ctx.fillRect(20, 40, 280 * level, 6);
  ctx.strokeStyle = "#323237"; ctx.strokeRect(20, 40, 280, 6);
  ctx.restore();
}

let shake = 0, lastFrame = performance.now(), fps = 0;
function loop() {
  const now = performance.now(), dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now; fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;

  const ok = updateFrame();
  let fresh = false;
  if (ok && landmarker && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime; fresh = true;
    try { faces = analyze(landmarker.detectForVideo(frame, now)); } catch (e) { console.warn(e); faces = []; }
    faces = mergeFar(faces, now);
    if (force && !faces.length && canonVerts) faces = [fakeFace(now)];
    fakeActive = faces.length > 0 && !!faces[0].fake; // 假脸下面没有真皮肤，遮罩不适用
  }
  track = updatePeople(now, dt, fresh);
  // 只在需要遮罩的脸部效果出现后才跑分割，省性能
  const maxLv = people.reduce((m, p) => (p.active ? Math.max(m, p.level - p.prof.offset) : m), 0);
  const needMask = (cfg.faceCracks && maxLv >= STAGE.face[0] - 0.03) || (cfg.pale && maxLv >= STAGE.pale[0] - 0.03)
    || (cfg.ghostMask && maxLv >= 0.12);
  if (fresh && segmenter && cfg.occlusion && needMask) {
    try { runSegment(now); } catch (e) { console.warn(e); }
  }
  updateLevel(dt);
  updateView();
  updateGlitch(now);
  updateJump(now);

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
  shake *= Math.pow(0.02, dt);
  if (shake > 0.3) ctx.translate(rnd(-0.5, 0.5) * shake, rnd(-0.5, 0.5) * shake);
  if (ok) drawScene(now, dt);
  drawJump(now);
  drawGlitch(now);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (cfg.debug) drawDebug();
  requestAnimationFrame(loop);
}

// ---------- 摄像头 ----------
let stream = null, cams = [], camError = "";
function fakeStream() {
  const c = document.createElement("canvas"); c.width = 1280; c.height = 720;
  const x = c.getContext("2d");
  const paint = () => {
    const t = performance.now() / 1000;
    const g = x.createLinearGradient(0, 0, 0, 720); g.addColorStop(0, "#3a3f44"); g.addColorStop(1, "#15181a");
    x.fillStyle = g; x.fillRect(0, 0, 1280, 720);
    x.fillStyle = "#2a2622"; x.fillRect(900, 120, 220, 600);
    const px = 640 + Math.sin(t * 0.7) * 30;
    x.fillStyle = "#6b5a4c"; x.beginPath(); x.ellipse(px, 300, 95, 125, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = "#1c1a19"; x.beginPath(); x.ellipse(px, 620, 230, 200, 0, Math.PI, 0); x.fill();
    x.fillStyle = "#5fa8ff"; x.font = "20px Consolas"; x.fillText("TEST PATTERN", 30, 40);
    requestAnimationFrame(paint);
  };
  paint();
  return c.captureStream(30);
}
async function startCamera() {
  if (stream) for (const t of stream.getTracks()) t.stop();
  camError = "";
  if (cfg.deviceId === "__test") { stream = fakeStream(); }
  else {
    const hi = cfg.res === "1080";
    const v = { width: { ideal: hi ? 1920 : 1280 }, height: { ideal: hi ? 1080 : 720 } };
    if (cfg.deviceId) v.deviceId = { exact: cfg.deviceId }; else v.facingMode = "user";
    try { stream = await navigator.mediaDevices.getUserMedia({ video: v, audio: false }); }
    catch (e) {
      if (cfg.deviceId) { cfg.deviceId = ""; saveCfg(); return startCamera(); }
      camError = e.message; stream = fakeStream(); openPanel(true);
    }
  }
  video.srcObject = stream;
  // 摄像头被拔掉或被系统中断时自动重连（自己 stop() 不会触发 ended）
  for (const tr of stream.getVideoTracks()) tr.addEventListener("ended", () => { if (stream && stream.getVideoTracks().includes(tr)) setTimeout(startCamera, 1000); });
  try { await video.play(); } catch {}
  try { cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput"); } catch { cams = []; }
  renderCamSelect();
}

// ---------- 设置面板 ----------
const R = (k, l, min, max, step, u = "") => ({ t: "range", k, l, min, max, step, u });
const C = (k, l) => ({ t: "chk", k, l });
const TABS = [
  { id: "cam", l: T("镜面", "Mirror", "거울"), groups: [
    { l: T("摄像头", "Camera", "카메라"), n: T("输入", "input", "입력"), items: [
      { t: "camera" },
      { t: "seg", k: "res", l: T("分辨率", "Resolution", "해상도"), o: [{ v: "720", l: "720p" }, { v: "1080", l: "1080p" }] },
      { t: "info", id: "camInfo" },
    ] },
    { l: T("镜子角度", "Mirror angle", "거울 각도"), n: T("显示", "display", "표시"), items: [
      { t: "seg", k: "rot", l: T("旋转", "Rotate", "회전"), o: [0, 90, 180, 270].map((v) => ({ v, l: v + "°" })) },
      R("tilt", T("微调角度", "Fine tilt", "미세 각도"), -20, 20, 0.5, "°"),
      { t: "seg", k: "fit", l: T("适配", "Fit", "맞춤"), o: [{ v: "cover", l: T("铺满", "Cover", "채우기") }, { v: "contain", l: T("完整", "Contain", "전체") }] },
      R("zoom", T("缩放", "Zoom", "확대"), 1, 3, 0.01, "×"),
      R("offX", T("水平偏移", "Offset X", "가로 이동"), -0.5, 0.5, 0.005),
      R("offY", T("垂直偏移", "Offset Y", "세로 이동"), -0.5, 0.5, 0.005),
      C("mirror", T("左右镜像", "Mirror horizontally", "좌우 반전")),
      C("flipY", T("上下翻转", "Flip vertically", "상하 반전")),
      { t: "btns", b: [{ id: "resetView", l: T("角度复位", "Reset view", "보기 초기화"), cls: "danger" }] },
    ] },
    { l: T("画面", "Image", "화면"), items: [
      R("bright", T("亮度", "Brightness", "밝기"), 0.4, 1.6, 0.01),
      R("contrast", T("对比度", "Contrast", "대비"), 0.5, 1.6, 0.01),
      R("sat", T("饱和度", "Saturation", "채도"), 0, 1.6, 0.01),
      R("sheen", T("玻璃反光", "Glass sheen", "유리 반사"), 0, 1, 0.01),
      R("vignette", T("暗角", "Vignette", "비네팅"), 0, 1, 0.01),
    ] },
  ] },
  { id: "detect", l: T("识别", "Detect", "인식"), groups: [
    { l: T("距离", "Distance", "거리"), n: T("脸宽 / 画面宽", "face / frame", "얼굴 / 화면"), items: [
      R("nearRatio", T("近距离阈值", "Near threshold", "근거리 기준"), 0.02, 0.45, 0.005),
      { t: "seg", k: "farScan", l: T("远距离检测", "Far detection", "원거리 검출"), o: [{ v: "off", l: T("关", "Off", "끔") }, { v: "2x2", l: "2×2" }, { v: "3x2", l: "3×2" }] },
      { t: "sub", l: T("摄像头离人远、脸很小时打开：画面切块轮流检测，找到的小脸每帧在附近裁一块跟踪。阈值同时调到 0.03–0.05。更吃性能。", "For far cameras with tiny faces: scans the frame in tiles and re-crops each found face every frame. Lower the threshold to 0.03–0.05. Heavier.", "카메라가 멀고 얼굴이 작을 때: 화면을 나눠 검출하고 찾은 얼굴은 매 프레임 주변을 잘라 추적합니다. 기준을 0.03–0.05로 낮추세요. 더 무겁습니다.") },
      { t: "sub", l: T("脸宽小于阈值视为远处，不推进演出。现场用调试叠加看 w 值再调。", "Faces narrower than this count as far away.", "이 값보다 작으면 먼 사람으로 보고 연출을 진행하지 않습니다.") },
      { t: "sub", l: T("镜子的面具要贴在脸上，必须看到脸，所以这里没有人头模型（低头的人本来也照不到镜子）。", "The mask needs a visible face, so the mirror has no head model (people looking down aren't facing the mirror anyway).", "마스크는 얼굴이 보여야 하므로 거울에는 머리 모델이 없습니다.") },
    ] },
    { l: T("模型", "Models", "모델"), n: T("可下载", "downloadable", "다운로드"), items: [{ t: "models" }] },
    { l: T("朝向", "Facing", "방향"), n: "yaw", items: [
      R("yawLimit", T("左右角度上限", "Yaw limit", "좌우 각도 한계"), 10, 80, 1, "°"),
      { t: "sub", l: T("这是自己设的过滤阈值，不是 MediaPipe 的识别极限。超过时不推进，也不回退。", "A chosen filter, not the tracker's limit. Beyond it the show pauses.", "직접 정한 필터 값이며 인식 한계가 아닙니다. 넘으면 연출이 멈춥니다.") },
    ] },
    { l: T("时间", "Timing", "시간"), items: [
      R("lostGrace", T("丢失容忍", "Lost grace", "인식 끊김 허용"), 0, 2, 0.1, "s"),
      R("recede", T("离开后消退", "Fade after leaving", "떠난 뒤 사라짐"), 2, 30, 0.5, "s"),
    ] },
    { l: T("人数", "People", "인원"), n: T("最多识别 5 人", "detects up to 5", "최대 5명 인식"), items: [
      R("maxFaces", T("同时作用人数", "Faces with effects", "효과 적용 인원"), 1, 5, 1),
      { t: "sub", l: T("按脸大小（离镜子近）排前几个人各自出效果，每人随机面相。人多时表情变形比较吃 CPU，建议 ≤3。", "Nearest N faces each get their own random look. Keep ≤3 for performance.", "가까운 순서로 N명에게 각자 랜덤 효과. 성능상 3명 이하 권장.") },
    ] },
    { l: T("脸部追踪", "Face tracking", "얼굴 추적"), items: [
      R("smooth", T("防抖", "Stabilize", "떨림 보정"), 0.2, 5, 0.1, "Hz"),
      { t: "sub", l: T("数值越小越稳，但跟随会慢一点；快速移动时自动放开。", "Lower = steadier but laggier; loosens on fast moves.", "작을수록 안정적이지만 조금 늦게 따라갑니다.") },
      R("faceConf", T("人脸置信度", "Face confidence", "얼굴 신뢰도"), 0.1, 0.95, 0.05),
      { t: "sub", l: T("越低越容易认出侧脸、远处、暗处的脸，但更容易误认；越高越严。人脸模型不给每张脸单独的分数，叠加里显示的是当前门槛。", "Lower finds side / far / dark faces more easily but with more false hits; higher is stricter. The face model gives no per-face score, so the overlay shows the current threshold.", "낮을수록 옆얼굴·먼 얼굴·어두운 얼굴을 잘 찾지만 오검출이 늘고, 높을수록 엄격합니다. 얼굴 모델은 얼굴별 점수를 주지 않아 오버레이에는 현재 기준값이 표시됩니다.") },
      C("occlusion", T("遮挡（头发 / 手 / 眼镜）", "Occlusion (hair / hands / glasses)", "가림 (머리카락 / 손 / 안경)")),
      { t: "sub", l: T("用多类分割只在脸部皮肤上画裂痕。打开“显示关键点”可看到遮罩。", "Cracks only on face-skin pixels. Turn on landmarks to see the mask.", "얼굴 피부 픽셀에만 금을 그립니다. 랜드마크 표시로 마스크 확인.") },
    ] },
    { l: T("调试", "Debug", "디버그"), n: "D", items: [
      C("debug", T("显示识别叠加", "Show detection overlay", "인식 오버레이")),
      C("mesh", T("显示关键点", "Show landmarks", "랜드마크 표시")),
    ] },
  ] },
  { id: "show", l: T("演出", "Show", "연출"), groups: [
    { l: T("节奏", "Pace", "속도"), items: [
      R("build", T("到满级时间", "Time to full", "최대까지 시간"), 5, 120, 1, "s"),
      { t: "meter" },
      { t: "sub", l: T("合格的人在镜前，演出慢慢加深：冰霜 → 污痕 → 镜面裂痕 → 脸上裂纹 GIF → 鬼脸贴图显形；鬼脸会时不时频闪，偶尔闪到屏幕前。", "Frost → stains → glass cracks → face crack GIF → ghost face; it strobes now and then and jumps to the screen.", "서리 → 얼룩 → 거울 금 → 얼굴 금 GIF → 귀신 얼굴. 가끔 깜빡이고 화면 앞으로 튀어나옵니다.") },
    ] },
    { l: T("待机吸引", "Attract", "대기 유도"), n: T("没人时", "no one near", "사람 없을 때"), items: [
      R("idleFx", T("边缘常驻", "Edge ambience", "가장자리 상시"), 0, 1, 0.01),
      C("glitch", T("信号毛刺", "Signal glitch", "신호 글리치")),
      R("glitchRate", T("毛刺频率", "Glitch rate", "글리치 빈도"), 0.2, 3, 0.1, "×"),
      { t: "sub", l: T("没人时边缘有少量冰霜呼吸、污痕慢慢移动，并不时出现信号毛刺吸引人靠近；演出中毛刺变少变弱。", "Idle: breathing frost, drifting smudges and glitches to draw people in.", "대기 중: 서리·얼룩이 움직이고 글리치로 관객을 유도합니다.") },
    ] },
    { l: T("镜面", "Glass", "거울면"), items: [
      C("frost", T("四周冰霜", "Edge frost", "가장자리 서리")),
      R("frostAmt", T("冰霜强度", "Frost amount", "서리 강도"), 0, 1, 0.01),
      C("stains", T("污痕", "Stains", "얼룩")),
      R("stainAmt", T("污痕强度", "Stain amount", "얼룩 강도"), 0, 1, 0.01),
      C("cracks", T("随机裂痕", "Random cracks", "랜덤 금")),
      R("crackCount", T("裂痕数量", "Crack count", "금 개수"), 1, 14, 1),
    ] },
    { l: T("脸部", "Face", "얼굴"), n: T("需要人脸追踪", "needs tracking", "추적 필요"), items: [
      C("ghostMask", T("鬼脸贴图", "Ghost face texture", "귀신 얼굴 텍스처")),
      { t: "seg", k: "maskTex", l: T("贴图", "Texture", "텍스처"), o: [
        { v: "random", l: T("随机", "Random", "랜덤") }, { v: "base", l: T("底图", "Base", "기본") },
        { v: "blink", l: T("眨眼", "Blink", "깜빡임") }, { v: "veins", l: T("血管", "Veins", "혈관") }] },
      R("maskAmt", T("面具整体不透明度", "Mask opacity", "마스크 불투명도"), 0, 1, 0.01),
      R("maskOffY", T("贴图上下", "Texture up/down", "텍스처 상하"), -0.08, 0.08, 0.002),
      R("maskScale", T("贴图缩放", "Texture scale", "텍스처 크기"), 0.85, 1.15, 0.005),
      R("maskGrow", T("面具外扩", "Mask outer size", "마스크 바깥 크기"), 0, 2, 0.05, "×"),
      R("edgeFeather", T("边缘渐变", "Edge fade", "가장자리 페이드"), 0.02, 0.8, 0.01),
      { t: "sub", l: T("面具四周从外往里逐渐不透明，数值越大渐变越宽、边越软。", "How wide the mask edge fades out; larger = softer.", "마스크 가장자리가 투명해지는 폭. 클수록 부드럽게.") },
      R("mouthLock", T("锁嘴", "Mouth lock", "입 고정"), 0, 1, 0.05),
      { t: "sub", l: T("外扩：轮廓外多盖一圈（额头带出头发）；锁嘴：张嘴时面具的嘴不跟着拉开，1 = 完全闭合。", "Outer size covers past the face outline; mouth lock keeps the mask mouth closed.", "바깥 크기: 윤곽 밖까지 덮기. 입 고정: 입을 벌려도 마스크 입은 닫힌 채.") },
      { t: "sub", l: T("每张贴图加载时已自动对齐眼睛和嘴；还差一点就用这两项微调（正值往下）。", "Eyes and mouth are auto-aligned per texture; fine-tune here (positive = down).", "눈과 입은 자동 정렬됩니다. 남은 오차는 여기서 조정 (양수 = 아래).") },
      C("maskFlicker", T("贴图时不时频闪", "Random mask strobe", "텍스처 랜덤 깜빡임")),
      R("flickRate", T("频闪频率", "Strobe rate", "깜빡임 빈도"), 0.2, 3, 0.1, "×"),
      C("jumpFlash", T("随机闪到屏幕前", "Jump flash to screen", "화면 앞으로 튀어나옴")),
      R("jumpRate", T("闪现频率", "Jump rate", "튀어나옴 빈도"), 0.2, 3, 0.1, "×"),
      C("faceCracks", T("脸上裂纹（GIF，每人随机颜色）", "Face cracks (GIF, random color)", "얼굴 금 (GIF, 랜덤 색)")),
      R("crackAmt", T("裂纹强度", "Crack amount", "금 강도"), 0, 1, 0.01),
    ] },
    { l: T("声音", "Sound", "소리"), items: [
      R("volume", T("音量", "Volume", "볼륨"), 0, 1, 0.01),
      C("ambience", T("低频氛围", "Low drone", "저음 분위기")),
    ] },
    { l: T("测试", "Test", "테스트"), items: [
      { t: "btns", b: [
        { id: "force", l: T("模拟有人", "Simulate visitor", "관객 시뮬레이션"), cls: "primary" },
        { id: "jumpFull", l: T("直接满级", "Jump to full", "바로 최대") },
        { id: "resetShow", l: T("重置", "Reset", "초기화"), cls: "danger" },
      ] },
      { t: "btns", b: [{ id: "fullscreen", l: T("全屏 / 退出全屏", "Fullscreen", "전체화면") }, { id: "closePanel", l: T("关闭设置", "Close panel", "설정 닫기") }] },
      { t: "sub", l: T("快捷键：S 面板 · D 调试 · F 全屏 · P 模拟有人 · R 重置", "Keys: S panel · D debug · F fullscreen · P simulate · R reset", "단축키: S 패널 · D 디버그 · F 전체화면 · P 시뮬레이션 · R 초기화") },
      { t: "sub", l: T("手机 / 平板：右上角连点三下，或两指按住屏幕 1.2 秒，打开或关闭设置。", "Phone / tablet: triple-tap the top-right corner, or hold two fingers for 1.2 s.", "휴대폰 / 태블릿: 오른쪽 위를 세 번 탭하거나 두 손가락으로 1.2초 누르기.") },
    ] },
  ] },
];

let activeTab = "cam";
// 小数位数跟着步长走（0.005 → 3 位）
const fmtNum = (it, v) => {
  const s = String(it.step), d = s.includes(".") ? s.split(".")[1].length : 0;
  return Number(v).toFixed(d);
};
function itemHTML(it) {
  // 滑块 + 可直接输入的数字框（两边同步；输入框可以超出滑块范围）
  if (it.t === "range") return `<div class="field"><label>${tr(it.l)}</label><div class="rng"><input type="range" data-k="${it.k}" min="${it.min}" max="${it.max}" step="${it.step}" value="${cfg[it.k]}"><input class="nv" type="number" data-k="${it.k}" step="${it.step}" value="${fmtNum(it, cfg[it.k])}">${it.u ? `<i>${it.u}</i>` : ""}</div></div>`;
  if (it.t === "chk") return `<label class="chk"><input type="checkbox" data-k="${it.k}" ${cfg[it.k] ? "checked" : ""}>${tr(it.l)}</label>`;
  if (it.t === "seg") return `<div class="field"><label>${tr(it.l)}</label><div class="seg">${it.o.map((o) => `<button data-seg="${it.k}" data-v="${o.v}" class="${String(cfg[it.k]) === String(o.v) ? "on" : ""}">${tr(o.l)}</button>`).join("")}</div></div>`;
  if (it.t === "sub") return `<div class="sub">${tr(it.l)}</div>`;
  if (it.t === "info") return `<div class="info" id="${it.id}"></div>`;
  if (it.t === "models") {
    const total = MODELS.reduce((s, m) => s + parseFloat(m.size), 0).toFixed(0);
    return MODELS.map((m) => `<div class="mdl"><b>${m.file}</b><i>${m.size}</i><div class="sub">${tr(m.use)} · ${m.src}</div></div>`).join("")
      + `<div class="grid2" style="margin-top:10px"><button class="btn" id="zipModels">${tr(T("下载模型 zip", "Download models.zip", "모델 zip 다운로드"))} · ${total} MB</button></div>`
      + `<div class="sub">${tr(T("网页会自动加载这些模型，不用手动下载。离线或现场电脑用时，下载 zip 解压出 models/ 文件夹，放到 互动demo/ 里（和作品文件夹并排）。", "The page loads these models by itself. For offline / on-site machines, download the zip and put the models/ folder inside 互动demo/ next to the demo folders.", "웹페이지가 모델을 자동으로 불러옵니다. 오프라인·현장 PC용으로는 zip을 받아 models/ 폴더를 互动demo/ 안(작품 폴더 옆)에 두세요."))}</div>`;
  }
  if (it.t === "meter") return `<div class="field"><label>level</label><div class="meter"><i id="levelBar"></i></div></div>`;
  if (it.t === "camera") return `<div class="field"><label>${tr(T("设备", "Device", "장치"))}</label><div class="sel"><select id="camSel"></select><button class="btn icon" id="camRefresh" title="refresh">↻</button></div></div>`;
  if (it.t === "btns") return `<div class="grid${it.b.length >= 3 ? 3 : 2}">${it.b.map((b) => `<button class="btn ${b.cls || ""}" id="${b.id}">${tr(b.l)}</button>`).join("")}</div>`;
  return "";
}
function renderPanel() {
  document.documentElement.lang = { zh: "zh-CN", en: "en", ko: "ko" }[cfg.lang];
  $("#tabs").innerHTML = TABS.map((t) => `<button data-tab="${t.id}" class="${t.id === activeTab ? "on" : ""}">${tr(t.l)}</button>`).join("");
  $("#panes").innerHTML = TABS.map((t) => `<div class="pane ${t.id === activeTab ? "on" : ""}" data-pane="${t.id}">${t.groups.map((g) =>
    `<div class="group"><div class="ghead">${tr(g.l)}${g.n ? `<span>${tr(g.n)}</span>` : ""}</div>${g.items.map(itemHTML).join("")}</div>`).join("")}</div>`).join("");
  for (const b of document.querySelectorAll("#lang button")) b.classList.toggle("on", b.dataset.lang === cfg.lang);
  renderCamSelect(); syncButtons();
}
function findItem(k) { for (const t of TABS) for (const g of t.groups) for (const it of g.items) if (it.k === k) return it; }
function renderCamSelect() {
  const sel = $("#camSel"); if (!sel) return;
  const opts = cams.map((d, i) => `<option value="${d.deviceId}">${d.label || "Camera " + (i + 1)}</option>`);
  opts.unshift(`<option value="">${tr(T("默认（前置）", "Default (front)", "기본 (전면)"))}</option>`);
  opts.push(`<option value="__test">${tr(T("测试画面（无摄像头）", "Test pattern (no camera)", "테스트 화면 (카메라 없음)"))}</option>`);
  sel.innerHTML = opts.join(""); sel.value = cfg.deviceId;
  if (sel.value !== cfg.deviceId) sel.value = "";
  const info = $("#camInfo");
  if (info) {
    info.classList.toggle("err", !!camError);
    info.textContent = camError ? tr(T("摄像头打开失败：", "Camera failed: ", "카메라 실패: ")) + camError + tr(T("（已切到测试画面）", " (using test pattern)", " (테스트 화면 사용)"))
      : video.videoWidth ? `${video.videoWidth}×${video.videoHeight} → ${frame.width}×${frame.height}` : "";
  }
}
function syncButtons() {
  const f = $("#force"); if (f) f.textContent = tr(force ? T("停止模拟", "Stop simulating", "시뮬레이션 중지") : T("模拟有人", "Simulate visitor", "관객 시뮬레이션"));
}
function onChange(k) {
  saveCfg();
  if (k === "volume" && master) master.gain.value = cfg.volume;
  if (k === "res") startCamera();
  if (k === "faceConf") applyFaceConf();
  if (k === "crackCount") resetFx();
}
const side = $("#side");
function openPanel(open) {
  side.classList.toggle("open", open);
  document.body.classList.toggle("hide-cursor", !open);
}
side.addEventListener("input", (e) => {
  const el = e.target, k = el.dataset.k; if (!k) return;
  if (el.type === "checkbox") cfg[k] = el.checked;
  else {
    const v = parseFloat(el.value); if (!Number.isFinite(v)) return; // 输入框还没输完（空、只有负号）时先不改
    cfg[k] = v;
    const box = el.parentElement;
    if (el.type === "range") box.querySelector(".nv").value = fmtNum(findItem(k), v);
    else box.querySelector("input[type=range]").value = v;
  }
  onChange(k);
});
side.addEventListener("change", (e) => {
  if (e.target.id === "camSel") { cfg.deviceId = e.target.value; saveCfg(); startCamera(); }
});
side.addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.tab) { activeTab = b.dataset.tab; renderPanel(); return; }
  if (b.dataset.lang) { cfg.lang = b.dataset.lang; saveCfg(); renderPanel(); return; }
  if (b.dataset.seg) {
    const k = b.dataset.seg, it = findItem(k);
    cfg[k] = typeof it.o[0].v === "number" ? Number(b.dataset.v) : b.dataset.v;
    for (const s of b.parentElement.children) s.classList.toggle("on", s === b);
    onChange(k); return;
  }
  if (b.id === "close" || b.id === "closePanel") openPanel(false);
  else if (b.id === "camRefresh") startCamera();
  else if (b.id === "resetView") { for (const k of ["rot", "tilt", "mirror", "flipY", "fit", "zoom", "offX", "offY"]) cfg[k] = DEFAULTS[k]; saveCfg(); renderPanel(); }
  else if (b.id === "force") { force = !force; syncButtons(); }
  else if (b.id === "jumpFull") level = 1;
  else if (b.id === "fullscreen") toggleFullscreen();
  else if (b.id === "resetShow") { level = 0; resetFx(); }
});

// 右上角连点三下打开面板（展场没有键盘时用）
let hotClicks = [];
$("#hotspot").addEventListener("pointerdown", () => {
  const t = performance.now(); hotClicks = hotClicks.filter((x) => t - x < 800); hotClicks.push(t);
  if (hotClicks.length >= 3) { hotClicks = []; openPanel(!side.classList.contains("open")); }
});
addEventListener("pointerdown", initAudio);
addEventListener("keydown", (e) => {
  initAudio();
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
  const k = e.key.toLowerCase();
  if (k === "s") openPanel(!side.classList.contains("open"));
  else if (k === "escape") openPanel(false);
  else if (k === "d") { cfg.debug = !cfg.debug; saveCfg(); renderPanel(); }
  else if (k === "f") toggleFullscreen();
  else if (k === "p") { force = !force; syncButtons(); }
  else if (k === "r") { level = 0; resetFx(); }
});

// 状态栏
setInterval(() => {
  const bar = $("#levelBar"); if (bar) bar.style.width = (level * 100).toFixed(1) + "%";
  $("#statusbar").innerHTML = `<span class="dot"></span>LOCAL<span>${landmarker ? "model ok" : "model…"}</span>` +
    `<span>faces <b class="v">${faces.length}</b></span><span>${track}</span><span>level <b class="v">${(level * 100).toFixed(0)}%</b></span><span>${fps.toFixed(0)} fps</span>`;
  if (!camError && $("#camInfo") && video.videoWidth && !$("#camInfo").textContent) renderCamSelect();
}, 250);

// ---------- 手机 / 展场 ----------
// 防 iOS 双指缩放和长按菜单；屏幕常亮；横竖屏切换、地址栏伸缩时重算画布
addEventListener("gesturestart", (e) => e.preventDefault());
addEventListener("contextmenu", (e) => e.preventDefault());
let wakeLock = null;
async function keepAwake() {
  try { if ("wakeLock" in navigator && document.visibilityState === "visible" && !wakeLock) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => { wakeLock = null; }); } } catch {}
}
document.addEventListener("visibilitychange", keepAwake);
addEventListener("pointerdown", keepAwake);
if (window.visualViewport) visualViewport.addEventListener("resize", resize);
addEventListener("orientationchange", () => setTimeout(resize, 250));
function toggleFullscreen() {
  const d = document, el = d.documentElement;
  if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
  else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
}
// 手机没有键盘：两指按住屏幕 1.2 秒也能打开设置（右上角连点三下同样可以）
let twoFingerTimer = 0;
addEventListener("touchstart", (e) => {
  if (e.touches.length >= 2) { clearTimeout(twoFingerTimer); twoFingerTimer = setTimeout(() => openPanel(!side.classList.contains("open")), 1200); }
}, { passive: true });
addEventListener("touchend", () => clearTimeout(twoFingerTimer), { passive: true });
addEventListener("touchcancel", () => clearTimeout(twoFingerTimer), { passive: true });

// ---------- 启动 ----------
// 这个作品用到的模型（设置 → 识别 → 模型 里可以下载）
const MODEL_DIR = "../models/";
const MODELS = [
  { file: "face_landmarker.task", size: "3.6 MB", use: T("人脸 478 点 + 表情 + 头部姿态", "Face 478 landmarks + blendshapes + pose", "얼굴 478점 + 표정 + 자세"), src: "Google MediaPipe · Apache-2.0" },
  { file: "selfie_multiclass_256x256.tflite", size: "15.6 MB", use: T("人物分割（手、头发挡住面具）", "Person segmentation (hands / hair occlude the mask)", "인물 분할 (손·머리카락 가림)"), src: "Google MediaPipe · Apache-2.0" },
];const ZIP_NAME = "ghost-mirror-models.zip";
// 模型 zip：点按钮时在网页里现场把这个作品用到的模型打成一个 zip（不压缩）。
// 模型加起来超过 GitHub 单文件 100 MB 上限，放不了现成的 zip，所以在浏览器里打包。
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (d) => { let c = 0xffffffff; for (let i = 0; i < d.length; i++) c = CRC_T[(c ^ d[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
async function downloadModelsZip(zipName, list, onProgress) {
  const enc = new TextEncoder(), parts = [], central = [];
  let off = 0;
  const notes = ["Models used by " + zipName.replace(/\.zip$/, ""), "Put this models/ folder next to the demo folders (互动demo/models/).", ""];
  const entries = [];
  for (let i = 0; i < list.length; i++) {
    onProgress && onProgress(i, list.length);
    const m = list[i], r = await fetch(MODEL_DIR + m.file);
    if (!r.ok) throw new Error(m.file + " " + r.status);
    entries.push({ name: "models/" + m.file, data: new Uint8Array(await r.arrayBuffer()) });
    notes.push(`${m.file}  ${m.size}  ${m.src}`);
  }
  entries.push({ name: "models/README.txt", data: enc.encode(notes.join("\r\n") + "\r\n") });
  for (const { name: n, data } of entries) {
    const name = enc.encode(n), crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(12, 0x21, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
    parts.push(h, name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(14, 0x21, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    central.push(c, name);
    off += 30 + name.length + data.length;
  }
  const csize = central.reduce((s, x) => s + x.byteLength, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, entries.length, true); e.setUint16(10, entries.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
  const url = URL.createObjectURL(new Blob([...parts, ...central, e], { type: "application/zip" }));
  const a = document.createElement("a"); a.href = url; a.download = zipName; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// 模型 zip 按钮（面板会重绘，所以用事件委托）
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("#zipModels"); if (!b || b.disabled) return;
  const label = b.textContent; b.disabled = true;
  downloadModelsZip(ZIP_NAME, MODELS, (i, n) => { b.textContent = `${i + 1} / ${n} …`; })
    .then(() => { b.textContent = label; }).catch((err) => { console.warn(err); b.textContent = "✕ " + err.message; })
    .finally(() => { b.disabled = false; setTimeout(() => { b.textContent = label; }, 4000); });
});

// 先读自带的模型文件（GitHub 上是 ghost-series/models/，本地服务器把 /models/ 映射到 互动demo/models/），读不到再用官方地址；
// 每个实例一份拷贝，MediaPipe 会占用传进去的缓冲区
const modelBytes = {};
async function modelAsset(file, url) {
  if (!(file in modelBytes)) modelBytes[file] = fetch(MODEL_DIR + file).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => (b ? new Uint8Array(b) : null)).catch(() => null);
  const b = await modelBytes[file];
  return b ? { modelAssetBuffer: b.slice() } : { modelAssetPath: url };
}
async function loadSegmenter(fs) {
  const asset = await modelAsset("selfie_multiclass_256x256.tflite", SEG_URL);
  const opts = (delegate) => ({ baseOptions: { ...asset, delegate }, runningMode: "VIDEO", outputCategoryMask: true, outputConfidenceMasks: false });
  try { return await ImageSegmenter.createFromOptions(fs, opts("GPU")); }
  catch (e) { console.warn("分割 GPU 不可用，改用 CPU", e); return await ImageSegmenter.createFromOptions(fs, opts("CPU")); }
}
async function loadModel() {
  const fs = await FilesetResolver.forVisionTasks(WASM_URL);
  // 分割模型单独加载，失败只是没有遮挡，不影响主流程
  loadSegmenter(fs).then((s) => { segmenter = s; }).catch((e) => console.warn("分割模型加载失败，只用脸轮廓裁剪", e));
  return loadLandmarker("VIDEO", fs);
}
// 人脸模型的三个置信度一起调（检测 / 存在 / 跟踪）；改了立刻生效，不用重新加载
const faceConfOpts = () => ({ minFaceDetectionConfidence: cfg.faceConf, minFacePresenceConfidence: cfg.faceConf, minTrackingConfidence: cfg.faceConf });
function applyFaceConf() { for (const m of [landmarker, tileLm]) if (m) m.setOptions(faceConfOpts()).catch((e) => console.warn(e)); }
async function loadLandmarker(mode, fs) {
  fs = fs || await FilesetResolver.forVisionTasks(WASM_URL);
  const asset = await modelAsset("face_landmarker.task", MODEL_URL);
  const opts = (delegate) => ({
    baseOptions: { ...asset, delegate },
    runningMode: mode, numFaces: 5,
    outputFacialTransformationMatrixes: true, outputFaceBlendshapes: true,
    ...faceConfOpts(),
  });
  try { return await FaceLandmarker.createFromOptions(fs, opts("GPU")); }
  catch (e) { console.warn("GPU 不可用，改用 CPU", e); return await FaceLandmarker.createFromOptions(fs, opts("CPU")); }
}

resize();
resetFx();
renderPanel();
startCamera();
loadFaceAssets().catch((e) => console.warn("鬼脸贴图不可用", e));
// 调试用：控制台里 __gm 查看状态
window.__gm = { get people() { return people; }, get faces() { return faces; }, FACE_TEX, get faceReady() { return faceReady; }, get gl() { return gl; }, glC, cfg };
loadModel().then((lm) => { landmarker = lm; }).catch((e) => { camError = "model: " + e.message; openPanel(true); renderCamSelect(); });
requestAnimationFrame(loop);
