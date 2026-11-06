// 鬼神系列 03 · 冥婚
// 镜面画面：中间一张凳子，有人坐上去 → 两边的鬼新郎、鬼新娘显形 → 随机做动作；
// 观众头偏向哪边，哪边的鬼凑过来互动，另一边隐去；头回正两个都回来；人离开就消失。
// 现在的鬼是程序画的“纸扎人”占位，之后换成提供的素材（动作接口不变）。
import { FaceLandmarker, FilesetResolver, ImageSegmenter } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const SEG_URL = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite";
// 模型优先从自带的 models 文件夹加载（GitHub 上是 ghost-series/models/，本地服务器把 /models/ 映射到 互动demo/models/），失败再用官方地址
const MODEL_DIR = "../models/";
const ORT_URL = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/";

const $ = (s) => document.querySelector(s);
const canvas = $("#stage");
const ctx = canvas.getContext("2d");
const video = $("#cam");
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const env = (u) => Math.sin(Math.PI * clamp(u, 0, 1)); // 0 → 1 → 0
const smooth = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };

// ---------- 参数 ----------
const DEFAULTS = {
  lang: "zh", deviceId: "", res: "720", rot: 0, mirror: true, flipY: false,
  seatX: 0.5, seatY: 0.5, seatW: 0.5, seatH: 0.6, minFace: 0.1, farScan: "off", headDet: "off", headConf: 0.35, faceConf: 0.5, headEvery: 0.5, dwell: 1.5, leaveGrace: 1.2,
  turnThresh: 0.14, lookHold: 0.5, smooth: 1.2, debug: false,
  ghostDist: 1.9, ghostRise: 0.35, ghostScale: 1, brideSide: "right", actRate: 1, tInteract: 6, otherFade: 0,
  occlusion: true, blackBg: true, decor: true, grade: 0.7, volume: 0.7,
};
const CFG_KEY = "ghostWeddingCfg.v1";
let cfg = loadCfg();
function loadCfg() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(CFG_KEY) || "{}") }; }
  catch { return { ...DEFAULTS }; }
}
function saveCfg() { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch {} }
const T = (zh, en, ko) => ({ zh, en, ko });
const tr = (o) => (typeof o === "string" ? o : o[cfg.lang] || o.zh);

// ---------- 画布与视图 ----------
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, matchMedia("(pointer: coarse)").matches ? 1.5 : 2); // 手机像素比太高时限制到 1.5，省性能
  W = innerWidth; H = innerHeight;
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  layer.width = canvas.width; layer.height = canvas.height;
}
addEventListener("resize", resize);
// 鬼和装饰先画在这层，再用人物分割扣掉人，贴回画面：鬼就站在人身后
const layer = document.createElement("canvas"), lx = layer.getContext("2d");

// 摄像头转正 + 镜像都做进 frame
const frame = document.createElement("canvas"), fctx = frame.getContext("2d");
function updateFrame() {
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || video.readyState < 2) return false;
  const side = cfg.rot % 180 !== 0, fw = side ? vh : vw, fh = side ? vw : vh;
  if (frame.width !== fw || frame.height !== fh) { frame.width = fw; frame.height = fh; }
  fctx.setTransform(1, 0, 0, 1, fw / 2, fh / 2);
  fctx.rotate(cfg.rot * Math.PI / 180); fctx.scale(cfg.mirror ? -1 : 1, cfg.flipY ? -1 : 1);
  fctx.drawImage(video, -vw / 2, -vh / 2);
  return true;
}
let VM = new DOMMatrix();
function updateView() {
  const fw = frame.width || 1280, fh = frame.height || 720, s = Math.max(W / fw, H / fh);
  VM = new DOMMatrix().translateSelf(W / 2, H / 2).scaleSelf(s).translateSelf(-fw / 2, -fh / 2);
}
const scr = (x, y) => ({ x: VM.a * x + VM.c * y + VM.e, y: VM.b * x + VM.d * y + VM.f });
const lmS = (l) => scr(l.x * frame.width, l.y * frame.height);

