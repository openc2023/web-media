import { t, translateStatus } from "./ui.js";
import { faceBox, matchFaces } from "./tracking.js";
import { createCamera } from "./camera.js";
import { drawVitals, drawDetection } from "./vitals.js";
import { createAtmosphere } from "./atmosphere.js";

const $ = id => document.getElementById(id);
const statusEl = $("status"), video = $("video"), stage = $("stage");
function setStatus(text, cls) { statusEl.dataset.message = text; statusEl.textContent = translateStatus(text); document.getElementById("introStatus").textContent = translateStatus(text); statusEl.className = cls || ""; }
const DEMO = location.hash === "#demo";            // built-in test scene, no camera needed
const THREE_URL = "./vendor/three.module.js";
const MP = "./vendor/mediapipe";
const MODELS = "https://storage.googleapis.com/mediapipe-models/";
const FACE_MODEL = new URL('../models/face_landmarker.task',import.meta.url).href;
const HAND_MODEL = new URL('../models/hand_landmarker.task',import.meta.url).href;
const META = JSON.parse($("meshmeta").textContent);

// ------------------------------ settings ------------------------------
const DEFAULTS = { skull: true, brain: false, muscles: false, eyes: true, outline: true, hands: true,
                   style: "xray", bright: 1, real: 1, feather: 0.2, reveal: "whole", cut: 0.5, showdata: false,
                   fs: 1, fw: 1, fh: 1, fd: 1, fx: 0, fy: 0, fz: 0, labels: false,
 maxFaces:4, minFace:.045, confidence:.5, smooth:.6, lostGrace:.6, detectHz:20, priority:'near',
 deviceId:'', resolution:'720', mirror:true, rotation:0, vitals:true, vitalsOpacity:.8, debug:false,
 cameraLook:'gray',warmth:0,softness:0,cameraSaturation:.1,cameraExposure:.9,cameraContrast:1.15,grain:.2,scanlines:.2,vignette:.45,interference:.15,cameraOverlay:true };
let S = Object.assign({}, DEFAULTS);
try { Object.assign(S, JSON.parse(localStorage.getItem("ghostXrayCfg.v1") || "{}")); } catch (e) {}
for(const [key,min,max] of [['maxFaces',1,6],['confidence',.1,.95],['minFace',.01,.3],['smooth',.1,1],['lostGrace',.1,3],['detectHz',5,30],['vitalsOpacity',.1,1]]) S[key]=Math.min(max,Math.max(min,Number(S[key])||DEFAULTS[key]));
S.maxFaces=Math.round(S.maxFaces);
// User requested a visible live camera background, including on existing installations.
if(!S.liveVideoV2){S.real=1;S.liveVideoV2=true;}
function save() { try { localStorage.setItem("ghostXrayCfg.v1", JSON.stringify(S)); } catch (e) {} }
const LAYERS = ["skull", "brain", "muscles", "eyes", "outline", "hands"];
const SLIDERS = ["bright", "real", "feather", "cut", "fs", "fw", "fh", "fd", "fx", "fy", "fz"];

function syncUI() {
  for (const k of LAYERS) $("L_" + k).checked = S[k];
  for (const b of $("style").children) b.classList.toggle("on", b.dataset.style === S.style);
  for (const k of SLIDERS) $(k).value = S[k];
  for (const k of ["fs", "fw", "fh", "fd"]) $(k + "v").textContent = Math.round(S[k] * 100) + "%";
  for (const k of ["fx", "fy", "fz"]) $(k + "v").textContent = (S[k] > 0 ? "+" : "") + S[k].toFixed(1) + " cm";
  $("featherv").textContent = Math.round(S.feather * 100) + "%";
  $("labels").checked = S.labels;
  $("reveal").value = S.reveal; $("showdata").checked = S.showdata; $("data").hidden = !S.showdata;
  $("cutrow").hidden = S.reveal === "whole";
  $("cutlabel").textContent = t(S.reveal === "lens" ? "Lens size" : "Cut position");
  document.dispatchEvent(new Event('xray-sync'));
}
for (const k of LAYERS) $("L_" + k).onchange = e => { S[k] = e.target.checked; save(); };
for (const b of $("style").children) b.onclick = () => { S.style = b.dataset.style; save(); syncUI(); applyStyle(); };
for (const k of SLIDERS) $(k).oninput = e => { S[k] = parseFloat(e.target.value); save(); syncUI(); };
$("labels").onchange = e => { S.labels = e.target.checked; save(); };
$("reveal").onchange = e => { S.reveal = e.target.value; S.cut = 0.5; save(); syncUI(); };
$("showdata").onchange = e => { S.showdata = e.target.checked; save(); syncUI(); };
$("fitreset").onclick = () => { S.fs = S.fw = S.fh = S.fd = 1; S.fx = S.fy = S.fz = 0; save(); syncUI(); };
for (const b of document.querySelectorAll("[data-preset]")) b.onclick = () => {
  const p = b.dataset.preset;
  S.skull = p === "skull" || p === "all"; S.brain = p === "brain" || p === "all";
  S.muscles = p === "muscles" || p === "all"; S.eyes = p !== "brain"; S.outline = true;
  save(); syncUI();
};
syncUI();

// ------------------------------ 3D scene ------------------------------
let THREE, renderer, headScene, handScene, cam, ortho, headGroup, jawPivot, baseProj;
let W = 640, H = 480;
let meshes = {};                 // name -> { mesh, layer, xray color, solid color }
const handRigs = [];               // two hands, each: { group, palm, bones[] }
const BONES = [[1,2],[2,3],[3,4],[5,6],[6,7],[7,8],[9,10],[10,11],[11,12],[13,14],[14,15],[15,16],[17,18],[18,19],[19,20]];

