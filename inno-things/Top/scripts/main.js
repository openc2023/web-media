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
let xr8Configured = false;
let arCanvas = null;
let boxModel = null;
let introModel = null;
let mixer = null;
let mixerActions = [];
let gifTextureDisposers = [];
let gifUpdaters = [];
let introTextureDisposers = [];
let introVideoElements = [];
let introFadeMaterials = [];
let introSequence = null;
let petalGroup = null;
let petalInstances = [];
let petalTextureDisposers = [];
let backgroundTextureDisposers = [];
let previewStream = null;
let preferredFacingMode = "environment";
let currentXrCameraDirection = "BACK";
let xrRetryDirections = [];
let xrRetryInFlight = false;
let xrSessionHealthy = false;
let previewFallbackTimer = null;
let xrCameraBootTimer = null;
let lostTimer = null;
let startAttemptToken = 0;
let assetWarmupPromise = null;
let preloadedTargetDataPromise = null;
let currentState = "scanning";
let currentStatusKey = "top.statusIdle";
let currentStatusVars = {};

const clock = new THREE.Clock(false);

const IMAGE_TARGET_NAME = "000-top";
const PAINTING_WIDTH_M = 0.20;
const ASSET_VERSION = "20260515-assets8";
const withAssetVersion = (path) => {
    const url = new URL(path, import.meta.url);
    url.searchParams.set("v", ASSET_VERSION);
    return url.href;
};
const boxModelUrl = withAssetVersion("../assets/3d/gltf/box.glb");
const introModelUrl = withAssetVersion("../assets/3d/gltf/shipin.glb");
const targetDataUrl = withAssetVersion("../assets/targets/000-top/000-top.json");

const resolvedFlameGifUrl = new URL(
    "../assets/3d/gltf/%E7%81%AB%E7%84%B0%E6%97%8B%E8%BD%AC.gif",
    import.meta.url
);
resolvedFlameGifUrl.searchParams.set("v", ASSET_VERSION);
const resolvedIntroVideoUrl = new URL(
    "../assets/3d/gltf/shipin.mp4",
    import.meta.url
);
resolvedIntroVideoUrl.searchParams.set("v", ASSET_VERSION);
const resolvedPetalUrls = [
    new URL("../assets/3d/png/huaban1.png", import.meta.url),
    new URL("../assets/3d/png/huaban2.png", import.meta.url),
    new URL("../assets/3d/png/huaban3.png", import.meta.url),
].map((url) => {
    url.searchParams.set("v", ASSET_VERSION);
    return url.href;
});
const resolvedInteriorBackgroundUrl = new URL("../assets/3d/png/bg1.png", import.meta.url);
resolvedInteriorBackgroundUrl.searchParams.set("v", ASSET_VERSION);
const resolvedFlameGifUrlString = resolvedFlameGifUrl.href;
const resolvedIntroVideoUrlString = resolvedIntroVideoUrl.href;
const resolvedInteriorBackgroundUrlString = resolvedInteriorBackgroundUrl.href;
const flamePlaybackFps = 24;
const flameFrameDurationMs = 1000 / flamePlaybackFps;
const flameFrameOffsetByMesh = new Map([
    ["plane004", 0],
    ["plane005", 12],
]);
const flameMaterialNames = new Set(["?싨컮", "?싨컮.001"]);

// Legacy fallback roles for older GLBs that do not use suffix naming yet.
const LEGACY_ROLES = {
    box001: "occluder",
    box: "shell",
    box1: "shell",
    box2: "shell",
    petalarea: "petal-area",
    plane004: "flame",
    plane005: "flame",
    top2: "interior",
    top3: "interior",
    cube001: "interior",
};

const MODEL_SCALE_MULTIPLIER = 0.18;
const MODEL_OFFSET_Y = 0.34;
const MODEL_OFFSET_Z = -0.04;
const POSITION_DEADBAND = 0.0012;
const SCALE_DEADBAND = 0.0025;
const INTRO_FADE_IN_MS = 1200;
const INTRO_FADE_OUT_MS = 8000;
const MEDIA_REQUEST_TIMEOUT_MS = 10000;
const XR_CAMERA_BOOT_TIMEOUT_MS = 9000;
const TARGET_FETCH_TIMEOUT_MS = 12000;
const ENABLE_INTRO_SEQUENCE = false;
const PETAL_COUNT_MIN = 17;
const PETAL_COUNT_MAX = 21;
const pseudoRandom = (seed) => {
    const x = Math.sin(seed * 127.1 + seed * seed * 311.7) * 43758.5453123;
    return x - Math.floor(x);
};

const normalizeMeshName = (name = "") => name.toLowerCase().replace(/[^a-z0-9]/g, "");

const getMeshRole = (obj) => {
    const ud = obj.userData?.arRole;
    if (ud) return String(ud);

    const n = normalizeMeshName(obj.name);
    if (LEGACY_ROLES[n]) return LEGACY_ROLES[n];

    // Naming convention:
    // _occ   -> occluder
    // _shell -> shell
    // _int   -> interior
    // _flame -> flame
    if (n.endsWith('occ') || n.includes('occluder')) return 'occluder';
    if (n.endsWith('shell')) return 'shell';
    if (n.endsWith('int') || n.endsWith('interior')) return 'interior';
    if (n.endsWith('flame') || n.endsWith('fire')) return 'flame';
    if (n.includes('petalarea') || n.endsWith('petal') || n.includes('petalrange')) return 'petal-area';

    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    if (mats.some((m) => m && flameMaterialNames.has(m.name))) return 'flame';

    return 'shell';
};

// 1-Euro filter: slow motion -> heavier smoothing, fast motion -> responsive.
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

// ???? Utilities ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

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

const getViewportSize = () => {
    const vv = window.visualViewport;
    if (vv?.width && vv?.height) {
        return {
            width: Math.max(1, Math.round(vv.width)),
            height: Math.max(1, Math.round(vv.height)),
        };
    }
    return {
        width: Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1),
        height: Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1),
    };
};

