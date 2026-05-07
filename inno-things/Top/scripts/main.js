import * as THREE from "../../../neu/voice-three-control/vendor/three/build/three.module.js";
import { GLTFLoader } from "../../../neu/voice-three-control/vendor/three/examples/jsm/loaders/GLTFLoader.js";
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
let xr8Configured = false;   // XR8.XrController.configure() can only be called once per page load
let arCanvas = null;
let boxModel = null;
let mixer = null;
let mixerActions = [];
let gifTextureDisposers = [];
let gifUpdaters = [];
let previewStream = null;
let preferredFacingMode = "environment";
let currentXrCameraDirection = "BACK";
let xrRetryDirections = [];
let xrRetryInFlight = false;
let xrSessionHealthy = false;
let previewFallbackTimer = null;
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
const flameMaterialNames = new Set(["聚气", "聚气.001"]);

// ── 自动识别网格角色 ────────────────────────────────────────────────────────────
// 优先级：① Blender userData.arRole → ② 名称后缀 → ③ 材质名 → ④ 兜底 shell
//
// 新模型只需在 Blender 里给网格名加后缀，换模型无需改代码：
//   _occ   → 遮挡体（depth-only，不可见但挡住现实世界）
//   _shell → 外壳（正常渲染）
//   _int   → 内部内容
//   _flame → 火焰 / 透明动画面片
//
// 当前模型兼容映射（旧名称直接识别，无需重命名）：
const LEGACY_ROLES = {
    box001: "occluder",
    box: "shell", box1: "shell", box2: "shell",
    plane004: "flame", plane005: "flame",
    top2: "interior", top3: "interior", cube001: "interior",
};

// 火焰帧偏移（flame mesh → 起始帧）
const flameFrameOffsetByMesh = new Map([
    ["plane004", 0],
    ["plane005", 12],
]);

const MODEL_SCALE_MULTIPLIER = 0.18;
const MODEL_OFFSET_Y = 0.34;
const MODEL_OFFSET_Z = -0.04;
const POSITION_DEADBAND = 0.0012;
const SCALE_DEADBAND = 0.0025;

const normalizeMeshName = (name = "") => name.toLowerCase().replace(/[^a-z0-9]/g, "");

const getMeshRole = (obj) => {
    // ① Blender 自定义属性 arRole（Object Properties → Custom Properties）
    const ud = obj.userData?.arRole;
    if (ud) return String(ud);

    const n = normalizeMeshName(obj.name);

    // ② 兼容旧名称
    if (LEGACY_ROLES[n]) return LEGACY_ROLES[n];

    // ③ 后缀约定
    if (n.endsWith("occ") || n.includes("occluder")) return "occluder";
    if (n.endsWith("shell"))                          return "shell";
    if (n.endsWith("flame") || n.endsWith("fire"))    return "flame";
    if (n.endsWith("int")   || n.endsWith("interior")) return "interior";

    // ④ 材质名（火焰贴图识别）
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    if (mats.some((m) => m && flameMaterialNames.has(m.name))) return "flame";

    // ⑤ 兜底：当 shell 处理，正常渲染，不报错
    return "shell";
};

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
const fScale = new OneEuro(MIN_CUTOFF * 0.8, BETA * 0.7);
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
    fScale.reset();
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

const appendDebug = (message) => {
    const next = String(message ?? "");
    if (!next) return;
    debugLog.hidden = false;
    debugLog.textContent = debugLog.textContent
        ? `${debugLog.textContent}\n${next}`
        : next;
};

const withTimeout = (promise, ms, label) =>
    Promise.race([
        promise,
        new Promise((_, reject) => {
            window.setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
        }),
    ]);

const isDesktopLikeEnvironment = () => {
    const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
    const touchPoints = navigator.maxTouchPoints || 0;
    const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    return !mobileUa && !coarsePointer && touchPoints === 0;
};

const listVideoInputs = async () =>
    (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "videoinput");

const inferFacingModeFromDevices = (devices) => {
    if (devices.length <= 1) return "user";
    const labels = devices.map((device) => device.label.toLowerCase());
    const hasBack = labels.some((label) => /back|rear|environment|world|traseira|trasera|후면/.test(label));
    const hasFront = labels.some((label) => /front|user|facetime|selfie|前置|전면/.test(label));
    if (hasBack) return "environment";
    if (hasFront && !hasBack) return "user";
    return "user";
};

