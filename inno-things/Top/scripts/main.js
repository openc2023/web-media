import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { parseGIF, decompressFrames } from "gifuct-js";
import { createI18n } from "../../i18n/index.js";

// XR8.Threejs.pipelineModule() needs THREE on window
window.THREE = THREE;

const i18n = createI18n();
const { t } = i18n;

const startButton = document.querySelector("#start-recognition");
const closeButton = document.querySelector("#close-camera");
const cameraModal = document.querySelector("#camera-modal");
const cameraShell = document.querySelector("#camera-shell");
const arContainer = document.querySelector("#ar-container");
const cameraStatus = document.querySelector("#camera-status");
const debugLog = document.querySelector("#debug-log");
const scanBadge = document.querySelector("#scan-badge");
const scanBadgeText = document.querySelector("#scan-badge-text");
const localeButtons = [...document.querySelectorAll("[data-locale]")];

let xrRunning = false;
let arCanvas = null;
let boxModel = null;
let mixer = null;
let mixerActions = [];
let gifTextureDisposers = [];
let gifUpdaters = [];
let lostTimer = null;
let currentState = "scanning";
let currentStatusKey = "top.statusIdle";
let currentStatusVars = {};

const clock = new THREE.Clock(false);

// Image target name must match the key inside the compiled target JSON
const IMAGE_TARGET_NAME = "000-top";

// Physical width of the painting (meters). Drives scale calibration.
const PAINTING_WIDTH_M = 0.20;

const resolvedFlameGifUrl = new URL(
    "../assets/3d/gltf/%E7%81%AB%E7%84%B0%E6%97%8B%E8%BD%AC.gif",
    import.meta.url
).href;
const flamePlaybackFps = 24;
const flameFrameDurationMs = 1000 / flamePlaybackFps;
const flameFrameOffsetByMesh = new Map([
    ["plane004", 0],
    ["plane005", 12],
]);
const flameMeshNames = new Set(["plane004", "plane005"]);
const flameMaterialNames = new Set(["聚气", "聚气.001"]);
const occluderMeshNames = new Set(["box001"]);
const shellMeshNames = new Set(["box", "box1", "box2"]);
const interiorMeshNames = new Set(["plane004", "plane005", "top2", "top3", "cube001"]);

const normalizeMeshName = (name = "") => name.toLowerCase().replace(/[^a-z0-9]/g, "");

// ── 1-Euro Filter ──────────────────────────────────────────────────────────────
// Adaptive low-pass: slow motion → heavy smoothing, fast motion → responsive.
class OneEuro {
    constructor(minCutoff = 0.5, beta = 0.01, dCutoff = 1.0) {
        this.minCutoff = minCutoff;
        this.beta = beta;
        this.dCutoff = dCutoff;
        this.xPrev = null;
        this.dxPrev = 0;
        this.tPrev = null;
    }
    _alpha(cutoff, dt) {
        const r = 2 * Math.PI * cutoff * dt;
        return r / (r + 1);
    }
    filter(x, t) {
        if (this.tPrev === null) { this.tPrev = t; this.xPrev = x; this.dxPrev = 0; return x; }
        const dt = Math.max((t - this.tPrev) / 1000, 1 / 120);
        const dx = (x - this.xPrev) / dt;
        const aD = this._alpha(this.dCutoff, dt);
        const dxHat = aD * dx + (1 - aD) * this.dxPrev;
        const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
        const a = this._alpha(cutoff, dt);
        const xHat = a * x + (1 - a) * this.xPrev;
        this.xPrev = xHat;
        this.dxPrev = dxHat;
        this.tPrev = t;
        return xHat;
    }
    reset() { this.xPrev = null; this.tPrev = null; this.dxPrev = 0; }
}