const syncViewportMetrics = () => {
    const { width, height } = getViewportSize();
    document.documentElement.style.setProperty("--app-vw", `${width}px`);
    document.documentElement.style.setProperty("--app-vh", `${height}px`);
};

const cloneJson = (value) => {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
};

const buildImageTargetData = (source) => {
    const imageTargetData = cloneJson(source);
    if (imageTargetData.resources?.luminanceImage) {
        imageTargetData.imagePath = `./assets/targets/000-top/${imageTargetData.resources.luminanceImage}`;
    }
    imageTargetData.physicalWidthInMeters = PAINTING_WIDTH_M;
    if (imageTargetData.properties) {
        imageTargetData.properties.physicalWidthInMeters = PAINTING_WIDTH_M;
    } else {
        imageTargetData.properties = { physicalWidthInMeters: PAINTING_WIDTH_M };
    }
    return imageTargetData;
};

const warmStaticAsset = async (url) => {
    const response = await fetch(url, { cache: "force-cache" });
    if (!response.ok) {
        throw new Error(`Warmup failed for ${url} (HTTP ${response.status})`);
    }
    return response;
};

const preloadTargetData = () => {
    if (preloadedTargetDataPromise) return preloadedTargetDataPromise;
    preloadedTargetDataPromise = withTimeout(fetch(targetDataUrl, { cache: "force-cache" }), TARGET_FETCH_TIMEOUT_MS, "image target preload")
        .then(async (targetRes) => {
            if (!targetRes.ok) {
                throw new Error(`Image target JSON not found (HTTP ${targetRes.status}). Run scripts/gen-target.mjs first.`);
            }
            return targetRes.json();
        })
        .catch((error) => {
            preloadedTargetDataPromise = null;
            throw error;
        });
    return preloadedTargetDataPromise;
};

const warmAssetCache = () => {
    if (assetWarmupPromise) return assetWarmupPromise;
    assetWarmupPromise = Promise.allSettled([
        warmStaticAsset(boxModelUrl),
        warmStaticAsset(introModelUrl),
        warmStaticAsset(resolvedFlameGifUrlString),
        warmStaticAsset(resolvedIntroVideoUrlString),
        ...resolvedPetalUrls.map((url) => warmStaticAsset(url)),
        preloadTargetData(),
    ]);
    return assetWarmupPromise;
};

const invalidateStartAttempt = () => {
    startAttemptToken += 1;
    return startAttemptToken;
};

const throwIfStartCancelled = (token) => {
    if (token !== startAttemptToken) {
        const error = new Error("AR start cancelled");
        error.name = "StartCancelledError";
        throw error;
    }
};

const isDesktopLikeEnvironment = () => {
    const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
    const touchPoints = navigator.maxTouchPoints || 0;
    const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    return !mobileUa && !coarsePointer && touchPoints === 0;
};

const listVideoInputs = async () =>
    (await withTimeout(navigator.mediaDevices.enumerateDevices(), 4000, "enumerateDevices"))
        .filter((device) => device.kind === "videoinput");

const resolvePreferredFacingMode = ({ requestedFacingMode, actualFacingMode, devices }) => {
    if (actualFacingMode === "environment" || actualFacingMode === "user") return actualFacingMode;
    const inferredFacingMode = inferFacingModeFromDevices(devices);
    if (devices.length > 1 && requestedFacingMode === "environment") return "environment";
    return inferredFacingMode;
};

const inferFacingModeFromDevices = (devices) => {
    if (devices.length <= 1) return "user";
    const labels = devices.map((device) => device.label.toLowerCase());
    const backHints = ["back", "rear", "environment", "world", "traseira", "trasera"];
    const frontHints = ["front", "user", "facetime", "selfie"];
    const hasBack = labels.some((label) => backHints.some((hint) => label.includes(hint)));
    const hasFront = labels.some((label) => frontHints.some((hint) => label.includes(hint)));
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
    video.setAttribute("webkit-playsinline", "");
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

const clearXrCameraBootTimer = () => {
    if (!xrCameraBootTimer) return;
    window.clearTimeout(xrCameraBootTimer);
    xrCameraBootTimer = null;
};

const markXrSessionHealthy = () => {
    xrSessionHealthy = true;
    clearXrCameraBootTimer();
    clearPreviewFallbackTimer();
    stopPreviewStream();
};

const scheduleXrCameraBootTimeout = () => {
    clearXrCameraBootTimer();
    xrCameraBootTimer = window.setTimeout(() => {
        xrCameraBootTimer = null;
        if (xrSessionHealthy) return;
        appendDebug("camera: startup timeout");
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
        setStatus("top.statusStartTimeout");
        setState("lost");
        startButton.disabled = false;
        startButton.removeAttribute("aria-busy");
        cleanupXrRuntime({ stopPreview: false, resetModel: false });
        setArPresentationActive(false);
        arCanvas = null;
    }, XR_CAMERA_BOOT_TIMEOUT_MS);
};

const schedulePreviewFallback = () => {
    if (!isDesktopLikeEnvironment()) return;
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
    syncViewportMetrics();
    document.body.classList.add("preview-running");
    const video = ensurePreviewVideo();
    previewStream = await withTimeout(navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            aspectRatio: { ideal: 9 / 16 },
        },
    }), MEDIA_REQUEST_TIMEOUT_MS, "preview getUserMedia");
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
            const stream = await withTimeout(navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    facingMode: { ideal: attempt.facingMode },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    aspectRatio: { ideal: 9 / 16 },
                },
            }), MEDIA_REQUEST_TIMEOUT_MS, `probe ${attempt.facingMode}`);
            const [track] = stream.getVideoTracks();
            const actualFacingMode = track?.getSettings?.().facingMode;
            const devices = await listVideoInputs();
            stream.getTracks().forEach((track) => track.stop());
            preferredFacingMode = resolvePreferredFacingMode({
                requestedFacingMode: attempt.facingMode,
                actualFacingMode,
                devices,
            });
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