const ensurePreviewVideo = () => {
    let video = document.getElementById("camera-preview");
    if (video) return video;
    video = document.createElement("video");
    video.id = "camera-preview";
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("autoplay", "");
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    arContainer.appendChild(video);
    return video;
};

const stopPreviewStream = () => {
    document.body.classList.remove("preview-running");
    if (previewStream) {
        previewStream.getTracks().forEach((track) => track.stop());
        previewStream = null;
    }
    const video = document.getElementById("camera-preview");
    if (video) {
        video.pause?.();
        video.srcObject = null;
        video.remove();
    }
};

const clearPreviewFallbackTimer = () => {
    if (!previewFallbackTimer) return;
    window.clearTimeout(previewFallbackTimer);
    previewFallbackTimer = null;
};

const markXrSessionHealthy = () => {
    xrSessionHealthy = true;
    clearPreviewFallbackTimer();
    stopPreviewStream();
};

const schedulePreviewFallback = () => {
    if (xrSessionHealthy || previewStream || previewFallbackTimer) return;
    appendDebug("preview fallback: waiting");
    previewFallbackTimer = window.setTimeout(() => {
        previewFallbackTimer = null;
        if (xrSessionHealthy || previewStream) return;
        setStatus("top.statusStartFailed", { message: "camera status failed" });
        startPreviewStream(preferredFacingMode).catch((error) => {
            appendDebug(`preview failed: ${formatError(error)}`);
        });
    }, 1200);
};

const startPreviewStream = async (facingMode = preferredFacingMode) => {
    clearPreviewFallbackTimer();
    stopPreviewStream();
    document.body.classList.add("preview-running");
    const video = ensurePreviewVideo();
    previewStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
        },
    });
    video.srcObject = previewStream;
    try { await video.play(); } catch (_) {}
    appendDebug(`preview: ${facingMode}`);
    console.log("[top-ar] preview stream ready:", facingMode);
    return previewStream;
};

const setPreviewPresentationActive = (active) => {
    document.body.classList.toggle("preview-running", active);
};

const probeCameraDirection = async () => {
    const attempts = [
        { facingMode: "environment" },
        { facingMode: "user" },
    ];
    let lastError = null;

    for (const attempt of attempts) {
        try {
            console.log("[top-ar] probe camera:", attempt.facingMode);
            appendDebug(`probe: ${attempt.facingMode}`);
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    facingMode: { ideal: attempt.facingMode },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
            });
            const [track] = stream.getVideoTracks();
            const actualFacingMode = track?.getSettings?.().facingMode;
            const devices = await listVideoInputs();
            stream.getTracks().forEach((track) => track.stop());
            preferredFacingMode = actualFacingMode === "environment"
                ? "environment"
                : actualFacingMode === "user"
                    ? "user"
                    : inferFacingModeFromDevices(devices);
            const xrDirection = preferredFacingMode === "environment" ? "BACK" : "FRONT";
            console.log("[top-ar] probe selected:", {
                requested: attempt.facingMode,
                actualFacingMode,
                videoInputs: devices.map((device) => device.label || "(unlabeled camera)"),
                preferredFacingMode,
                xrDirection,
            });
            appendDebug(`probe: using ${preferredFacingMode} (${devices.length} cam)`);
            return xrDirection;
        } catch (error) {
            lastError = error;
            console.warn("[top-ar] probe failed:", attempt.facingMode, error);
            appendDebug(`probe failed: ${attempt.facingMode} | ${formatError(error)}`);
            const hardFailNames = new Set(["NotAllowedError", "SecurityError", "NotReadableError", "AbortError"]);
            if (hardFailNames.has(error?.name)) {
                throw error;
            }
        }
    }

    throw lastError || new Error("No usable camera found.");
};

// ── XR8 video 全屏接管 ─────────────────────────────────────────────────────────
// XR8 把相机 <video> 直接 append 到 document.body（不进我们的容器），
// 默认尺寸是原始分辨率，显示在左上角。
// 用 MutationObserver 在 XR8 插入 video 的瞬间抓住它并强制全屏。

let xrVideoObserver = null;