const MIN_CUTOFF = 0.5;
const BETA = 0.01;
const fPos = {
    x: new OneEuro(MIN_CUTOFF, BETA),
    y: new OneEuro(MIN_CUTOFF, BETA),
    z: new OneEuro(MIN_CUTOFF, BETA),
};
// Rotation filtered at lower cutoff (wall marker vertical pose is very sensitive)
const fQ = {
    x: new OneEuro(MIN_CUTOFF * 0.6, BETA),
    y: new OneEuro(MIN_CUTOFF * 0.6, BETA),
    z: new OneEuro(MIN_CUTOFF * 0.6, BETA),
    w: new OneEuro(MIN_CUTOFF * 0.6, BETA),
};
let _lastQ = { x: 0, y: 0, z: 0, w: 1 };
const _tmpQ = new THREE.Quaternion();

function resetFilters() {
    fPos.x.reset(); fPos.y.reset(); fPos.z.reset();
    fQ.x.reset(); fQ.y.reset(); fQ.z.reset(); fQ.w.reset();
    _lastQ = { x: 0, y: 0, z: 0, w: 1 };
}

// ── Utilities ──────────────────────────────────────────────────────────────────

const formatError = (error) => {
    if (!error) return "Unknown error";
    if (typeof error === "string") return error;
    const name = error.name ? `${error.name}: ` : "";
    return `${name}${error.message || JSON.stringify(error)}`;
};

const showDebug = (message) => {
    debugLog.hidden = false;
    debugLog.textContent = message;
};

const clearDebug = () => {
    debugLog.hidden = true;
    debugLog.textContent = "";
};

const withTimeout = (promise, ms, label) =>
    Promise.race([
        promise,
        new Promise((_, reject) => {
            window.setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
        }),
    ]);

const renderStatus = () => {
    if (cameraStatus) cameraStatus.textContent = t(currentStatusKey, currentStatusVars);
};

const setStatus = (key, vars = {}) => {
    currentStatusKey = key;
    currentStatusVars = vars;
    renderStatus();
};

const BADGE_COPY = {
    loading:  { dot: "#888",    key: "top.badgeLoading" },
    scanning: { dot: "#00ed64", key: "top.badgeScanning" },
    found:    { dot: "#00ff88", key: "top.badgeFound" },
    lost:     { dot: "#ffaa00", key: "top.badgeLost" },
};

const setState = (state) => {
    currentState = state;
    cameraShell.dataset.state = state;
    const badge = BADGE_COPY[state] || BADGE_COPY.scanning;
    scanBadgeText.textContent = t(badge.key);
    const dot = scanBadge.querySelector(".scan-badge-dot");
    if (dot) dot.style.background = badge.dot;
};

const restartScanAnimations = () => {
    const els = cameraModal.querySelectorAll(".scan-line, .camera-target-frame, .scan-badge-dot");
    els.forEach((el) => {
        el.style.animationName = "none";
        void el.offsetWidth;
        el.style.animationName = "";
    });
};

// ── Model loading ──────────────────────────────────────────────────────────────

const loadBoxModel = () =>
    new Promise((resolve, reject) => {
        new GLTFLoader().load("./assets/3d/gltf/box.glb", resolve, undefined, reject);
    });

const setTextureColorSpace = (texture) => {
    if ("colorSpace" in texture) {
        texture.colorSpace = THREE.SRGBColorSpace;
    } else {
        texture.encoding = THREE.sRGBEncoding;
    }
};

// ── GIF flame texture ──────────────────────────────────────────────────────────

const scrubFlameFrameAlpha = (imageData) => {
    const data = imageData.data;
    const matteThreshold = 28;
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a === 0) continue;
        const maxChannel = Math.max(r, g, b);
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (maxChannel <= matteThreshold || luminance <= matteThreshold) {
            data[i + 3] = 0;
            continue;
        }
        const normalized = Math.min(1, Math.max(0, (luminance - matteThreshold) / (255 - matteThreshold)));
        data[i + 3] = Math.min(a, Math.round(normalized * 255));
    }
    return imageData;
};