const VERT = `
uniform mat4 uToHead; uniform float uOrtho;
varying vec3 vN; varying vec3 vV; varying vec3 vL;
void main() {
  vL = (uToHead * vec4(position, 1.0)).xyz;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = uOrtho > 0.5 ? vec3(0.0, 0.0, 1.0) : normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
uniform vec3 uColor; uniform vec3 uSolidColor;
uniform float uOpacity, uGain, uMode, uClipOn, uFade, uFeather, uCutSoft; uniform vec4 uClip;
varying vec3 vN; varying vec3 vV; varying vec3 vL;
void main() {
  float soft = 1.0;                                    // edge feather: 1 = fully drawn, 0 = faded out
  if (uClipOn > 0.5) {
    float dcut = dot(uClip.xyz, vL) - uClip.w;         // distance (cm) inside the cut
    if (dcut < 0.0) discard;
    if (uCutSoft > 0.001) soft *= smoothstep(0.0, uCutSoft, dcut);
  }
  vec3 n = normalize(vN);
  float ndv = abs(dot(n, normalize(vV)));
  if (uFeather > 0.001) soft *= smoothstep(0.0, uFeather, ndv);   // surfaces turning away at the outline fade out
  float fade = uFade > 0.5 ? smoothstep(-12.4, -9.2, vL.y) : 1.0;   // the neck fades out instead of ending in a hard edge
  if (uMode > 1.5) {                                   // flat veil that hides the real face
    gl_FragColor = vec4(uColor, uOpacity * fade * soft);
  } else if (uMode > 0.5) {                            // solid, lit
    vec3 fn = gl_FrontFacing ? n : -n;
    float d = max(dot(fn, normalize(vec3(0.35, 0.55, 0.76))), 0.0);
    float rim = pow(1.0 - ndv, 2.5);
    gl_FragColor = vec4(uSolidColor * (0.28 + 0.78 * d) * uGain + vec3(0.25) * rim, uOpacity * soft);
  } else {                                             // x-ray: edges glow, flat areas stay see-through
    float rim = pow(1.0 - ndv, 2.1);
    float a = clamp((0.035 + 0.95 * rim) * uGain * uOpacity * fade, 0.0, 1.0);
    gl_FragColor = vec4(uColor, a * soft);
  }
}`;

function makeMat(xray, solid, mode) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(xray) }, uSolidColor: { value: new THREE.Color(solid) },
                uOpacity: { value: 1 }, uGain: { value: 1 }, uMode: { value: mode || 0 }, uOrtho: { value: 0 }, uFade: { value: 0 }, uFeather: { value: 0 }, uCutSoft: { value: 0 },
                uClipOn: { value: 0 }, uClip: { value: new THREE.Vector4(1, 0, 0, 0) }, uToHead: { value: new THREE.Matrix4() } },
    vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, transparent: true,
    depthTest: false, depthWrite: false, blending: mode === 2 ? THREE.NormalBlending : THREE.AdditiveBlending
  });
}

function decodeMeshes() {
  const bin = atob($("meshdata").textContent.trim());
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const out = {};
  for (const m of META.meshes) {
    const q = new Uint16Array(u8.buffer, m.offV, m.nv * 3), pos = new Float32Array(m.nv * 3);
    for (let i = 0; i < q.length; i++) pos[i] = m.min[i % 3] + q[i] / 65535 * m.size[i % 3];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setIndex(new THREE.BufferAttribute(new Uint16Array(u8.buffer, m.offI, m.ni).slice(), 1));
    geo.computeVertexNormals();
    out[m.name] = geo;
  }
  return out;
}

function buildScene() {
  renderer = new THREE.WebGLRenderer({ canvas: $("gl"), alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  headScene = new THREE.Scene(); handScene = new THREE.Scene();
  // MediaPipe places the face for a camera with a 63 degree vertical field of view.
  cam = new THREE.PerspectiveCamera(63, W / H, 1, 10000);
  ortho = new THREE.OrthographicCamera(0, W, H, 0, -5000, 5000);
  const geos = decodeMeshes();

  for (let slot=0;slot<6;slot++) {
  head = {id:slot,found:false,pos:new THREE.Vector3(),quat:new THREE.Quaternion(),scl:new THREE.Vector3(1,1,1),fitS:1,fitX:0,fitY:0,jaw:0,lms:null,box:null,seen:0,born:0,vx:0,vy:0,opacity:1,projection:baseProj?.clone()||cam.projectionMatrix.clone(),vitals:{hr:65+Math.random()*25,rr:12+Math.random()*7,o2:96+Math.random()*3,temp:36.2+Math.random()*.8,next:0,phase:Math.random()*6}};
  meshes={};
  headGroup = new THREE.Group(); headGroup.matrixAutoUpdate = false; headGroup.visible = false;
  headScene.add(headGroup);
  jawPivot = new THREE.Group(); jawPivot.position.fromArray(META.jawPivot); headGroup.add(jawPivot);
  const add = (name, geo, layer, xray, solid, order, parent, mode) => {
    const mesh = new THREE.Mesh(geo, makeMat(xray, solid, mode));
    mesh.renderOrder = order; mesh.frustumCulled = false;
    (parent || headGroup).add(mesh);
    meshes[name] = { mesh, layer, fixedMode: mode };
    return mesh;
  };
  add("veil", geos.skin, "veil", 0x04070d, 0x04070d, -10, null, 2).material.uniforms.uFade.value = 1;
  add("outline", geos.skin, "outline", 0x6fb6ff, 0x6fb6ff, 1, null, 0).material.uniforms.uFade.value = 1;
  add("muscles", geos.muscles, "muscles", 0xff6b5e, 0xb5453c, 2);
  add("cranium", geos.cranium, "skull", 0xbfe3ff, 0xe9e2cf, 3);
  const jaw = add("jaw", geos.jaw, "skull", 0xbfe3ff, 0xe9e2cf, 3, jawPivot);
  jaw.position.fromArray(META.jawPivot).multiplyScalar(-1);
  add("eyes", geos.eyes, "eyes", 0xfff3a8, 0xf4f4ee, 4);
  add("cerebrum", geos.cerebrum, "brain", 0xff9fc0, 0xe2a39d, 5);
  add("hindbrain", geos.hindbrain, "brain", 0xffc37a, 0xd6ad84, 5);

  actors.push({head,headGroup,jawPivot,meshes});
  }
  useActor(actors[0]);
  for (let h = 0; h < 2; h++) {
    const group = new THREE.Group(); group.visible = false; handScene.add(group);
    const mk = geo => { const m = new THREE.Mesh(geo, makeMat(0xd9f0ff, 0xe9e2cf)); m.material.uniforms.uOrtho.value = 1;
                        m.matrixAutoUpdate = false; m.frustumCulled = false; group.add(m); return m; };
    handRigs.push({ group, palm: mk(geos.hand_palm), bones: BONES.map(([a, b]) => mk(geos["hand_b_" + a + "_" + b])),
                    pts: null, seen: 0 });
  }
  applyStyle(); resize();
}

const actors=[];
function useActor(actor){({head,headGroup,jawPivot,meshes}=actor);if(cam&&head.projection){cam.projectionMatrix.copy(head.projection);cam.projectionMatrixInverse.copy(head.projection).invert();}}
function eachMat(fn) {
  for(const actor of actors) for (const k in actor.meshes) fn(actor.meshes[k].mesh.material, actor.meshes[k]);
  for (const r of handRigs) { fn(r.palm.material, { layer: "hands" }); for (const b of r.bones) fn(b.material, { layer: "hands" }); }
}
function applyStyle() {
  if (!renderer) return;
  const solid = S.style === "solid";
  eachMat((m, info) => {
    if (info.fixedMode !== undefined) return;            // veil and outline keep their own look
    m.uniforms.uMode.value = solid ? 1 : 0;
    m.blending = solid ? THREE.NormalBlending : THREE.AdditiveBlending;
    m.depthTest = solid; m.depthWrite = solid; m.needsUpdate = true;
  });
}

function resize() {
  const r = stage.getBoundingClientRect();
  W = Math.max(2, Math.round(r.width)); H = Math.max(2, Math.round(r.height));
  if (renderer) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H, false);
    cam.aspect = W / H; cam.updateProjectionMatrix(); baseProj = cam.projectionMatrix.clone();
    ortho.right = W; ortho.top = H; ortho.updateProjectionMatrix();
  }
  for (const id of ["shade", "hud"]) { const c = $(id); c.width = W; c.height = H; }
}
new ResizeObserver(resize).observe(stage);

