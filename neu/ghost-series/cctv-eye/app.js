// 鬼神系列 02 · CCTV 鬼眼
// 监控墙：同一个摄像头画面切成 4 格（CAM 01–04），每格是一台虚拟云台，各追一个人：
// 全景 → 锁定 → 推到脸 → 推到双眼 → 眼睛变成黑眼洞（用提供的面具贴图眼部）→ 信号丢失 → 回到全景
import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
// 模型优先从自带的 models 文件夹加载（GitHub 上是 ghost-series/models/，本地服务器把 /models/ 映射到 互动demo/models/），失败再用官方地址
const MODEL_DIR = "../models/";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const ORT_URL = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/";

const $ = (s) => document.querySelector(s);
const canvas = $("#stage");
const ctx = canvas.getContext("2d");
const video = $("#cam");
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const wrapAng = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ---------- 参数 ----------
const DEFAULTS = {
  lang: "zh", deviceId: "", res: "1080", rot: 0, mirror: false, flipY: false, layout: "quad", stamp: true,
  nearRatio: 0.15, farScan: "off", headDet: "off", headGrid: 2, headEvery: 0.5, headWait: 15, yawLimit: 45, lostGrace: 0.8, smooth: 1.2, debug: false, mesh: false,
  tLock: 1.2, tFace: 3, tEyes: 3, tBlack: 2.5, tHold: 4, cooldown: 5,
  faceFrame: 1.5, eyeFill: 0.62, follow: 2.6, hunt: 0.5, vary: 0.7,
  eyeTex: "random", eyeAmt: 1, eyeRadius: 1.2, eyeLock: true,
  pixel: 400, contrast: 1.3, bright: 1, noise: 0.35, scan: 0.45, vignette: 0.7, glitchRate: 1, dropRate: 1,
  volume: 0.7,
};
const CFG_KEY = "ghostCctvCfg.v1";
let cfg = loadCfg();
if (typeof cfg.scan !== "number") cfg.scan = DEFAULTS.scan; // 旧版把远距离检测也存成了 scan，和扫描线撞名
function loadCfg() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(CFG_KEY) || "{}") }; }
  catch { return { ...DEFAULTS }; }
}
function saveCfg() { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch {} }

const T = (zh, en, ko) => ({ zh, en, ko });
const tr = (o) => (typeof o === "string" ? o : o[cfg.lang] || o.zh);

// ---------- 画布 ----------
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, matchMedia("(pointer: coarse)").matches ? 1.5 : 2); // 手机像素比太高时限制到 1.5，省性能
  W = innerWidth; H = innerHeight;
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
}
addEventListener("resize", resize);

// 摄像头按 0/90/180/270 转正，镜像也直接做进 frame，识别和显示都用 frame
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
  fctx.scale(cfg.mirror ? -1 : 1, cfg.flipY ? -1 : 1);
  fctx.drawImage(video, -vw / 2, -vh / 2);
  return true;
}
const lmPx = (l) => ({ x: l.x * frame.width, y: l.y * frame.height });

// ---------- 声音 ----------
let ac = null, master = null, servoGain = null, servoOsc = null;
function initAudio() {
  if (ac) { if (ac.state === "suspended") ac.resume(); return; }
  ac = new (window.AudioContext || window.webkitAudioContext)();
  const comp = ac.createDynamicsCompressor();
  master = ac.createGain(); master.gain.value = cfg.volume;
  master.connect(comp); comp.connect(ac.destination);
  // 监控机房的底噪：60Hz 电流声 + 很轻的风扇噪声
  const hum = ac.createOscillator(), hg = ac.createGain(); hum.frequency.value = 60; hum.type = "triangle"; hg.gain.value = 0.05;
  hum.connect(hg); hg.connect(master); hum.start();
  const n = noise(3); n.loop = true; const nf = ac.createBiquadFilter(); nf.type = "lowpass"; nf.frequency.value = 900;
  const ng = ac.createGain(); ng.gain.value = 0.04; n.connect(nf); nf.connect(ng); ng.connect(master); n.start();
  // 云台马达：音量和音高跟着变焦速度
  servoOsc = ac.createOscillator(); servoOsc.type = "sawtooth"; servoOsc.frequency.value = 180;
  const sf = ac.createBiquadFilter(); sf.type = "bandpass"; sf.frequency.value = 900; sf.Q.value = 2;
  servoGain = ac.createGain(); servoGain.gain.value = 0;
  servoOsc.connect(sf); sf.connect(servoGain); servoGain.connect(master); servoOsc.start();
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
function sndBeep() {
  if (!ac) return; const t = ac.currentTime;
  for (const dt of [0, 0.13]) {
    const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 1350;
    env(g, t + dt, 0.12, 0.004, 0.07); o.connect(g); g.connect(master); o.start(t + dt); o.stop(t + dt + 0.1);
  }
}
function sndStatic(dur, vol) {
  if (!ac) return; const t = ac.currentTime;
  const n = noise(dur + 0.05), f = ac.createBiquadFilter(), g = ac.createGain();
  f.type = "bandpass"; f.frequency.value = 2200; env(g, t, vol, 0.005, dur);
  n.connect(f); f.connect(g); g.connect(master); n.start(t);
}
function sndDrop() { // 黑眼出现时一声低沉的下坠
  if (!ac) return; const t = ac.currentTime;
  const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(38, t + 1.2);
  env(g, t, 0.35, 0.02, 1.3); o.connect(g); g.connect(master); o.start(t); o.stop(t + 1.4);
}

// ---------- 识别 ----------
let landmarker = null, faces = [], people = [], nextPersonId = 1, force = false, lastVideoTime = -1;
function analyze(res) {
  const out = [];
  const lms = res.faceLandmarks || [], mats = res.facialTransformationMatrixes || [];
  const aspect = frame.height / frame.width;
  for (let i = 0; i < lms.length; i++) {
    const l = lms[i], a = l[234], b = l[454];
    const width = Math.hypot(a.x - b.x, (a.y - b.y) * aspect);
    const m = mats[i] && mats[i].data;
    const yaw = m ? Math.atan2(m[8], m[10]) * 180 / Math.PI : NaN;
    const near = width >= cfg.nearRatio, frontal = Number.isFinite(yaw) && Math.abs(yaw) <= cfg.yawLimit;
    out.push({ lm: l, width, yaw, cx: l[1].x, cy: l[1].y, near, frontal, ok: near && frontal });
  }
  return out;
}

// ---------- 远距离：分块检测 ----------
// 整幅画面送进模型会被缩小，远处的小脸（只占画面宽 5% 左右）检测不到。
// 打开后把画面切成几块、每帧轮流检测一块；正在被追的小脸再每帧在他附近裁一块精确跟踪。
let tileLm = null, tileLoading = false, tileIdx = 0, tileFaces = [], roiFaces = [];
const tileC = document.createElement("canvas"), tctx = tileC.getContext("2d");
// 人头模型加载不了（没联网、文件缺失、浏览器不支持）时，自动退回放大切片 3×2
const farMode = () => (cfg.farScan !== "off" ? cfg.farScan : cfg.headDet !== "off" && headFailed ? "3x2" : "off");
function tileRects() {
  const [nx, ny] = farMode() === "3x2" ? [3, 2] : [2, 2], ov = 1.3, out = [];
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
  return analyze({ faceLandmarks: lms, facialTransformationMatrixes: res.facialTransformationMatrixes });
}
function mergeFar(base, now) {
  const tiled = farMode() !== "off";
  if (!tiled && cfg.headDet === "off") return base;
  if (!tileLm) {
    if (!tileLoading) { tileLoading = true; loadModel("IMAGE").then((m) => { tileLm = m; }).catch((e) => { console.warn("分块检测模型加载失败", e); tileLoading = false; }); }
    return base;
  }
  const rects = tiled ? tileRects() : [];
  try {
    if (tiled) { tileIdx = (tileIdx + 1) % rects.length; tileFaces[tileIdx] = { t: now, faces: detectCrop(rects[tileIdx]) }; }
    tileFaces.length = rects.length;
    // 被格子追着的人：脸小、或者暂时没脸（低头，只有人头框）时，每帧在他附近裁一块找脸
    roiFaces = [];
    for (const c of cells) {
      const p = c.pid != null && people.find((q) => q.id === c.pid);
      if (p && (!p.seen || p.width < 0.12)) roiFaces.push(...detectCrop(roiRect(p)));
    }
  } catch (e) { console.warn(e); }
  // 合并去重：整幅画面的结果优先，其次每帧裁的，最后是轮流扫的块
  const all = [...base];
  const add = (f) => { if (!all.some((g) => Math.hypot(g.cx - f.cx, g.cy - f.cy) < Math.max(g.width, f.width) * 0.6)) all.push(f); };
  roiFaces.forEach(add);
  for (const tf of tileFaces) if (tf && now - tf.t < rects.length * 70 + 250) tf.faces.forEach(add);
  return all;
}

// ---------- 人头检测（YOLOv8 head，SCUT-HEAD 训练，ONNX，MIT）----------
// 低头、只露头顶的人，人脸模型找不到。先用人头模型找出所有人头，格子先追头；
// 被追的头每帧裁一块找脸（mergeFar），找到脸就接着走原来的流程。
// 所有格子都追上有脸的人时不再跑人头检测，省性能。
const HEAD_MODELS = { nano: "yolo-head-nano.onnx", medium: "yolo-head-medium.onnx" };
let headSess = null, headName = "", headEP = "", headLoading = false, headFailed = false, headBusy = false, headAt = 0, headMs = 0, heads = [], headErr = "";
const headC = document.createElement("canvas"); headC.width = headC.height = 640;
const hctx = headC.getContext("2d", { willReadFrequently: true });
const headGrace = () => Math.max(2000, cfg.headEvery * 3000);
function loadScript(src) { return new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }
async function ensureHead() {
  if (cfg.headDet === "off" || headLoading) return null;
  if (headSess && headName === cfg.headDet) return headSess;
  if (headFailed && ensureHead.failed === cfg.headDet) return null; // 同一个模型失败过就不反复重试，换模型才再试
  headLoading = true; ensureHead.failed = cfg.headDet;
  try {
    if (!window.ort) await loadScript(ORT_URL + "ort.webgpu.min.js");
    ort.env.wasm.wasmPaths = ORT_URL;
    const name = cfg.headDet;
    for (const ep of ["webgpu", "wasm"]) {
      try { headSess = await ort.InferenceSession.create(MODEL_DIR + HEAD_MODELS[name], { executionProviders: [ep] }); headName = name; headEP = ep; headErr = ""; headFailed = false; break; }
      catch (e) { console.warn("人头模型", ep, e); headErr = String(e.message || e); }
    }
  } catch (e) { headErr = String(e.message || e); } finally { headLoading = false; }
  if (!(headSess && headName === cfg.headDet)) headFailed = true;
  return headSess && headName === cfg.headDet ? headSess : null;
}
// 一块区域按长边缩到 640、补灰边，跑 YOLOv8；输出 [1, 5, N]：cx cy w h score（640 像素坐标）
async function detectHeads(sess, r) {
  const fw = frame.width, fh = frame.height, sw = r.w * fw, sh = r.h * fh, k = 640 / Math.max(sw, sh);
  hctx.fillStyle = "#727272"; hctx.fillRect(0, 0, 640, 640);
  hctx.drawImage(frame, r.x * fw, r.y * fh, sw, sh, 0, 0, sw * k, sh * k);
  const d = hctx.getImageData(0, 0, 640, 640).data, N = 640 * 640, f = new Float32Array(3 * N);
  for (let i = 0, p = 0; i < N; i++, p += 4) { f[i] = d[p] / 255; f[i + N] = d[p + 1] / 255; f[i + 2 * N] = d[p + 2] / 255; }
  const out = await sess.run({ [sess.inputNames[0]]: new ort.Tensor("float32", f, [1, 3, 640, 640]) });
  const o = out[sess.outputNames[0]], n = o.dims[2], a = o.data, bs = [];
  for (let i = 0; i < n; i++) {
    const s = a[4 * n + i]; if (s < 0.35) continue;
    const w = a[2 * n + i] / k, h = a[3 * n + i] / k, cx = r.x * fw + a[i] / k, cy = r.y * fh + a[n + i] / k;
    bs.push({ cx: cx / fw, cy: cy / fh, w: w / fw, h: h / fh, s });
  }
  return bs;
}
function nmsHeads(bs) {
  const fw = frame.width, fh = frame.height, box = (b) => [(b.cx - b.w / 2) * fw, (b.cy - b.h / 2) * fh, b.w * fw, b.h * fh];
  const iou = (p, q) => { const [ax, ay, aw, ah] = box(p), [bx, by, bw, bh] = box(q); const ix = Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx)), iy = Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by)); const I = ix * iy; return I / (aw * ah + bw * bh - I); };
  bs.sort((a, b) => b.s - a.s); const keep = [];
  for (const b of bs) if (keep.every((q) => iou(q, b) < 0.45)) keep.push(b);
  return keep;
}
function headTiles() {
  if (+cfg.headGrid !== 2) return [{ x: 0, y: 0, w: 1, h: 1 }];
  const out = []; for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) out.push({ x: i * 0.35, y: j * 0.35, w: 0.65, h: 0.65 });
  return out;
}
// 头框对上已有的人（有脸的人鼻尖在头框里）；对不上就新建一个“只有人头”的人
function applyHeads(hs, now) {
  for (const h of hs) {
    let best = null, bd = 1e9;
    for (const p of people) { const d = Math.hypot(p.cx - h.cx, p.cy - h.cy); if (d < Math.max(h.w, p.width) * 0.8 && d < bd) { bd = d; best = p; } }
    if (best) { best.hb = h; best.headAt = now; if (!best.seen) { best.cx = h.cx; best.cy = h.cy; best.width = h.w; } continue; }
    people.push({ id: nextPersonId++, lm: null, slm: null, sm: null, cx: h.cx, cy: h.cy, width: h.w, yaw: NaN, near: false, frontal: false, ok: false,
      lastSeen: -1e9, seen: false, hb: h, headAt: now, tex: ["base", "veins"][Math.random() * 2 | 0], eyeRef: [0, 0] });
  }
}
function headTick(now) {
  if (cfg.headDet === "off" || headBusy || now - headAt < cfg.headEvery * 1000 || !frame.width) return;
  // 每一格都已经追上有脸的人：不用再找头
  const need = visibleCells().some((c) => { const p = c.pid != null && people.find((q) => q.id === c.pid); return !p || !p.seen; });
  if (!need) return;
  headBusy = true; headAt = now;
  (async () => {
    const sess = await ensureHead(); if (!sess) return;
    const t0 = performance.now(), all = [];
    for (const r of headTiles()) all.push(...await detectHeads(sess, r));
    heads = nmsHeads(all); headMs = performance.now() - t0;
    applyHeads(heads, performance.now());
  })().catch((e) => { console.warn(e); headErr = String(e.message || e); }).finally(() => { headBusy = false; });
}
const headFresh = (p, now) => p.hb && now - p.headAt < headGrace();
const faceFresh = (p, now) => p.slm && (p.seen || now - p.lastSeen < 400);