const createAnimatedGifTexture = async (src, frameOffsetFrames = 0) => {
    const response = await fetch(src);
    if (!response.ok) throw new Error(`GIF fetch failed: ${response.status}`);

    const buffer = await response.arrayBuffer();
    const gif = parseGIF(buffer);
    const frames = decompressFrames(gif, true);
    const width = gif.lsd.width;
    const height = gif.lsd.height;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    canvas.width = width;
    canvas.height = height;

    const workCanvas = document.createElement("canvas");
    const workCtx = workCanvas.getContext("2d", { willReadFrequently: true });
    workCanvas.width = width;
    workCanvas.height = height;

    const composedFrames = [];
    let previousFrame = null;

    frames.forEach((frame) => {
        if (previousFrame?.disposalType === 2) {
            workCtx.clearRect(previousFrame.dims.left, previousFrame.dims.top, previousFrame.dims.width, previousFrame.dims.height);
        } else if (previousFrame?.disposalType === 3 && previousFrame._restoreImageData) {
            workCtx.putImageData(previousFrame._restoreImageData, 0, 0);
        }
        if (frame.disposalType === 3) {
            frame._restoreImageData = workCtx.getImageData(0, 0, width, height);
        }
        const imageData = new ImageData(frame.patch, frame.dims.width, frame.dims.height);
        workCtx.putImageData(imageData, frame.dims.left, frame.dims.top);
        const composedImageData = workCtx.getImageData(0, 0, width, height);
        scrubFlameFrameAlpha(composedImageData);
        composedFrames.push({ delayMs: flameFrameDurationMs, imageData: composedImageData });
        previousFrame = frame;
    });

    const totalDurationMs = composedFrames.reduce((s, f) => s + f.delayMs, 0);
    if (!composedFrames.length || totalDurationMs <= 0) throw new Error("GIF has no playable frames.");

    const texture = new THREE.CanvasTexture(canvas);
    texture.flipY = false;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    setTextureColorSpace(texture);

    let currentFrameIndex = 0;
    let elapsedInFrameMs = (frameOffsetFrames * flameFrameDurationMs) % totalDurationMs;
    while (elapsedInFrameMs >= composedFrames[currentFrameIndex].delayMs) {
        elapsedInFrameMs -= composedFrames[currentFrameIndex].delayMs;
        currentFrameIndex = (currentFrameIndex + 1) % composedFrames.length;
    }

    const drawFrame = (i) => { ctx.putImageData(composedFrames[i].imageData, 0, 0); texture.needsUpdate = true; };
    drawFrame(currentFrameIndex);

    let lastTick = performance.now();
    return {
        texture,
        update: () => {
            const now = performance.now();
            const deltaMs = now - lastTick;
            lastTick = now;
            if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
            elapsedInFrameMs += deltaMs;
            while (elapsedInFrameMs >= composedFrames[currentFrameIndex].delayMs) {
                elapsedInFrameMs -= composedFrames[currentFrameIndex].delayMs;
                currentFrameIndex = (currentFrameIndex + 1) % composedFrames.length;
                drawFrame(currentFrameIndex);
            }
        },
        dispose: () => texture.dispose(),
    };
};

const attachExternalFlameGif = async (model) => {
    const matchedMeshes = [];
    const updaters = [];
    const disposers = [];
    const cache = new Map();
    const targets = [];

    model.traverse((obj) => {
        if (!obj.isMesh || !obj.material) return;
        const normalizedName = normalizeMeshName(obj.name);
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        const nextMaterials = materials.map((mat) => {
            if (!mat) return mat;
            const isFlameMesh = flameMeshNames.has(normalizedName) || flameMaterialNames.has(mat.name);
            if (!isFlameMesh) return mat;
            const nextMat = new THREE.MeshBasicMaterial({
                transparent: true, alphaTest: 0.03, depthWrite: false, depthTest: true,
                side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
                premultipliedAlpha: true, toneMapped: false, color: 0xffffff,
            });
            targets.push({ obj, mat: nextMat, normalizedName });
            return nextMat;
        });
        obj.material = Array.isArray(obj.material) ? nextMaterials : nextMaterials[0];
        if (flameMeshNames.has(normalizedName)) obj.renderOrder = 10;
    });

    for (const target of targets) {
        const frameOffset = flameFrameOffsetByMesh.get(target.normalizedName) ?? 0;
        const key = String(frameOffset);
        let anim = cache.get(key);
        if (!anim) {
            anim = await createAnimatedGifTexture(resolvedFlameGifUrl, frameOffset);
            cache.set(key, anim);
            updaters.push(anim.update);
            disposers.push(anim.dispose);
        }
        target.mat.map = anim.texture;
        target.mat.needsUpdate = true;
        matchedMeshes.push(target.obj.name);
    }

    if (!matchedMeshes.length) {
        console.warn("Flame GIF matched no meshes.");
        return { updaters: [], disposers: [] };
    }
    console.info("Flame GIF attached to:", matchedMeshes);
    return { updaters, disposers };
};