// ------------------------------ head tracking ------------------------------
let head = { found: false, pos: null, quat: null, scl: null, fitS: 1, fitX: 0, fitY: 0, jaw: 0, lms: null };
let tmpM, tmpP, tmpQ, tmpS, tmpV, fitM, corr;
function initMath() {
  tmpM = new THREE.Matrix4(); tmpP = new THREE.Vector3(); tmpQ = new THREE.Quaternion(); tmpS = new THREE.Vector3();
  tmpV = new THREE.Vector3(); fitM = new THREE.Matrix4(); corr = new THREE.Matrix4(); jawM = new THREE.Matrix4();
  head.pos = new THREE.Vector3(); head.quat = new THREE.Quaternion(); head.scl = new THREE.Vector3(1, 1, 1);
}
const FIT_IDS = Object.keys(META.fit).map(Number);

function updateHead(matrixData, lms, jawOpen) {
  tmpM.fromArray(matrixData);
  const e = tmpM.elements;                               // accept either memory layout
  if (Math.abs(e[12]) + Math.abs(e[13]) + Math.abs(e[14]) < 1e-6 && Math.abs(e[3]) + Math.abs(e[7]) + Math.abs(e[11]) > 1e-3) tmpM.transpose();
  tmpM.decompose(tmpP, tmpQ, tmpS);
  if (!head.found) { head.pos.copy(tmpP); head.quat.copy(tmpQ); head.scl.copy(tmpS); head.fitS = 1; head.fitX = head.fitY = 0; }
  else { const a=1-Math.pow(1-S.smooth,Math.min(.2,(performance.now()-(head.updated||0))/1000)*30);head.pos.lerp(tmpP,a);head.quat.slerp(tmpQ,a);head.scl.lerp(tmpS,a); }
  head.updated=performance.now();
  head.found = true; head.lms = lms;
  head.jaw += (jawOpen - head.jaw) * 0.6;
  tmpM.compose(head.pos, head.quat, head.scl);           // smoothed pose

  // Pin the model to the face on screen: compare where key face points land with where the tracker saw them.
  let pmx = 0, pmy = 0, qmx = 0, qmy = 0; const P = [], Q = [];
  for (const id of FIT_IDS) {
    tmpV.fromArray(META.fit[id]).applyMatrix4(tmpM).applyMatrix4(baseProj);
    const q = lms[id]; if (!q) continue;
    P.push([tmpV.x, tmpV.y]); Q.push([q.x * 2 - 1, 1 - q.y * 2]);
  }
  for (let i = 0; i < P.length; i++) { pmx += P[i][0]; pmy += P[i][1]; qmx += Q[i][0]; qmy += Q[i][1]; }
  pmx /= P.length; pmy /= P.length; qmx /= P.length; qmy /= P.length;
  let num = 0, den = 0;
  for (let i = 0; i < P.length; i++) {
    const ax = P[i][0] - pmx, ay = P[i][1] - pmy;
    num += ax * (Q[i][0] - qmx) + ay * (Q[i][1] - qmy); den += ax * ax + ay * ay;
  }
  const s = Math.max(0.6, Math.min(1.6, den > 1e-9 ? num / den : 1));
  head.fitS += (s - head.fitS) * 0.5;
  head.fitX += (qmx - head.fitS * pmx - head.fitX) * 0.7;
  head.fitY += (qmy - head.fitS * pmy - head.fitY) * 0.7;
  corr.set(head.fitS, 0, 0, head.fitX,  0, head.fitS, 0, head.fitY,  0, 0, 1, 0,  0, 0, 0, 1);
  cam.projectionMatrix.copy(baseProj).premultiply(corr);
  cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  head.projection.copy(cam.projectionMatrix);

  // the user's manual fit: overall size, per-axis stretch and position (local +x is your left, so the mirror view flips it)
  fitM.makeScale(S.fs * S.fw, S.fs * S.fh, S.fs * S.fd).setPosition(-S.fx, S.fy, S.fz);
  headGroup.matrix.copy(tmpM).multiply(fitM);
  headGroup.matrixWorldNeedsUpdate = true;          // we set the matrix by hand, so tell three.js it changed
  headGroup.visible = true;
  jawPivot.rotation.x = Math.min(1, Math.max(0, head.jaw)) * 0.36;
}