// 测试用假脸：官方模型顶点投影，轻轻晃动；“模拟有人”时生成两张，方便看监控墙分格
let canonVerts = null;
function fakeFace(now, k) {
  const t = now / 1000 + k * 2.1, yaw = Math.sin(t * 0.5) * 0.3, s = [0.22, 0.2, 0.14, 0.12][k] / 15.3, sy = s * frame.width / frame.height;
  const c = Math.cos(yaw), sn = Math.sin(yaw), lm = [];
  const ox = [0.38, 0.64, 0.13, 0.87][k], oy = [0.42, 0.5, 0.6, 0.36][k];
  // 假脸每 3 秒眨一次眼（用来测锁眼）
  const blink = Math.max(0, Math.sin(t * 2.1)) ** 8;
  const ec = [[33, 133, 159, 145], [263, 362, 386, 374]].map((ids) => ids.reduce((s, i) => [s[0] + canonVerts[i * 3] / 4, s[1] + canonVerts[i * 3 + 1] / 4], [0, 0]));
  for (let i = 0; i < 468; i++) {
    const x = canonVerts[i * 3], z = canonVerts[i * 3 + 2];
    let y = canonVerts[i * 3 + 1];
    for (const [ex, ey] of ec) { const d = Math.hypot(x - ex, (y - ey) * 1.6); if (d < 1.6) y = lerp(y, ey, blink * (1 - d / 1.6)); }
    const rx = x * c + z * sn, rz = -x * sn + z * c;
    lm.push({ x: ox + rx * s + Math.sin(t * 0.3) * 0.015, y: oy - y * sy, z: -rz * s });
  }
  for (let i = 468; i < 478; i++) lm.push({ ...lm[1] });
  const width = Math.hypot(lm[234].x - lm[454].x, (lm[234].y - lm[454].y) * frame.height / frame.width);
  return { lm, width, yaw: yaw * 180 / Math.PI, cx: lm[1].x, cy: lm[1].y, near: true, frontal: true, ok: true, fake: true };
}

const pickFace = (f) => ({ lm: f.lm, cx: f.cx, cy: f.cy, width: f.width, yaw: f.yaw, near: f.near, frontal: f.frontal, ok: f.ok });
function updatePeople(now, fresh) {
  if (fresh) {
    const pairs = [];
    // 匹配距离跟脸大小走：远处小脸挨得近，固定 0.15 会把两个人认成一个
    people.forEach((p, pi) => faces.forEach((f, fi) => { const d = Math.hypot(f.cx - p.cx, f.cy - p.cy); if (d < clamp(p.width * 1.2, 0.03, 0.15)) pairs.push([d, pi, fi]); }));
    pairs.sort((a, b) => a[0] - b[0]);
    const usedP = new Set(), usedF = new Set();
    for (const [, pi, fi] of pairs) {
      if (usedP.has(pi) || usedF.has(fi)) continue;
      usedP.add(pi); usedF.add(fi); Object.assign(people[pi], pickFace(faces[fi]), { lastSeen: now, seen: true });
    }
    people.forEach((p, pi) => { if (!usedP.has(pi)) p.seen = false; });
    faces.forEach((f, fi) => {
      if (usedF.has(fi)) return;
      people.push({ id: nextPersonId++, ...pickFace(f), lastSeen: now, seen: true, sm: null, slm: null,
        tex: ["base", "veins"][Math.random() * 2 | 0], eyeRef: [0, 0] });
    });
  }
  // 开着人头检测时，脸丢了（低头）的人先别删，等人头检测接上
  const grace = cfg.headDet !== "off" ? Math.max(cfg.lostGrace * 1000, headGrace()) : cfg.lostGrace * 1000;
  people = people.filter((p) => p.seen || now - p.lastSeen < grace || headFresh(p, now));
  for (const p of people) if (fresh && p.seen) p.slm = smoothLandmarks(p, now);
}
// One Euro 防抖（整张脸共用一个截止频率）
function smoothLandmarks(p, now) {
  const lm = p.lm, n = lm.length, fw = frame.width, fh = frame.height;
  let sm = p.sm;
  if (!sm || sm.n !== n) {
    sm = p.sm = { n, t: now, x: new Float32Array(n), y: new Float32Array(n), v: 0, nx: lm[1].x * fw, ny: lm[1].y * fh, out: lm.map((q) => ({ ...q })) };
    for (let i = 0; i < n; i++) { sm.x[i] = lm[i].x * fw; sm.y[i] = lm[i].y * fh; }
    return sm.out;
  }
  const dt = Math.max(1e-3, (now - sm.t) / 1000); sm.t = now;
  const alpha = (cut) => 1 / (1 + 1 / (2 * Math.PI * cut * dt));
  const nx = lm[1].x * fw, ny = lm[1].y * fh;
  sm.v += alpha(1) * (Math.hypot(nx - sm.nx, ny - sm.ny) / dt - sm.v); sm.nx = nx; sm.ny = ny;
  const a = alpha(cfg.smooth + 0.012 * sm.v);
  for (let i = 0; i < n; i++) {
    sm.x[i] += a * (lm[i].x * fw - sm.x[i]); sm.y[i] += a * (lm[i].y * fh - sm.y[i]);
    sm.out[i].x = sm.x[i] / fw; sm.out[i].y = sm.y[i] / fh; sm.out[i].z = lm[i].z;
  }
  return sm.out;
}