// ── Depth / render order ───────────────────────────────────────────────────────

const configureModelRendering = (model) => {
    model.traverse((obj) => {
        if (!obj.isMesh || !obj.material) return;
        const normalizedName = normalizeMeshName(obj.name);
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        const nextMaterials = materials.map((mat) => {
            if (!mat) return mat;
            const nextMat = mat.clone();
            if (occluderMeshNames.has(normalizedName)) {
                obj.userData.isOccluder = true;
                obj.frustumCulled = false;
                nextMat.colorWrite = false;
                nextMat.depthWrite = true;
                nextMat.depthTest = true;
                nextMat.transparent = false;
                nextMat.opacity = 1;
                nextMat.needsUpdate = true;
                return nextMat;
            }
            if (shellMeshNames.has(normalizedName)) {
                nextMat.depthTest = true;
                nextMat.needsUpdate = true;
                return nextMat;
            }
            if (interiorMeshNames.has(normalizedName)) {
                obj.frustumCulled = false;
                nextMat.depthTest = true;
                if (flameMeshNames.has(normalizedName)) {
                    nextMat.transparent = true;
                    nextMat.depthWrite = false;
                    nextMat.alphaTest = Math.max(nextMat.alphaTest ?? 0, 0.005);
                    nextMat.side = THREE.DoubleSide;
                }
                nextMat.needsUpdate = true;
            }
            return nextMat;
        });
        obj.material = Array.isArray(obj.material) ? nextMaterials : nextMaterials[0];
        if (occluderMeshNames.has(normalizedName)) obj.renderOrder = 1;
        else if (shellMeshNames.has(normalizedName)) obj.renderOrder = 2;
        else if (interiorMeshNames.has(normalizedName)) obj.renderOrder = flameMeshNames.has(normalizedName) ? 4 : 3;
    });
};

const setModelOpacity = (opacity) => {
    if (!boxModel) return;
    boxModel.traverse((object) => {
        if (!object.isMesh || !object.material) return;
        const normalizedName = normalizeMeshName(object.name);
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((mat) => {
            if (!mat) return;
            if (object.userData.isOccluder) {
                mat.colorWrite = false; mat.depthWrite = true; mat.depthTest = true;
                mat.transparent = false; mat.opacity = 1;
            } else {
                if (interiorMeshNames.has(normalizedName)) {
                    mat.depthTest = true;
                    if (flameMeshNames.has(normalizedName)) {
                        mat.transparent = true; mat.depthWrite = false;
                        mat.alphaTest = Math.max(mat.alphaTest ?? 0, 0.005);
                    }
                }
                mat.opacity = opacity;
            }
            mat.needsUpdate = true;
        });
    });
};

// ── Pose application with 1-Euro smoothing ─────────────────────────────────────
// boxModel is an anchor group child equivalent: placed at image center with offset.
// The offset (0, 0.38, -0.05) is in image-local space (1 unit = image width).
const _offsetVec = new THREE.Vector3();