const clipState = { on: 0, x: 1, y: 0, w: 0 };
let jawM = null;
const XRAY_GAIN = { outline: 0.55, muscles: 0.5, cerebrum: 0.36, hindbrain: 0.6, eyes: 0.9 };
function applyLayers() {
  const reveal = S.reveal;
  let clipOn = 0, cx = 1, cy = 0, cz = 0, cw = 0;
  if (reveal === "left")   { clipOn = 1; cx = 1;  cy = 0; cw = (S.cut - 0.5) * 16; }      // your left = +x
  if (reveal === "right")  { clipOn = 1; cx = -1; cy = 0; cw = (S.cut - 0.5) * 16; }
  if (reveal === "top")    { clipOn = 1; cx = 0; cy = 1;  cw = -9 + (1 - S.cut) * 22; }
  if (reveal === "bottom") { clipOn = 1; cx = 0; cy = -1; cw = -(-9 + S.cut * 22); }
  clipState.on = clipOn; clipState.x = cx; clipState.y = cy; clipState.w = cw;
  jawPivot.updateMatrix(); meshes.jaw.mesh.updateMatrix();
  jawM.copy(jawPivot.matrix).multiply(meshes.jaw.mesh.matrix);
  const heavy = (S.skull ? 1 : 0) + (S.brain ? 1 : 0) + (S.muscles ? 1 : 0);
  const share = 1 / (0.4 + 0.6 * Math.max(1, heavy));        // several glowing layers at once would wash out to white
  for (const k in meshes) {
    const { mesh, layer } = meshes[k], u = mesh.material.uniforms;
    mesh.visible = layer === "veil" ? true : !!S[layer];
    // x-ray light adds up, so layers with many overlapping surfaces get a lower share
    u.uGain.value = (S.style === "solid" && k !== "outline") ? Math.min(1.25, 0.6 + 0.4 * S.bright) : S.bright * (XRAY_GAIN[k] || 1) * (layer === "outline" ? 1 : share);
    u.uOpacity.value = (layer === "veil" ? 1 - S.real : 1) * head.opacity;
    u.uClipOn.value = clipOn; u.uClip.value.set(cx, cy, cz, cw);
    u.uFeather.value = S.feather * 0.75; u.uCutSoft.value = S.feather * 5;   // outline softness, and up to 5 cm of fade at a cut
    if (k === "jaw") u.uToHead.value.copy(jawPivot.matrix).multiply(mesh.matrix); else u.uToHead.value.identity();
  }
}

// ------------------------------ hands ------------------------------
let vA, vB, vC, e1, e2, e3, hm;
function initHandMath() {
  lp = new THREE.Vector3(); ln = new THREE.Vector3(); lc = new THREE.Vector3();
  vA = new THREE.Vector3(); vB = new THREE.Vector3(); vC = new THREE.Vector3();
  e1 = new THREE.Vector3(); e2 = new THREE.Vector3(); e3 = new THREE.Vector3(); hm = new THREE.Matrix4();
}
function updateHand(rig, lms, isRight) {
  // tracker coordinates -> stage pixels, with depth scaled like x (closer to the camera = larger z)
  if (!rig.pts) rig.pts = lms.map(() => new THREE.Vector3());
  const fresh = !rig.group.visible;
  lms.forEach((p, i) => { tmpV.set(p.x * W, (1 - p.y) * H, -p.z * W); if (fresh) rig.pts[i].copy(tmpV); else rig.pts[i].lerp(tmpV, 0.65); });
  const P = rig.pts, sign = isRight ? 1 : -1;
  // palm block (wrist bones + the four finger metacarpals) follows wrist, index knuckle and little-finger knuckle
  e1.subVectors(P[5], P[0]); e2.subVectors(P[17], P[0]);
  e3.crossVectors(e1, e2).normalize().multiplyScalar(sign * Math.sqrt(e1.length() * e2.length()));
  rig.palm.matrix.makeBasis(e1, e2, e3).setPosition(P[0]);
  rig.palm.matrixWorldNeedsUpdate = true;
  // every finger bone spans two tracked joints; its roll comes from the line across the knuckles
  vC.subVectors(P[17], P[5]).normalize();
  BONES.forEach(([a, b], i) => {
    vA.subVectors(P[b], P[a]);
    let len = vA.length(); if (len < 1e-6) len = 1e-6;
    vA.divideScalar(len);
    vB.copy(vC).addScaledVector(vA, -vC.dot(vA));
    if (vB.lengthSq() < 1e-6) vB.set(1, 0, 0); vB.normalize();
    e3.crossVectors(vA, vB).multiplyScalar(sign);
    const L = len * (b % 4 === 0 ? 0.8 : 1);              // fingertip points sit past the end of the bone
    hm.makeBasis(e1.copy(vA).multiplyScalar(L), e2.copy(vB).multiplyScalar(L), e3.multiplyScalar(L)).setPosition(P[a]);
    rig.bones[i].matrix.copy(hm);
    rig.bones[i].matrixWorldNeedsUpdate = true;
  });
  rig.group.visible = true;
}

// the dark "veil" that hides the real hand so the bones read clearly (drawn on the 2D layer under the 3D one)
function drawHandVeil(g, lms, alpha) {
  const px = i => lms[i].x * W, py = i => lms[i].y * H;
  const d = Math.hypot(px(5) - px(17), py(5) - py(17)) || 1;
  g.fillStyle = g.strokeStyle = "rgba(4,7,13," + alpha.toFixed(3) + ")";
  g.lineJoin = g.lineCap = "round";
  const path = new Path2D();
  [0, 1, 2, 5, 9, 13, 17].forEach((i, k) => k ? path.lineTo(px(i), py(i)) : path.moveTo(px(i), py(i)));
  path.closePath();
  const fingers = new Path2D();
  for (const c of [[1,2,3,4],[5,6,7,8],[9,10,11,12],[13,14,15,16],[17,18,19,20]])
    c.forEach((i, k) => k ? fingers.lineTo(px(i), py(i)) : fingers.moveTo(px(i), py(i)));
  // draw opaque on a scratch canvas first so overlapping strokes do not darken twice
  const sc = drawHandVeil.sc || (drawHandVeil.sc = document.createElement("canvas"));
  if (sc.width !== W || sc.height !== H) { sc.width = W; sc.height = H; }
  const s = sc.getContext("2d");
  s.clearRect(0, 0, W, H); s.fillStyle = s.strokeStyle = "#04070d"; s.lineJoin = s.lineCap = "round";
  s.lineWidth = d * 0.34; s.fill(path); s.stroke(path); s.lineWidth = d * 0.36; s.stroke(fingers);
  const blur = S.feather * d * 0.22;                     // soften the hand's dark outline by the same setting
  g.filter = blur > 0.5 ? "blur(" + blur.toFixed(1) + "px)" : "none";
  g.globalAlpha = alpha; g.drawImage(sc, 0, 0); g.globalAlpha = 1; g.filter = "none";
}

