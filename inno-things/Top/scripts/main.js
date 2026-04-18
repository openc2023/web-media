import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MindARThree } from "mindar-image-three";
import { createI18n } from "../../i18n/index.js";

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

let mindarThree = null;
let anchor = null;
let boxModel = null;
let mixer = null;
let mixerActions = [];
let lostTimer = null;          // 模块级：stopMindAR 可以安全取消
let currentState = "scanning";
let currentStatusKey = "top.statusIdle";
let currentStatusVars = {};
const clock = new THREE.Clock(false);
const imageTargetSrc = "./assets/targets/000-top.mind";

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
    if (cameraStatus) {
        cameraStatus.textContent = t(currentStatusKey, currentStatusVars);
    }
};

const setStatus = (key, vars = {}) => {
    currentStatusKey = key;
    currentStatusVars = vars;
    renderStatus();
};

const BADGE_COPY = {
    loading: { dot: "#888", key: "top.badgeLoading" },
    scanning: { dot: "#00ed64", key: "top.badgeScanning" },
    found: { dot: "#00ff88", key: "top.badgeFound" },
    lost: { dot: "#ffaa00", key: "top.badgeLost" },
};

const setState = (state) => {
    currentState = state;
    cameraShell.dataset.state = state;

    const badge = BADGE_COPY[state] || BADGE_COPY.scanning;
    scanBadgeText.textContent = t(badge.key);

    const dot = scanBadge.querySelector(".scan-badge-dot");
    if (dot) {
        dot.style.background = badge.dot;
    }
};

// 强制重启扫描 UI 的 CSS 动画（每次打开弹窗从第 0 帧开始）
const restartScanAnimations = () => {
    const els = cameraModal.querySelectorAll(
        ".scan-line, .camera-target-frame, .scan-badge-dot"
    );
    els.forEach((el) => {
        el.style.animationName = "none";
        void el.offsetWidth;          // 触发 reflow，让浏览器"忘记"当前帧
        el.style.animationName = "";  // 恢复 CSS 定义的动画名，从头播放
    });
};


const loadBoxModel = () =>
    new Promise((resolve, reject) => {
        new GLTFLoader().load(
            "./assets/3d/gltf/box.glb",
            (gltf) => resolve(gltf),
            undefined,
            reject
        );
    });

// ── GIF 动图贴图支持 ───────────────────────────────────────
// GLTFLoader 把内嵌 GIF 解析成 HTMLImageElement（只有第一帧）
// 把它替换成 CanvasTexture，每帧 drawImage 让浏览器渲染当前帧
const buildGifTextureUpdaters = (model) => {
    const updaters = [];
    const SLOTS = ["map", "emissiveMap", "alphaMap", "roughnessMap", "metalnessMap"];

    model.traverse((obj) => {
        if (!obj.isMesh) return;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];

        mats.forEach((mat) => {
            SLOTS.forEach((slot) => {
                const tex = mat[slot];
                if (!tex || !(tex.image instanceof HTMLImageElement)) return;

                const img = tex.image;
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");

                // 初始化 canvas 尺寸（图片可能还未 load 完）
                const initSize = () => {
                    if (canvas.width === 0 && img.naturalWidth > 0) {
                        canvas.width  = img.naturalWidth;
                        canvas.height = img.naturalHeight;
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                    }
                };
                if (img.complete) initSize();
                else img.addEventListener("load", initSize, { once: true });

                // 继承原纹理属性
                const canvasTex = new THREE.CanvasTexture(canvas);
                canvasTex.flipY    = tex.flipY;
                canvasTex.wrapS    = tex.wrapS;
                canvasTex.wrapT    = tex.wrapT;
                canvasTex.encoding = tex.encoding;
                mat[slot] = canvasTex;
                mat.needsUpdate = true;

                // 保留原材质透明设置
                mat.transparent = true;
                mat.alphaTest   = mat.alphaTest ?? 0;

                // 每帧调用：先清空再 drawImage，保留 GIF 透明通道
                updaters.push(() => {
                    initSize();
                    if (canvas.width > 0 && canvas.height > 0) {
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        canvasTex.needsUpdate = true;
                    }
                });
            });
        });
    });

    return updaters;
};