const applyPose = (detail) => {
    if (!boxModel) return;
    const { position, rotation, scale } = detail;
    const t = performance.now();

    // ── 位置：三轴 1-Euro ──────────────────────────────────────────────────────
    const sx = fPos.x.filter(position.x, t);
    const sy = fPos.y.filter(position.y, t);
    const sz = fPos.z.filter(position.z, t);

    // ── 旋转：四元数连续性修正 + 每分量 1-Euro + 归一化 + adaptive slerp ────────
    let rx = rotation.x, ry = rotation.y, rz = rotation.z, rw = rotation.w;
    const dot = rx * _lastQ.x + ry * _lastQ.y + rz * _lastQ.z + rw * _lastQ.w;
    if (dot < 0) { rx = -rx; ry = -ry; rz = -rz; rw = -rw; }

    let qx = fQ.x.filter(rx, t), qy = fQ.y.filter(ry, t);
    let qz = fQ.z.filter(rz, t), qw = fQ.w.filter(rw, t);
    const qLen = Math.hypot(qx, qy, qz, qw) || 1;
    qx /= qLen; qy /= qLen; qz /= qLen; qw /= qLen;
    _lastQ = { x: qx, y: qy, z: qz, w: qw };

    _tmpQ.set(qx, qy, qz, qw);
    const ang = boxModel.quaternion.angleTo(_tmpQ);
    const stillRad = 2 * Math.PI / 180;
    const moveRad = Math.max(stillRad * 10, 0.0873);
    const qAlpha = ang < stillRad ? 0.03 : ang > moveRad ? 1.0 : Math.min(1, Math.max(0.15, ang / moveRad));
    boxModel.quaternion.slerp(_tmpQ, qAlpha);

    // ── 偏移（image-local 空间，随旋转转到世界空间）──────────────────────────────
    // offset = (0, 0.38, -0.05) in image-widths; scale converts to world meters
    _offsetVec.set(0, 0.38 * scale, -0.05 * scale).applyQuaternion(boxModel.quaternion);

    boxModel.position.set(sx + _offsetVec.x, sy + _offsetVec.y, sz + _offsetVec.z);
    boxModel.scale.setScalar(scale * 0.18);
};

const snapPose = (detail) => {
    if (!boxModel) return;
    const { position, rotation, scale } = detail;
    _tmpQ.set(rotation.x, rotation.y, rotation.z, rotation.w);
    boxModel.quaternion.copy(_tmpQ);
    _offsetVec.set(0, 0.38 * scale, -0.05 * scale).applyQuaternion(_tmpQ);
    boxModel.position.set(
        position.x + _offsetVec.x,
        position.y + _offsetVec.y,
        position.z + _offsetVec.z
    );
    boxModel.scale.setScalar(scale * 0.18);
    _lastQ = { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w };
    resetFilters();
    // Seed filters with initial position to avoid pull-to-zero on first frame
    const t = performance.now();
    fPos.x.filter(position.x, t); fPos.y.filter(position.y, t); fPos.z.filter(position.z, t);
    fQ.x.filter(rotation.x, t); fQ.y.filter(rotation.y, t);
    fQ.z.filter(rotation.z, t); fQ.w.filter(rotation.w, t);
};

// ── XR8 pipeline ──────────────────────────────────────────────────────────────

const buildAppModule = () => ({
    name: "top-ar-app",

    onStart: () => {
        const { scene } = XR8.Threejs.xrScene();

        scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1.25));
        const dir = new THREE.DirectionalLight(0xffffff, 0.9);
        dir.position.set(0, 2, 1.5);
        scene.add(dir);
        scene.add(boxModel);

        setState("scanning");
        setStatus("top.statusCameraReady");
        startButton.removeAttribute("aria-busy");
    },

    // XR8 pipeline events use the listeners array (not canvas DOM events)
    listeners: [
        {
            event: "reality.imagefound",
            process: ({ detail }) => {
                if (lostTimer) { clearTimeout(lostTimer); lostTimer = null; }
                snapPose(detail);
                boxModel.visible = true;
                setModelOpacity(1);
                if (mixer && mixerActions.length > 0) {
                    clock.start();
                    mixerActions.forEach((a) => { if (!a.isRunning()) a.play(); else a.paused = false; });
                }
                setState("found");
                setStatus("top.statusFound");
            },
        },
        {
            event: "reality.imageupdated",
            process: ({ detail }) => {
                applyPose(detail);
            },
        },
        {
            event: "reality.imagelost",
            process: () => {
                setState("lost");
                setStatus("top.statusLost");
                if (mixer) { mixerActions.forEach((a) => { a.paused = true; }); clock.stop(); }
                resetFilters();
                lostTimer = window.setTimeout(() => {
                    setModelOpacity(0);
                    boxModel.visible = false;
                    lostTimer = null;
                }, 800);
            },
        },
    ],

    onUpdate: () => {
        gifUpdaters.forEach((fn) => fn());
        if (mixer && clock.running) mixer.update(clock.getDelta());
    },
});