// ???? XR8 video ??⑥퐪?管? ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????
// XR8 ??곸럱??<video> ??몃젎 append ??document.body塋딅뛻?뽫벀?용땴繞볃낆돦畑대갊?녕쳥?듯렰
// 若뱀꼱?凉깅럽????끻넼?λ듊歷╈몺?ㅷ쳥?㏃깙埇쎈럽?됭뿥?딇닍欲뀀???// ??MutationObserver ??XR8 ?誘ｋ?video ?袁ㅼ삺??몃뮇俑앸ㅇ痢놅Ⅷ?뱀꽦??밸뀐Ⅵ琉돠?
let xrVideoObserver = null;

const applyXrVideoFullscreen = (video) => {
    // ??뀡??臾뉖틖??낅윴??preview video
    if (video.id === "camera-preview") return;
    syncViewportMetrics();
    video.style.setProperty("position",       "fixed",           "important");
    video.style.setProperty("inset",          "0",               "important");
    video.style.setProperty("width",          "var(--app-vw)",   "important");
    video.style.setProperty("height",         "var(--app-vh)",   "important");
    video.style.setProperty("object-fit",     "cover",           "important");
    video.style.setProperty("z-index",        "29",              "important");
    video.style.setProperty("pointer-events", "none",            "important");
    video.style.setProperty("opacity",        "1",               "important");
    console.log("[top-ar] xr video fullscreen applied:", video);
    appendDebug(`xr-video: ${video.videoWidth || 0}x${video.videoHeight || 0}`);
};

const watchXrVideo = () => {
    // ??귥Ø??썬???ㅸ뿥轅⑹맋??video塋딅뒏R8 ??爰쀨뿥轅⑥몛?臾뉖틖????observer ??룸짉?恝??
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

const hideXrBodyVideos = () => {
    document.querySelectorAll("body > video").forEach((video) => {
        if (video.id === "camera-preview") return;
        video.style.setProperty("opacity", "0", "important");
        video.style.setProperty("visibility", "hidden", "important");
    });
};

const unwatchXrVideo = () => {
    xrVideoObserver?.disconnect();
    xrVideoObserver = null;
};

// ???? XR runtime cleanup ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????

const cleanupXrRuntime = ({ stopPreview = false, resetModel = false } = {}) => {
    unwatchXrVideo();
    clearXrCameraBootTimer();
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
        introTextureDisposers.forEach((d) => d());
        petalTextureDisposers.forEach((d) => d());
        backgroundTextureDisposers.forEach((d) => d());
        gifTextureDisposers = [];
        gifUpdaters = [];
        introTextureDisposers = [];
        petalTextureDisposers = [];
        backgroundTextureDisposers = [];
        introVideoElements = [];
        introFadeMaterials = [];
        introSequence = null;
        petalInstances = [];
        petalGroup = null;
        resetFilters();
        boxModel = null;
        introModel = null;
    }

    xrRunning = false;
};

const runXrSession = (direction) => {
    currentXrCameraDirection = direction;
    xrSessionHealthy = false;
    syncViewportMetrics();
    clearPreviewFallbackTimer();
    scheduleXrCameraBootTimeout();
    appendDebug(`xr run: ${direction}`);
    XR8.addCameraPipelineModules([
        XR8.GlTextureRenderer.pipelineModule(),
        XR8.Threejs.pipelineModule(),
        XR8.XrController.pipelineModule(),
        buildAppModule(),
    ]);

    // ????observer塋딅삗R8 ?誘ｋ?<video> ?袁ㅼ삺??룹꽦??밸뀐Ⅵ?    watchXrVideo();

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
    syncViewportMetrics();
    if (canvas) {
        // XR8 辱됱떓逾?inline style 沃ㅻ끆??canvas ?袁?같?롫챿?룡벴?뤿땱?硫⑹몳??살뫊??쏇렫塋?        // ??setProperty + "important" 畑밸럽???⑥퐪塋딅슖???꾨꺼?숈꼩??쨹?≫맟 inline style
        canvas.style.setProperty("position", "fixed",    "important");
        canvas.style.setProperty("inset",    "0",        "important");
        canvas.style.setProperty("width",    "var(--app-vw)",    "important");
        canvas.style.setProperty("height",   "var(--app-vh)",    "important");
        canvas.style.removeProperty("object-fit");
        canvas.style.removeProperty("object-position");
        canvas.style.removeProperty("background");
        canvas.style.setProperty("opacity",  active ? "1" : "0", "important");
        canvas.style.setProperty("z-index",  active ? "30" : "-1", "important");
    }
    document.body.classList.toggle("ar-running", active);
};

const syncXrViewport = () => {
    const xrScene = XR8?.Threejs?.xrScene?.();
    const renderer = xrScene?.renderer;
    const canvas = arCanvas || document.getElementById("xr8-canvas");
    if (!renderer || !canvas) return;

    syncViewportMetrics();
    const { width: sw, height: sh } = getViewportSize();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.style.setProperty("width", "var(--app-vw)", "important");
    canvas.style.setProperty("height", "var(--app-vh)", "important");
    renderer.setPixelRatio(dpr);
    renderer.setSize(sw, sh, false);
};

// ???? Model loading ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

const loadBoxModel = () =>
    new Promise((resolve, reject) => {
        new GLTFLoader().load(boxModelUrl, resolve, undefined, reject);
    });

const loadIntroModel = () =>
    new Promise((resolve, reject) => {
        new GLTFLoader().load(introModelUrl, resolve, undefined, reject);
    });

const setTextureColorSpace = (texture) => {
    if ("colorSpace" in texture) {
        texture.colorSpace = THREE.SRGBColorSpace;
    } else {
        texture.encoding = THREE.sRGBEncoding;
    }
};