// ------------------------------ labels ------------------------------
const LABEL_COLOR = { skull: "#d9f0ff", brain: "#ffc2d6", muscles: "#ffb3aa", eyes: "#fff3a8", hands: "#d9f0ff" };
const HEAD_C = [0, 3.2, -4.8];                    // rough centre of the head, in head coordinates (cm)
const labelState = {};                            // text -> { side, y } so labels glide instead of jumping
let lp, ln, lc;
function toScreen(v) {                            // head/view-space point -> heads-up layer pixels (mirrored like the picture)
  lc.copy(v).applyMatrix4(cam.projectionMatrix);
  return { x: screenX((lc.x + 1) / 2), y: (1 - lc.y) / 2 * H };
}
function collectHeadLabels(lens) {
  const out = [], solid = S.style === "solid", M = headGroup.matrix;
  for (const L of META.labels) {
    if (!S[L.layer]) continue;
    if (solid && S.muscles && (L.layer === "skull" || L.layer === "brain")) continue;   // hidden under the muscles
    if (solid && S.skull && L.layer === "brain") continue;                               // hidden inside the skull
    let best = null;
    for (const p of L.pts) {
      lp.fromArray(p); if (L.jaw) lp.applyMatrix4(jawM);
      if (clipState.on && clipState.x * lp.x + clipState.y * lp.y < clipState.w) continue;   // cut away
      ln.set(lp.x - HEAD_C[0], lp.y - HEAD_C[1], lp.z - HEAD_C[2]).transformDirection(M);
      lp.applyMatrix4(M);
      const facing = -(ln.x * lp.x + ln.y * lp.y + ln.z * lp.z) / (lp.length() || 1);
      if (solid && facing < 0.12) continue;                                                // on the far side
      const s = toScreen(lp);
      if (lens && Math.hypot(s.x - lens.x, s.y - lens.y) > lens.r) continue;
      if (!best || facing > best.facing) best = { text: L.t, color: LABEL_COLOR[L.layer], ax: s.x, ay: s.y, facing };
    }
    if (best) out.push(best);
  }
  return out;
}
function layoutLabels(g, items, cx, halfWidth, key, splitX) {
  if (splitX === undefined) splitX = cx;            // where "left of the subject" ends and "right" begins
  // two columns beside the subject; each label joins the column on its own side, then they are spread so none overlap
  const cols = { left: [], right: [] };
  for (const it of items) {
    const st = labelState[key + it.text] || (labelState[key + it.text] = { side: it.ax < splitX ? "left" : "right", y: null, seen: 0 });
    if (st.side === "left" && it.ax > splitX + halfWidth * 0.15) st.side = "right";
    else if (st.side === "right" && it.ax < splitX - halfWidth * 0.15) st.side = "left";
    it.st = st; cols[st.side].push(it);
  }
  g.font = "600 12.5px system-ui,-apple-system,Segoe UI,Roboto,sans-serif"; g.textBaseline = "middle"; g.lineJoin = "round";
  for (const side of ["left", "right"]) {
    const list = cols[side], gap = 18;
    // Smooth each label's wanted height, and keep last frame's order unless two labels are clearly the other way round,
    // so labels neither overlap nor flicker between slots.
    for (const it of list) {
      const st = it.st;
      if (st.wy === undefined || frameNo - st.seen > 3) { st.wy = it.ay; st.rank = undefined; } else st.wy += (it.ay - st.wy) * 0.5;
      st.seen = frameNo;
    }
    list.sort((p, q) => (p.st.rank === undefined || q.st.rank === undefined || p.st.side !== p.st.rankSide || q.st.side !== q.st.rankSide)
                        ? p.st.wy - q.st.wy : p.st.rank - q.st.rank);
    for (let swapped = true, guard = 0; swapped && guard < 40; guard++) {
      swapped = false;
      for (let i = 0; i + 1 < list.length; i++)
        if (list[i].st.wy > list[i + 1].st.wy + 7) { const tmp = list[i]; list[i] = list[i + 1]; list[i + 1] = tmp; swapped = true; }
    }
    list.forEach((it, i) => { it.st.rank = i; it.st.rankSide = side; });
    let prev = -1e9;
    for (const it of list) { it.ty = Math.max(it.st.wy, prev + gap); prev = it.ty; }
    const over = prev - (H - 12); if (over > 0) for (const it of list) it.ty -= over;      // keep the stack on screen
    const tx = side === "left" ? Math.max(8, cx - halfWidth - 22) : Math.min(W - 8, cx + halfWidth + 22);
    for (const it of list) {
      const y = it.ty;
      g.strokeStyle = it.color; g.globalAlpha = 0.75; g.lineWidth = 1;
      g.beginPath(); g.moveTo(it.ax, it.ay); g.lineTo(tx + (side === "left" ? 5 : -5), y); g.stroke();
      g.globalAlpha = 1; g.fillStyle = it.color; g.beginPath(); g.arc(it.ax, it.ay, 2.6, 0, 6.3); g.fill();
      g.textAlign = side === "left" ? "right" : "left";
      g.strokeStyle = "rgba(4,7,13,.9)"; g.lineWidth = 3.5; g.strokeText(it.text, tx, y);
      g.fillText(it.text, tx, y);
    }
  }
}
let frameNo = 0, headSplit = 0;
function drawLabels(g, lens) {
  frameNo++;
  let hx = W / 2, halfW = W * 0.16;
  if (head.found && headGroup.visible) {
    lp.fromArray(HEAD_C).applyMatrix4(headGroup.matrix);
    const c = toScreen(lp); lp.x += 10.5 * S.fs * S.fw; const e = toScreen(lp);
    hx = c.x; halfW = Math.abs(e.x - c.x);
    const items = collectHeadLabels(lens);
    // when the head is turned most points sit on one side, so split nearer the middle of the points to balance the columns
    const xs = items.map(it => it.ax).sort((a, b) => a - b), med = xs.length ? xs[xs.length >> 1] : hx;
    headSplit += ((hx + med) / 2 - headSplit) * 0.2;
    layoutLabels(g, items, hx, halfW, "h:"+head.id+":", hx);
  }
  if (S.hands && head.id===0) handRigs.forEach((rig, i) => {
    if (!rig.group.visible || !rig.pts) return;
    const P = rig.pts, at = (a, b, k) => ({ ax: screenX((P[a].x + (P[b].x - P[a].x) * k)/W), ay: H - (P[a].y + (P[b].y - P[a].y) * k) });
    const items = [["Distal phalanx", 11, 12, 0.5], ["Middle phalanx", 10, 11, 0.5], ["Proximal phalanx", 9, 10, 0.5],
                   ["Metacarpal", 0, 9, 0.62], ["Carpal bones (wrist)", 0, 9, 0.1]]
      .map(([text, a, b, k]) => Object.assign({ text, color: LABEL_COLOR.hands }, at(a, b, k)))
      .filter(it => !lens || Math.hypot(it.ax - lens.x, it.ay - lens.y) <= lens.r);
    let lo = 1e9, hi = -1e9; for (const p of P) { lo = Math.min(lo, screenX(p.x/W)); hi = Math.max(hi, screenX(p.x/W)); }
    // put all of a hand's labels on its outer side, away from the head
    const mid = (lo + hi) / 2, outerRight = mid > hx, far = outerRight ? lo - 1e4 : hi + 1e4;
    layoutLabels(g, items, far, outerRight ? hi - far : far - lo, "hand" + i + ":");
  });
}