const applyXrVideoFullscreen = (video) => {
    // 跳过我们自己的 preview video
    if (video.id === "camera-preview") return;
    video.style.setProperty("position",       "fixed",           "important");
    video.style.setProperty("inset",          "0",               "important");
    video.style.setProperty("width",          "100vw",           "important");
    video.style.setProperty("height",         "100vh",           "important");
    video.style.setProperty("object-fit",     "cover",           "important");
    video.style.setProperty("z-index",        "29",              "important");
    video.style.setProperty("pointer-events", "none",            "important");
    video.style.setProperty("opacity",        "1",               "important");
    console.log("[top-ar] xr video fullscreen applied:", video);
    appendDebug(`xr-video: ${video.videoWidth || 0}x${video.videoHeight || 0}`);
};

const watchXrVideo = () => {
    // 先处理页面里已有的 video（XR8 可能已在我们启动 observer 前插入）
    document.querySelectorAll("video").forEach(applyXrVideoFullscreen);

    xrVideoObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== 1) continue;
                if (node.tagName === "VIDEO") {
                    applyXrVideoFullscreen(node);
                } else {
                    node.querySelectorAll?.("video").forEach(applyXrVideoFullscreen);
                }
            }
        }
    });
    xrVideoObserver.observe(document.body, { childList: true, subtree: true });
};

const unwatchXrVideo = () => {
    xrVideoObserver?.disconnect();
    xrVideoObserver = null;
};

// ── XR runtime cleanup ─────────────────────────────────────────────────────────

const cleanupXrRuntime = ({ stopPreview = false, resetModel = false } = {}) => {
    unwatchXrVideo();
    clearPreviewFallbackTimer();
    xrSessionHealthy = false;
    try { XR8.stop(); } catch (_) {}
    ["gltexturerenderer", "threejsrenderer", "reality", "top-ar-app"].forEach((name) => {
        try { XR8.removeCameraPipelineModule(name); } catch (_) {}
    });

    if (stopPreview) stopPreviewStream();

    if (resetModel && mixer) {
        mixer.stopAllAction();
        if (boxModel) mixer.uncacheRoot(boxModel);
        mixer = null;
    }

    if (resetModel) {
        mixerActions = [];
        clock.stop();
        gifTextureDisposers.forEach((d) => d());
        gifTextureDisposers = [];
        gifUpdaters = [];
        resetFilters();
        boxModel = null;
    }

    xrRunning = false;
};

const runXrSession = (direction) => {
    currentXrCameraDirection = direction;
    xrSessionHealthy = false;
    clearPreviewFallbackTimer();
    appendDebug(`xr run: ${direction}`);
    XR8.addCameraPipelineModules([
        XR8.GlTextureRenderer.pipelineModule(),
        XR8.Threejs.pipelineModule(),
        XR8.XrController.pipelineModule(),
        buildAppModule(),
    ]);

    // 启动 observer，XR8 插入 <video> 的瞬间强制全屏
    watchXrVideo();

    XR8.run({
        canvas: arCanvas,
        allowedDevices: XR8.XrConfig?.device?.().ANY,
        cameraConfig: {
            direction: direction === "FRONT"
                ? XR8.XrConfig.camera().FRONT
                : XR8.XrConfig.camera().BACK,
        },
    });
    xrRunning = true;
};

const retryXrSession = async (direction) => {
    appendDebug(`xr retry: ${currentXrCameraDirection} -> ${direction}`);
    setStatus("top.statusLoadingEngine");
    cleanupXrRuntime({ stopPreview: false, resetModel: false });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    runXrSession(direction);
};

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