// ???? GIF flame texture ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

const createAnimatedGifTexture = async (src) => {
    // <img> 让浏览器自动解码并播放 GIF 帧；每帧 drawImage 采样到 CanvasTexture
    const img = new Image();
    img.crossOrigin = "anonymous";

    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error(`GIF load failed: ${src}`));
        img.src = src;
    });

    const offscreen = document.createElement("canvas");
    offscreen.width  = img.naturalWidth  || 256;
    offscreen.height = img.naturalHeight || 256;
    const ctx = offscreen.getContext("2d");

    const texture = new THREE.CanvasTexture(offscreen);
    texture.flipY = false;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    setTextureColorSpace(texture);

    return {
        texture,
        update: () => {
            // 每帧把当前 GIF 帧画到 canvas，上传到 GPU
            ctx.clearRect(0, 0, offscreen.width, offscreen.height);
            ctx.drawImage(img, 0, 0);
            texture.needsUpdate = true;
        },
        dispose: () => {
            img.src = "";   // 停止浏览器继续解码
            texture.dispose();
        },
    };
};

const createLoopingVideoTexture = async (src) => {
    const video = document.createElement("video");
    video.src = src;
    video.crossOrigin = "anonymous";
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");

    await new Promise((resolve, reject) => {
        const onLoaded = () => {
            video.removeEventListener("loadeddata", onLoaded);
            video.removeEventListener("error", onError);
            resolve();
        };
        const onError = () => {
            video.removeEventListener("loadeddata", onLoaded);
            video.removeEventListener("error", onError);
            reject(new Error(`Failed to load intro video: ${src}`));
        };
        video.addEventListener("loadeddata", onLoaded, { once: true });
        video.addEventListener("error", onError, { once: true });
        video.load();
    });

    try { await video.play(); } catch (_) {}

    const texture = new THREE.VideoTexture(video);
    texture.flipY = false;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    setTextureColorSpace(texture);

    return {
        video,
        texture,
        update: () => {},
        dispose: () => {
            video.pause();
            video.removeAttribute("src");
            video.load();
            texture.dispose();
        },
    };
};

const loadTexture = (src) =>
    new Promise((resolve, reject) => {
        new THREE.TextureLoader().load(src, resolve, undefined, reject);
    });

const createPetalField = async (model) => {
    const textures = await Promise.all(resolvedPetalUrls.map((url) => loadTexture(url)));
    textures.forEach((texture) => {
        texture.flipY = false;
        texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.minFilter = texture.magFilter = THREE.LinearFilter;
        setTextureColorSpace(texture);
    });

    model.updateMatrixWorld(true);
    let petalHost = null;
    model.traverse((obj) => {
        if (petalHost || !obj.isMesh) return;
        if (getMeshRole(obj) === "petal-area") {
            petalHost = obj;
            return;
        }
    });
    model.traverse((obj) => {
        if (petalHost || !obj.isMesh) return;
        if (normalizeMeshName(obj.name) === "box") petalHost = obj;
    });
    petalHost ||= model;

    let localBounds = null;
    if (petalHost.isMesh && petalHost.geometry) {
        petalHost.geometry.computeBoundingBox?.();
        if (petalHost.geometry.boundingBox) {
            localBounds = petalHost.geometry.boundingBox.clone();
        }
    }
    if (!localBounds) {
        localBounds = new THREE.Box3(
            new THREE.Vector3(-0.5, -0.5, -0.5),
            new THREE.Vector3(0.5, 0.5, 0.5)
        );
    }

    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    localBounds.getSize(size);
    localBounds.getCenter(center);

    const width = Math.max(size.x, 0.18);
    const height = Math.max(size.y, 0.22);
    const depth = Math.max(size.z, 0.12);
    const petalSize = Math.min(width, height) * 0.078;
    const insetX = Math.min(width * 0.09, petalSize * 0.52);
    const insetY = Math.min(height * 0.06, petalSize * 0.45);
    const insetZ = Math.min(depth * 0.1, petalSize * 0.58);

    const group = new THREE.Group();
    group.name = "petal-field";
    group.position.set(0, 0, 0);

    const geometry = new THREE.PlaneGeometry(petalSize, petalSize);
    const xMin = localBounds.min.x + insetX;
    const xMax = localBounds.max.x - insetX;
    const yMin = localBounds.min.y + insetY;
    const yMax = localBounds.max.y - insetY;
    const zMin = localBounds.min.z + insetZ;
    const zMax = localBounds.max.z - insetZ;
    const petalCount = PETAL_COUNT_MIN + Math.floor(Math.random() * (PETAL_COUNT_MAX - PETAL_COUNT_MIN + 1));
    const instances = Array.from({ length: petalCount }, (_, index) => {
        const texture = textures[index % textures.length];
        const randomA = pseudoRandom(index + 1);
        const randomB = pseudoRandom(index + 21);
        const randomC = pseudoRandom(index + 57);
        const randomD = pseudoRandom(index + 103);
        const depthLayer = index % 3;
        const layerDepthFactor = [0.18, 0.5, 0.82][depthLayer];
        const layerScaleFactor = [1.14, 0.92, 0.76][depthLayer];
        const layerOpacityFactor = [0.8, 0.62, 0.42][depthLayer];
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: (0.38 + randomA * 0.12) * layerOpacityFactor,
            alphaTest: 0.0,
            depthWrite: false,
            depthTest: true,
            side: THREE.DoubleSide,
            toneMapped: false,
            premultipliedAlpha: true,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData.arRole = "interior";
        mesh.renderOrder = 6;
        mesh.frustumCulled = false;
        const meshScale = (0.19 + randomA * 0.16) * layerScaleFactor;
        mesh.scale.setScalar(meshScale);
        group.add(mesh);

        const phase = randomB;
        const xAnchor = 0.02 + randomC * 0.96;
        const zAnchor = 0.08 + randomD * 0.84;
        const baseX = THREE.MathUtils.lerp(xMin, xMax, xAnchor);
        const layerZ = THREE.MathUtils.lerp(zMin, zMax, layerDepthFactor);
        const scatterZ = THREE.MathUtils.lerp(-depth * 0.09, depth * 0.09, zAnchor);
        const baseZ = THREE.MathUtils.clamp(layerZ + scatterZ, zMin, zMax);
        return {
            mesh,
            material,
            meshScale,
            minY: yMin,
            maxY: yMax,
            baseX,
            baseZ,
            driftAmplitudeX: width * (0.03 + randomB * 0.07),
            driftAmplitudeZ: depth * (0.024 + randomC * 0.065),
            driftFrequency: 0.28 + randomD * 0.42,
            windAmplitudeX: width * (0.008 + randomA * 0.016),
            windAmplitudeZ: depth * (0.008 + randomB * 0.015),
            windFrequencyX: 0.08 + randomC * 0.09,
            windFrequencyZ: 0.08 + randomD * 0.08,
            windPhaseX: pseudoRandom(index + 201) * Math.PI * 2,
            windPhaseZ: pseudoRandom(index + 301) * Math.PI * 2,
            spinSpeedX: 0.16 + randomA * 0.32,
            spinSpeedY: 0.22 + randomB * 0.4,
            spinSpeedZ: 0.08 + randomC * 0.22,
            fallSpeed: 0.028 + randomD * 0.032,
            phase,
            baseOpacity: (0.38 + randomA * 0.12) * layerOpacityFactor,
        };
    });

    return {
        group,
        host: petalHost,
        instances,
        dispose: () => {
            geometry.dispose();
            instances.forEach(({ material }) => material.dispose());
            textures.forEach((texture) => texture.dispose());
        },
    };
};