// ------------------------------ per-frame update ------------------------------
let pointer = null, frames = 0, fps = 0, fpsAt = 0, dataAt = 0;
stage.addEventListener("pointermove", e => { const r = stage.getBoundingClientRect(); pointer = { x: e.clientX - r.left, y: e.clientY - r.top }; });
stage.addEventListener("pointerleave", () => { pointer = null; });

function renderFrame(now, faceLms, hands, sides) {
  atmosphere.draw(now,W,H,DEMO);
  // hands
  const sg = $("shade").getContext("2d"); sg.clearRect(0, 0, W, H);
  handRigs.forEach((rig, i) => {
    const lms = hands[i];
    if (lms && S.hands) {
      updateHand(rig, lms, sides[i]);
      drawHandVeil(sg, lms, (1 - S.real) * 0.92);
      for (const m of [rig.palm, ...rig.bones]) { m.material.uniforms.uGain.value = S.style === "solid" ? Math.min(1.25, 0.6 + 0.4 * S.bright) : S.bright * 1.15;
                                                 m.material.uniforms.uFeather.value = S.feather * 0.75; }
    } else rig.group.visible = false;
  });
  const visible=actors.filter(a=>a.head.id<S.maxFaces && a.head.found);
  for(const actor of actors)actor.headGroup.visible=false;

  // x-ray lens: a round window; outside it you see the plain camera picture
  let mask = "none", lens = null;
  if (S.reveal === "lens") {
    const rad = (0.07 + 0.38 * S.cut) * W;
    let cx, cy;                                              // in the canvas's own (unmirrored) pixel space
    if (hands[0]) { cx = hands[0][8].x * W; cy = hands[0][8].y * H; }
    else if (pointer) { cx = S.mirror ? W - pointer.x : pointer.x; cy = pointer.y; }
    else if (faceLms) { cx = faceLms[1].x * W; cy = faceLms[1].y * H; }
    else { cx = W / 2; cy = H / 2; }
    mask = "radial-gradient(circle " + rad.toFixed(1) + "px at " + cx.toFixed(1) + "px " + cy.toFixed(1) + "px, #000 " + (98 - 78 * S.feather).toFixed(0) + "%, transparent 100%)";
    lens = { x: screenX(cx/W), y: cy, r: rad };
  }
  for (const id of ["gl", "shade"]) { const st = $(id).style; st.maskImage = mask; st.webkitMaskImage = mask; }

  renderer.clear();
  for(const actor of visible){
    useActor(actor);headGroup.visible=true;applyLayers();
    renderer.render(headScene,cam);headGroup.visible=false;
  }
  cam.projectionMatrix.copy(baseProj);cam.projectionMatrixInverse.copy(baseProj).invert();
  renderer.clearDepth();
  renderer.render(handScene, ortho);

  // heads-up layer: lens ring, and the tracking points when switched on
  const g = $("hud").getContext("2d"); g.clearRect(0, 0, W, H);
  const occupiedCards=[];
  const headBounds=visible.map(a=>{
   const b=a.head.box;
   return {x:screenX(S.mirror?b.left+b.w:b.left)-b.w*W*.25,y:(b.top-b.h*.65)*H,w:b.w*W*1.5,h:b.h*H*1.95};
  });
  if (lens) { g.strokeStyle = "rgba(127,209,255,.8)"; g.lineWidth = 2; g.beginPath(); g.arc(lens.x, lens.y, lens.r, 0, 6.3); g.stroke(); }
  for(const actor of visible){
   useActor(actor);headGroup.visible=true;
   applyLayers();
   if(S.labels)drawLabels(g,lens);
   if(S.vitals)drawVitals(g,actor,now,S,W,H,screenX,headBounds,occupiedCards);
   if(S.debug)drawDetection(g,actor,W,H,screenX,S.mirror);
   headGroup.visible=false;
  }
  useActor(visible[0]||actors[0]);
  $('liveStats').textContent=`${t('Faces')} ${visible.length}/${S.maxFaces} · ${fps} FPS`;
  if(S.debug){g.fillStyle='#7fd1a8';g.font='11px Consolas,monospace';g.fillText(`${t('Faces')} ${visible.length}/${S.maxFaces}  ${fps} FPS`,12,20);}
  if (S.showdata) {
    if (faceLms) { g.fillStyle = "rgba(127,255,170,.85)"; for (const p of faceLms.filter(Boolean)) g.fillRect(screenX(p.x) - 1, p.y * H - 1, 2, 2); }
    g.strokeStyle = "rgba(255,183,3,.9)"; g.fillStyle = "#ffb703"; g.lineWidth = 1.5;
    for (const lms of hands) {
      for (const c of [[0,1,2,3,4],[0,5,6,7,8],[5,9,10,11,12],[9,13,14,15,16],[13,17,18,19,20],[0,17]]) {
        g.beginPath(); c.forEach((i, k) => { const x = screenX(lms[i].x), y = lms[i].y * H; k ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
      }
      for (const p of lms) { g.beginPath(); g.arc(screenX(p.x), p.y * H, 3, 0, 6.3); g.fill(); }
    }
    if (now - dataAt > 120) {
      dataAt = now;
      const pad = k => (k + "                  ").slice(0, 18), rows = [];
      if (head.found) {
        const eu = new THREE.Euler().setFromQuaternion(head.quat, "YXZ"), deg = r => (r * 57.2958).toFixed(0) + "°";
        rows.push(["faces",actors.filter(a=>a.head.found).length+" / "+S.maxFaces], ["face", "tracked, " + (faceLms ? faceLms.filter(Boolean).length : 0) + " points"],
                  ["distance", (-head.pos.z).toFixed(0) + " cm (estimate)"],
                  ["turn / nod / tilt", deg(eu.y) + " / " + deg(eu.x) + " / " + deg(eu.z)],
                  ["jaw open", head.jaw.toFixed(2)],
                  ["screen fit", "scale " + head.fitS.toFixed(3) + ", shift " + head.fitX.toFixed(3) + ", " + head.fitY.toFixed(3)]);
      } else rows.push(["face", "not found"]);
      rows.push(["hands", hands.length ? hands.map((h, i) => sides[i] ? "right" : "left").join(" + ") : "none"]);
      if (hands[0]) rows.push(["index fingertip", (1 - hands[0][8].x).toFixed(2) + ", " + hands[0][8].y.toFixed(2)]);
      rows.push(["layers", LAYERS.filter(k => S[k]).join(", ") || "none"], ["speed", fps + " frames/s"]);
      $("data").textContent = rows.map(r => pad(r[0]) + r[1]).join("\n");
    }
  }
  frames++;
  if (now - fpsAt >= 1000) { fps = Math.round(frames * 1000 / (now - fpsAt)); frames = 0; fpsAt = now; }
}

// ------------------------------ start-up ------------------------------
let faceTracker = null, handTracker = null;
async function loadTrackers() {
  const vision = await import(MP + "/vision_bundle.mjs");
  const files = await vision.FilesetResolver.forVisionTasks(MP + "/wasm");
  const mkFace = d => vision.FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: FACE_MODEL, delegate: d },
    runningMode: "VIDEO", numFaces: S.maxFaces, minFaceDetectionConfidence:S.confidence,minFacePresenceConfidence:S.confidence,minTrackingConfidence:S.confidence, outputFacialTransformationMatrixes: true, outputFaceBlendshapes: true });
  const mkHand = d => vision.HandLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: HAND_MODEL, delegate: d },
    runningMode: "VIDEO", numHands: 2 });
  try { faceTracker = await mkFace("GPU"); } catch (e) { faceTracker = await mkFace("CPU"); }
  try { try { handTracker = await mkHand("GPU"); } catch (e) { handTracker = await mkHand("CPU"); } }
  catch (e) { handTracker = null; }                        // the head view still works without hand tracking
}