const setupMindAR = async () => {
    arContainer.innerHTML = "";

    mindarThree = new MindARThree({
        container: arContainer,
        imageTargetSrc,
        maxTrack: 1,
        warmupTolerance: 5,   // 5帧即触发 found，识别更快
        filterMinCF: 0.0001,  // 静止极度平滑，覆盖手颤噪声
        filterBeta: 90,       // 移动跟手同时保留手颤过滤
        missTolerance: 60,
        // 关闭 MindAR 自带的扫描框/加载/错误覆盖层（我们用自己的 UI）
        uiLoading: "no",
        uiScanning: "no",
        uiError: "no",
    });

    const { renderer, scene } = mindarThree;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1.25));

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(0, 2, 1.5);
    scene.add(directionalLight);

    anchor = mindarThree.addAnchor(0);

    const gltf = await loadBoxModel();
    boxModel = gltf.scene;
    boxModel.position.set(0, 0.38, 0.12);
    boxModel.scale.set(0.18, 0.18, 0.18);
    boxModel.visible = false;

    // 扫描模型所有贴图，把 GIF 贴图替换成可逐帧更新的 CanvasTexture
    const gifUpdaters = buildGifTextureUpdaters(boxModel);

    // ── Smooth proxy ──────────────────────────────────────
    // Model lives in smoothProxy (scene-level group) rather than directly
    // in anchor.group. Each frame we lerp/slerp smoothProxy toward the
    // anchor's world transform, eliminating frame-to-frame jitter.
    const smoothProxy = new THREE.Group();
    scene.add(smoothProxy);
    smoothProxy.add(boxModel);

    // Reusable decompose targets (avoid per-frame allocations)
    const _lerpPos   = new THREE.Vector3();
    const _lerpQuat  = new THREE.Quaternion();
    const _lerpScale = new THREE.Vector3();

    // ── 自适应 lerp 参数 ───────────────────────────────────
    // 距离目标近（静止）→ alpha 接近 1.0（锁死）
    // 距离目标远（运动）→ alpha 降低（平滑追随）
    // SNAP_DIST 以 MindAR 世界单位为准（目标图宽 ≈ 1 unit）
    const SNAP_DIST  = 0.02;   // 手颤死区（小于 filter 噪声范围，避免噪声直透）
    const MIN_ALPHA  = 0.45;   // 移动时最低 alpha，微量平滑

    if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(boxModel);
        mixerActions = gltf.animations.map((clip) => {
            const action = mixer.clipAction(clip);
            action.loop = THREE.LoopRepeat;
            action.clampWhenFinished = false;
            return action;
        });
    }

    const setModelOpacity = (opacity) => {
        boxModel.traverse((object) => {
            if (object.isMesh && object.material) {
                object.material.transparent = true;
                object.material.opacity = opacity;
                object.material.needsUpdate = true;
            }
        });
    };

    anchor.onTargetFound = () => {
        if (lostTimer) {
            clearTimeout(lostTimer);
            lostTimer = null;
        }

        // Snap proxy to current anchor position on first appear (no slide-in lag)
        anchor.group.updateWorldMatrix(true, false);
        anchor.group.matrixWorld.decompose(_lerpPos, _lerpQuat, _lerpScale);
        smoothProxy.position.copy(_lerpPos);
        smoothProxy.quaternion.copy(_lerpQuat);
        smoothProxy.scale.copy(_lerpScale);

        boxModel.visible = true;
        setModelOpacity(1);

        if (mixer && mixerActions.length > 0) {
            clock.start();
            mixerActions.forEach((action) => {
                if (!action.isRunning()) {
                    action.play();
                } else {
                    action.paused = false;
                }
            });
        }

        setState("found");
        setStatus("top.statusFound");
    };

    anchor.onTargetLost = () => {
        setState("lost");
        setStatus("top.statusLost");

        if (mixer) {
            mixerActions.forEach((action) => {
                action.paused = true;
            });
            clock.stop();
        }

        lostTimer = window.setTimeout(() => {
            setModelOpacity(0);
            boxModel.visible = false;
            lostTimer = null;
        }, 800);
    };

    renderer.setClearColor(0x000000, 0);

    // Return a factory for the animation loop so startMindAR can call it
    // after mindarThree.start() (when renderer & camera are ready).
    return (camera) => {
        renderer.setAnimationLoop(() => {
            // ── Smooth proxy update（自适应 lerp） ────────────────
            if (boxModel.visible) {
                anchor.group.updateWorldMatrix(true, false);
                anchor.group.matrixWorld.decompose(_lerpPos, _lerpQuat, _lerpScale);

                // 根据当前偏移距离动态计算 alpha：
                //   静止（偏移小）→ alpha → 1.0，模型锁死在目标上
                //   运动（偏移大）→ alpha 降低，过渡平滑不跳变
                const posDist = smoothProxy.position.distanceTo(_lerpPos);
                const alpha = posDist < SNAP_DIST
                    ? 1.0
                    : Math.max(MIN_ALPHA, SNAP_DIST / posDist);

                smoothProxy.position.lerp(_lerpPos, alpha);
                smoothProxy.quaternion.slerp(_lerpQuat, alpha);
                smoothProxy.scale.copy(_lerpScale);
            }
            // ── GIF 贴图逐帧更新 ───────────────────────────────────
            if (gifUpdaters.length > 0) {
                gifUpdaters.forEach((fn) => fn());
            }
            // ── Animation mixer ────────────────────────────────────
            if (mixer && clock.running) {
                mixer.update(clock.getDelta());
            }
            renderer.render(scene, camera);
        });
    };
};