// ---------- 声音 ----------
let ac = null, master = null, droneGain = null;
function initAudio() {
  if (ac) { if (ac.state === "suspended") ac.resume(); return; }
  ac = new (window.AudioContext || window.webkitAudioContext)();
  const comp = ac.createDynamicsCompressor();
  master = ac.createGain(); master.gain.value = cfg.volume; master.connect(comp); comp.connect(ac.destination);
  droneGain = ac.createGain(); droneGain.gain.value = 0;
  const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 300;
  for (const [type, fr] of [["sawtooth", 55], ["sine", 58.3], ["triangle", 110.6]]) { const o = ac.createOscillator(); o.type = type; o.frequency.value = fr; o.connect(f); o.start(); }
  f.connect(droneGain); droneGain.connect(master);
}
function noise(dur) {
  const b = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = ac.createBufferSource(); s.buffer = b; return s;
}
function envG(g, t, peak, a, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function panned(pan) { const p = ac.createStereoPanner ? ac.createStereoPanner() : ac.createGain(); if (p.pan) p.pan.value = pan; p.connect(master); return p; }
function sndAppear() {
  if (!ac) return; const t = ac.currentTime;
  const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(48, t); o.frequency.exponentialRampToValueAtTime(30, t + 1.6);
  envG(g, t, 0.6, 0.02, 1.7); o.connect(g); g.connect(master); o.start(t); o.stop(t + 1.8);
  const n = noise(2), nf = ac.createBiquadFilter(), ng = ac.createGain(); nf.type = "bandpass"; nf.frequency.setValueAtTime(400, t); nf.frequency.exponentialRampToValueAtTime(3000, t + 1.4);
  envG(ng, t, 0.18, 1.2, 0.5); n.connect(nf); nf.connect(ng); ng.connect(master); n.start(t);
}
// 走调的五声音阶单音（像远处的喜乐）
function sndNote(pan) {
  if (!ac) return; const t = ac.currentTime, scale = [0, 2, 4, 7, 9, 12];
  const f0 = 330 * 2 ** ((scale[Math.random() * scale.length | 0] + rnd(-0.6, 0.6)) / 12);
  const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(); o.type = "triangle"; o2.type = "sine";
  o.frequency.value = f0; o2.frequency.value = f0 * 1.007; envG(g, t, 0.07, 0.01, 2.2);
  const out = panned(pan); o.connect(g); o2.connect(g); g.connect(out); o.start(t); o2.start(t); o.stop(t + 2.4); o2.stop(t + 2.4);
}
// 耳语：带通噪声 + 断断续续的音节包络，只从互动那一侧出来
function sndWhisper(pan, dur) {
  if (!ac) return; const t = ac.currentTime;
  const n = noise(dur + 0.1), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = "bandpass"; f.frequency.value = 2200; f.Q.value = 1.4;
  g.gain.setValueAtTime(0.0001, t);
  for (let k = 0; k < dur / 0.18; k++) { const tt = t + k * 0.18 + rnd(0, 0.06); g.gain.linearRampToValueAtTime(rnd(0.05, 0.22), tt + 0.04); g.gain.linearRampToValueAtTime(0.005, tt + rnd(0.1, 0.16)); }
  n.connect(f); f.connect(g); g.connect(panned(pan)); n.start(t); n.stop(t + dur + 0.1);
}
function sndVanish() { if (!ac) return; const t = ac.currentTime, n = noise(0.5), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = "highpass"; f.frequency.value = 2500; envG(g, t, 0.2, 0.005, 0.4); n.connect(f); f.connect(g); g.connect(master); n.start(t); }

// ---------- 识别 ----------
let landmarker = null, segmenter = null, faces = [], force = false, lastVideoTime = -1, canonVerts = null;
function analyze(res) {
  const out = [], lms = res.faceLandmarks || [], aspect = frame.height / frame.width;
  for (const l of lms) out.push({ lm: l, width: Math.hypot(l[234].x - l[454].x, (l[234].y - l[454].y) * aspect), cx: l[1].x, cy: l[1].y });
  return out;
}
// ---------- 远距离：分块检测 ----------
// 整幅画面送进模型会被缩小，远处的小脸（只占画面宽 5% 左右）检测不到。
// 打开后把画面切成几块、每帧轮流检测一块；已经找到的小脸再每帧在他附近裁一块精确跟踪。
let tileLm = null, tileLoading = false, tileIdx = 0, tileFaces = [], roiFaces = [];
const tileC = document.createElement("canvas"), tctx = tileC.getContext("2d");
// 人头模型加载不了时，自动退回放大切片 3×2
const farMode = () => (cfg.farScan !== "off" ? cfg.farScan : cfg.headDet !== "off" && headFailed ? "3x2" : "off");
function tileRects() {
  const [nx, ny] = farMode() === "3x2" ? [3, 2] : [2, 2], ov = 1.3, out = [];
  const w = Math.min(1, ov / nx), h = Math.min(1, ov / ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++)
    out.push({ x: clamp((i + 0.5) / nx - w / 2, 0, 1 - w), y: clamp((j + 0.5) / ny - h / 2, 0, 1 - h), w, h });
  return out;
}
function roiRect(f) { // 以鼻尖为中心、约 3.5 倍脸宽的方块
  const fw = frame.width, fh = frame.height, side = clamp(f.width * fw * 3.5, 160, Math.min(fw, fh));
  const w = side / fw, h = side / fh;
  return { x: clamp(f.cx - w / 2, 0, 1 - w), y: clamp(f.cy - h / 2, 0, 1 - h), w, h };
}
function detectCrop(r) {
  const fw = frame.width, fh = frame.height, sw = r.w * fw, sh = r.h * fh, k = Math.min(1, 640 / Math.max(sw, sh));
  tileC.width = Math.round(sw * k); tileC.height = Math.round(sh * k);
  tctx.drawImage(frame, r.x * fw, r.y * fh, sw, sh, 0, 0, tileC.width, tileC.height);
  const res = tileLm.detect(tileC);
  return analyze({ faceLandmarks: (res.faceLandmarks || []).map((l) => l.map((q) => ({ x: r.x + q.x * r.w, y: r.y + q.y * r.h, z: q.z * r.w }))) });
}
function mergeFar(base, prev, now) {
  if (farMode() === "off") return base;
  if (!tileLm) {
    if (!tileLoading) { tileLoading = true; loadTileModel().then((m) => { tileLm = m; }).catch((e) => { console.warn("分块检测模型加载失败", e); tileLoading = false; }); }
    return base;
  }
  const rects = tileRects();
  try {
    tileIdx = (tileIdx + 1) % rects.length;
    tileFaces[tileIdx] = { t: now, faces: detectCrop(rects[tileIdx]) };
    tileFaces.length = rects.length;
    roiFaces = [];
    for (const f of prev.filter((q) => !q.fake && q.width < 0.12).slice(0, 2)) roiFaces.push(...detectCrop(roiRect(f)));
  } catch (e) { console.warn(e); }
  // 合并去重：整幅画面的结果优先，其次每帧裁的，最后是轮流扫的块
  const all = [...base];
  const add = (f) => { if (!all.some((g) => Math.hypot(g.cx - f.cx, g.cy - f.cy) < Math.max(g.width, f.width) * 0.6)) all.push(f); };
  roiFaces.forEach(add);
  for (const tf of tileFaces) if (tf && now - tf.t < rects.length * 70 + 250) tf.faces.forEach(add);
  return all;
}
// ---------- 人头检测（YOLOv8 head，SCUT-HEAD 训练，ONNX，MIT）----------
// 坐着低头看手机的人，人脸模型找不到。打开后凳子区域里有人头也算坐下（鬼照样出来），抬头看到脸才判断偏头。
// 凳子上已经有脸时不再跑人头检测。
const HEAD_MODELS = { nano: "yolo-head-nano.onnx", medium: "yolo-head-medium.onnx" };
let headSess = null, headName = "", headEP = "", headLoading = false, headFailed = false, headBusy = false, headAt = 0, headMs = 0, heads = [], headErr = "";
const headC = document.createElement("canvas"); headC.width = headC.height = 640;
const hctx = headC.getContext("2d", { willReadFrequently: true });
function loadScript(src) { return new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }
async function ensureHead() {
  if (cfg.headDet === "off" || headLoading) return null;
  if (headSess && headName === cfg.headDet) return headSess;
  if (headFailed && ensureHead.failed === cfg.headDet) return null; // 同一个模型失败过就不反复重试
  headLoading = true; ensureHead.failed = cfg.headDet;
  try {
    if (!window.ort) await loadScript(ORT_URL + "ort.webgpu.min.js");
    ort.env.wasm.wasmPaths = ORT_URL;
    const name = cfg.headDet;
    const headBytes = (await modelAsset(HEAD_MODELS[name], null)).modelAssetBuffer; // 本地文件夹 → 网站 models/，没有官方备用地址
    if (!headBytes) throw new Error(HEAD_MODELS[name] + " missing");
    for (const ep of ["webgpu", "wasm"]) {
      try { headSess = await ort.InferenceSession.create(headBytes, { executionProviders: [ep] }); headName = name; headEP = ep; headErr = ""; headFailed = false; break; }
      catch (e) { console.warn("人头模型", ep, e); headErr = String(e.message || e); }
    }
  } catch (e) { headErr = String(e.message || e); } finally { headLoading = false; }
  if (!(headSess && headName === cfg.headDet)) headFailed = true;
  return headSess && headName === cfg.headDet ? headSess : null;
}
// 整幅画面按长边缩到 640、补灰边，跑 YOLOv8；输出 [1, 5, N]：cx cy w h score
async function detectHeads(sess) {
  const fw = frame.width, fh = frame.height, k = 640 / Math.max(fw, fh);
  hctx.fillStyle = "#727272"; hctx.fillRect(0, 0, 640, 640); hctx.drawImage(frame, 0, 0, fw * k, fh * k);
  const d = hctx.getImageData(0, 0, 640, 640).data, N = 640 * 640, f = new Float32Array(3 * N);
  for (let i = 0, p = 0; i < N; i++, p += 4) { f[i] = d[p] / 255; f[i + N] = d[p + 1] / 255; f[i + 2 * N] = d[p + 2] / 255; }
  const out = await sess.run({ [sess.inputNames[0]]: new ort.Tensor("float32", f, [1, 3, 640, 640]) });
  const o = out[sess.outputNames[0]], n = o.dims[2], a = o.data, bs = [];
  for (let i = 0; i < n; i++) { const s = a[4 * n + i]; if (s >= cfg.headConf) bs.push({ cx: a[i] / k / fw, cy: a[n + i] / k / fh, w: a[2 * n + i] / k / fw, h: a[3 * n + i] / k / fh, s }); }
  bs.sort((p, q) => q.s - p.s); const keep = [];
  for (const b of bs) if (keep.every((q) => Math.hypot(q.cx - b.cx, q.cy - b.cy) > Math.max(q.w, b.w) * 0.5)) keep.push(b);
  return keep;
}
function headTick(now) {
  if (cfg.headDet === "off" || headBusy || now - headAt < cfg.headEvery * 1000 || !frame.width) return;
  if (faces.some((f) => !f.fake && inSeat(f))) return; // 凳子上有脸：不用找头
  headBusy = true; headAt = now;
  (async () => {
    const sess = await ensureHead(); if (!sess) return;
    const t0 = performance.now(); heads = await detectHeads(sess); headMs = performance.now() - t0; heads.at = performance.now();
  })().catch((e) => { console.warn(e); headErr = String(e.message || e); }).finally(() => { headBusy = false; });
}
// 凳子区域里最大的人头（最近一次检测在 2 秒内）
const inSeatHead = (h) => Math.abs(h.cx - cfg.seatX) < cfg.seatW / 2 && Math.abs(h.cy - cfg.seatY) < cfg.seatH / 2 && h.w >= cfg.minFace * 0.8;
function seatHead(now) {
  if (cfg.headDet === "off" || !heads.at || now - heads.at > Math.max(2000, cfg.headEvery * 3000)) return null;
  let best = null; for (const h of heads) if (inSeatHead(h) && (!best || h.w > best.w)) best = h; return best;
}

// 测试用假脸：坐在凳子区域里，按“正 → 左 → 正 → 右”循环转头；←/→ 键可手动转头
let fakeYawKey = 0, fakeYawKeyAt = 0;
function fakeFace(now) {
  const t = now / 1000 % 14;
  let yaw = t < 4 ? 0 : t < 7 ? -0.6 : t < 10 ? 0 : 0.6;
  if (now - fakeYawKeyAt < 3000) yaw = fakeYawKey;
  fakeFace.y = lerp(fakeFace.y || 0, yaw, 0.08);
  const a = fakeFace.y, k = 0.2 / 15.3, ky = k * frame.width / frame.height, c = Math.cos(a), sn = Math.sin(a), lm = [];
  for (let i = 0; i < 468; i++) {
    const x = canonVerts[i * 3], y = canonVerts[i * 3 + 1], z = canonVerts[i * 3 + 2];
    lm.push({ x: cfg.seatX + (x * c + z * sn) * k, y: cfg.seatY - 0.05 - y * ky, z: -(-x * sn + z * c) * k });
  }
  for (let i = 468; i < 478; i++) lm.push({ ...lm[1] });
  return { lm, width: Math.hypot(lm[234].x - lm[454].x, (lm[234].y - lm[454].y) * frame.height / frame.width), cx: lm[1].x, cy: lm[1].y, fake: true };
}
// One Euro 防抖（整张脸共用截止频率）
let sm = null;
function smoothLm(lm, now) {
  const n = lm.length, fw = frame.width, fh = frame.height;
  if (!sm || sm.n !== n) {
    sm = { n, t: now, x: new Float32Array(n), y: new Float32Array(n), v: 0, nx: lm[1].x * fw, ny: lm[1].y * fh, out: lm.map((q) => ({ ...q })) };
    for (let i = 0; i < n; i++) { sm.x[i] = lm[i].x * fw; sm.y[i] = lm[i].y * fh; } return sm.out;
  }
  const dt = Math.max(1e-3, (now - sm.t) / 1000); sm.t = now;
  const alpha = (cut) => 1 / (1 + 1 / (2 * Math.PI * cut * dt));
  const nx = lm[1].x * fw, ny = lm[1].y * fh; sm.v += alpha(1) * (Math.hypot(nx - sm.nx, ny - sm.ny) / dt - sm.v); sm.nx = nx; sm.ny = ny;
  const a = alpha(cfg.smooth + 0.012 * sm.v);
  for (let i = 0; i < n; i++) { sm.x[i] += a * (lm[i].x * fw - sm.x[i]); sm.y[i] += a * (lm[i].y * fh - sm.y[i]); sm.out[i].x = sm.x[i] / fw; sm.out[i].y = sm.y[i] / fh; sm.out[i].z = lm[i].z; }
  return sm.out;
}
const inSeat = (f) => Math.abs(f.cx - cfg.seatX) < cfg.seatW / 2 && Math.abs(f.cy - cfg.seatY) < cfg.seatH / 2 && f.width >= cfg.minFace;

// 人物遮罩：多类分割里“不是背景”的像素就是人（头发、皮肤、衣服）
let maskReady = false, maskAt = 0, maskImg = null;
const segIn = document.createElement("canvas"), segCtx = segIn.getContext("2d");
const maskC = document.createElement("canvas"), maskX = maskC.getContext("2d");
function runSegment(now) {
  const sw = 320, sh = Math.max(8, Math.round(320 * frame.height / frame.width));
  if (segIn.width !== sw || segIn.height !== sh) { segIn.width = maskC.width = sw; segIn.height = maskC.height = sh; maskImg = maskX.createImageData(sw, sh); maskReady = false; }
  segCtx.drawImage(frame, 0, 0, sw, sh);
  segmenter.segmentForVideo(segIn, now, (res) => {
    const m = res.categoryMask; if (!m) return;
    const a = m.getAsUint8Array(); if (a.length !== sw * sh) return;
    const d = maskImg.data; for (let i = 0; i < a.length; i++) d[i * 4 + 3] = a[i] === 0 ? 0 : 255;
    maskX.putImageData(maskImg, 0, 0); maskReady = true; maskAt = now;
  });
}

// ---------- 场景状态 ----------
// empty（空凳子）→ seated（坐稳计时）→ show（鬼在，待机 / 互动）→ leaving（离开）→ empty
const scene = { phase: "empty", t: 0, dwell: 0, lastSeen: 0, look: 0, lookRaw: 0, lookT: 0, side: 0, sideT: 0, anchor: null, sitter: null };
const ghosts = [
  { kind: "groom", side: -1 }, { kind: "bride", side: 1 },
].map((g) => Object.assign(g, { alpha: 0, act: null, actT: 0, nextAct: rnd(2, 4), rs: 1, P: {}, flick: 0 }));
function ghostSides() { const b = cfg.brideSide === "left" ? -1 : 1; ghosts[1].side = b; ghosts[0].side = -b; }

// 随机动作：每个返回这一刻要叠加到姿势上的量（u = 0..1）
const ACTIONS = {
  tilt: { dur: 3.2, fn: (u, g) => ({ tilt: 0.38 * env(u) * g.rs }) },
  stare: { dur: 4.5, fn: (u, g) => ({ turn: -g.side * smooth(u * 3) * env(u) ** 0.3, lean: -g.side * 0.06 * env(u) }) },
  bow: { dur: 3.4, fn: (u) => ({ bow: env(u), armIn: 0.5 * env(u), armOut: 0.5 * env(u) }) },
  raise: { dur: 4.2, fn: (u, g) => ({ armIn: 1.25 * env(u), turn: -g.side * 0.8 * env(u) }) },
  twitch: { dur: 0.9, fn: () => ({ jit: 1, tilt: rnd(-0.5, 0.5) }) },
  blink: { dur: 1.9, fn: (u) => ({ hide: u < 0.18 || u > 0.86 ? 1 : 0, near: u >= 0.18 && u <= 0.86 ? 0.55 : 0 }) },
  sway: { dur: 5, fn: (u) => ({ lean: 0.14 * Math.sin(u * Math.PI * 4) * env(u) }) },
  veil: { dur: 3.2, only: "bride", fn: (u) => ({ veil: 0.32 * env(u) }) },
  sleeve: { dur: 3.6, fn: (u) => ({ armOut: 0.9 * env(u), tilt: 0.12 * env(u) }) },
};
// 互动：凑到观众脸边，转头盯着；新郎伸手，新娘掀盖头
function interactPose(u, g) {
  const inn = smooth(u / 0.25), out = 1 - smooth((u - 0.85) / 0.15);
  const k = inn * out;
  return { near: k, turn: -g.side * k, tilt: -g.side * 0.25 * k, armIn: g.kind === "groom" ? 1.1 * k : 0.35 * k, veil: g.kind === "bride" ? smooth((u - 0.2) / 0.3) * out : 0, whisper: k };
}

function pickAction(g, now) {
  const names = Object.keys(ACTIONS).filter((n) => !ACTIONS[n].only || ACTIONS[n].only === g.kind);
  const name = names[Math.random() * names.length | 0];
  g.act = name; g.actT = 0; g.rs = Math.random() < 0.5 ? -1 : 1;
  if (name === "twitch" || name === "blink") sndVanish();
  else if (Math.random() < 0.5) sndNote(g.side * 0.7);
}

function updateScene(now, dt) {
  ghostSides();
  // 找坐在凳子上的人：区域里最大的脸
  let sit = null; for (const f of faces) if (inSeat(f) && (!sit || f.width > sit.width)) sit = f;
  if (sit) { scene.lastSeen = now; scene.sitter = sit; scene.slm = smoothLm(sit.lm, now); scene.head = null; }
  // 没有脸但凳子上有人头（低头）：也算坐着；鬼的位置跟着头框，偏头回到正中
  const hd = !sit && seatHead(now);
  if (hd) { scene.lastSeen = now; scene.sitter = scene.sitter || hd; scene.head = hd; scene.slm = null; sm = null; sit = hd; }
  const present = sit || (scene.sitter && now - scene.lastSeen < cfg.leaveGrace * 1000);
  scene.t += dt;
  if (scene.phase === "empty") {
    scene.dwell = present && sit ? scene.dwell + dt : Math.max(0, scene.dwell - dt * 2);
    if (scene.dwell >= cfg.dwell) { scene.phase = "show"; scene.t = 0; sndAppear(); for (const g of ghosts) { g.flick = 1.2; g.nextAct = rnd(1.5, 3.5); g.act = null; } }
  } else if (scene.phase === "show") {
    if (!present) { scene.phase = "leaving"; scene.t = 0; sndVanish(); }
  } else if (scene.phase === "leaving") {
    if (present && sit) { scene.phase = "show"; scene.t = 0; }
    else if (scene.t > 1.2) { scene.phase = "empty"; scene.dwell = 0; scene.side = 0; scene.sitter = null; scene.head = null; sm = null; }
  }
  if (droneGain) droneGain.gain.setTargetAtTime(scene.phase === "show" ? 0.2 : 0.04, ac.currentTime, 0.6);

  // 锚点（鬼跟着坐着的人的脸放）平滑跟随
  if (scene.slm) {
    const P = (i) => lmS(scene.slm[i]);
    const a = P(234), b = P(454), n = P(1), mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const s = Math.hypot(a.x - b.x, a.y - b.y), cy = (P(10).y + P(152).y) / 2;
    const tgt = { x: mid.x, y: cy, s };
    scene.anchor = scene.anchor ? { x: lerp(scene.anchor.x, tgt.x, 1 - Math.exp(-dt * 4)), y: lerp(scene.anchor.y, tgt.y, 1 - Math.exp(-dt * 4)), s: lerp(scene.anchor.s, tgt.s, 1 - Math.exp(-dt * 3)) } : tgt;
    // 头偏向：鼻尖相对两颊中点的偏移（屏幕上，已镜像），左负右正
    scene.lookRaw = (n.x - mid.x) / Math.max(1, s);
    scene.look = lerp(scene.look, scene.lookRaw, 1 - Math.exp(-dt * 8));
  } else if (scene.head) {
    const h = scene.head, a = lmS({ x: h.cx - h.w / 2, y: h.cy }), b = lmS({ x: h.cx + h.w / 2, y: h.cy }), c = lmS({ x: h.cx, y: h.cy });
    const tgt = { x: c.x, y: c.y, s: Math.hypot(a.x - b.x, a.y - b.y) * 0.85 };
    scene.anchor = scene.anchor ? { x: lerp(scene.anchor.x, tgt.x, 1 - Math.exp(-dt * 4)), y: lerp(scene.anchor.y, tgt.y, 1 - Math.exp(-dt * 4)), s: lerp(scene.anchor.s, tgt.s, 1 - Math.exp(-dt * 3)) } : tgt;
    scene.look = lerp(scene.look, 0, 1 - Math.exp(-dt * 4)); // 看不到脸就当朝正前
  }
  // 偏头判定：超过阈值并保持一段时间 → 那一边互动；回正保持 0.4 秒 → 回到待机
  if (scene.phase === "show") {
    const want = scene.look < -cfg.turnThresh ? -1 : scene.look > cfg.turnThresh ? 1 : 0;
    const back = Math.abs(scene.look) < cfg.turnThresh * 0.6;
    if (scene.side === 0) {
      scene.lookT = want ? scene.lookT + dt : 0;
      if (want && scene.lookT >= cfg.lookHold) { scene.side = want; scene.sideT = 0; scene.lookT = 0; const g = ghosts.find((q) => q.side === want); sndWhisper(want * 0.9, Math.min(cfg.tInteract * 0.6, 4)); if (g) { g.act = null; } }
    } else {
      scene.sideT += dt;
      scene.lookT = back ? scene.lookT + dt : 0;
      if ((back && scene.lookT >= 0.4) || scene.sideT >= cfg.tInteract) { scene.side = 0; scene.lookT = 0; for (const g of ghosts) g.flick = 0.6; }
    }
  } else scene.side = 0;

  // 每个鬼：透明度、随机动作
  for (const g of ghosts) {
    let target = scene.phase === "show" ? 1 : 0;
    if (scene.side && g.side !== scene.side) target = cfg.otherFade; // 另一边隐去
    g.alpha = lerp(g.alpha, target, 1 - Math.exp(-dt * (target > g.alpha ? 2.5 : 4)));
    g.flick = Math.max(0, g.flick - dt);
    if (scene.phase !== "show" || scene.side) { if (scene.side && g.side !== scene.side) g.act = null; continue; }
    if (g.act) { g.actT += dt; if (g.actT >= ACTIONS[g.act].dur) { g.act = null; g.nextAct = rnd(2, 6) / cfg.actRate; } }
    else { g.nextAct -= dt; if (g.nextAct <= 0) pickAction(g, now); }
  }
}

// 当前姿势：待机呼吸 + 随机动作 + 互动
function poseOf(g, now) {
  const t = now / 1000 + (g.side > 0 ? 1.7 : 0);
  const P = { lean: 0.03 * Math.sin(t * 0.7), dy: 0.02 * Math.sin(t * 1.3), tilt: 0.04 * Math.sin(t * 0.5), turn: 0, armIn: 0.05 * Math.sin(t * 0.9), armOut: 0, bow: 0, veil: 0, near: 0, jit: 0, hide: 0, whisper: 0 };
  const add = (o) => { for (const k in o) P[k] = (k === "hide" || k === "jit") ? Math.max(P[k], o[k]) : P[k] + o[k]; };
  if (g.act) add(ACTIONS[g.act].fn(g.actT / ACTIONS[g.act].dur, g));
  if (scene.side === g.side && scene.phase === "show") add(interactPose(scene.sideT / cfg.tInteract, g));
  return P;
}

// ---------- 纸扎人占位（之后换成提供的素材） ----------
function drawPuppet(c, g, x, y, s, P, now) {
  const jx = P.jit ? rnd(-0.08, 0.08) * s : 0, jy = P.jit ? rnd(-0.05, 0.05) * s : 0;
  c.save(); c.translate(x + jx, y + (P.dy + P.bow * 0.18) * s + jy); c.rotate(P.lean); c.scale(P.sc, P.sc);
  const robe = g.kind === "bride" ? "#9c1a1a" : "#7c1515", trim = "#c9a24a";
  const neck = 0.6 * s;
  // 袖子（先画外侧，内侧压在身体上面）
  const sleeve = (dir, ang) => {
    c.save(); c.translate(dir * 0.92 * s, neck + 0.2 * s); c.rotate(ang);
    c.fillStyle = robe; c.beginPath(); c.moveTo(-0.26 * s, 0); c.lineTo(0.26 * s, 0); c.lineTo(0.44 * s, 1.85 * s); c.lineTo(-0.4 * s, 1.85 * s); c.closePath(); c.fill();
    c.fillStyle = trim; c.fillRect(-0.42 * s, 1.72 * s, 0.86 * s, 0.13 * s);
    c.fillStyle = "#e4ded2"; c.beginPath(); c.ellipse(0, 1.95 * s, 0.13 * s, 0.1 * s, 0, 0, Math.PI * 2); c.fill();
    c.restore();
  };
  const inDir = -g.side; // 朝观众那一侧
  sleeve(-inDir, -inDir * 0.12 - inDir * P.armOut * 0.9);
  // 身体
  c.fillStyle = robe; c.beginPath(); c.moveTo(-0.95 * s, neck + 0.1 * s); c.lineTo(0.95 * s, neck + 0.1 * s); c.lineTo(1.35 * s, 4.8 * s); c.lineTo(-1.35 * s, 4.8 * s); c.closePath(); c.fill();
  c.strokeStyle = trim; c.lineWidth = 0.06 * s;
  c.beginPath(); c.moveTo(-0.38 * s, neck + 0.05 * s); c.lineTo(0, neck + 0.75 * s); c.lineTo(0.38 * s, neck + 0.05 * s); c.stroke(); // 交领
  c.beginPath(); c.moveTo(0, neck + 0.75 * s); c.lineTo(0, 4.8 * s); c.stroke();
  c.fillStyle = "#1c1210"; c.fillRect(-1.0 * s, neck + 1.55 * s, 2.0 * s, 0.16 * s); // 腰带
  if (g.kind === "groom") { // 胸前大红花
    c.fillStyle = "#d11f1f"; for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; c.beginPath(); c.ellipse(Math.cos(a) * 0.16 * s, neck + 1.05 * s + Math.sin(a) * 0.16 * s, 0.17 * s, 0.11 * s, a, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = "#f2c94c"; c.beginPath(); c.arc(0, neck + 1.05 * s, 0.07 * s, 0, Math.PI * 2); c.fill();
  }
  sleeve(inDir, inDir * 0.1 + inDir * (-P.armIn * 1.15)); // 内侧袖子：抬起伸向观众
  // 头
  c.save(); c.translate(0, -0.05 * s + P.bow * 0.12 * s); c.rotate(P.tilt + P.bow * 0.0);
  c.fillStyle = "#0d0b0a"; c.beginPath(); c.ellipse(0, -0.05 * s, 0.5 * s, 0.62 * s, 0, 0, Math.PI * 2); c.fill(); // 头发
  c.fillStyle = "#e6e0d4"; c.beginPath(); c.ellipse(0, 0.04 * s, 0.41 * s, 0.53 * s, 0, 0, Math.PI * 2); c.fill(); // 白脸
  const fx = P.turn * 0.15 * s;
  c.fillStyle = "rgba(205,40,40,0.55)"; for (const d of [-1, 1]) { c.beginPath(); c.arc(fx + d * 0.24 * s, 0.17 * s, 0.11 * s, 0, Math.PI * 2); c.fill(); } // 腮红
  c.strokeStyle = "#111"; c.lineWidth = 0.035 * s; c.lineCap = "round";
  for (const d of [-1, 1]) { c.beginPath(); c.arc(fx + d * 0.17 * s, -0.07 * s, 0.09 * s, Math.PI * 1.12, Math.PI * 1.88); c.stroke(); } // 细缝眼（弯着笑）
  c.fillStyle = "#b3151b"; c.beginPath(); c.ellipse(fx, 0.33 * s, 0.07 * s, 0.035 * s + P.whisper * 0.03 * s * (0.5 + 0.5 * Math.sin(now / 70)), 0, 0, Math.PI * 2); c.fill(); // 小红嘴
  if (g.kind === "groom") { // 乌纱帽
    c.fillStyle = "#121212"; c.beginPath(); c.ellipse(0, -0.5 * s, 0.46 * s, 0.24 * s, 0, Math.PI, 0); c.fill();
    c.fillRect(-0.46 * s, -0.5 * s, 0.92 * s, 0.12 * s);
    for (const d of [-1, 1]) { c.beginPath(); c.ellipse(d * 0.72 * s, -0.48 * s, 0.3 * s, 0.07 * s, d * 0.08, 0, Math.PI * 2); c.fill(); }
  } else { // 凤冠 + 红盖头（veil：0 盖着 → 1 掀开）
    c.fillStyle = trim; c.beginPath(); c.ellipse(0, -0.52 * s, 0.5 * s, 0.22 * s, 0, Math.PI, 0); c.fill();
    for (let k = -2; k <= 2; k++) { c.beginPath(); c.arc(k * 0.18 * s, -0.66 * s - Math.abs(k) * -0.04 * s, 0.05 * s, 0, Math.PI * 2); c.fill(); }
    const v = clamp(P.veil, 0, 1);
    c.save(); c.translate(0, -0.55 * s); c.rotate(-v * 2.4 * (inDir || 1) * 0.5); c.scale(1, 1 - v * 0.55);
    c.fillStyle = "#b8141a"; c.beginPath(); c.moveTo(-0.62 * s, 0); c.quadraticCurveTo(0, -0.12 * s, 0.62 * s, 0); c.lineTo(0.66 * s, 1.28 * s); c.quadraticCurveTo(0, 1.4 * s, -0.66 * s, 1.28 * s); c.closePath(); c.fill();
    c.strokeStyle = trim; c.lineWidth = 0.04 * s; c.beginPath(); c.moveTo(-0.64 * s, 1.24 * s); c.quadraticCurveTo(0, 1.36 * s, 0.64 * s, 1.24 * s); c.stroke();
    c.fillStyle = trim; for (let k = -3; k <= 3; k++) c.fillRect(k * 0.18 * s - 0.015 * s, 1.27 * s + Math.abs(k) * -0.01 * s, 0.03 * s, 0.16 * s); // 流苏
    c.restore();
  }
  c.restore();
  c.restore();
}

// 背景装饰：淡淡的囍字 + 两盏红灯笼（也画在“人身后”那层）
function drawDecor(c, now, amt) {
  if (!cfg.decor || amt <= 0) return;
  const t = now / 1000;
  c.save(); c.globalAlpha = amt;
  c.fillStyle = `rgba(150,20,20,${0.22 + 0.05 * Math.sin(t * 2.3)})`;
  c.font = `900 ${Math.min(W, H) * 0.42}px "Noto Serif SC", "SimSun", serif`; c.textAlign = "center"; c.textBaseline = "middle";
  c.fillText("囍", W / 2, H * 0.36);
  for (const d of [-1, 1]) {
    const lx0 = W / 2 + d * W * 0.36, ly0 = H * 0.12, sw = Math.sin(t * 0.9 + d) * 0.08, r = Math.min(W, H) * 0.06;
    c.save(); c.translate(lx0, 0); c.rotate(sw);
    c.strokeStyle = "rgba(60,40,30,0.9)"; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, ly0); c.stroke();
    const flick = 0.75 + 0.25 * Math.sin(t * 13 + d * 5) * Math.sin(t * 7.1);
    const glow = c.createRadialGradient(0, ly0 + r, 0, 0, ly0 + r, r * 3.2); glow.addColorStop(0, `rgba(255,80,50,${0.35 * flick})`); glow.addColorStop(1, "rgba(255,60,40,0)");
    c.fillStyle = glow; c.fillRect(-r * 3.2, ly0 + r - r * 3.2, r * 6.4, r * 6.4);
    c.fillStyle = `rgb(${180 * flick | 0},20,20)`; c.beginPath(); c.ellipse(0, ly0 + r, r * 0.85, r, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#2a1a10"; c.fillRect(-r * 0.4, ly0 - r * 0.05, r * 0.8, r * 0.15); c.fillRect(-r * 0.4, ly0 + r * 1.9, r * 0.8, r * 0.15);
    c.fillStyle = "rgba(255,210,120,0.8)"; c.font = `700 ${r * 0.8}px "Noto Serif SC", serif`; c.fillText("囍", 0, ly0 + r);
    c.restore();
  }
  c.restore();
}

// ---------- 每帧 ----------
let shake = 0, lastFrame = performance.now(), fps = 0;
// 纯黑背景时：只把“人”从摄像头画面里抠出来
const personC = document.createElement("canvas"), px = personC.getContext("2d");
function drawGradedFrame(c) {
  c.save(); c.transform(VM.a, VM.b, VM.c, VM.d, VM.e, VM.f);
  const g = cfg.grade; c.filter = `sepia(${0.45 * g}) saturate(${1 - 0.35 * g}) brightness(${1 - 0.3 * g}) contrast(${1 + 0.12 * g})`;
  c.drawImage(frame, 0, 0); c.restore(); c.filter = "none";
  c.fillStyle = `rgba(90,10,10,${0.18 * cfg.grade})`; c.fillRect(0, 0, W, H);
}
function drawPerson(now) {
  if (!(maskReady && now - maskAt < 500)) return; // 没有遮罩就什么都不显示（保持全黑）
  if (personC.width !== canvas.width || personC.height !== canvas.height) { personC.width = canvas.width; personC.height = canvas.height; }
  px.setTransform(1, 0, 0, 1, 0, 0); px.clearRect(0, 0, personC.width, personC.height); px.setTransform(DPR, 0, 0, DPR, 0, 0);
  px.globalCompositeOperation = "source-over"; drawGradedFrame(px);
  px.save(); px.globalCompositeOperation = "destination-in"; px.transform(VM.a, VM.b, VM.c, VM.d, VM.e, VM.f);
  px.filter = "blur(2px)"; px.drawImage(maskC, 0, 0, frame.width, frame.height); px.restore();
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(personC, 0, 0); ctx.restore();
}
function drawScene(now) {
  // 1) 背景：纯黑，或偏暗偏旧、红色调的摄像头画面
  if (cfg.blackBg) { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H); }
  else drawGradedFrame(ctx);
  // 2) 人身后那层：装饰 + 两个鬼
  lx.setTransform(1, 0, 0, 1, 0, 0); lx.clearRect(0, 0, layer.width, layer.height); lx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const show = Math.max(...ghosts.map((q) => q.alpha));
  drawDecor(lx, now, 0.25 + 0.75 * show);
  const A = scene.anchor;
  if (A) for (const gh of ghosts) {
    if (gh.alpha < 0.01) continue;
    const P = poseOf(gh, now);
    if (P.hide) continue;
    let a = gh.alpha; if (gh.flick > 0 && Math.random() < 0.45) a *= rnd(0, 0.6); // 显形 / 回来时频闪
    const s = Math.min(A.s, Math.min(W, H) * 0.14) * cfg.ghostScale; // 脸太大（离太近 / 竖屏）时限制鬼的大小
    const x = A.x + gh.side * cfg.ghostDist * s * (1 - 0.42 * P.near), y = A.y - cfg.ghostRise * s + P.near * 0.12 * s;
    P.sc = 1 + 0.22 * P.near;
    lx.save(); lx.globalAlpha = a; drawPuppet(lx, gh, x, y, s, P, now); lx.restore();
  }
  // 3) 扣掉人：鬼和装饰都在人身后（纯黑背景时直接把抠出来的人盖在最上面）
  if (!cfg.blackBg && cfg.occlusion && maskReady && now - maskAt < 500) {
    lx.save(); lx.setTransform(DPR, 0, 0, DPR, 0, 0); lx.globalCompositeOperation = "destination-out";
    lx.transform(VM.a, VM.b, VM.c, VM.d, VM.e, VM.f); lx.filter = "blur(2px)"; lx.drawImage(maskC, 0, 0, frame.width, frame.height); lx.restore();
  }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(layer, 0, 0); ctx.restore();
  if (cfg.blackBg) drawPerson(now);
  // 4) 暗角 + 烛光闪烁
  const t = now / 1000, fl = 0.08 * Math.sin(t * 11) * Math.sin(t * 6.3);
  const v = ctx.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.25, W / 2, H * 0.55, Math.max(W, H) * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, `rgba(0,0,0,${0.75 + fl})`); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  if (scene.phase === "leaving" && Math.random() < 0.3) { ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, 0, W, H); }
}