const setArPresentationActive = (active) => {
    const canvas = document.getElementById("xr8-canvas");
    if (canvas) {
        // XR8 会用 inline style 覆盖 canvas 的尺寸（设成相机分辨率），
        // 用 setProperty + "important" 强制全屏，优先级高于任何 inline style
        canvas.style.setProperty("position", "fixed",    "important");
        canvas.style.setProperty("inset",    "0",        "important");
        canvas.style.removeProperty("width");
        canvas.style.removeProperty("height");
        canvas.style.removeProperty("object-fit");
        canvas.style.removeProperty("object-position");
        canvas.style.removeProperty("background");
        canvas.style.setProperty("opacity",  active ? "1" : "0", "important");
        canvas.style.setProperty("z-index",  active ? "30" : "-1", "important");
    }
    document.body.classList.toggle("ar-running", active);
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

const createAnimatedGifTexture = async (src, frameOffsetFrames = 0) => {
    const texture = await new THREE.TextureLoader().loadAsync(src);
    texture.flipY = false;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    setTextureColorSpace(texture);
    return {
        texture,
        update: () => {},
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
        if (getMeshRole(obj) !== "flame") return;
        const normalizedName = normalizeMeshName(obj.name);
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        const nextMaterials = materials.map((mat) => {
            if (!mat) return mat;
            const nextMat = new THREE.MeshBasicMaterial({
                transparent: true, alphaTest: 0.03, depthWrite: false, depthTest: true,
                side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
                premultipliedAlpha: true, toneMapped: false, color: 0xffffff,
            });
            targets.push({ obj, mat: nextMat, normalizedName });
            return nextMat;
        });
        obj.material = Array.isArray(obj.material) ? nextMaterials : nextMaterials[0];
        obj.renderOrder = 10;
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
    const roleLog = {};
    model.traverse((obj) => {
        if (!obj.isMesh || !obj.material) return;
        const role = getMeshRole(obj);
        (roleLog[role] = roleLog[role] || []).push(obj.name);

        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        const nextMaterials = materials.map((mat) => {
            if (!mat) return mat;
            const nextMat = mat.clone();
            if (role === "occluder") {
                obj.userData.isOccluder = true;
                obj.frustumCulled = false;
                nextMat.colorWrite = false;
                nextMat.depthWrite = true;
                nextMat.depthTest = true;
                nextMat.transparent = false;
                nextMat.opacity = 1;
            } else if (role === "shell") {
                nextMat.depthTest = true;
            } else if (role === "interior" || role === "flame") {
                obj.frustumCulled = false;
                nextMat.depthTest = true;
                if (role === "flame") {
                    nextMat.transparent = true;
                    nextMat.depthWrite = false;
                    nextMat.alphaTest = Math.max(nextMat.alphaTest ?? 0, 0.005);
                    nextMat.side = THREE.DoubleSide;
                }
            }
            nextMat.needsUpdate = true;
            return nextMat;
        });
        obj.material = Array.isArray(obj.material) ? nextMaterials : nextMaterials[0];

        const renderOrders = { occluder: 1, shell: 2, interior: 3, flame: 4 };
        obj.renderOrder = renderOrders[role] ?? 2;
    });
    console.log("[top-ar] mesh roles:", roleLog);
};

const setModelOpacity = (opacity) => {
    if (!boxModel) return;
    boxModel.traverse((object) => {
        if (!object.isMesh || !object.material) return;
        const role = getMeshRole(object);
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((mat) => {
            if (!mat) return;
            if (role === "occluder") {
                mat.colorWrite = false; mat.depthWrite = true;
                mat.depthTest = true; mat.transparent = false; mat.opacity = 1;
            } else {
                if (role === "flame") {
                    mat.depthTest = true; mat.transparent = true;
                    mat.depthWrite = false;
                    mat.alphaTest = Math.max(mat.alphaTest ?? 0, 0.005);
                }
                mat.opacity = opacity;
            }
            mat.needsUpdate = true;
        });
    });
};

// ── Pose application with 1-Euro smoothing ─────────────────────────────────────
// boxModel is an anchor group child equivalent: placed at image center with offset.
// The offset is in image-local space (1 unit = image width).
const _offsetVec = new THREE.Vector3();
const _tmpPos = new THREE.Vector3();

const applyPose = (detail) => {
    if (!boxModel) return;
    const { position, rotation, scale } = detail;
    const t = performance.now();

    // ── 位置：三轴 1-Euro ──────────────────────────────────────────────────────
    const sx = fPos.x.filter(position.x, t);
    const sy = fPos.y.filter(position.y, t);
    const sz = fPos.z.filter(position.z, t);
    const sScale = fScale.filter(scale, t);

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
    _offsetVec.set(0, MODEL_OFFSET_Y * sScale, MODEL_OFFSET_Z * sScale).applyQuaternion(boxModel.quaternion);
    _tmpPos.set(sx + _offsetVec.x, sy + _offsetVec.y, sz + _offsetVec.z);

    if (boxModel.position.distanceToSquared(_tmpPos) > POSITION_DEADBAND * POSITION_DEADBAND) {
        boxModel.position.copy(_tmpPos);
    }

    const targetScale = sScale * MODEL_SCALE_MULTIPLIER;
    if (Math.abs(boxModel.scale.x - targetScale) > SCALE_DEADBAND) {
        boxModel.scale.setScalar(targetScale);
    }
};

const snapPose = (detail) => {
    if (!boxModel) return;
    const { position, rotation, scale } = detail;
    _tmpQ.set(rotation.x, rotation.y, rotation.z, rotation.w);
    boxModel.quaternion.copy(_tmpQ);
    _offsetVec.set(0, MODEL_OFFSET_Y * scale, MODEL_OFFSET_Z * scale).applyQuaternion(_tmpQ);
    boxModel.position.set(
        position.x + _offsetVec.x,
        position.y + _offsetVec.y,
        position.z + _offsetVec.z
    );
    boxModel.scale.setScalar(scale * MODEL_SCALE_MULTIPLIER);
    _lastQ = { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w };
    resetFilters();
    // Seed filters with initial position to avoid pull-to-zero on first frame
    const t = performance.now();
    fPos.x.filter(position.x, t); fPos.y.filter(position.y, t); fPos.z.filter(position.z, t);
    fScale.filter(scale, t);
    fQ.x.filter(rotation.x, t); fQ.y.filter(rotation.y, t);
    fQ.z.filter(rotation.z, t); fQ.w.filter(rotation.w, t);
};

// ── XR8 pipeline ──────────────────────────────────────────────────────────────

const buildAppModule = () => ({
    name: "top-ar-app",

    onBeforeRun: () => {
        appendDebug("run: before");
    },

    onCameraStatusChange: ({ status, video, stream }) => {
        const extra = [
            status ? `status=${status}` : null,
            video ? `video=${video.videoWidth || 0}x${video.videoHeight || 0}` : null,
            stream ? "stream=ok" : null,
        ].filter(Boolean).join(" | ");
        console.log("[top-ar] camera status:", status, { video, stream });
        appendDebug(`camera: ${extra || "unknown"}`);

        if (status === "requesting") {
            setStatus("top.statusLoadingEngine");
            return;
        }
        if (status === "hasStream") {
            appendDebug("camera: stream attached");
            return;
        }
        if (status === "hasVideo") {
            appendDebug("camera: video ready");
            markXrSessionHealthy();
            return;
        }
        if (status === "failed") {
            if (!xrRetryInFlight && xrRetryDirections.length > 0) {
                const nextDirection = xrRetryDirections.shift();
                xrRetryInFlight = true;
                retryXrSession(nextDirection)
                    .catch((error) => {
                        appendDebug(`xr retry failed: ${formatError(error)}`);
                    })
                    .finally(() => {
                        xrRetryInFlight = false;
                    });
                return;
            }
            appendDebug("camera: failed, waiting fallback");
            schedulePreviewFallback();
        }
    },

    onException: (error) => {
        console.error("[top-ar] XR8 exception:", error);
        appendDebug(`xr8 exception: ${formatError(error)}`);
    },

    onStart: () => {
        markXrSessionHealthy();
        const { scene } = XR8.Threejs.xrScene();

        // XR8 默认把 canvas buffer 设成相机原始分辨率（横向，如 1280×720）。
        // 竖屏手机上会出现黑边/letterbox。
        // 强制 renderer 对齐屏幕，GlTextureRenderer 也会跟着填满。
        const sw = window.innerWidth;

        scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbff, 0.6));
        const dir = new THREE.DirectionalLight(0xffffff, 0.5);
        dir.position.set(0, 2, 1.5);
        scene.add(dir);
        scene.add(boxModel);

        // Debug
        const cv = arCanvas;
        const dbg = `onStart | buf:${cv?.width}x${cv?.height} screen:${sw}x${sh}@${dpr}x`;
        console.log("[top-ar]", dbg);
        appendDebug(dbg);

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

                markXrSessionHealthy();
                snapPose(detail);
                boxModel.visible = true;
                setModelOpacity(1);
                if (mixer && mixerActions.length > 0) {
                    clock.start();
                    mixerActions.forEach((a) => { if (!a.isRunning()) a.play(); else a.paused = false; });
                }
                setState("found");
                setStatus("top.statusFound");

                // ── 识别调试 ──────────────────────────────────────────────────
                const { position: p, scale: s } = detail;
                console.log("[top-ar] imagefound", {
                    name: detail.name,
                    pos: `(${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)})`,
                    scale: s.toFixed(4),
                });
                appendDebug(`FOUND scale=${s.toFixed(4)} pos=(${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)})`);
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

                // ── 识别调试 ──────────────────────────────────────────────────
                console.log("[top-ar] imagelost");
                appendDebug(`LOST @ ${new Date().toLocaleTimeString()}`);

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
        if (isDesktopLikeEnvironment()) {
            preferredFacingMode = "user";
            xrSessionHealthy = false;
            clearPreviewFallbackTimer();
            await startPreviewStream(preferredFacingMode);
            appendDebug("mode: desktop-preview");
            setPreviewPresentationActive(true);
            setArPresentationActive(false);
            setState("scanning");
            setStatus("top.statusDesktopPreview");
            startButton.removeAttribute("aria-busy");
            return;
        }

        const xrCameraDirection = await probeCameraDirection();
        appendDebug(`xr camera: ${xrCameraDirection}`);
        xrRetryDirections = [xrCameraDirection === "BACK" ? "FRONT" : "BACK"];
        xrRetryInFlight = false;
        xrSessionHealthy = false;
        clearPreviewFallbackTimer();
        stopPreviewStream();

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

        // Canvas is statically in the HTML with proper viewport dimensions.
        // Switch from opacity:0 → opacity:1 (never use display:none — that
        // makes iOS Safari create a 0×0 WebGL context → "No valid session manager").
        arCanvas = document.getElementById("xr8-canvas");
        if (!arCanvas) throw new Error("xr8-canvas not found.");
        setArPresentationActive(true);

        // iOS 13+: motion permission must be requested from a user gesture
        if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
            try { await DeviceMotionEvent.requestPermission(); } catch (_) { /* user declined, continue */ }
        }

        // Wait for XR8 engine binary
        if (!window.XR8) {
            await withTimeout(
                new Promise((resolve) => window.addEventListener("xrloaded", resolve, { once: true })),
                12000,
                "xrloaded"
            );
        }
        if (!window.XR8) {
            throw new Error("XR8 failed to load.");
        }

        // configure() can only be called BEFORE the very first XR8.run() —
        // it throws if called after run() even after stop().  So we call it
        // exactly once per page load and rely on XR8 remembering the data.
        if (!xr8Configured) {
            XR8.XrController.configure({
                disableWorldTracking: false,   // SLAM 开启：陀螺仪+环境建图，模型原生稳定
                imageTargetData: [imageTargetData],
            });
            xr8Configured = true;
        }

        // FullWindowCanvas is deprecated in R13.1 and tries to load a chunk
        // that doesn't exist in our self-hosted build → skip it entirely.
        // Canvas is already fixed 100vw×100vh via inline styles, so XR8
        // can fill it without the module.
        runXrSession(xrCameraDirection);

    } catch (error) {
        console.error("AR start failed:", error);
        clearPreviewFallbackTimer();
        xrSessionHealthy = false;
        showDebug([
            `protocol: ${window.location.protocol}`,
            `secureContext: ${String(window.isSecureContext)}`,
            `error: ${formatError(error)}`,
        ].join("\n"));
        try {
            await startPreviewStream(preferredFacingMode);
        } catch (previewError) {
            appendDebug(`preview failed: ${formatError(previewError)}`);
        }

        const name = error?.name ?? "";
        if (name === "NotAllowedError") setStatus("top.statusPermissionDenied");
        else if (name === "NotReadableError") setStatus("top.statusCameraBusy");
        else if (name === "AbortError") setStatus("top.statusCameraAborted");
        else if (error?.message?.includes("timeout")) setStatus("top.statusStartTimeout");
        else setStatus("top.statusStartFailed", { message: error?.message ?? "Unknown error" });

        xrRetryDirections = [];
        xrRetryInFlight = false;
        xrRunning = false;
        setArPresentationActive(false);
        arCanvas = null;
        boxModel = null;
        startButton.disabled = false;
        startButton.removeAttribute("aria-busy");
    }
};

const stopMindAR = () => {
    if (lostTimer) { clearTimeout(lostTimer); lostTimer = null; }
    if (!xrRunning) {
        clearPreviewFallbackTimer();
        xrSessionHealthy = false;
        setArPresentationActive(false);
        arCanvas = null;
        stopPreviewStream();
        xrRetryDirections = [];
        xrRetryInFlight = false;
        return;
    }
    cleanupXrRuntime({ stopPreview: true, resetModel: true });
    setArPresentationActive(false);
    xrRetryDirections = [];
    xrRetryInFlight = false;
    arCanvas = null;
};

// ── Modal & locale ─────────────────────────────────────────────────────────────

const closeCameraModal = () => {
    cameraModal.hidden = true;
    document.body.classList.remove("camera-open");
    stopMindAR();
    arContainer.innerHTML = "";
    clearDebug();
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