const updatePetalField = () => {
    if (!petalInstances.length) return;
    const now = performance.now() * 0.001;

    petalInstances.forEach((petal) => {
        const t = now * petal.fallSpeed + petal.phase;
        const loopProgress = t - Math.floor(t);
        const fallRange = petal.maxY - petal.minY;
        const fadeIn = THREE.MathUtils.smoothstep(loopProgress, 0.04, 0.28);
        const fadeOut = 1 - THREE.MathUtils.smoothstep(loopProgress, 0.72, 0.98);
        const softPulse = 0.88 + 0.12 * Math.sin(now * 0.46 + petal.phase * Math.PI * 2);
        const fadeEnvelope = Math.pow(Math.max(0, Math.min(1, fadeIn * fadeOut)), 1.15);
        const opacity = fadeEnvelope * petal.baseOpacity * softPulse;
        const driftX = Math.sin(now * petal.driftFrequency + petal.phase * Math.PI * 2) * petal.driftAmplitudeX;
        const driftZ = Math.cos(now * (petal.driftFrequency * 0.8) + petal.phase * Math.PI) * petal.driftAmplitudeZ;
        const windX = Math.sin(now * petal.windFrequencyX + petal.windPhaseX) * petal.windAmplitudeX;
        const windZ = Math.cos(now * petal.windFrequencyZ + petal.windPhaseZ) * petal.windAmplitudeZ;
        petal.mesh.position.x = petal.baseX + driftX + windX;
        petal.mesh.position.y = petal.maxY - loopProgress * fallRange;
        petal.mesh.position.z = petal.baseZ + driftZ + windZ;
        petal.mesh.rotation.x = now * petal.spinSpeedX + petal.phase * Math.PI;
        petal.mesh.rotation.y = now * petal.spinSpeedY + petal.phase * Math.PI * 0.7;
        petal.mesh.rotation.z = now * petal.spinSpeedZ + petal.phase * Math.PI * 1.3;
        petal.material.opacity = opacity;
    });
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
            anim = await createAnimatedGifTexture(resolvedFlameGifUrlString, frameOffset);
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

const attachIntroVideo = async (model) => {
    const introAnim = await createLoopingVideoTexture(resolvedIntroVideoUrlString);
    const fadeMaterials = [];

    model.traverse((obj) => {
        if (!obj.isMesh || !obj.material) return;
        const normalizedName = normalizeMeshName(obj.name);
        const shouldUseIntroVideo = normalizedName.includes("shipinglb")
            || normalizedName.includes("shipin")
            || normalizedName.includes("video");
        if (!shouldUseIntroVideo) return;

        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        const nextMaterials = materials.map(() => {
            const mat = new THREE.MeshBasicMaterial({
                map: introAnim.texture,
                transparent: true,
                opacity: 0,
                side: THREE.DoubleSide,
                depthWrite: false,
                depthTest: true,
                toneMapped: false,
                color: 0xffffff,
            });
            fadeMaterials.push(mat);
            return mat;
        });

        obj.material = Array.isArray(obj.material) ? nextMaterials : nextMaterials[0];
        obj.renderOrder = 8;
        obj.frustumCulled = false;
    });

    return {
        materials: fadeMaterials,
        video: introAnim.video,
        updater: introAnim.update,
        disposer: introAnim.dispose,
    };
};

const attachInteriorBackground = async (model) => {
    const bgTexture = await loadTexture(resolvedInteriorBackgroundUrlString);
    bgTexture.flipY = false;
    bgTexture.wrapS = bgTexture.wrapT = THREE.ClampToEdgeWrapping;
    bgTexture.minFilter = bgTexture.magFilter = THREE.LinearFilter;
    setTextureColorSpace(bgTexture);

    const selected = [];
    model.traverse((obj) => {
        if (selected.length || !obj.isMesh || !obj.material) return;
        if (normalizeMeshName(obj.name) !== "box") return;
        selected.push({ obj });
    });

    selected.forEach(({ obj }) => {
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        const nextMaterials = materials.map((mat) => {
            const nextMat = mat.clone();
            nextMat.map = bgTexture;
            nextMat.transparent = false;
            nextMat.opacity = 1;
            nextMat.color?.set?.("#f2efe6");
            if ("roughness" in nextMat) nextMat.roughness = 1;
            if ("metalness" in nextMat) nextMat.metalness = 0;
            nextMat.needsUpdate = true;
            return nextMat;
        });
        obj.material = Array.isArray(obj.material) ? nextMaterials : nextMaterials[0];
    });

    return {
        dispose: () => bgTexture.dispose(),
        attachedMeshes: selected.map(({ obj }) => obj.name),
    };
};

const applyIntroOpacity = (opacity) => {
    const nextOpacity = Math.max(0, Math.min(1, opacity));
    introFadeMaterials.forEach((mat) => {
        mat.opacity = nextOpacity;
        mat.needsUpdate = true;
    });
    if (introModel) introModel.visible = nextOpacity > 0.001;
};

const syncIntroPoseFromBox = () => {
    if (!introModel || !boxModel) return;
    introModel.position.copy(boxModel.position);
    introModel.quaternion.copy(boxModel.quaternion);
    introModel.scale.copy(boxModel.scale);
};

const restartIntroVideo = () => {
    introVideoElements.forEach((video) => {
        try {
            video.currentTime = 0;
            video.play();
        } catch (_) {}
    });
};

const pauseModelAnimations = () => {
    if (!mixer || mixerActions.length === 0) return;
    mixerActions.forEach((action) => {
        action.paused = true;
    });
    clock.stop();
};

const playModelAnimations = ({ restart = false } = {}) => {
    if (!mixer || mixerActions.length === 0) return;
    clock.start();
    mixerActions.forEach((action) => {
        action.enabled = true;
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.clampWhenFinished = false;
        action.setEffectiveTimeScale(1);
        action.setEffectiveWeight(1);
        action.paused = false;
        if (restart) {
            action.reset();
            action.play();
            return;
        }
        if (!action.isRunning()) action.play();
    });
};

const beginIntroSequence = () => {
    if (!introModel) return false;
    introSequence = {
        startedAt: performance.now(),
        fadeInMs: INTRO_FADE_IN_MS,
        fadeOutMs: INTRO_FADE_OUT_MS,
        boxPlaybackStarted: false,
    };
    restartIntroVideo();
    applyIntroOpacity(0);
    introModel.visible = true;
    if (boxModel) {
        boxModel.visible = false;
        setModelOpacity(0);
    }
    pauseModelAnimations();
    return true;
};

const ensureBoxPlaybackStarted = () => {
    if (!introSequence || introSequence.boxPlaybackStarted) return;
    introSequence.boxPlaybackStarted = true;
    playModelAnimations({ restart: true });
};

const finishIntroSequence = () => {
    introSequence = null;
    applyIntroOpacity(0);
    if (introModel) introModel.visible = false;
    if (boxModel) {
        boxModel.visible = true;
        setModelOpacity(1);
    }
    playModelAnimations({ restart: true });
};

const updateIntroSequence = () => {
    if (!introSequence || !introModel) return;

    const elapsed = performance.now() - introSequence.startedAt;
    if (elapsed <= introSequence.fadeInMs) {
        if (boxModel) {
            boxModel.visible = false;
            setModelOpacity(0);
        }
        applyIntroOpacity(elapsed / introSequence.fadeInMs);
        return;
    }

    const fadeOutElapsed = elapsed - introSequence.fadeInMs;
    if (fadeOutElapsed <= introSequence.fadeOutMs) {
        const fadeProgress = fadeOutElapsed / introSequence.fadeOutMs;
        applyIntroOpacity(1 - fadeProgress);
        if (boxModel) {
            boxModel.visible = true;
            setModelOpacity(fadeProgress);
        }
        ensureBoxPlaybackStarted();
        return;
    }

    finishIntroSequence();
};

// ???? Depth / render order ??????????????????????????????????????????????????????????????????????????????????????????????????????????????

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
            const originalOpacity = mat.opacity ?? 1;
            const originalTransparent = Boolean(mat.transparent) || originalOpacity < 0.999;
            nextMat.userData = {
                ...(nextMat.userData || {}),
                originalOpacity,
                originalTransparent,
            };
            if (role === "occluder") {
                obj.userData.isOccluder = true;
                obj.frustumCulled = false;
                nextMat.colorWrite = false;
                nextMat.depthWrite = true;
                nextMat.depthTest = true;
                nextMat.transparent = false;
                nextMat.opacity = 1;
            } else if (role === "petal-area") {
                obj.frustumCulled = false;
                nextMat.colorWrite = false;
                nextMat.depthWrite = false;
                nextMat.depthTest = false;
                nextMat.transparent = true;
                nextMat.opacity = 0;
            } else if (role === "shell") {
                nextMat.depthTest = true;
                if (nextMat.color && normalizeMeshName(obj.name).startsWith("box")) {
                    nextMat.color.lerp(new THREE.Color("#667379"), 0.42);
                }
                if ("roughness" in nextMat) nextMat.roughness = Math.min(1, (nextMat.roughness ?? 0.8) + 0.12);
                if ("metalness" in nextMat) nextMat.metalness = Math.max(0, (nextMat.metalness ?? 0) * 0.35);
            } else if (role === "interior" || role === "flame") {
                obj.frustumCulled = false;
                nextMat.depthTest = true;
                if (role === "interior" && nextMat.color) {
                    nextMat.color.lerp(new THREE.Color("#b6b0a2"), 0.24);
                }
                if (role === "interior") {
                    nextMat.transparent = originalTransparent;
                    nextMat.opacity = originalOpacity;
                }
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

        const renderOrders = { occluder: 1, shell: 2, interior: 3, flame: 4, "petal-area": 0 };
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
            const originalOpacity = mat.userData?.originalOpacity ?? 1;
            const originalTransparent = mat.userData?.originalTransparent ?? (originalOpacity < 0.999);
            if (role === "occluder") {
                mat.colorWrite = false; mat.depthWrite = true;
                mat.depthTest = true; mat.transparent = false; mat.opacity = 1;
            } else {
                if (role === "flame") {
                    mat.depthTest = true; mat.transparent = true;
                    mat.depthWrite = false;
                    mat.alphaTest = Math.max(mat.alphaTest ?? 0, 0.005);
                }
                if (role === "interior") {
                    mat.transparent = originalTransparent;
                    mat.opacity = originalOpacity * opacity;
                } else {
                    mat.opacity = opacity;
                }
            }
            mat.needsUpdate = true;
        });
    });
};