// ---------- 黑眼洞：WebGL 把面具贴图的眼部贴到真人眼睛上 ----------
// 网格与 UV 来自 MediaPipe 官方 canonical_face_model；只保留两眼附近（高斯权重），边缘渐隐到真皮肤
// 不用眨眼 GIF：监控里的黑眼洞不眨眼
const FACE_TEX = [
  { id: "base", url: "assets/face_base.webp" },
  { id: "veins", url: "assets/face_veins.gif" },
];
const glC = document.createElement("canvas");
let gl = null, glLoc = null, glPos = null, glAlphaBuf = null, faceTris = null, meshUV = null, meshFeat = null, faceReady = false, alphaFor = -1;
const glPosData = new Float32Array(468 * 3);
function eyeAlpha(r) {
  const out = new Float32Array(468), sx = 0.06 * r, sy = 0.05 * r;
  for (let i = 0; i < 468; i++) {
    let w = 0;
    for (const e of [meshFeat.R, meshFeat.L]) {
      const du = (meshUV[i * 2] - e[0]) / sx, dv = (meshUV[i * 2 + 1] - e[1]) / sy;
      w = Math.max(w, Math.exp(-(du * du + dv * dv) / 2));
    }
    const t = clamp((w - 0.18) / 0.5, 0, 1); out[i] = t * t * (3 - 2 * t);
  }
  return out;
}
function measureTexture(img) {
  const N = 256, c = document.createElement("canvas"); c.width = c.height = N;
  const x = c.getContext("2d"); x.drawImage(img, 0, 0, N, N);
  const px = x.getImageData(0, 0, N, N).data;
  const blob = (c0, rx, ry, thr) => {
    let sx = 0, sy = 0, n = 0;
    for (let v = Math.max(0, (c0[1] - ry) * N | 0); v < Math.min(N, (c0[1] + ry) * N); v++)
      for (let u = Math.max(0, (c0[0] - rx) * N | 0); u < Math.min(N, (c0[0] + rx) * N); u++) {
        const i = (v * N + u) * 4, L = 0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2];
        if (L < thr) { const w = thr - L; sx += u * w; sy += v * w; n += w; }
      }
    return n ? [sx / n / N, sy / n / N] : null;
  };
  return { R: blob(meshFeat.R, 0.09, 0.1, 40), L: blob(meshFeat.L, 0.09, 0.1, 40) };
}
// 贴图画的黑眼洞和网格眼睛位置不完全一致：在眼睛附近把 UV 挪过去
function calibratedUV(feat) {
  const out = new Float32Array(meshUV), pts = [];
  for (const k of ["R", "L"]) {
    const f = feat[k], m = meshFeat[k]; if (!f) continue;
    pts.push({ m, dx: clamp(f[0] - m[0], -0.06, 0.06), dy: clamp(f[1] - m[1], -0.08, 0.08), s2: 2 * 0.07 * 0.07 });
  }
  for (let i = 0; i < 468; i++) for (const p of pts) {
    const w = Math.exp(-((meshUV[i * 2] - p.m[0]) ** 2 + (meshUV[i * 2 + 1] - p.m[1]) ** 2) / p.s2);
    out[i * 2] += p.dx * w; out[i * 2 + 1] += p.dy * w;
  }
  return out;
}
async function loadFaceAssets() {
  const d = await (await fetch("assets/face_uv.json")).json();
  faceTris = new Uint16Array(d.tris); canonVerts = d.verts; meshUV = new Float32Array(d.uv);
  const avg = (ids) => ids.reduce((s, i) => [s[0] + meshUV[i * 2] / ids.length, s[1] + meshUV[i * 2 + 1] / ids.length], [0, 0]);
  meshFeat = { R: avg([33, 133, 159, 145]), L: avg([263, 362, 386, 374]) };
  gl = glC.getContext("webgl", { premultipliedAlpha: false, alpha: true, depth: true, antialias: true });
  if (!gl) throw new Error("WebGL 不可用");
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, `
    attribute vec3 aPos; attribute vec2 aUV; attribute float aA; uniform vec2 uRes; varying vec2 vUV; varying float vA;
    void main() { vUV = aUV; vA = aA; vec2 p = aPos.xy / uRes * 2.0 - 1.0; gl_Position = vec4(p.x, -p.y, clamp(aPos.z, -1.0, 1.0), 1.0); }`));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, `
    precision mediump float; uniform sampler2D uTex; uniform float uOp; varying vec2 vUV; varying float vA;
    void main() { vec4 c = texture2D(uTex, vUV); gl_FragColor = vec4(c.rgb, c.a * vA * uOp); }`));
  gl.linkProgram(prog); gl.useProgram(prog);
  glLoc = { pos: gl.getAttribLocation(prog, "aPos"), uv: gl.getAttribLocation(prog, "aUV"), a: gl.getAttribLocation(prog, "aA"),
    res: gl.getUniformLocation(prog, "uRes"), op: gl.getUniformLocation(prog, "uOp") };
  const buf = (data, loc, size, usage) => {
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, usage);
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); return b;
  };
  buf(meshUV, glLoc.uv, 2, gl.STATIC_DRAW);
  glAlphaBuf = buf(eyeAlpha(cfg.eyeRadius), glLoc.a, 1, gl.DYNAMIC_DRAW); alphaFor = cfg.eyeRadius;
  glPos = buf(glPosData, glLoc.pos, 3, gl.DYNAMIC_DRAW);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, faceTris, gl.STATIC_DRAW);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  faceReady = true;
  await Promise.all(FACE_TEX.map(loadTexSource));
}
async function loadTexSource(s) {
  s.frames = [];
  try {
    if (s.url.endsWith(".gif") && "ImageDecoder" in window) {
      const dec = new ImageDecoder({ data: await (await fetch(s.url)).arrayBuffer(), type: "image/gif" });
      await dec.tracks.ready;
      for (let i = 0; i < dec.tracks.selectedTrack.frameCount; i++) {
        const r = await dec.decode({ frameIndex: i });
        s.frames.push({ img: await createImageBitmap(r.image), dur: Math.max(20, r.image.duration ? r.image.duration / 1000 : 100) });
        r.image.close();
      }
    } else {
      // 用 onload 而不是 img.decode()：后者在后台标签页里可能一直不返回
      const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error("load " + s.url)); im.src = s.url; });
      s.frames.push({ img, dur: 1e9 });
    }
    s.total = s.frames.reduce((a, f) => a + f.dur, 0);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, calibratedUV(measureTexture(s.frames[0].img)), gl.STATIC_DRAW);
    s.uvBuf = b;
    s.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, s.tex);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    s.cur = -1; s.ready = true;
  } catch (e) { console.warn("贴图加载失败", s.url, e); }
}
function texFor(p) {
  const want = cfg.eyeTex === "random" ? p.tex : cfg.eyeTex;
  return FACE_TEX.find((s) => s.id === want && s.ready) || FACE_TEX.find((s) => s.ready);
}
// 锁眼：真人眨眼时眼皮关键点会合上，黑眼洞也会被压扁。
// 每只眼记住平时睁开的高度（相对眼宽），眨眼时把上眼皮一侧往上、下眼皮一侧往下撑回去
const EYES = [{ up: 159, lo: 145, a: 33, b: 133, k: "R" }, { up: 386, lo: 374, a: 362, b: 263, k: "L" }];
function lockEyes(p) {
  if (!cfg.eyeLock) return;
  const P =(i) => [glPosData[i * 3], glPosData[i * 3 + 1]];
  EYES.forEach((e, n) => {
    const U = P(e.up), Lo = P(e.lo), A = P(e.a), B = P(e.b);
    const eyeW = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
    let ox = Lo[0] - U[0], oy = Lo[1] - U[1]; const open = Math.hypot(ox, oy);
    const r = open / eyeW;
    // 参考开度：变大时立刻跟上，变小时很慢地回落（眨眼一下不会拉低它）
    const ref = p.eyeRef[n] = r > p.eyeRef[n] ? r : p.eyeRef[n] + (r - p.eyeRef[n]) * 0.003;
    const deficit = (ref - r) * eyeW; if (deficit < 0.3) return;
    // 开口方向：用眼角连线的法线（眼睛快闭上时上下眼皮连线不可靠）
    let nx = -(B[1] - A[1]), ny = B[0] - A[0]; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
    if (nx * ox + ny * oy < 0) { nx = -nx; ny = -ny; }
    const [mu, mv] = meshFeat[e.k];
    const wt = (i) => { const du = meshUV[i * 2] - mu, dv = meshUV[i * 2 + 1] - mv; return Math.exp(-(du * du) / (2 * 0.06 * 0.06) - (dv * dv) / (2 * 0.04 * 0.04)); };
    const wUp = wt(e.up), wLo = wt(e.lo); // 用眼皮点的权重归一化，保证眼皮本身被完全撑回
    for (let i = 0; i < 468; i++) {
      const dv = meshUV[i * 2 + 1] - mv, w0 = wt(i);
      if (w0 < 0.01) continue;
      const up = dv < 0, w = Math.min(1, w0 / (up ? wUp : wLo));
      const side = up ? -0.5 : 0.5; // 上半往上（逆开口方向），下半往下
      glPosData[i * 3] += nx * deficit * side * w; glPosData[i * 3 + 1] += ny * deficit * side * w;
    }
  });
}
// 在某一格的小监控画面上画黑眼；M 是 frame 像素 → 这一格画面像素的变换
function drawBlackEyes(mx, mw, mh, M, p, op, src, now) {
  const lm = p.slm;
  if (!faceReady || !src || op <= 0.001) return;
  if (glC.width !== mw || glC.height !== mh) { glC.width = mw; glC.height = mh; }
  let t = now % src.total, fi = 0;
  while (fi < src.frames.length - 1 && t >= src.frames[fi].dur) { t -= src.frames[fi].dur; fi++; }
  gl.bindTexture(gl.TEXTURE_2D, src.tex);
  if (src.cur !== fi) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src.frames[fi].img); src.cur = fi; }
  if (alphaFor !== cfg.eyeRadius) { alphaFor = cfg.eyeRadius; gl.bindBuffer(gl.ARRAY_BUFFER, glAlphaBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, eyeAlpha(cfg.eyeRadius)); }
  gl.bindBuffer(gl.ARRAY_BUFFER, src.uvBuf); gl.vertexAttribPointer(glLoc.uv, 2, gl.FLOAT, false, 0, 0);
  for (let i = 0; i < 468; i++) {
    const q = lmPx(lm[i]);
    glPosData[i * 3] = M.a * q.x + M.c * q.y + M.e; glPosData[i * 3 + 1] = M.b * q.x + M.d * q.y + M.f; glPosData[i * 3 + 2] = lm[i].z * 4;
  }
  lockEyes(p);
  gl.bindBuffer(gl.ARRAY_BUFFER, glPos); gl.bufferSubData(gl.ARRAY_BUFFER, 0, glPosData);
  gl.viewport(0, 0, mw, mh); gl.uniform2f(glLoc.res, mw, mh); gl.uniform1f(glLoc.op, op);
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.drawElements(gl.TRIANGLES, faceTris.length, gl.UNSIGNED_SHORT, 0);
  mx.drawImage(glC, 0, 0);
}