function drawDebug(now) {
  ctx.save(); ctx.font = "12px Consolas, monospace"; ctx.lineWidth = 1.5;
  const a = scr((cfg.seatX - cfg.seatW / 2) * frame.width, (cfg.seatY - cfg.seatH / 2) * frame.height), b = scr((cfg.seatX + cfg.seatW / 2) * frame.width, (cfg.seatY + cfg.seatH / 2) * frame.height);
  ctx.setLineDash([6, 4]); ctx.strokeStyle = "#e5b26f"; ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y); ctx.setLineDash([]);
  ctx.fillStyle = "#e5b26f"; ctx.fillText(tr(T("凳子区域", "seat zone", "의자 영역")), a.x + 6, a.y + 16);
  for (const f of faces) {
    const p = lmS(f.lm[10]), q = lmS(f.lm[152]), l = lmS(f.lm[234]), r = lmS(f.lm[454]);
    ctx.strokeStyle = ctx.fillStyle = inSeat(f) ? "#7fd1a8" : "#9a9a9a";
    ctx.strokeRect(Math.min(l.x, r.x), p.y, Math.abs(r.x - l.x), q.y - p.y);
    ctx.fillText(`conf ≥ ${cfg.faceConf.toFixed(2)}  w ${f.width.toFixed(2)}${f.width < cfg.minFace ? " small" : ""}`, Math.min(l.x, r.x), p.y - 6);
  }
  ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(10, 10, 330, 62);
  ctx.fillStyle = "#e4e4e7";
  if (cfg.headDet !== "off") {
    for (const h of heads) { const p = scr((h.cx - h.w / 2) * frame.width, (h.cy - h.h / 2) * frame.height), q = scr((h.cx + h.w / 2) * frame.width, (h.cy + h.h / 2) * frame.height); ctx.strokeStyle = ctx.fillStyle = inSeatHead(h) ? "#f2838f" : "#e8c25a"; ctx.strokeRect(p.x, p.y, q.x - p.x, q.y - p.y); ctx.fillText(`head conf ${h.s.toFixed(2)}`, p.x, p.y - 4); }
    ctx.fillStyle = "#7fd1a8"; ctx.fillText(headSess ? `head ${headName}/${headEP}  ${heads.length} heads  ${headMs.toFixed(0)} ms${scene.head ? "  seated by head" : ""}` : headLoading ? "head loading…" : headFailed ? "head unavailable → tiles 3x2" : "head idle", 20, 76);
  }
  ctx.fillText(`phase ${scene.phase.padEnd(8)}dwell ${scene.dwell.toFixed(1)}/${cfg.dwell}s  faces ${String(faces.length).padStart(2)}  fps ${String(fps.toFixed(0)).padStart(3)}  conf face ≥ ${cfg.faceConf.toFixed(2)} head ≥ ${cfg.headConf.toFixed(2)}${force ? "  (force)" : ""}`, 20, 28);
  ctx.fillText(`look ${scene.look.toFixed(2)} (±${cfg.turnThresh})  side ${scene.side}  ${ghosts.map((g) => g.kind + ":" + (g.act || "-")).join("  ")}`, 20, 44);
  const bx = 20, bw = 300; ctx.strokeStyle = "#444"; ctx.strokeRect(bx, 54, bw, 8);
  ctx.fillStyle = "#c4a1f0"; ctx.fillRect(bx + bw / 2, 54, clamp(scene.look / 0.5, -1, 1) * bw / 2, 8);
  ctx.restore();
}