// ── Start / Stop ───────────────────────────────────────────────────────────────

const startMindAR = async () => {
    clearDebug();

    if (window.location.protocol === "file:") { setStatus("top.statusNeedHttps"); return; }
    if (!window.isSecureContext) { setStatus("top.statusNeedSecureContext"); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setStatus("top.statusNoCameraSupport"); return; }

    cameraModal.hidden = false;
    document.body.classList.add("camera-open");
    restartScanAnimations();
    startButton.disabled = true;
    startButton.setAttribute("aria-busy", "true");
    setState("loading");
    setStatus("top.statusLoadingEngine");
    requestAnimationFrame(() => closeButton.focus());

    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    try {
        // Load model + GIF before XR8 starts
        const gltf = await withTimeout(loadBoxModel(), 25000, "loadBoxModel");
        boxModel = gltf.scene;
        boxModel.visible = false;

        const { updaters, disposers } = await attachExternalFlameGif(boxModel);
        gifUpdaters = updaters;
        gifTextureDisposers = disposers;
        configureModelRendering(boxModel);

        if (gltf.animations?.length > 0) {
            mixer = new THREE.AnimationMixer(boxModel);
            mixerActions = gltf.animations.map((clip) => {
                const action = mixer.clipAction(clip);
                action.loop = THREE.LoopRepeat;
                action.clampWhenFinished = false;
                return action;
            });
        }

        // Fetch compiled image target data
        setStatus("top.statusLoadingEngine");
        const targetRes = await fetch("./assets/targets/000-top/000-top.json");
        if (!targetRes.ok) throw new Error(`Image target JSON not found (HTTP ${targetRes.status}). Run scripts/gen-target.mjs first.`);
        const imageTargetData = await targetRes.json();

        // Fix imagePath: XR8 fetches the luminance image at runtime to build feature descriptors.
        // The CLI writes a relative path ("image-targets/…") that doesn't match our actual layout.
        // Point it to the real file so XR8 can load it.
        if (imageTargetData.resources?.luminanceImage) {
            imageTargetData.imagePath = `./assets/targets/000-top/${imageTargetData.resources.luminanceImage}`;
        }

        // Apply physical width so XR8 maps 1 world unit → correct meter scale.
        imageTargetData.physicalWidthInMeters = PAINTING_WIDTH_M;
        if (imageTargetData.properties) {
            imageTargetData.properties.physicalWidthInMeters = PAINTING_WIDTH_M;
        } else {
            imageTargetData.properties = { physicalWidthInMeters: PAINTING_WIDTH_M };
        }

        // Create XR8 canvas inside #ar-container so the camera feed fills the
        // camera-stage element.  The CSS rule `#ar-container canvas` already
        // sets position:absolute; inset:0; width/height 100%; z-index:1 so no
        // inline styles needed — just append and let XR8 own the canvas.
        arCanvas = document.createElement("canvas");
        arCanvas.id = "xr8-canvas";
        arContainer.appendChild(arCanvas);
        document.body.classList.add("ar-running");

        // iOS 13+: motion permission must be requested from a user gesture
        if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
            try { await DeviceMotionEvent.requestPermission(); } catch (_) { /* user declined, continue */ }
        }

        // Wait for XR8 engine binary
        if (!window.XR8) {
            await new Promise((resolve) => window.addEventListener("xrloaded", resolve, { once: true }));
        }

        XR8.XrController.configure({
            disableWorldTracking: false,     // keep SLAM for stability
            imageTargetData: [imageTargetData],
        });

        XR8.addCameraPipelineModules([
            XR8.GlTextureRenderer.pipelineModule(),
            XR8.Threejs.pipelineModule(),
            XR8.XrController.pipelineModule(),
            buildAppModule(),
        ]);

        XR8.run({ canvas: arCanvas });
        xrRunning = true;

    } catch (error) {
        console.error("AR start failed:", error);
        showDebug([
            `protocol: ${window.location.protocol}`,
            `secureContext: ${String(window.isSecureContext)}`,
            `error: ${formatError(error)}`,
        ].join("\n"));

        const name = error?.name ?? "";
        if (name === "NotAllowedError") setStatus("top.statusPermissionDenied");
        else if (name === "NotReadableError") setStatus("top.statusCameraBusy");
        else if (name === "AbortError") setStatus("top.statusCameraAborted");
        else if (error?.message?.includes("timeout")) setStatus("top.statusStartTimeout");
        else setStatus("top.statusStartFailed", { message: error?.message ?? "Unknown error" });

        xrRunning = false;
        // Clean up any partial canvas / state
        const failCanvas = document.getElementById("xr8-canvas");
        if (failCanvas) failCanvas.remove();
        document.body.classList.remove("ar-running");
        arCanvas = null;
        boxModel = null;
        startButton.disabled = false;
        startButton.removeAttribute("aria-busy");
    }
};