// ???? Pose application with 1-Euro smoothing ??????????????????????????????????????????????????????????????????????????
// boxModel is an anchor group child equivalent: placed at image center with offset.
// The offset is in image-local space (1 unit = image width).
const _offsetVec = new THREE.Vector3();
const _tmpPos = new THREE.Vector3();

const applyPose = (detail) => {
    if (!boxModel) return;
    const { position, rotation, scale } = detail;
    const t = performance.now();

    // ???? 俑앸씤?곁쳥??닋耀?1-Euro ????????????????????????????????????????????????????????????????????????????????????????????????????????????
    const sx = fPos.x.filter(position.x, t);
    const sy = fPos.y.filter(position.y, t);
    const sz = fPos.z.filter(position.z, t);
    const sScale = fScale.filter(scale, t);

    // ???? ??⑥돩塋딆떑??猿낅퉲??쉫類??쏆뿶癲?+ 癲뉖ㅇ???1-Euro + 鶯ㅻ????+ adaptive slerp ????????????????
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

    // ???? ?琉밤럦塋딅뒡mage-local 癲⑤툍肉당쳥?れ돶??⑥돩耀붡껊뙀鼇앸쉥釉ｏ┬釉낅였塋딅맍???????????????????????????????????????????????????????????
    _offsetVec.set(0, MODEL_OFFSET_Y * sScale, MODEL_OFFSET_Z * sScale).applyQuaternion(boxModel.quaternion);
    _tmpPos.set(sx + _offsetVec.x, sy + _offsetVec.y, sz + _offsetVec.z);

    if (boxModel.position.distanceToSquared(_tmpPos) > POSITION_DEADBAND * POSITION_DEADBAND) {
        boxModel.position.copy(_tmpPos);
    }

    const targetScale = sScale * MODEL_SCALE_MULTIPLIER;
    if (Math.abs(boxModel.scale.x - targetScale) > SCALE_DEADBAND) {
        boxModel.scale.setScalar(targetScale);
    }
    syncIntroPoseFromBox();
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
    syncIntroPoseFromBox();
    _lastQ = { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w };
    resetFilters();
    // Seed filters with initial position to avoid pull-to-zero on first frame
    const t = performance.now();
    fPos.x.filter(position.x, t); fPos.y.filter(position.y, t); fPos.z.filter(position.z, t);
    fScale.filter(scale, t);
    fQ.x.filter(rotation.x, t); fQ.y.filter(rotation.y, t);
    fQ.z.filter(rotation.z, t); fQ.w.filter(rotation.w, t);
};