function loop() {
  const now = performance.now(), dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now; fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;
  const ok = updateFrame();
  let fresh = false;
  if (ok && landmarker && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime; fresh = true;
    const prev = faces;
    try { faces = analyze(landmarker.detectForVideo(frame, now)); } catch (e) { console.warn(e); faces = []; }
    faces = mergeFar(faces, prev, now);
    if (force && !faces.length && canonVerts) faces = [fakeFace(now)];
    headTick(now);
    // 纯黑背景要一直抠人（空场时也要看得到走近的人）；否则只在鬼出现后为遮挡而跑
    const needSeg = cfg.blackBg || (cfg.occlusion && scene.phase !== "empty");
    if (segmenter && needSeg && !(faces[0] && faces[0].fake)) { try { runSegment(now); } catch (e) { console.warn(e); } }
    if (faces[0] && faces[0].fake) maskReady = false; // 假脸下面没有真人，不做遮挡
  }
  updateView();
  if (ok) updateScene(now, dt);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
  if (ok) drawScene(now);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (cfg.debug) drawDebug(now);
  requestAnimationFrame(loop);
}

// ---------- 摄像头 ----------
let stream = null, cams = [], camError = "";
function fakeStream() {
  const c = document.createElement("canvas"); c.width = 1280; c.height = 720;
  const x = c.getContext("2d");
  const paint = () => {
    const g = x.createLinearGradient(0, 0, 0, 720); g.addColorStop(0, "#3d3a36"); g.addColorStop(1, "#171513"); x.fillStyle = g; x.fillRect(0, 0, 1280, 720);
    x.fillStyle = "#3a2a1e"; x.fillRect(560, 470, 160, 24); x.fillRect(575, 494, 14, 140); x.fillRect(691, 494, 14, 140); // 测试画面里画一张凳子
    x.fillStyle = "#6a6a6a"; x.font = "20px Consolas"; x.fillText("TEST PATTERN", 30, 40);
    requestAnimationFrame(paint);
  };
  paint(); return c.captureStream(30);
}
async function startCamera() {
  if (stream) for (const t of stream.getTracks()) t.stop();
  camError = "";
  if (cfg.deviceId === "__test") stream = fakeStream();
  else {
    const hi = cfg.res === "1080", v = { width: { ideal: hi ? 1920 : 1280 }, height: { ideal: hi ? 1080 : 720 } };
    if (cfg.deviceId) v.deviceId = { exact: cfg.deviceId }; else v.facingMode = "user";
    try { stream = await navigator.mediaDevices.getUserMedia({ video: v, audio: false }); }
    catch (e) { if (cfg.deviceId) { cfg.deviceId = ""; saveCfg(); return startCamera(); } camError = e.message; stream = fakeStream(); openPanel(true); }
  }
  video.srcObject = stream;
  // 摄像头被拔掉或被系统中断时自动重连（自己 stop() 不会触发 ended）
  for (const t of stream.getVideoTracks()) t.addEventListener("ended", () => { if (stream && stream.getVideoTracks().includes(t)) setTimeout(startCamera, 1000); });
  try { await video.play(); } catch {}
  try { cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput"); } catch { cams = []; }
  renderCamSelect();
}

// ---------- 设置面板 ----------
const R = (k, l, min, max, step, u = "") => ({ t: "range", k, l, min, max, step, u });
const C = (k, l) => ({ t: "chk", k, l });
const TABS = [
  { id: "cam", l: T("镜头", "Camera", "카메라"), groups: [
    { l: T("摄像头", "Camera", "카메라"), n: T("输入", "input", "입력"), items: [
      { t: "camera" },
      { t: "seg", k: "res", l: T("分辨率", "Resolution", "해상도"), o: [{ v: "720", l: "720p" }, { v: "1080", l: "1080p" }] },
      { t: "info", id: "camInfo" },
    ] },
    { l: T("画面方向", "Orientation", "방향"), items: [
      { t: "seg", k: "rot", l: T("旋转", "Rotate", "회전"), o: [0, 90, 180, 270].map((v) => ({ v, l: v + "°" })) },
      C("mirror", T("左右镜像", "Mirror", "좌우 반전")), C("flipY", T("上下翻转", "Flip vertically", "상하 반전")),
    ] },
  ] },
  { id: "detect", l: T("识别", "Detect", "인식"), groups: [
    { l: T("凳子区域", "Seat zone", "의자 영역"), n: T("画面比例", "frame ratio", "화면 비율"), items: [
      R("seatX", T("中心 X", "Center X", "중심 X"), 0, 1, 0.01), R("seatY", T("中心 Y", "Center Y", "중심 Y"), 0, 1, 0.01),
      R("seatW", T("宽", "Width", "너비"), 0.05, 1, 0.01), R("seatH", T("高", "Height", "높이"), 0.05, 1, 0.01),
      R("minFace", T("最小脸宽", "Min face width", "최소 얼굴 폭"), 0.02, 0.4, 0.005),
      { t: "seg", k: "farScan", l: T("远距离检测", "Far detection", "원거리 검출"), o: [{ v: "off", l: T("关", "Off", "끔") }, { v: "2x2", l: "2×2" }, { v: "3x2", l: "3×2" }] },
      { t: "sub", l: T("摄像头离凳子远、脸很小时打开：画面切块轮流检测，找到的脸每帧在附近裁一块跟踪。最小脸宽同时调到 0.03–0.05。更吃性能。", "For far cameras with tiny faces: scans the frame in tiles and re-crops each found face every frame. Lower min face width to 0.03–0.05. Heavier.", "카메라가 멀고 얼굴이 작을 때: 화면을 나눠 검출하고 찾은 얼굴은 매 프레임 주변을 잘라 추적합니다. 최소 얼굴 폭을 0.03–0.05로 낮추세요. 더 무겁습니다.") },
      { t: "sub", l: T("脸进入这个框（打开调试可以看到虚线框）并停留，才算坐到凳子上。按现场摄像头调。", "A face inside this box (dashed in debug) for the dwell time counts as seated.", "얼굴이 이 영역(디버그에서 점선)에 머물면 앉은 것으로 봅니다.") },
    ] },
    { l: T("人头检测", "Head detection", "머리 검출"), n: "YOLOv8 head · ONNX", items: [
      { t: "seg", k: "headDet", l: T("模型", "Model", "모델"), o: [{ v: "off", l: T("关", "Off", "끔") }, { v: "nano", l: "nano 12MB" }, { v: "medium", l: "medium 104MB" }] },
      R("headConf", T("人头置信度", "Head confidence", "머리 신뢰도"), 0.1, 0.9, 0.05),
      R("headEvery", T("检测间隔", "Interval", "간격"), 0.2, 3, 0.1, "s"),
      { t: "sub", l: T("两种模式：上面的“远距离检测”是放大切片（不用额外模型）；这里是人头模型。打开后坐着低头（看手机）的人也算坐下，鬼照样出来；抬头看到脸才判断偏头。凳子上有脸时自动停止人头检测。人头模型加载不了时自动退回放大切片 3×2。", "Two modes: Far detection above = zoomed tiles (no extra model); this = head model. A seated person looking down still counts as seated; head turns need a visible face. Pauses while a face is on the seat. Falls back to 3×2 tiles if the model can't load.", "두 가지 모드: 위의 원거리 검출은 확대 타일(추가 모델 없음), 여기는 머리 모델. 고개 숙여 앉아 있어도 앉은 것으로 보고 귀신이 나타나며, 고개 방향은 얼굴이 보여야 판단합니다. 의자에 얼굴이 있으면 멈춥니다. 모델을 못 불러오면 3×2 타일로 돌아갑니다.") },
    ] },
    { l: T("模型", "Models", "모델"), n: T("可下载", "downloadable", "다운로드"), items: [{ t: "models" }] },
    { l: T("时间", "Timing", "시간"), items: [
      R("dwell", T("坐稳时间", "Sit dwell", "앉아 있는 시간"), 0.2, 5, 0.1, "s"), R("leaveGrace", T("离开容忍", "Leave grace", "떠남 허용"), 0, 5, 0.1, "s"),
    ] },
    { l: T("转头", "Head turn", "고개 돌림"), items: [
      R("turnThresh", T("偏头阈值", "Turn threshold", "돌림 기준"), 0.04, 0.4, 0.01),
      R("lookHold", T("保持时间", "Hold", "유지"), 0, 2, 0.05, "s"),
      { t: "sub", l: T("鼻尖偏离两颊中点的比例；0.14 大约是 20°。调试里有实时数值条。", "Nose offset vs. cheek midpoint; 0.14 ≈ 20°. Live bar in debug.", "코끝과 양 볼 중점의 차이; 0.14 ≈ 20°.") },
    ] },
    { l: T("追踪", "Tracking", "추적"), items: [
      R("faceConf", T("人脸置信度", "Face confidence", "얼굴 신뢰도"), 0.1, 0.95, 0.05),
      { t: "sub", l: T("越低越容易认出侧脸、远处、暗处的脸，但更容易误认；越高越严。人脸模型不给每张脸单独的分数，叠加里显示的是当前门槛。", "Lower finds side / far / dark faces more easily but with more false hits; higher is stricter. The face model gives no per-face score, so the overlay shows the current threshold.", "낮을수록 옆얼굴·먼 얼굴·어두운 얼굴을 잘 찾지만 오검출이 늘고, 높을수록 엄격합니다. 얼굴 모델은 얼굴별 점수를 주지 않아 오버레이에는 현재 기준값이 표시됩니다.") },
      R("smooth", T("防抖", "Stabilize", "떨림 보정"), 0.2, 5, 0.1, "Hz"), C("debug", T("显示识别叠加（D）", "Detection overlay (D)", "인식 오버레이 (D)")),
    ] },
  ] },
  { id: "show", l: T("演出", "Show", "연출"), groups: [
    { l: T("鬼的位置", "Ghost placement", "귀신 위치"), n: T("按脸宽", "× face width", "얼굴 폭 기준"), items: [
      R("ghostDist", T("离人距离", "Distance", "거리"), 0.8, 4, 0.05, "×"), R("ghostRise", T("抬高", "Rise", "높이"), -1, 1.5, 0.05, "×"),
      R("ghostScale", T("大小", "Scale", "크기"), 0.5, 2, 0.05, "×"),
      { t: "seg", k: "brideSide", l: T("新娘在", "Bride side", "신부 위치"), o: [{ v: "left", l: T("左", "Left", "왼쪽") }, { v: "right", l: T("右", "Right", "오른쪽") }] },
    ] },
    { l: T("动作", "Actions", "동작"), items: [
      R("actRate", T("随机动作频率", "Action rate", "동작 빈도"), 0.2, 3, 0.1, "×"),
      R("tInteract", T("互动最长时间", "Max interaction", "상호작용 최대"), 2, 15, 0.5, "s"),
      R("otherFade", T("另一边剩余", "Other side keeps", "반대편 남김"), 0, 1, 0.01),
      { t: "sub", l: T("随机动作：歪头、盯着你、作揖、抬手、抽动、闪现靠近、摇晃、掀盖头一角、甩袖。偏头时被看的那边凑过来（新郎伸手、新娘掀盖头），另一边隐去。", "Random: tilt, stare, bow, reach, twitch, blink-closer, sway, veil, sleeve. Turning your head brings that side close; the other fades.", "랜덤: 갸웃, 응시, 절, 손 뻗기, 경련, 순간이동, 흔들림, 면사포, 소매. 고개를 돌리면 그쪽이 다가오고 반대편은 사라짐.") },
    ] },
    { l: T("画面", "Image", "화면"), items: [
      C("blackBg", T("纯黑背景（只抠出人）", "Pure black background (person only)", "검은 배경 (사람만)")),
      C("occlusion", T("鬼在人身后（人物遮挡）", "Ghosts behind the person", "사람 뒤에 귀신 (가림)")), C("decor", T("囍字和灯笼", "囍 and lanterns", "囍 글자와 등롱")),
      R("grade", T("旧色调", "Old-photo grade", "옛 색감"), 0, 1, 0.01),
    ] },
    { l: T("声音", "Sound", "소리"), items: [R("volume", T("音量", "Volume", "볼륨"), 0, 1, 0.01)] },
    { l: T("测试", "Test", "테스트"), items: [
      { t: "btns", b: [{ id: "force", l: T("模拟有人坐下", "Simulate sitter", "착석 시뮬레이션"), cls: "primary" }, { id: "resetShow", l: T("重置", "Reset", "초기화"), cls: "danger" }] },
      { t: "btns", b: [{ id: "fullscreen", l: T("全屏 / 退出全屏", "Fullscreen", "전체화면") }, { id: "closePanel", l: T("关闭设置", "Close panel", "설정 닫기") }] },
      { t: "sub", l: T("快捷键：S 面板 · D 调试 · F 全屏 · P 模拟有人（假脸会自己左右转头；←/→ 手动转头）· R 重置", "Keys: S · D · F · P simulate (←/→ turn) · R reset", "단축키: S · D · F · P 시뮬레이션 (←/→ 고개) · R") },
      { t: "sub", l: T("手机 / 平板：右上角连点三下，或两指按住屏幕 1.2 秒，打开或关闭设置。", "Phone / tablet: triple-tap the top-right corner, or hold two fingers for 1.2 s.", "휴대폰 / 태블릿: 오른쪽 위 세 번 탭 또는 두 손가락 1.2초.") },
    ] },
  ] },
];
let activeTab = "show";
const fmtNum = (it, v) => { const s = String(it.step), d = s.includes(".") ? s.split(".")[1].length : 0; return Number(v).toFixed(d); };
function itemHTML(it) {
  if (it.t === "range") return `<div class="field"><label>${tr(it.l)}</label><div class="rng"><input type="range" data-k="${it.k}" min="${it.min}" max="${it.max}" step="${it.step}" value="${cfg[it.k]}"><input class="nv" type="number" data-k="${it.k}" step="${it.step}" value="${fmtNum(it, cfg[it.k])}">${it.u ? `<i>${it.u}</i>` : ""}</div></div>`;
  if (it.t === "chk") return `<label class="chk"><input type="checkbox" data-k="${it.k}" ${cfg[it.k] ? "checked" : ""}>${tr(it.l)}</label>`;
  if (it.t === "seg") return `<div class="field"><label>${tr(it.l)}</label><div class="seg">${it.o.map((o) => `<button data-seg="${it.k}" data-v="${o.v}" class="${String(cfg[it.k]) === String(o.v) ? "on" : ""}">${tr(o.l)}</button>`).join("")}</div></div>`;
  if (it.t === "sub") return `<div class="sub">${tr(it.l)}</div>`;
  if (it.t === "info") return `<div class="info" id="${it.id}"></div>`;
  if (it.t === "models") {
    const total = MODELS.reduce((s, m) => s + parseFloat(m.size), 0).toFixed(0);
    return MODELS.map((m) => `<div class="mdl"><b>${m.file}</b><i>${m.size} · <span data-src="${m.file}" class="src ${modelSrc[m.file] || ""}">${srcText(m.file)}</span></i><div class="sub">${tr(m.use)} · ${m.src}</div></div>`).join("")
      + `<div class="grid2" style="margin-top:10px"><button class="btn" id="pickModels">${tr(T("选择 models 文件夹", "Choose models folder", "models 폴더 선택"))}</button><button class="btn" id="clearModels">${tr(T("清除本地模型", "Clear local models", "로컬 모델 지우기"))}</button></div><div class="grid2" style="margin-top:6px"><button class="btn" id="zipModels">${tr(T("下载模型 zip", "Download models.zip", "모델 zip 다운로드"))} · ${total} MB</button></div>`
      + `<div class="sub">${tr(T("加载顺序：本地文件夹 → 网站自带 → 官方地址，每个模型后面标着这次从哪来。平时什么都不用做。网速慢或要离线时：先下载 zip 解压，再点“选择 models 文件夹”选中它（选上一层文件夹也行），文件存进浏览器，以后打开直接用；同一网站的三个作品共用。手机选不了文件夹，会改成多选文件。", "Load order: local folder → site → official; each model shows where it came from. Normally nothing to do. For slow networks / offline: download the zip, unzip, then “Choose models folder” (its parent folder works too). Files are stored in the browser and reused next time, shared by all three demos on this site. Phones can't pick folders, so it falls back to picking files.", "로드 순서: 로컬 폴더 → 사이트 → 공식. 각 모델 옆에 출처가 표시됩니다. 평소에는 아무것도 할 필요 없습니다. 느리거나 오프라인일 때: zip을 받아 풀고 “models 폴더 선택”으로 고르세요(상위 폴더도 됨). 파일은 브라우저에 저장되어 다음에도 쓰이며, 같은 사이트의 세 작품이 함께 씁니다. 휴대폰은 폴더 대신 파일 여러 개를 고릅니다."))}</div>`;
  }
  if (it.t === "camera") return `<div class="field"><label>${tr(T("设备", "Device", "장치"))}</label><div class="sel"><select id="camSel"></select><button class="btn icon" id="camRefresh" title="refresh">↻</button></div></div>`;
  if (it.t === "btns") return `<div class="grid${it.b.length >= 3 ? 3 : 2}">${it.b.map((b) => `<button class="btn ${b.cls || ""}" id="${b.id}">${tr(b.l)}</button>`).join("")}</div>`;
  return "";
}
function renderPanel() {
  document.documentElement.lang = { zh: "zh-CN", en: "en", ko: "ko" }[cfg.lang];
  $("#tabs").innerHTML = TABS.map((t) => `<button data-tab="${t.id}" class="${t.id === activeTab ? "on" : ""}">${tr(t.l)}</button>`).join("");
  $("#panes").innerHTML = TABS.map((t) => `<div class="pane ${t.id === activeTab ? "on" : ""}">${t.groups.map((g) =>
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
  sel.innerHTML = opts.join(""); sel.value = cfg.deviceId; if (sel.value !== cfg.deviceId) sel.value = "";
  const info = $("#camInfo");
  if (info) { info.classList.toggle("err", !!camError); info.textContent = camError ? tr(T("摄像头打开失败：", "Camera failed: ", "카메라 실패: ")) + camError + tr(T("（已切到测试画面）", " (test pattern)", " (테스트 화면)")) : video.videoWidth ? `${video.videoWidth}×${video.videoHeight}` : ""; }
}
function syncButtons() { const f = $("#force"); if (f) f.textContent = tr(force ? T("停止模拟", "Stop", "중지") : T("模拟有人坐下", "Simulate sitter", "착석 시뮬레이션")); }
function resetShow() { scene.phase = "empty"; scene.dwell = 0; scene.side = 0; scene.anchor = null; scene.sitter = null; for (const g of ghosts) { g.alpha = 0; g.act = null; } }
function onChange(k) { saveCfg(); if (k === "volume" && master) master.gain.value = cfg.volume; if (k === "res") startCamera(); if (k === "faceConf") applyFaceConf(); }
const side = $("#side");
function openPanel(open) { side.classList.toggle("open", open); document.body.classList.toggle("hide-cursor", !open); }
side.addEventListener("input", (e) => {
  const el = e.target, k = el.dataset.k; if (!k) return;
  if (el.type === "checkbox") cfg[k] = el.checked;
  else {
    const v = parseFloat(el.value); if (!Number.isFinite(v)) return; cfg[k] = v;
    const box = el.parentElement;
    if (el.type === "range") box.querySelector(".nv").value = fmtNum(findItem(k), v); else box.querySelector("input[type=range]").value = v;
  }
  onChange(k);
});
side.addEventListener("change", (e) => { if (e.target.id === "camSel") { cfg.deviceId = e.target.value; saveCfg(); startCamera(); } });
side.addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.tab) { activeTab = b.dataset.tab; renderPanel(); return; }
  if (b.dataset.lang) { cfg.lang = b.dataset.lang; saveCfg(); renderPanel(); return; }
  if (b.dataset.seg) {
    const k = b.dataset.seg, it = findItem(k); cfg[k] = typeof it.o[0].v === "number" ? Number(b.dataset.v) : b.dataset.v;
    for (const s of b.parentElement.children) s.classList.toggle("on", s === b); onChange(k); return;
  }
  if (b.id === "close" || b.id === "closePanel") openPanel(false);
  else if (b.id === "camRefresh") startCamera();
  else if (b.id === "force") { force = !force; syncButtons(); }
  else if (b.id === "fullscreen") toggleFullscreen();
  else if (b.id === "resetShow") resetShow();
});
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
  else if (k === "r") resetShow();
  else if (k === "arrowleft" || k === "arrowright") { fakeYawKey = k === "arrowleft" ? -0.6 : 0.6; fakeYawKeyAt = performance.now(); }
});
setInterval(() => {
  $("#statusbar").innerHTML = `<span class="dot"></span>WEDDING<span>${landmarker ? "model ok" : "model…"}</span><span>faces <b class="v">${faces.length}</b></span><span>${scene.phase}</span><span>${fps.toFixed(0)} fps</span>`;
  if (!camError && $("#camInfo") && video.videoWidth && !$("#camInfo").textContent) renderCamSelect();
}, 250);

// ---------- 手机 / 展场 ----------
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
let twoFingerTimer = 0;
addEventListener("touchstart", (e) => { if (e.touches.length >= 2) { clearTimeout(twoFingerTimer); twoFingerTimer = setTimeout(() => openPanel(!side.classList.contains("open")), 1200); } }, { passive: true });
addEventListener("touchend", () => clearTimeout(twoFingerTimer), { passive: true });
addEventListener("touchcancel", () => clearTimeout(twoFingerTimer), { passive: true });

// ---------- 启动 ----------
// 这个作品用到的模型（设置 → 识别 → 模型 里可以下载）
const MODELS = [
  { file: "face_landmarker.task", size: "3.6 MB", use: T("人脸 478 点（坐下、偏头）", "Face 478 landmarks (seat, head turn)", "얼굴 478점 (앉기·고개)"), src: "Google MediaPipe · Apache-2.0" },
  { file: "selfie_multiclass_256x256.tflite", size: "15.6 MB", use: T("人物分割（黑底抠人、遮挡）", "Person segmentation (cutout, occlusion)", "인물 분할 (컷아웃·가림)"), src: "Google MediaPipe · Apache-2.0" },
  { file: "yolo-head-nano.onnx", size: "11.7 MB", use: T("人头检测（快）", "Head detection (fast)", "머리 검출 (빠름)"), src: "trysem/YOLOv8_head_detector · MIT" },
  { file: "yolo-head-medium.onnx", size: "98.8 MB", use: T("人头检测（准）", "Head detection (accurate)", "머리 검출 (정확)"), src: "trysem/YOLOv8_head_detector · MIT" },
];const ZIP_NAME = "ghost-wedding-models.zip";
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

// 先读自带的模型文件，读不到再用官方地址；每个实例一份拷贝，MediaPipe 会占用传进去的缓冲区
// 本地模型文件夹：在设置里选一次 models 文件夹，文件存进浏览器缓存（Cache Storage）。
// 同一个网站下的三个作品共用这份缓存，关掉网页再打开也还在；加载时优先用它，其次网站自带的 models/，最后官方地址。
const LOCAL_CACHE = "ghost-series-models";
const ALL_MODEL_FILES = ["face_landmarker.task", "selfie_multiclass_256x256.tflite", "yolo-head-nano.onnx", "yolo-head-medium.onnx"];
const modelSrc = {}; // 文件名 → local / site / official / missing
const SRC_LABEL = { local: T("本地文件夹", "local folder", "로컬 폴더"), site: T("网站", "site", "사이트"), official: T("官方地址", "official", "공식"), missing: T("缺失", "missing", "없음") };
const srcText = (file) => tr(modelSrc[file] ? SRC_LABEL[modelSrc[file]] : T("未加载", "not loaded", "미로드"));
function refreshModelSrc() {
  for (const el of document.querySelectorAll(".mdl [data-src]")) { el.textContent = srcText(el.dataset.src); el.className = "src " + (modelSrc[el.dataset.src] || ""); }
}
async function cachedModel(file) {
  try { const c = await caches.open(LOCAL_CACHE), r = await c.match("/__models/" + file); return r ? new Uint8Array(await r.arrayBuffer()) : null; } catch { return null; }
}
// 选文件夹：Chrome / Edge 用系统的“选择文件夹”；其他电脑浏览器用文件夹上传；手机选不了文件夹，改成多选文件
async function collectDir(dir, depth = 0) {
  const out = [];
  for await (const h of dir.values()) {
    if (h.kind === "file") { if (ALL_MODEL_FILES.includes(h.name)) out.push(await h.getFile()); }
    else if (depth < 2) out.push(...await collectDir(h, depth + 1)); // 选的是 models 的上一层（比如 互动demo）也能找到
  }
  return out;
}
function pickViaInput() {
  return new Promise((ok) => {
    const i = document.createElement("input"); i.type = "file"; i.multiple = true;
    if ("webkitdirectory" in i && !matchMedia("(pointer: coarse)").matches) i.webkitdirectory = true;
    i.onchange = () => ok([...i.files].filter((f) => ALL_MODEL_FILES.includes(f.name)));
    i.oncancel = () => ok(null);
    i.click();
  });
}
async function pickModelFolder() {
  let files;
  if (window.showDirectoryPicker) {
    try { files = await collectDir(await showDirectoryPicker({ id: "ghost-models", mode: "read" })); }
    catch (e) { if (e.name === "AbortError") return null; throw e; }
  } else files = await pickViaInput();
  if (!files) return null;
  const c = await caches.open(LOCAL_CACHE);
  for (const f of files) await c.put("/__models/" + f.name, new Response(f, { headers: { "Content-Type": "application/octet-stream", "Content-Length": String(f.size) } }));
  return files.map((f) => f.name);
}
document.addEventListener("click", (e) => {
  const pick = e.target.closest && e.target.closest("#pickModels"), clear = e.target.closest && e.target.closest("#clearModels");
  if (pick && !pick.disabled) {
    const label = pick.textContent; pick.disabled = true; pick.textContent = "…";
    pickModelFolder().then((names) => {
      if (!names) { pick.textContent = label; return; }
      if (!names.length) { pick.textContent = tr(T("没找到模型文件", "No model files found", "모델 파일 없음")); setTimeout(() => { pick.textContent = label; }, 3000); return; }
      pick.textContent = tr(T(`已导入 ${names.length} 个，重新加载…`, `Imported ${names.length}, reloading…`, `${names.length}개 가져옴, 다시 불러오는 중…`));
      setTimeout(() => location.reload(), 600);
    }).catch((err) => { console.warn(err); pick.textContent = "✕ " + err.message; setTimeout(() => { pick.textContent = label; }, 4000); })
      .finally(() => { pick.disabled = false; });
  }
  if (clear && !clear.disabled) {
    clear.disabled = true;
    caches.delete(LOCAL_CACHE).catch(() => {}).finally(() => location.reload());
  }
});
const modelBytes = {};
async function modelAsset(file, url) {
  if (!(file in modelBytes)) modelBytes[file] = (async () => {
    const local = await cachedModel(file);
    if (local) { modelSrc[file] = "local"; return local; }
    try { const r = await fetch(MODEL_DIR + file); if (r.ok) { modelSrc[file] = "site"; return new Uint8Array(await r.arrayBuffer()); } } catch {}
    modelSrc[file] = url ? "official" : "missing"; return null;
  })().finally(refreshModelSrc);
  const b = await modelBytes[file];
  return b ? { modelAssetBuffer: b.slice() } : { modelAssetPath: url }; // 每个实例一份拷贝，MediaPipe 会占用传进去的缓冲区
}
// 人脸模型的三个置信度一起调（检测 / 存在 / 跟踪）；改了立刻生效，不用重新加载
const faceConfOpts = () => ({ minFaceDetectionConfidence: cfg.faceConf, minFacePresenceConfidence: cfg.faceConf, minTrackingConfidence: cfg.faceConf });
function applyFaceConf() { for (const m of [landmarker, tileLm]) if (m) m.setOptions(faceConfOpts()).catch((e) => console.warn(e)); }
async function loadModels() {
  const fs = await FilesetResolver.forVisionTasks(WASM_URL);
  const lmAsset = await modelAsset("face_landmarker.task", MODEL_URL), segAsset = await modelAsset("selfie_multiclass_256x256.tflite", SEG_URL);
  const lmOpts = (delegate) => ({ baseOptions: { ...lmAsset, delegate }, runningMode: "VIDEO", numFaces: 3, outputFacialTransformationMatrixes: false, outputFaceBlendshapes: false, ...faceConfOpts() });
  try { landmarker = await FaceLandmarker.createFromOptions(fs, lmOpts("GPU")); } catch { landmarker = await FaceLandmarker.createFromOptions(fs, lmOpts("CPU")); }
  const segOpts = (delegate) => ({ baseOptions: { ...segAsset, delegate }, runningMode: "VIDEO", outputCategoryMask: true, outputConfidenceMasks: false });
  try { segmenter = await ImageSegmenter.createFromOptions(fs, segOpts("GPU")); } catch { try { segmenter = await ImageSegmenter.createFromOptions(fs, segOpts("CPU")); } catch (e) { console.warn("分割不可用，鬼不会被人挡住", e); } }
}
async function loadTileModel() {
  const fs = await FilesetResolver.forVisionTasks(WASM_URL);
  const asset = await modelAsset("face_landmarker.task", MODEL_URL);
  const o = (delegate) => ({ baseOptions: { ...asset, delegate }, runningMode: "IMAGE", numFaces: 3, outputFacialTransformationMatrixes: false, outputFaceBlendshapes: false, ...faceConfOpts() });
  try { return await FaceLandmarker.createFromOptions(fs, o("GPU")); } catch { return await FaceLandmarker.createFromOptions(fs, o("CPU")); }
}
resize();
renderPanel();
startCamera();
fetch("assets/face_uv.json").then((r) => r.json()).then((d) => { canonVerts = d.verts; }).catch(() => {});
loadModels().catch((e) => { camError = "model: " + e.message; openPanel(true); renderCamSelect(); });
window.__wed = { scene, ghosts, cfg, get faces() { return faces; }, detectCrop };
requestAnimationFrame(loop);