function updateFaces(detections,now){
 const filtered=detections.filter(d=>d.box&&d.box.w>=S.minFace);
 const matches=matchFaces(actors.map(a=>a.head),filtered,now,S.lostGrace*1000,S.maxFaces,S.priority);
 for(const actor of actors){
  useActor(actor);
  const i=matches.get(head.id);
  if(i!==undefined){
   const d=filtered[i],fresh=!head.box||now-head.seen>S.lostGrace*1000;
   if(fresh){head.found=false;head.born=now;head.vx=head.vy=0;head.vitals.next=0;}
   else {const dt=Math.max(.016,(now-head.seen)/1000);head.vx=(d.box.x-head.box.x)/dt*.5+head.vx*.5;head.vy=(d.box.y-head.box.y)/dt*.5+head.vy*.5;}
   updateHead(d.matrix,d.lms,d.jaw||0);head.box=d.box;head.seen=now;
  }
  if(head.id>=S.maxFaces || !head.box || now-head.seen>S.lostGrace*1000){head.found=false;headGroup.visible=false;}
 }
 useActor(actors[0]);
}
function ageFaces(now){for(const {head:h} of actors){if(h.id>=S.maxFaces||now-h.seen>S.lostGrace*1000)h.found=false;h.opacity=Math.min(1,(now-h.born)/350)*Math.max(0,1-(now-h.seen)/Math.max(1,S.lostGrace*1000));}}
let running=false,trackingBusy=false,trackerDirty=false,liveRequest=0;
const faceOptions=()=>({numFaces:S.maxFaces,minFaceDetectionConfidence:S.confidence,minFacePresenceConfidence:S.confidence,minTrackingConfidence:S.confidence});
async function configureTracker(){
 trackerDirty=true;if(trackingBusy||!faceTracker)return;
 trackingBusy=true;
 try{while(trackerDirty){trackerDirty=false;await faceTracker.setOptions(faceOptions());}}
 catch(e){setStatus('The tracker hit an error: '+e.message,'bad');}
 finally{trackingBusy=false;}
}
function liveLoop() {
 running=true;let lastTime=-1,lastDetect=-Infinity,hands=[],sides=[];
 function tick(){
  if(!running)return;liveRequest=requestAnimationFrame(tick);
  const now=performance.now();
  if(video.readyState<2||video.currentTime===lastTime)return;
  lastTime=video.currentTime;paintCamera();
  if(!trackingBusy && now-lastDetect>=1000/S.detectHz){
   lastDetect=now;
   try{
    const fr=faceTracker.detectForVideo(cameraFrame,now);
    updateFaces((fr.faceLandmarks||[]).map((lms,i)=>({lms,box:faceBox(lms),matrix:fr.facialTransformationMatrixes?.[i]?.data,jaw:fr.faceBlendshapes?.[i]?.categories.find(c=>c.categoryName==='jawOpen')?.score||0})).filter(d=>d.matrix),now);
    if(handTracker&&(S.hands||S.reveal==='lens'||S.showdata)){
     const hr=handTracker.detectForVideo(cameraFrame,now);hands=hr.landmarks||[];const hd=hr.handedness||hr.handednesses||[];sides=hands.map((_,i)=>hd[i]?.[0]?.categoryName==='Left');
    }else{hands=[];sides=[];}
   }catch(e){setStatus('The tracker hit an error: '+e.message,'bad');}
  }
  ageFaces(now);
  const count=actors.filter(a=>a.head.found).length;
  const message=`${t('Live camera')} · ${t('Faces')} ${count}/${S.maxFaces}`;
  if(statusEl.textContent!==message)setStatus(message,count?'ok':'');
  renderFrame(now,actors.find(a=>a.head.found)?.head.lms||null,hands,sides);
 }
 tick();
}