// ???? XR8 pipeline ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

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
            clearXrCameraBootTimer();
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

        syncXrViewport();
        hideXrBodyVideos();


        scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbff, 0.6));
        const dir = new THREE.DirectionalLight(0xffffff, 0.5);
        dir.position.set(0, 2, 1.5);
        scene.add(dir);
        if (ENABLE_INTRO_SEQUENCE && introModel) scene.add(introModel);
        scene.add(boxModel);

        // Debug
        const cv = arCanvas;
        const dbg = `onStart OK | buf:${cv?.width}x${cv?.height} css:${cv?.clientWidth}x${cv?.clientHeight} ar:${document.body.classList.contains("ar-running")}`;
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
                const startedIntro = ENABLE_INTRO_SEQUENCE ? beginIntroSequence() : false;
                if (!startedIntro) {
                    boxModel.visible = true;
                    setModelOpacity(1);
                    playModelAnimations({ restart: true });
                }
                setState("found");
                setStatus("top.statusFound");

                // ???? ?λ끀?썹삜猿뉗틞 ????????????????????????????????????????????????????????????????????????????????????????????????????
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
                introSequence = null;
                applyIntroOpacity(0);
                if (introModel) introModel.visible = false;
                pauseModelAnimations();
                resetFilters();

                // ???? ?λ끀?썹삜猿뉗틞 ????????????????????????????????????????????????????????????????????????????????????????????????????
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
        if (ENABLE_INTRO_SEQUENCE) updateIntroSequence();
        updatePetalField();
        gifUpdaters.forEach((fn) => fn());
        if (mixer && clock.running) mixer.update(clock.getDelta());
    },
});

// ???? Start / Stop ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