const startMindAR = async () => {
    clearDebug();

    if (window.location.protocol === "file:") {
        setStatus("top.statusNeedHttps");
        return;
    }

    if (!window.isSecureContext) {
        setStatus("top.statusNeedSecureContext");
        return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("top.statusNoCameraSupport");
        return;
    }

    cameraModal.hidden = false;
    document.body.classList.add("camera-open");
    // 每次打开都重置扫描动画到第 0 帧，消除"扫描残留"
    restartScanAnimations();
    startButton.disabled = true;
    startButton.setAttribute("aria-busy", "true");
    setState("loading");
    setStatus("top.statusLoadingEngine");

    // 焦点移入弹窗（无障碍 + 键盘用户）
    requestAnimationFrame(() => closeButton.focus());

    await new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
    });

    try {
        // setupMindAR returns startLoop(camera) — call it after mindarThree.start()
        const startLoop = await withTimeout(setupMindAR(), 25000, "setupMindAR");

        setState("scanning");
        setStatus("top.statusCameraReady");

        await withTimeout(mindarThree.start(), 20000, "mindarThree.start");

        const { renderer, camera } = mindarThree;
        const videoElement = arContainer.querySelector("video");

        if (videoElement) {
            Object.assign(videoElement.style, {
                position: "absolute",
                inset: "0",
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                zIndex: "0",
            });
        }

        if (renderer.domElement) {
            renderer.domElement.style.zIndex = "1";
        }

        startButton.removeAttribute("aria-busy");

        // Start the smoothed render loop (lerp + mixer + render)
        startLoop(camera);
    } catch (error) {
        console.error("MindAR start failed:", error);
        showDebug([
            `protocol: ${window.location.protocol}`,
            `secureContext: ${String(window.isSecureContext)}`,
            `userAgent: ${navigator.userAgent}`,
            `error: ${formatError(error)}`,
        ].join("\n"));

        const name = error?.name ?? "";
        if (name === "NotAllowedError") {
            setStatus("top.statusPermissionDenied");
        } else if (name === "NotReadableError") {
            setStatus("top.statusCameraBusy");
        } else if (name === "AbortError") {
            setStatus("top.statusCameraAborted");
        } else if (error?.message?.includes("000-top.mind")) {
            setStatus("top.statusMindMissing");
        } else if (error?.message?.includes("timeout")) {
            setStatus("top.statusStartTimeout");
        } else {
            setStatus("top.statusStartFailed", { message: error?.message ?? "Unknown error" });
        }

        mindarThree = null;
        anchor = null;
        boxModel = null;
        startButton.disabled = false;
        startButton.removeAttribute("aria-busy");
    }
};

const stopMindAR = () => {
    // 先取消 lostTimer，防止它在 boxModel 已置 null 后触发 → 崩溃
    if (lostTimer) {
        clearTimeout(lostTimer);
        lostTimer = null;
    }

    if (!mindarThree) return;

    try {
        mindarThree.renderer.setAnimationLoop(null);
        mindarThree.stop();
    } catch (_) {
        // ignore
    }

    if (mixer) {
        mixer.stopAllAction();
        mixer.uncacheRoot(boxModel);
        mixer = null;
    }

    mixerActions = [];
    clock.stop();
    mindarThree = null;
    anchor = null;
    boxModel = null;

    // 清理 MindAR 可能挂到 body 上的残留覆盖层
    document.querySelectorAll(
        ".mindar-ui-overlay, .mindar-ui-loading, .mindar-ui-scanning, .mindar-ui-error"
    ).forEach((el) => el.remove());
};

const closeCameraModal = () => {
    cameraModal.hidden = true;
    document.body.classList.remove("camera-open");
    stopMindAR();
    arContainer.innerHTML = "";
    startButton.disabled = false;
    startButton.removeAttribute("aria-busy");
    setState("scanning");
    setStatus("top.statusIdle");
    // 焦点还原到触发按钮（键盘用户不迷失）
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

startButton.addEventListener("click", startMindAR);
closeButton.addEventListener("click", closeCameraModal);
localeButtons.forEach((button) => {
    button.addEventListener("click", () => {
        i18n.setLocale(button.dataset.locale);
        // 同步 html[lang]，让浏览器/屏幕阅读器感知语言切换
        document.documentElement.lang = button.dataset.locale;
        refreshLocalizedUi();
    });
});

// 点击遮罩关闭
cameraModal.addEventListener("click", (event) => {
    if (event.target === cameraModal) {
        closeCameraModal();
    }
});

// Escape 键关闭（桌面端体验）
window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !cameraModal.hidden) {
        closeCameraModal();
    }
});

window.addEventListener("beforeunload", stopMindAR);

window.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled rejection:", event.reason);
    showDebug([
        `protocol: ${window.location.protocol}`,
        `secureContext: ${String(window.isSecureContext)}`,
        `unhandledrejection: ${formatError(event.reason)}`,
    ].join("\n"));
});

window.addEventListener("error", (event) => {
    if (!event.message) return;

    console.error("Window error:", event.error || event.message);
    showDebug([
        `protocol: ${window.location.protocol}`,
        `secureContext: ${String(window.isSecureContext)}`,
        `error: ${formatError(event.error || event.message)}`,
    ].join("\n"));
});

initializePageCopy();