const stopMindAR = () => {
    if (lostTimer) { clearTimeout(lostTimer); lostTimer = null; }
    if (!xrRunning) return;

    try { XR8.stop(); } catch (_) {}
    try { XR8.removeCameraPipelineModule("top-ar-app"); } catch (_) {}

    if (mixer) {
        mixer.stopAllAction();
        if (boxModel) mixer.uncacheRoot(boxModel);
        mixer = null;
    }

    mixerActions = [];
    clock.stop();
    gifTextureDisposers.forEach((d) => d());
    gifTextureDisposers = [];
    gifUpdaters = [];
    resetFilters();
    // Remove canvas and clear ar-running state
    const oldCanvas = document.getElementById("xr8-canvas");
    if (oldCanvas) oldCanvas.remove();
    document.body.classList.remove("ar-running");

    xrRunning = false;
    arCanvas = null;
    boxModel = null;
};

// ── Modal & locale ─────────────────────────────────────────────────────────────

const closeCameraModal = () => {
    cameraModal.hidden = true;
    document.body.classList.remove("camera-open");
    stopMindAR();
    arContainer.innerHTML = "";
    startButton.disabled = false;
    startButton.removeAttribute("aria-busy");
    setState("scanning");
    setStatus("top.statusIdle");
    startButton.focus();
};

const syncLocaleButtons = () => {
    const locale = i18n.getLocale();
    localeButtons.forEach((button) => {
        const isActive = button.dataset.locale === locale;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
    });
};

const refreshLocalizedUi = () => {
    i18n.applyPageTranslations();
    setState(currentState);
    renderStatus();
    syncLocaleButtons();
};

const initializePageCopy = () => {
    refreshLocalizedUi();
    setState("scanning");
    setStatus("top.statusIdle");
};

// ── Event wiring ───────────────────────────────────────────────────────────────

startButton.addEventListener("click", startMindAR);
closeButton.addEventListener("click", closeCameraModal);
localeButtons.forEach((button) => {
    button.addEventListener("click", () => {
        i18n.setLocale(button.dataset.locale);
        document.documentElement.lang = button.dataset.locale;
        refreshLocalizedUi();
    });
});
cameraModal.addEventListener("click", (e) => { if (e.target === cameraModal) closeCameraModal(); });
window.addEventListener("keydown", (e) => { if (e.key === "Escape" && !cameraModal.hidden) closeCameraModal(); });
window.addEventListener("beforeunload", stopMindAR);

window.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled rejection:", event.reason);
    showDebug(`unhandledrejection: ${formatError(event.reason)}`);
});
window.addEventListener("error", (event) => {
    if (!event.message) return;
    console.error("Window error:", event.error || event.message);
    showDebug(`error: ${formatError(event.error || event.message)}`);
});

initializePageCopy();