// ---------- 监控墙：4 台虚拟云台 ----------
const PHASES = ["lock", "face", "eyes", "black", "hold"];
const cells = [0, 1, 2, 3].map((i) => ({
  i, label: `CAM 0${i + 1}`, phase: "idle", t: 0, pid: null, coolUntil: 0,
  cam: { cx: 0, cy: 0, lh: 0, rot: 0, vx: 0, vy: 0, vh: 0, vr: 0, init: false },
  mon: document.createElement("canvas"), rect: { x: 0, y: 0, w: 0, h: 0 }, M: new DOMMatrix(), tear: 0,
}));
for (const c of cells) c.mx = c.mon.getContext("2d");
// 每次锁定给这一格随机一套“镜头风格”，四格不会同步、取景也不一样
const NO_STY = { dur: {}, frame: 1, fill: 1, follow: 1, eye: "both", skipFace: false, ox: 0, oy: 0, tilt: 0 };
function rollStyle() {
  const v = cfg.vary, r = (a) => 1 + rnd(-a, a) * v;
  return {
    dur: { lock: r(0.5), face: r(0.6), eyes: r(0.6), black: r(0.5), hold: r(0.6) },
    frame: r(0.35), fill: r(0.3), follow: r(0.5),
    eye: Math.random() < 0.35 * v ? (Math.random() < 0.5 ? "L" : "R") : "both", // 只推一只眼
    skipFace: Math.random() < 0.2 * v,                                          // 跳过脸，直接怼到眼睛
    ox: rnd(-0.12, 0.12) * v, oy: rnd(-0.1, 0.1) * v,                           // 不居中的取景
    tilt: rnd(-0.12, 0.12) * v,                                                 // 镜头歪一点
  };
}
const styOf = (c) => c.sty || NO_STY;
const durOf = (ph, c) => ({ lock: cfg.tLock, face: cfg.tFace, eyes: cfg.tEyes, black: cfg.tBlack, hold: cfg.tHold }[ph]) * (styOf(c).dur[ph] || 1);

function layoutCells() {
  const quad = cfg.layout === "quad", g = 2;
  cells.forEach((c, i) => {
    if (quad) c.rect = { x: (i % 2) * W / 2, y: Math.floor(i / 2) * H / 2, w: W / 2 - (i % 2 ? 0 : g / 2), h: H / 2 - (i < 2 ? g / 2 : 0) };
    else c.rect = i === 0 ? { x: 0, y: 0, w: W, h: H } : { x: 0, y: 0, w: 0, h: 0 };
    if (i % 2) c.rect.x += g / 2; if (i >= 2) c.rect.y += g / 2;
  });
}
const visibleCells = () => (cfg.layout === "quad" ? cells : [cells[0]]);

// 没人时每格的固定机位：全景、左侧、右侧、缓慢扫视
function idleView(c, now) {
  const fw = frame.width, fh = frame.height, asp = c.rect.w / Math.max(1, c.rect.h);
  const wideH = Math.min(fh, fw / asp);
  const t = now / 1000;
  if (c.i === 0) return { cx: fw / 2, cy: fh / 2, h: wideH, rot: 0 };
  if (c.i === 1) return { cx: fw * 0.3, cy: fh * 0.55, h: wideH / 1.7, rot: 0 };
  if (c.i === 2) return { cx: fw * 0.7, cy: fh * 0.5, h: wideH / 1.7, rot: 0 };
  return { cx: fw * (0.5 + 0.25 * Math.sin(t * 0.12)), cy: fh * 0.45, h: wideH / 1.35, rot: 0 };
}
function faceView(c, lm) {
  const P = (i) => lmPx(lm[i]);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const i of [10, 152, 234, 454, 127, 356, 58, 288]) { const p = P(i); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
  const asp = c.rect.w / Math.max(1, c.rect.h), st = styOf(c), ff = cfg.faceFrame * st.frame;
  const h = Math.max((y1 - y0) * ff, (x1 - x0) * ff / asp);
  const A = P(33), B = P(263);
  return { cx: (x0 + x1) / 2 + st.ox * h, cy: (y0 + y1) / 2 + st.oy * h, h, rot: Math.atan2(B.y - A.y, B.x - A.x) * 0.5 + st.tilt };
}
function eyesView(c, lm) {
  const P = (i) => lmPx(lm[i]);
  const ce = (ids) => ids.map(P).reduce((s, p) => ({ x: s.x + p.x / ids.length, y: s.y + p.y / ids.length }), { x: 0, y: 0 });
  const R = ce([33, 133, 159, 145]), L = ce([263, 362, 386, 374]);
  const A = P(33), B = P(263), span = Math.hypot(B.x - A.x, B.y - A.y);
  const asp = c.rect.w / Math.max(1, c.rect.h), st = styOf(c), rot = Math.atan2(B.y - A.y, B.x - A.x) + st.tilt * 0.6;
  if (st.eye !== "both") { // 单眼特写：一只眼占画面
    const E = st.eye === "L" ? L : R, w = st.eye === "L" ? Math.hypot(P(263).x - P(362).x, P(263).y - P(362).y) : Math.hypot(P(33).x - P(133).x, P(33).y - P(133).y);
    const h = w / (cfg.eyeFill * 0.85 * st.fill) / asp;
    return { cx: E.x + st.ox * h * 0.5, cy: E.y + st.oy * h * 0.5, h, rot };
  }
  const h = span / (cfg.eyeFill * st.fill) / asp;
  return { cx: (R.x + L.x) / 2 + st.ox * h * 0.5, cy: (R.y + L.y) / 2 + st.oy * h * 0.5, h, rot };
}
function headView(c, p) { // 只有人头框（低头）时：推到头上，等他抬头
  const b = p.hb, asp = c.rect.w / Math.max(1, c.rect.h), st = styOf(c), ff = cfg.faceFrame * st.frame * 1.25;
  const h = Math.max(b.h * frame.height * ff, b.w * frame.width * ff / asp);
  return { cx: b.cx * frame.width + st.ox * h, cy: b.cy * frame.height + st.oy * h, h, rot: st.tilt };
}

// 镜头：带一点过冲的弹簧，变焦在对数空间里做，像真的云台
function stepCam(c, tgt, dt) {
  const f = cfg.follow * (c.pid != null ? styOf(c).follow : 1), k = f * f, d = 2 * f * 0.72, m = c.cam;
  if (!m.init) { Object.assign(m, { cx: tgt.cx, cy: tgt.cy, lh: Math.log(tgt.h), rot: tgt.rot, init: true }); return; }
  const spring = (x, v, target) => { const a = k * (target - x) - d * v; v += a * dt; return [x + v * dt, v]; };
  [m.cx, m.vx] = spring(m.cx, m.vx, tgt.cx);
  [m.cy, m.vy] = spring(m.cy, m.vy, tgt.cy);
  [m.lh, m.vh] = spring(m.lh, m.vh, Math.log(tgt.h));
  const rt = m.rot + wrapAng(tgt.rot - m.rot); [m.rot, m.vr] = spring(m.rot, m.vr, rt);
}