const startMindAR = async () => {
    clearDebug();
    syncViewportMetrics();
    const startToken = invalidateStartAttempt();

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
    throwIfStartCancelled(startToken);

    try {
        if (isDesktopLikeEnvironment()) {
            preferredFacingMode = "user";
            xrSessionHealthy = false;
            clearPreviewFallbackTimer();
            await startPreviewStream(preferredFacingMode);
            throwIfStartCancelled(startToken);
            appendDebug("mode: desktop-preview");
            setPreviewPresentationActive(true);
            setArPresentationActive(false);
            setState("scanning");
            setStatus("top.statusDesktopPreview");
            startButton.removeAttribute("aria-busy");
            return;
        }

        const xrCameraDirection = await probeCameraDirection();
        throwIfStartCancelled(startToken);
        appendDebug(`xr camera: ${xrCameraDirection}`);
        xrRetryDirections = [xrCameraDirection === "BACK" ? "FRONT" : "BACK"];
        xrRetryInFlight = false;
        xrSessionHealthy = false;
        clearPreviewFallbackTimer();
        stopPreviewStream();

        const xrReadyPromise = window.XR8
            ? Promise.resolve()
            : withTimeout(
                new Promise((resolve) => window.addEventListener("xrloaded", resolve, { once: true })),
                12000,
                "xrloaded"
            );
        const targetDataPromise = preloadTargetData().then(buildImageTargetData);

        // Load model + GIF before XR8 starts
        const gltf = await withTimeout(loadBoxModel(), 25000, "loadBoxModel");
        throwIfStartCancelled(startToken);
        boxModel = gltf.scene;
        boxModel.visible = false;
        introModel = null;

        const { updaters, disposers } = await attachExternalFlameGif(boxModel);
        throwIfStartCancelled(startToken);
        gifUpdaters = updaters;
        gifTextureDisposers = disposers;
        const interiorBackground = await attachInteriorBackground(boxModel);
        throwIfStartCancelled(startToken);
        backgroundTextureDisposers = [interiorBackground.dispose];
        console.info("[top-ar] interior background attached to:", interiorBackground.attachedMeshes);
        introFadeMaterials = [];
        introVideoElements = [];
        introTextureDisposers = [];
        const petalField = await createPetalField(boxModel);
        throwIfStartCancelled(startToken);
        petalGroup = petalField.group;
        petalInstances = petalField.instances;
        petalTextureDisposers = [petalField.dispose];
        petalField.host.add(petalGroup);
        configureModelRendering(boxModel);

        if (gltf.animations?.length > 0) {
            mixer = new THREE.AnimationMixer(boxModel);
            mixerActions = gltf.animations.map((clip) => {
                const action = mixer.clipAction(clip);
                action.loop = THREE.LoopOnce;   // 播一次，停在最后一帧
                action.clampWhenFinished = true;
                action.setLoop(THREE.LoopRepeat, Infinity);
                action.loop = THREE.LoopRepeat;
                action.clampWhenFinished = false;
                action.enabled = true;
                return action;
            });
            mixerActions.forEach((action) => {
                action.reset();
                action.enabled = true;
                action.setLoop(THREE.LoopRepeat, Infinity);
                action.clampWhenFinished = false;
                action.setEffectiveTimeScale(1);
                action.setEffectiveWeight(1);
                action.play();
                action.paused = true;
            });
        }

        // Fetch compiled image target data
        setStatus("top.statusLoadingEngine");
        const [imageTargetData] = await Promise.all([
            targetDataPromise,
            xrReadyPromise,
        ]);
        throwIfStartCancelled(startToken);

        // Canvas is statically in the HTML with proper viewport dimensions.
        // Switch from opacity:0 ??opacity:1 (never use display:none ??that
        // makes iOS Safari create a 0?? WebGL context ??"No valid session manager").
        arCanvas = document.getElementById("xr8-canvas");
        if (!arCanvas) throw new Error("xr8-canvas not found.");
        setArPresentationActive(true);

        // iOS 13+: motion permission must be requested from a user gesture
        if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
            try { await DeviceMotionEvent.requestPermission(); } catch (_) { /* user declined, continue */ }
        }

        throwIfStartCancelled(startToken);
        if (!window.XR8) {
            throw new Error("XR8 failed to load.");
        }

        // configure() can only be called BEFORE the very first XR8.run() ??        // it throws if called after run() even after stop().  So we call it
        // exactly once per page load and rely on XR8 remembering the data.
        if (!xr8Configured) {
            XR8.XrController.configure({
                disableWorldTracking: false,
                imageTargetData: [imageTargetData],
            });
            xr8Configured = true;
        }

        // FullWindowCanvas is deprecated in R13.1 and tries to load a chunk
        // that doesn't exist in our self-hosted build ??skip it entirely.
        // Canvas is already fixed 100vw??00vh via inline styles, so XR8
        // can fill it without the module.
        throwIfStartCancelled(startToken);
        runXrSession(xrCameraDirection);

    } catch (error) {
        if (error?.name === "StartCancelledError") {
            appendDebug("start cancelled");
            return;
        }
        console.error("AR start failed:", error);
        clearPreviewFallbackTimer();
        xrSessionHealthy = false;
        showDebug([
            `protocol: ${window.location.protocol}`,
            `secureContext: ${String(window.isSecureContext)}`,
            `error: ${formatError(error)}`,
        ].join("\n"));
        if (isDesktopLikeEnvironment()) {
            try {
                await startPreviewStream(preferredFacingMode);
            } catch (previewError) {
                appendDebug(`preview failed: ${formatError(previewError)}`);
            }
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
    invalidateStartAttempt();
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

// ???? Modal & locale ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

const closeCameraModal = () => {
    invalidateStartAttempt();
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
    syncViewportMetrics();
    refreshLocalizedUi();
    setState("scanning");
    setStatus("top.statusIdle");
    if ("requestIdleCallback" in window) {
        window.requestIdleCallback(() => { warmAssetCache().catch(() => {}); }, { timeout: 1500 });
    } else {
        window.setTimeout(() => { warmAssetCache().catch(() => {}); }, 300);
    }
};

const handleViewportChange = () => {
    syncViewportMetrics();
    if (xrRunning) syncXrViewport();
};

const handlePageHidden = () => {
    if (document.visibilityState && document.visibilityState !== "hidden") return;
    if (cameraModal.hidden && !xrRunning && !previewStream) return;
    closeCameraModal();
};

const handlePageVisible = () => {
    syncViewportMetrics();
    if (xrRunning) {
        window.setTimeout(() => syncXrViewport(), 60);
    }
};

// ???? Event wiring ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

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
window.addEventListener("pagehide", handlePageHidden);
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") handlePageHidden();
    else handlePageVisible();
});
window.addEventListener("resize", handleViewportChange);
window.addEventListener("orientationchange", handleViewportChange);
window.visualViewport?.addEventListener("resize", handleViewportChange);
window.visualViewport?.addEventListener("scroll", handleViewportChange);

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