// Built-in test scene (open the page with #demo): a pretend head and the dataset's own hand, no camera.
function demoLoop() {
  $("intro").hidden = true;
  setStatus("Demo scene (no camera).", "ok");
  const params = new URLSearchParams(location.search), still = params.has("still");
  const base = META.demoHand, cx = base[9][0], cy = base[9][1], cz = base[9][2];
  function tick() {
    if (!still) requestAnimationFrame(tick);
    const now = performance.now(), t = still ? 1.2 : now / 1000;
    const detections=[];
    const n=S.maxFaces,cols=n===1?1:n===2?2:3,rows=Math.ceil(n/cols);
    const depth=n===1?52:n===2?85:110;
    const spanY=Math.tan(63*Math.PI/360)*depth*2,spanX=spanY*W/H;
    for(let i=0;i<n;i++){
     const m=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-.04,.25*Math.sin(t*.5+i),.02*Math.sin(t+i),'YXZ'));
     m.setPosition(((i%cols+.5)/cols-.5)*spanX*.88,((rows-1)/2-Math.floor(i/cols))*spanY*.43-2,-depth);
     const lms=[];for(const id of FIT_IDS){const v=new THREE.Vector3().fromArray(META.fit[id]).applyMatrix4(m).applyMatrix4(baseProj);lms[id]={x:(v.x+1)/2,y:(1-v.y)/2,z:0};}
     detections.push({lms,box:faceBox(lms),matrix:m.elements,jaw:.4+.3*Math.sin(t*1.3+i)});
    }
    updateFaces(detections,now);ageFaces(now);
    const k=.0021*H/W*(4/3),hand=base.map(p=>({x:.14-(p[0]-cx)*k,y:.68+(p[2]-cz)*k*W/H,z:(p[1]-cy)*k}));
    renderFrame(now,detections[0]?.lms,[hand],[true]);
    if (params.has("dump") && now > 1500 && !demoLoop.dumped) {      // flatten the layers into one picture for testing
      demoLoop.dumped = true;
      const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
      x.fillStyle = "#0b1220"; x.fillRect(0, 0, W, H);
      x.save(); x.translate(W, 0); x.scale(-1, 1); x.drawImage($("shade"), 0, 0, W, H); x.drawImage($("gl"), 0, 0, W, H); x.restore();
      x.drawImage($("hud"), 0, 0);
      const img = new Image(); img.src = c.toDataURL("image/png");
      img.style.cssText = "position:fixed;left:0;top:0;z-index:99;width:" + W + "px;height:" + H + "px";
      document.body.appendChild(img);
      console.log("DEMO dumped", W, H, "fit", head.fitS.toFixed(3), head.fitX.toFixed(3), head.fitY.toFixed(3));
    }
  }
  tick();
}

async function boot() {
  THREE = await import(DEMO && new URLSearchParams(location.search).get("three") || THREE_URL);
  initMath(); initHandMath(); buildScene();
}

$("start").onclick = async () => {
  $("start").disabled = true;
  document.dispatchEvent(new Event("xray-start"));
  let stageName = "camera";
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
      throw new Error("this browser will not give this page a camera. Try Chrome or Edge.");
    setStatus("Asking for the camera…");
    await openCamera();
    const stream=video.srcObject;
    video.srcObject = stream;
    await video.play();
    paintCamera();
    stageName = "3D engine";
    setStatus("Loading the 3D anatomy…");
    if(!renderer)await boot();
    stageName = "trackers";
    setStatus("Loading the face and hand trackers (first time takes a few seconds)…");
    if(!faceTracker)await loadTrackers();
    else await configureTracker();
    if (!handTracker) $("L_hands").disabled = true;
    resize();
    $("intro").hidden = true;
    liveLoop();
  } catch (err) {
    if (video.srcObject) { video.srcObject.getTracks().forEach(track => track.stop()); video.srcObject = null; }
    $("start").disabled = false; $("intro").hidden = false;
    const denied = err && (err.name === "NotAllowedError" || err.name === "SecurityError");
    const msg = err && err.message ? err.message : String(err);
    setStatus(denied ? "Camera blocked. Allow camera access for this page and click Start again."
            : "Could not load the " + stageName + ": " + msg, "bad");
  }
};

function screenX(x){return (S.mirror?1-x:x)*W;}
function resetTracks(){for(const a of actors){a.head.found=false;a.head.box=null;a.headGroup.visible=false;}for(const rig of handRigs)rig.group.visible=false;}
const camera=createCamera(S,video,stage,save,resetTracks);
const cameraFrame=camera.frame,paintCamera=camera.paint,openCamera=camera.open;
const atmosphere=createAtmosphere(S,stage,cameraFrame,save);
const detectKeys=['maxFaces','minFace','confidence','smooth','lostGrace','detectHz','vitalsOpacity'];
for(const key of detectKeys){
 $(key).value=S[key];
 $(key).addEventListener('input',()=>{
  S[key]=Number($(key).value);if(key==='maxFaces'){S.maxFaces=Math.round(S.maxFaces);for(const a of actors)if(a.head.id>=S.maxFaces){a.head.found=false;a.head.box=null;}}
  save();if(key==='maxFaces'||key==='confidence')configureTracker();
 });
}
for(const key of ['priority']){$(key).value=S[key];$(key).onchange=()=>{S[key]=$(key).value;save();};}
for(const key of ['vitals','debug']){$(key).checked=S[key];$(key).onchange=()=>{S[key]=$(key).checked;save();};}
$('applyCamera').onclick=async()=>{
 if(DEMO){$('cameraInfo').textContent=t('Saved for camera mode.');return;}
 if(!running){$('start').click();return;}
 $('applyCamera').disabled=true;running=false;cancelAnimationFrame(liveRequest);resetTracks();
 try{await openCamera();liveLoop();}
 catch(e){video.srcObject?.getTracks().forEach(track=>track.stop());video.srcObject=null;$('start').disabled=false;$('intro').hidden=false;setStatus('Could not load the camera: '+e.message,'bad');}
 finally{$('applyCamera').disabled=false;}
};
document.dispatchEvent(new Event('xray-sync'));
if (DEMO) boot().then(demoLoop).catch(e => setStatus("Demo failed: " + e.message, "bad"));