function updateCells(now, dt) {
  // 分配：空闲的格子去追离得最近、还没被追的合格的人
  const taken = new Set(cells.filter((c) => c.pid != null).map((c) => c.pid));
  const headOk = (p) => cfg.headDet !== "off" && headFresh(p, now) && p.hb.w >= cfg.nearRatio * 0.8;
  const free = people.filter((p) => !taken.has(p.id) && ((p.ok && p.seen) || (!p.seen && headOk(p)))).sort((a, b) => b.width - a.width);
  for (const c of visibleCells()) {
    if (c.pid == null && c.phase === "idle" && now >= c.coolUntil && free.length) {
      // 每格反应快慢不一样，不会几格同时锁定
      if (c.wait == null) c.wait = now + rnd(0, 1800) * cfg.vary;
      if (now < c.wait) continue;
      const p = free.shift(); c.pid = p.id; c.phase = "lock"; c.t = 0; c.wait = null; c.sty = rollStyle(); sndBeep();
    } else if (c.pid == null) c.wait = null;
  }
  // 空闲的格子时不时随机断讯（人越少，空闲格越多，断得越频繁）
  for (const c of visibleCells()) {
    if (c.phase === "drop") { c.t += dt; if (c.t >= c.dropDur) { c.phase = "idle"; c.t = 0; } continue; }
    if (cfg.dropRate > 0 && c.pid == null && c.phase === "idle" && Math.random() < dt * 0.07 * cfg.dropRate) {
      c.phase = "drop"; c.t = 0; c.dropDur = rnd(0.6, 2.5); c.dropText = Math.random() < 0.65 ? "NO SIGNAL" : "CAMERA OFFLINE";
      sndStatic(Math.min(0.6, c.dropDur), 0.08);
    }
  }
  let servo = 0;
  for (const c of cells) {
    if (c.phase === "drop") continue;
    const p = c.pid != null ? people.find((q) => q.id === c.pid) : null;
    if (c.pid != null && !p) { c.pid = null; if (c.phase !== "lost") { c.phase = "idle"; c.t = 0; } }
    if (c.phase === "lost") {
      c.t += dt;
      if (c.t > 1.4) { c.phase = "idle"; c.t = 0; c.pid = null; c.coolUntil = now + cfg.cooldown * 1000; c.cam.init = false; }
    } else if (p) {
      // 人在但不合格（转头太多）时暂停计时，不推进；只有人头（低头）时，锁定照走，之后停在头上等他抬头
      const headOnly = !p.seen && headFresh(p, now);
      if (p.ok && p.seen) c.t += dt;
      else if (headOnly && c.phase === "lock") c.t += dt;
      c.noFace = p.seen ? 0 : (c.noFace || 0) + dt;
      if (headOnly && c.phase !== "lock" && c.noFace > cfg.headWait) { c.phase = "lost"; c.t = 0; c.noFace = 0; sndStatic(1.2, 0.3); }
      if (c.phase !== "lost" && c.t >= durOf(c.phase, c)) {
        let idx = PHASES.indexOf(c.phase);
        if (c.phase === "lock" && styOf(c).skipFace) idx++;
        if (idx < PHASES.length - 1) { c.phase = PHASES[idx + 1]; c.t = 0; if (c.phase === "black") sndDrop(); if (c.phase === "face" || c.phase === "eyes") c.focus = 1; }
        else { c.phase = "lost"; c.t = 0; sndStatic(1.2, 0.3); }
      }
    }
    const lm = p && faceFresh(p, now) && p.slm;
    let tgt = idleView(c, now);
    if (lm && c.phase === "face") tgt = faceView(c, lm);
    else if (lm && ["eyes", "black", "hold", "lost"].includes(c.phase)) tgt = eyesView(c, lm);
    else if (p && !lm && p.hb && c.phase !== "lock") tgt = headView(c, p);
    stepCam(c, tgt, dt);
    c.focus = Math.max(0, (c.focus || 0) - dt * 1.2);
    servo += Math.abs(c.cam.vh) + Math.hypot(c.cam.vx, c.cam.vy) / Math.exp(c.cam.lh) * 0.5;
  }
  if (servoGain) {
    servoGain.gain.setTargetAtTime(clamp(servo * 0.08, 0, 0.1), ac.currentTime, 0.05);
    servoOsc.frequency.setTargetAtTime(160 + clamp(servo, 0, 3) * 120, ac.currentTime, 0.05);
  }
}

// ---------- 画一格 ----------
const noiseTiles = [0, 1, 2, 3].map(() => {
  const c = document.createElement("canvas"); c.width = c.height = 192;
  const x = c.getContext("2d"), d = x.createImageData(192, 192);
  for (let i = 0; i < d.data.length; i += 4) { const g = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = g; d.data[i + 3] = 255; }
  x.putImageData(d, 0, 0); return c;
});
let scanPattern = null;
function drawCell(c, now) {
  const r = c.rect; if (r.w < 4 || r.h < 4) return;
  const mw = Math.max(64, Math.round(cfg.pixel * (r.w / Math.max(W / 2, 1)))), mh = Math.max(36, Math.round(mw * r.h / r.w));
  if (c.mon.width !== mw || c.mon.height !== mh) { c.mon.width = mw; c.mon.height = mh; }
  const mx = c.mx, m = c.cam, h = Math.exp(m.lh), s = mh / h;
  // 小幅“找焦”抖动
  const t = now / 1000, jit = h * 0.004 * cfg.hunt;
  const jx = jit * (Math.sin(t * 2.3 + c.i) + Math.sin(t * 3.7 + c.i * 2)), jy = jit * Math.sin(t * 2.9 + c.i * 3);
  c.M = new DOMMatrix().translateSelf(mw / 2, mh / 2).rotateSelf(-m.rot * 180 / Math.PI).scaleSelf(s).translateSelf(-(m.cx + jx), -(m.cy + jy));
  mx.setTransform(1, 0, 0, 1, 0, 0); mx.fillStyle = "#000"; mx.fillRect(0, 0, mw, mh);
  const blur = (Math.abs(m.vh) * 2.5 + (c.focus || 0) * 1.4) * cfg.hunt;
  mx.filter = blur > 0.15 ? `blur(${Math.min(4, blur).toFixed(2)}px)` : "none";
  mx.setTransform(c.M.a, c.M.b, c.M.c, c.M.d, c.M.e, c.M.f);
  mx.drawImage(frame, 0, 0);
  mx.filter = "none"; mx.setTransform(1, 0, 0, 1, 0, 0);
  // 黑眼洞
  const p = c.pid != null ? people.find((q) => q.id === c.pid) : null;
  if (p && faceFresh(p, now)) {
    let op = 0;
    if (c.phase === "black") op = clamp(c.t / durOf("black", c), 0, 1) * (Math.random() < 0.25 ? rnd(0.2, 0.8) : 1);
    else if (c.phase === "hold" || c.phase === "lost") op = Math.random() < 0.06 ? 0 : 1;
    drawBlackEyes(mx, mw, mh, c.M, p, op * cfg.eyeAmt, texFor(p), now);
  }
  // 撕裂：偶尔几条横向错位
  if (Math.random() < 0.012 * cfg.glitchRate * (c.pid == null ? 2 : 1)) c.tear = now + rnd(60, 220);
  if (now < c.tear) for (let k = 0; k < 4; k++) { const y = Math.random() * mh, hh = rnd(2, mh * 0.08); mx.drawImage(c.mon, 0, y, mw, hh, rnd(-mw * 0.06, mw * 0.06), y, mw, hh); }

  // 放大到屏幕：黑白、对比度
  ctx.save();
  ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.filter = `grayscale(1) contrast(${cfg.contrast}) brightness(${cfg.bright})`;
  ctx.drawImage(c.mon, r.x, r.y, r.w, r.h);
  ctx.filter = "none";
  if (c.phase === "lost" || c.phase === "drop") { // 信号丢失：雪花 + 黑场
    ctx.globalAlpha = 0.85; ctx.fillStyle = "#000"; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.globalAlpha = 0.9; ctx.drawImage(noiseTiles[(Math.random() * 4) | 0], r.x, r.y, r.w, r.h); ctx.globalAlpha = 1;
  }
  // 噪点、扫描线、暗角
  ctx.globalAlpha = cfg.noise * 0.35; ctx.globalCompositeOperation = "overlay";
  const tile = noiseTiles[(now / 50 | 0) % 4]; ctx.fillStyle = ctx.createPattern(tile, "repeat");
  ctx.save(); ctx.translate(r.x + Math.random() * 192, r.y + Math.random() * 192); ctx.fillRect(-192, -192, r.w + 384, r.h + 384); ctx.restore();
  ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = cfg.scan;
  if (!scanPattern) { const pc = document.createElement("canvas"); pc.width = 1; pc.height = 3; const px = pc.getContext("2d"); px.fillStyle = "rgba(0,0,0,0.55)"; px.fillRect(0, 0, 1, 1); scanPattern = ctx.createPattern(pc, "repeat"); }
  ctx.fillStyle = scanPattern; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.globalAlpha = 1;
  const v = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h / 2, Math.min(r.w, r.h) * 0.3, r.x + r.w / 2, r.y + r.h / 2, Math.max(r.w, r.h) * 0.72);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, `rgba(0,0,0,${cfg.vignette})`); ctx.fillStyle = v; ctx.fillRect(r.x, r.y, r.w, r.h);
  // 滚动的亮带（老监控常见）
  const by = r.y + ((now / 40) % (r.h + 120)) - 60;
  const bg = ctx.createLinearGradient(0, by - 40, 0, by + 40); bg.addColorStop(0, "rgba(255,255,255,0)"); bg.addColorStop(0.5, "rgba(255,255,255,0.035)"); bg.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = bg; ctx.fillRect(r.x, by - 40, r.w, 80);
  drawHud(c, p, now);
  ctx.restore();
}

// ---------- HUD ----------
const pad2 = (n) => String(n).padStart(2, "0");
function stampText() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}
function drawHud(c, p, now) {
  const r = c.rect, fs = clamp(Math.round(Math.min(r.h / 26, r.w / 17)), 10, 22), m = fs * 0.9; // 窄格子按宽度缩字
  ctx.font = `${fs}px "Cascadia Code", Consolas, monospace`; ctx.textBaseline = "top";
  ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 3;
  ctx.fillStyle = "rgba(235,235,235,0.9)";
  ctx.fillText(c.label, r.x + m, r.y + m);
  if ((now / 600 | 0) % 2 === 0) { ctx.fillStyle = "#e33"; ctx.beginPath(); ctx.arc(r.x + m + fs * 5.2, r.y + m + fs * 0.55, fs * 0.3, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = "rgba(235,235,235,0.9)"; ctx.fillText("REC", r.x + m + fs * 5.7, r.y + m);
  if (cfg.stamp) { // 格子太窄（竖屏手机四分屏）时只显示时分秒，免得和 CAM 标签叠在一起
    let s = stampText(); if (ctx.measureText(s).width > r.w - fs * 9.5) s = s.slice(11);
    if (ctx.measureText(s).width <= r.w - fs * 9.5) ctx.fillText(s, r.x + r.w - m - ctx.measureText(s).width, r.y + m);
  }
  const asp = r.w / Math.max(1, r.h), wideH = Math.min(frame.height, frame.width / asp); // 以全景为 ×1
  const zoom = wideH / Math.exp(c.cam.lh);
  const z = `×${zoom.toFixed(1)}`;
  const noFace = p && !faceFresh(p, now) && p.hb && !["idle", "lock", "lost", "drop"].includes(c.phase);
  const status = noFace ? `SUBJ ${pad2(p.id % 100)} · FACE NOT VISIBLE` : {
    idle: now < c.coolUntil ? "STANDBY" : "MOTION SCAN", lock: "TARGET ACQUIRED", face: `TRACKING · SUBJ ${pad2(p ? p.id % 100 : 0)}`,
    eyes: "OCULAR ZOOM", black: "ANOMALY DETECTED", hold: "ANOMALY DETECTED", lost: "NO SIGNAL", drop: "",
  }[c.phase];
  const blinkStatus = (noFace || c.phase === "black" || c.phase === "hold" || c.phase === "lock") && (now / 350 | 0) % 2;
  if (!blinkStatus) ctx.fillText(status, r.x + m, r.y + r.h - m - fs);
  // 变焦倍数放右下；和状态文字挤不下时不显示
  if (ctx.measureText(status).width + ctx.measureText(z).width + m * 3 < r.w) ctx.fillText(z, r.x + r.w - m - ctx.measureText(z).width, r.y + r.h - m - fs);
  // 锁定框：在全景 / 推近到脸时框住目标的脸
  const hasFace = p && faceFresh(p, now);
  if (p && (hasFace || p.hb) && (c.phase === "lock" || c.phase === "face" || noFace)) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const sx = r.w / c.mon.width, sy = r.h / c.mon.height;
    // 有脸框脸，只有人头时框头
    const pts = hasFace ? [10, 152, 234, 454].map((i) => lmPx(p.slm[i]))
      : [[-1, -1], [1, 1]].map(([u, v]) => ({ x: (p.hb.cx + u * p.hb.w / 2) * frame.width, y: (p.hb.cy + v * p.hb.h / 2) * frame.height }));
    for (const q of pts) {
      const X = r.x + (c.M.a * q.x + c.M.c * q.y + c.M.e) * sx, Y = r.y + (c.M.b * q.x + c.M.d * q.y + c.M.f) * sy;
      x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y);
    }
    const padb = (x1 - x0) * 0.12; x0 -= padb; x1 += padb; y0 -= padb; y1 += padb;
    const L = Math.min(x1 - x0, y1 - y0) * 0.22;
    ctx.strokeStyle = "rgba(240,240,240,0.9)"; ctx.lineWidth = Math.max(1.5, fs / 9);
    ctx.beginPath();
    for (const [X, Y, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) { ctx.moveTo(X + dx * L, Y); ctx.lineTo(X, Y); ctx.lineTo(X, Y + dy * L); }
    ctx.stroke();
  }
  if (["eyes", "black", "hold"].includes(c.phase)) { // 中心十字
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, k = fs * 0.8;
    ctx.strokeStyle = "rgba(240,240,240,0.5)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - k, cy); ctx.lineTo(cx - k * 0.35, cy); ctx.moveTo(cx + k * 0.35, cy); ctx.lineTo(cx + k, cy);
    ctx.moveTo(cx, cy - k); ctx.lineTo(cx, cy - k * 0.35); ctx.moveTo(cx, cy + k * 0.35); ctx.lineTo(cx, cy + k); ctx.stroke();
  }
  if (c.phase === "lost" || (c.phase === "drop" && (now / 450 | 0) % 3)) {
    const s = c.phase === "drop" ? c.dropText : "NO SIGNAL", big = fs * 2.2; ctx.font = `${big}px "Cascadia Code", Consolas, monospace`;
    ctx.fillStyle = "rgba(240,240,240,0.9)"; ctx.fillText(s, r.x + (r.w - ctx.measureText(s).width) / 2, r.y + r.h / 2 - big / 2);
  }
  ctx.shadowBlur = 0;
}

function drawDebug(now) {
  // 每一格里：每张检测到的脸画框 + 编号、脸宽、yaw、是否合格、被哪一格追
  ctx.save(); ctx.font = "12px Consolas, monospace"; ctx.lineWidth = 1.5;
  for (const c of visibleCells()) {
    const r = c.rect; if (r.w < 4) continue;
    const sx = r.w / c.mon.width, sy = r.h / c.mon.height;
    const toS = (q) => ({ x: r.x + (c.M.a * q.x + c.M.c * q.y + c.M.e) * sx, y: r.y + (c.M.b * q.x + c.M.d * q.y + c.M.f) * sy });
    ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    for (const p of people) {
      if (!p.seen) continue;
      const lm = p.slm || p.lm;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const i of [10, 152, 234, 454]) { const q = toS(lmPx(lm[i])); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
      const cam = cells.find((k) => k.pid === p.id);
      ctx.strokeStyle = ctx.fillStyle = !p.ok ? "#9a9a9a" : cam ? "#f2838f" : "#7fd1a8";
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      const yawTxt = Number.isFinite(p.yaw) ? p.yaw.toFixed(0) + "°" : "--";
      ctx.fillText(`#${p.id}${cam ? " → " + cam.label : ""}`, x0, y0 - 20);
      ctx.fillText(`w ${p.width.toFixed(2)}${p.near ? "" : " far"}  yaw ${yawTxt}${p.frontal ? "" : " side"}`, x0, y0 - 6);
      if (cfg.mesh) for (let i = 0; i < 468; i += 2) { const q = toS(lmPx(lm[i])); ctx.fillRect(q.x - 0.7, q.y - 0.7, 1.4, 1.4); }
    }
    // 人头框（黄色）：最近一次人头检测的结果，被追的标上格子
    if (cfg.headDet !== "off") for (const p of people) {
      if (!p.hb || p.seen || !headFresh(p, now)) continue;
      const b = p.hb, a = toS({ x: (b.cx - b.w / 2) * frame.width, y: (b.cy - b.h / 2) * frame.height }), z = toS({ x: (b.cx + b.w / 2) * frame.width, y: (b.cy + b.h / 2) * frame.height });
      const cam = cells.find((k) => k.pid === p.id);
      ctx.strokeStyle = ctx.fillStyle = cam ? "#f2838f" : "#e8c25a";
      ctx.strokeRect(a.x, a.y, z.x - a.x, z.y - a.y);
      ctx.fillText(`#${p.id} head ${b.s.toFixed(2)}${cam ? " → " + cam.label : ""}`, a.x, a.y - 6);
    }
    ctx.restore();
  }
  ctx.restore();
  ctx.save(); ctx.font = "12px Consolas, monospace"; ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(W / 2 - 230, H / 2 - 54, 460, 94);
  ctx.fillStyle = "#7fd1a8";
  ctx.fillText(`faces ${faces.length}  people ${people.length}  near ≥ ${cfg.nearRatio}  yaw ≤ ±${cfg.yawLimit}°  fps ${fps.toFixed(0)}${force ? "  (force)" : ""}`, W / 2 - 220, H / 2 - 28);
  const hs = cfg.headDet === "off" ? "head off" : headSess ? `head ${headName}/${headEP}  ${heads.length} heads  ${headMs.toFixed(0)} ms${headBusy ? " …" : ""}` : headLoading ? "head loading…" : `head ${headFailed ? "unavailable → tiles 3x2" : headErr || "idle"}`;
  ctx.fillText(hs, W / 2 - 220, H / 2 - 42);
  cells.forEach((c, i) => {
    const st = c.pid != null && c.sty ? `  eye ${c.sty.eye}${c.sty.skipFace ? " skip" : ""} ×${c.sty.frame.toFixed(2)}/${c.sty.fill.toFixed(2)} spd ${c.sty.follow.toFixed(2)}` : "";
    ctx.fillText(`${c.label}  ${c.phase.padEnd(5)} ${c.t.toFixed(1)}s  subj ${c.pid ?? "-"}${st}`, W / 2 - 220, H / 2 - 12 + i * 14);
  });
  ctx.restore();
}

// ---------- 主循环 ----------
let lastFrame = performance.now(), fps = 0;
function loop() {
  const now = performance.now(), dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now; fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;
  const ok = updateFrame();
  let fresh = false;
  if (ok && landmarker && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime; fresh = true;
    try { faces = analyze(landmarker.detectForVideo(frame, now)); } catch (e) { console.warn(e); faces = []; }
    faces = mergeFar(faces, now);
    if (force && !faces.length && canonVerts) faces = [0, 1, 2, 3].map((k) => fakeFace(now, k));
  }
  if (ok) headTick(now);
  updatePeople(now, fresh);
  layoutCells();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = "#050505"; ctx.fillRect(0, 0, W, H);
  if (ok) { updateCells(now, dt); for (const c of visibleCells()) drawCell(c, now); }
  if (cfg.debug) drawDebug(now);
  requestAnimationFrame(loop);
}

// ---------- 摄像头 ----------
let stream = null, cams = [], camError = "";
function fakeStream() {
  const c = document.createElement("canvas"); c.width = 1280; c.height = 720;
  const x = c.getContext("2d");
  const paint = () => {
    const g = x.createLinearGradient(0, 0, 0, 720); g.addColorStop(0, "#4a4f54"); g.addColorStop(1, "#1a1d20");
    x.fillStyle = g; x.fillRect(0, 0, 1280, 720);
    x.fillStyle = "#2a2622"; x.fillRect(120, 160, 180, 560); x.fillStyle = "#33302c"; x.fillRect(980, 220, 220, 500);
    x.fillStyle = "#6a6a6a"; x.font = "20px Consolas"; x.fillText("TEST PATTERN", 30, 40);
    requestAnimationFrame(paint);
  };
  paint();
  return c.captureStream(30);
}
async function startCamera() {
  if (stream) for (const t of stream.getTracks()) t.stop();
  camError = "";
  if (cfg.deviceId === "__test") stream = fakeStream();
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
  { id: "cam", l: T("镜头", "Camera", "카메라"), groups: [
    { l: T("摄像头", "Camera", "카메라"), n: T("输入", "input", "입력"), items: [
      { t: "camera" },
      { t: "seg", k: "res", l: T("分辨率", "Resolution", "해상도"), o: [{ v: "720", l: "720p" }, { v: "1080", l: "1080p" }] },
      { t: "info", id: "camInfo" },
      { t: "sub", l: T("推到眼睛是数码放大，建议用 1080p 以上的摄像头，观众离摄像头 1 米以内。", "Eye close-ups are digital zoom: use 1080p+ and keep people within ~1 m.", "눈 클로즈업은 디지털 줌입니다. 1080p 이상, 1m 이내 권장.") },
    ] },
    { l: T("画面方向", "Orientation", "방향"), items: [
      { t: "seg", k: "rot", l: T("旋转", "Rotate", "회전"), o: [0, 90, 180, 270].map((v) => ({ v, l: v + "°" })) },
      C("mirror", T("左右镜像（监控默认不镜像）", "Mirror (CCTV is normally not mirrored)", "좌우 반전 (CCTV는 보통 반전 안 함)")),
      C("flipY", T("上下翻转", "Flip vertically", "상하 반전")),
    ] },
    { l: T("监控墙", "Monitor wall", "모니터 월"), items: [
      { t: "seg", k: "layout", l: T("布局", "Layout", "레이아웃"), o: [{ v: "quad", l: T("四分屏", "4 cams", "4분할") }, { v: "single", l: T("单画面", "Single", "단일") }] },
      C("stamp", T("显示时间戳", "Timestamp", "타임스탬프")),
      { t: "sub", l: T("同一个摄像头画面切成 CAM 01–04，每格一台虚拟云台，各追一个人（离得最近的优先）。", "One camera feed split into CAM 01–04; each is a virtual PTZ tracking one person (nearest first).", "카메라 하나를 CAM 01–04로 나눠 각 칸이 한 사람씩 추적합니다 (가까운 순).") },
    ] },
  ] },
  { id: "detect", l: T("识别", "Detect", "인식"), groups: [
    { l: T("距离", "Distance", "거리"), n: T("脸宽 / 画面宽", "face / frame", "얼굴 / 화면"), items: [
      R("nearRatio", T("近距离阈值", "Near threshold", "근거리 기준"), 0.02, 0.45, 0.005),
      { t: "seg", k: "farScan", l: T("远距离检测", "Far detection", "원거리 검출"), o: [{ v: "off", l: T("关", "Off", "끔") }, { v: "2x2", l: "2×2" }, { v: "3x2", l: "3×2" }] },
      { t: "sub", l: T("摄像头离人远、脸很小（教室、大厅俯拍）时打开：画面切块轮流检测，被追的人每帧在附近裁一块跟踪。阈值同时调到 0.03–0.05。更吃性能。", "For far cameras with tiny faces (classroom / hall): scans the frame in tiles and re-crops each tracked person every frame. Lower the threshold to 0.03–0.05. Heavier.", "카메라가 멀고 얼굴이 작을 때(교실·홀): 화면을 나눠 검출하고 추적 중인 사람은 매 프레임 주변을 잘라 추적합니다. 기준을 0.03–0.05로 낮추세요. 더 무겁습니다.") },
    ] },
    { l: T("人头检测", "Head detection", "머리 검출"), n: "YOLOv8 head · ONNX", items: [
      { t: "seg", k: "headDet", l: T("模型", "Model", "모델"), o: [{ v: "off", l: T("关", "Off", "끔") }, { v: "nano", l: "nano 12MB" }, { v: "medium", l: "medium 104MB" }] },
      { t: "seg", k: "headGrid", l: T("检测范围", "Coverage", "검출 범위"), o: [{ v: 1, l: T("整幅", "Full", "전체") }, { v: 2, l: "2×2" }] },
      R("headEvery", T("检测间隔", "Interval", "간격"), 0.2, 3, 0.1, "s"),
      R("headWait", T("等抬头最长", "Wait for face", "얼굴 대기"), 3, 60, 1, "s"),
      { t: "sub", l: T("两种模式：上面的“远距离检测”是放大切片（不用额外模型）；这里是人头模型。人头模型加载不了时自动退回放大切片 3×2。", "Two modes: Far detection above = zoomed tiles (no extra model); this = head model. If the head model can't load it falls back to 3×2 tiles.", "두 가지 모드: 위의 원거리 검출은 확대 타일(추가 모델 없음), 여기는 머리 모델. 머리 모델을 못 불러오면 자동으로 3×2 타일로 돌아갑니다.") },
      { t: "sub", l: T("先找人头再找脸：低头、只露头顶的人也会被锁定，镜头停在头上显示 FACE NOT VISIBLE，等他抬头再推到眼睛。所有格子都追上脸以后自动停止人头检测。nano 快，medium 准但慢、手机别用。", "Heads first, then faces: people looking down still get locked; the camera holds on the head (FACE NOT VISIBLE) until they look up. Head detection pauses once every cell has a face. nano is fast; medium is more accurate but slow (not for phones).", "머리 먼저, 얼굴은 나중: 고개 숙인 사람도 잠그고 머리에서 FACE NOT VISIBLE로 기다렸다가 고개를 들면 눈으로 줌인. 모든 칸이 얼굴을 잡으면 머리 검출은 멈춥니다. nano는 빠르고 medium은 정확하지만 느립니다(휴대폰 비권장).") },
    ] },
    { l: T("模型", "Models", "모델"), n: T("可下载", "downloadable", "다운로드"), items: [{ t: "models" }] },
    { l: T("朝向", "Facing", "방향"), n: "yaw", items: [
      R("yawLimit", T("左右角度上限", "Yaw limit", "좌우 각도 한계"), 10, 80, 1, "°"),
      { t: "sub", l: T("超过时镜头停在当前阶段，不往下推进。", "Beyond it the camera pauses at the current stage.", "넘으면 현재 단계에서 멈춥니다.") },
    ] },
    { l: T("追踪", "Tracking", "추적"), items: [
      R("lostGrace", T("丢失容忍", "Lost grace", "인식 끊김 허용"), 0, 3, 0.1, "s"),
      R("smooth", T("防抖", "Stabilize", "떨림 보정"), 0.2, 5, 0.1, "Hz"),
      C("debug", T("显示识别叠加（D）", "Detection overlay (D)", "인식 오버레이 (D)")),
      C("mesh", T("显示关键点", "Show landmarks", "랜드마크 표시")),
      { t: "sub", l: T("框的颜色：绿 = 合格未追，红 = 正在被追（→ CAM），灰 = 太远或侧脸。", "Green = eligible, red = being tracked (→ CAM), grey = too far or turned.", "초록 = 적합, 빨강 = 추적 중 (→ CAM), 회색 = 멀거나 옆얼굴.") },
    ] },
  ] },
  { id: "show", l: T("演出", "Show", "연출"), groups: [
    { l: T("节奏", "Timing", "타이밍"), n: T("秒", "seconds", "초"), items: [
      R("tLock", T("锁定", "Lock", "락온"), 0.2, 5, 0.1, "s"),
      R("tFace", T("停在脸", "Face", "얼굴"), 0.5, 10, 0.1, "s"),
      R("tEyes", T("停在眼睛", "Eyes", "눈"), 0.5, 10, 0.1, "s"),
      R("tBlack", T("变黑眼", "Turn black", "검게 변함"), 0.3, 8, 0.1, "s"),
      R("tHold", T("黑眼停留", "Hold", "유지"), 0.5, 15, 0.1, "s"),
      R("cooldown", T("信号丢失后冷却", "Cooldown", "쿨다운"), 0, 30, 0.5, "s"),
    ] },
    { l: T("镜头", "Lens", "렌즈"), items: [
      R("faceFrame", T("脸部取景", "Face framing", "얼굴 프레이밍"), 1, 3, 0.05, "×"),
      R("eyeFill", T("双眼占画面", "Eyes fill", "눈 비율"), 0.25, 0.95, 0.01),
      R("follow", T("跟随速度", "Follow speed", "따라가는 속도"), 0.5, 8, 0.1),
      R("hunt", T("找焦抖动", "Focus hunting", "초점 흔들림"), 0, 2, 0.05),
      R("vary", T("每格随机差异", "Per-cell variety", "칸별 랜덤 차이"), 0, 1, 0.05),
    ] },
    { l: T("黑眼洞", "Black eyes", "검은 눈"), n: T("用面具贴图的眼部", "from mask textures", "마스크 텍스처 눈"), items: [
      { t: "seg", k: "eyeTex", l: T("贴图", "Texture", "텍스처"), o: [
        { v: "random", l: T("随机", "Random", "랜덤") }, { v: "base", l: T("底图", "Base", "기본") },
        { v: "veins", l: T("血管", "Veins", "혈관") }] },
      R("eyeAmt", T("不透明度", "Opacity", "불투명도"), 0, 1, 0.01),
      R("eyeRadius", T("眼部范围", "Eye area", "눈 범위"), 0.5, 2, 0.05, "×"),
      C("eyeLock", T("锁眼（本人眨眼时黑眼洞不跟着闭）", "Eye lock (black eyes don't blink)", "눈 고정 (깜빡여도 검은 눈 유지)")),
    ] },
    { l: T("声音", "Sound", "소리"), items: [R("volume", T("音量", "Volume", "볼륨"), 0, 1, 0.01)] },
    { l: T("测试", "Test", "테스트"), items: [
      { t: "btns", b: [{ id: "force", l: T("模拟有人", "Simulate", "시뮬레이션"), cls: "primary" }, { id: "resetShow", l: T("重置", "Reset", "초기화"), cls: "danger" }] },
      { t: "btns", b: [{ id: "fullscreen", l: T("全屏 / 退出全屏", "Fullscreen", "전체화면") }, { id: "closePanel", l: T("关闭设置", "Close panel", "설정 닫기") }] },
      { t: "sub", l: T("快捷键：S 面板 · D 调试 · F 全屏 · P 模拟有人（两张假脸）· R 重置", "Keys: S panel · D debug · F fullscreen · P simulate · R reset", "단축키: S 패널 · D 디버그 · F 전체화면 · P 시뮬레이션 · R 초기화") },
      { t: "sub", l: T("手机 / 平板：右上角连点三下，或两指按住屏幕 1.2 秒，打开或关闭设置。", "Phone / tablet: triple-tap the top-right corner, or hold two fingers for 1.2 s.", "휴대폰 / 태블릿: 오른쪽 위를 세 번 탭하거나 두 손가락으로 1.2초 누르기.") },
    ] },
  ] },
  { id: "look", l: T("画面", "Image", "화면"), groups: [
    { l: T("监控画质", "CCTV look", "CCTV 화질"), items: [
      R("pixel", T("每格分辨率", "Cell resolution", "칸 해상도"), 120, 1280, 10, "px"),
      R("contrast", T("对比度", "Contrast", "대비"), 0.5, 2.5, 0.01),
      R("bright", T("亮度", "Brightness", "밝기"), 0.4, 1.8, 0.01),
      R("noise", T("噪点", "Noise", "노이즈"), 0, 1, 0.01),
      R("scan", T("扫描线", "Scanlines", "스캔라인"), 0, 1, 0.01),
      R("vignette", T("暗角", "Vignette", "비네팅"), 0, 1, 0.01),
      R("glitchRate", T("撕裂频率", "Tear rate", "찢김 빈도"), 0, 3, 0.1, "×"),
      R("dropRate", T("空闲格随机断讯", "Idle signal drops", "대기 칸 신호 끊김"), 0, 4, 0.1, "×"),
      { t: "sub", l: T("没在追人的格子会时不时 NO SIGNAL / CAMERA OFFLINE 一下；0 = 关闭。", "Idle cells randomly drop to NO SIGNAL / CAMERA OFFLINE; 0 = off.", "대기 칸이 가끔 NO SIGNAL / CAMERA OFFLINE. 0 = 끔.") },
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
  if (it.t === "models") return MODELS.map((m) => `<div class="mdl"><div><b>${m.file}</b><i>${m.size}</i></div><div class="sub">${tr(m.use)} · ${m.src}</div><a class="btn" href="${MODEL_DIR}${m.file}" download>${tr(T("下载", "Download", "다운로드"))}</a></div>`).join("");
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
  if (info) {
    info.classList.toggle("err", !!camError);
    info.textContent = camError ? tr(T("摄像头打开失败：", "Camera failed: ", "카메라 실패: ")) + camError + tr(T("（已切到测试画面）", " (test pattern)", " (테스트 화면)"))
      : video.videoWidth ? `${video.videoWidth}×${video.videoHeight}` : "";
  }
}
function syncButtons() { const f = $("#force"); if (f) f.textContent = tr(force ? T("停止模拟", "Stop", "중지") : T("模拟有人", "Simulate", "시뮬레이션")); }
function resetShow() { for (const c of cells) { c.phase = "idle"; c.t = 0; c.pid = null; c.coolUntil = 0; c.cam.init = false; } }
function onChange(k) {
  saveCfg();
  if (k === "volume" && master) master.gain.value = cfg.volume;
  if (k === "res") startCamera();
  if (k === "layout" || k === "rot") resetShow();
}
const side = $("#side");
function openPanel(open) { side.classList.toggle("open", open); document.body.classList.toggle("hide-cursor", !open); }
side.addEventListener("input", (e) => {
  const el = e.target, k = el.dataset.k; if (!k) return;
  if (el.type === "checkbox") cfg[k] = el.checked;
  else {
    const v = parseFloat(el.value); if (!Number.isFinite(v)) return;
    cfg[k] = v;
    const box = el.parentElement;
    if (el.type === "range") box.querySelector(".nv").value = fmtNum(findItem(k), v);
    else box.querySelector("input[type=range]").value = v;
  }
  onChange(k);
});
side.addEventListener("change", (e) => { if (e.target.id === "camSel") { cfg.deviceId = e.target.value; saveCfg(); startCamera(); } });
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
});
setInterval(() => {
  const busy = cells.filter((c) => c.pid != null).length;
  $("#statusbar").innerHTML = `<span class="dot"></span>CCTV<span>${landmarker ? "model ok" : "model…"}</span>` +
    `<span>faces <b class="v">${faces.length}</b></span><span>tracking <b class="v">${busy}</b></span><span>${fps.toFixed(0)} fps</span>`;
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
const MODELS = [
  { file: "face_landmarker.task", size: "3.6 MB", use: T("人脸 478 点 + 头部姿态", "Face 478 landmarks + head pose", "얼굴 478점 + 머리 자세"), src: "Google MediaPipe · Apache-2.0" },
  { file: "yolo-head-nano.onnx", size: "11.7 MB", use: T("人头检测（快）", "Head detection (fast)", "머리 검출 (빠름)"), src: "trysem/YOLOv8_head_detector · MIT" },
  { file: "yolo-head-medium.onnx", size: "98.8 MB", use: T("人头检测（准）", "Head detection (accurate)", "머리 검출 (정확)"), src: "trysem/YOLOv8_head_detector · MIT" },
];
// 先读自带的模型文件，读不到再用官方地址（读到的字节缓存起来，分块检测再建一个实例时不用重新下载）
const modelBytes = {};
async function modelAsset(file, url) {
  if (!(file in modelBytes)) {
    modelBytes[file] = fetch(MODEL_DIR + file).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => (b ? new Uint8Array(b) : null)).catch(() => null);
  }
  const b = await modelBytes[file];
  return b ? { modelAssetBuffer: b.slice() } : { modelAssetPath: url }; // 每个实例一份拷贝，MediaPipe 会占用传进去的缓冲区
}
async function loadModel(mode = "VIDEO") {
  const fs = await FilesetResolver.forVisionTasks(WASM_URL);
  const asset = await modelAsset("face_landmarker.task", MODEL_URL);
  const opts = (delegate) => ({
    baseOptions: { ...asset, delegate }, runningMode: mode, numFaces: 5,
    outputFacialTransformationMatrixes: true, outputFaceBlendshapes: false, minFaceDetectionConfidence: 0.5, minTrackingConfidence: 0.5,
  });
  try { return await FaceLandmarker.createFromOptions(fs, opts("GPU")); }
  catch (e) { console.warn("GPU 不可用，改用 CPU", e); return await FaceLandmarker.createFromOptions(fs, opts("CPU")); }
}
resize();
renderPanel();
startCamera();
loadFaceAssets().catch((e) => console.warn("黑眼贴图不可用", e));
loadModel().then((lm) => { landmarker = lm; }).catch((e) => { camError = "model: " + e.message; openPanel(true); renderCamSelect(); });
// 调试用：控制台里 __cctv 查看状态
window.__cctv = { cells, get people() { return people; }, get faces() { return faces; }, FACE_TEX, cfg, glC, detectCrop, tileRects };
requestAnimationFrame(loop);
