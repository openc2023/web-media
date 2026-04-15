import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MindARThree } from "mindar-image-three";

// ── DOM refs ──────────────────────────────────────────────
const startButton       = document.querySelector("#start-recognition");
const closeButton       = document.querySelector("#close-camera");
const cameraModal       = document.querySelector("#camera-modal");
const cameraShell       = document.querySelector("#camera-shell");
const arContainer       = document.querySelector("#ar-container");
const cameraStatus      = document.querySelector("#camera-status");
const cameraTitle       = document.querySelector("#camera-title");
const cameraOverlayStatus = document.querySelector("#camera-overlay-status");
const debugLog          = document.querySelector("#debug-log");
const scanBadge         = document.querySelector("#scan-badge");
const scanBadgeText     = document.querySelector("#scan-badge-text");

// ── State ─────────────────────────────────────────────────
let mindarThree    = null;
let animationId    = null;
let anchor         = null;
let boxModel       = null;
const imageTargetSrc = "./assets/targets/000-top.mind";

// ── Helpers ───────────────────────────────────────────────
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
        new Promise((_, reject) =>
            window.setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)
        ),
    ]);

const setStatus = (message, title) => {
    if (cameraStatus)      cameraStatus.textContent      = message;
    if (cameraOverlayStatus) cameraOverlayStatus.textContent = message;
    if (title && cameraTitle) cameraTitle.textContent    = title;
};

// ── 扫描状态 UI ───────────────────────────────────────────
const setState = (state) => {
    // state: 'loading' | 'scanning' | 'found' | 'lost'
    cameraShell.dataset.state = state;

    const badges = {
        loading:  { dot: "#888",    text: "加载中…" },
        scanning: { dot: "#00ed64", text: "扫描中，请对准画作" },
        found:    { dot: "#00ff88", text: "✓ 已识别" },
        lost:     { dot: "#ffaa00", text: "目标离开，请重新对准" },
    };
    const b = badges[state] || badges.scanning;
    scanBadgeText.textContent = b.text;
    scanBadge.querySelector(".scan-badge-dot").style.background = b.dot;
};

// ── 加载 box.glb ──────────────────────────────────────────
const loadBoxModel = () =>
    new Promise((resolve, reject) => {
        new GLTFLoader().load(
            "./assets/3d/gltf/box.glb",
            (gltf) => resolve(gltf),
            undefined,
            reject
        );
    });

// ── 初始化 MindAR ─────────────────────────────────────────
const setupMindAR = async () => {
    arContainer.innerHTML = "";

    mindarThree = new MindARThree({
        container: arContainer,
        imageTargetSrc,
        maxTrack: 1,
        warmupTolerance: 15,   // 更长的暖机期，初始追踪更稳
        filterMinCF: 0.001,    // 静止时极平滑
        filterBeta: 100,       // 低速度系数，减少移动时抖动
        missTolerance: 60,     // 丢失 60 帧才触发 onTargetLost，防止反复闪烁
    });

    // ⚠️ 不调用 setPixelRatio：MindAR 初始化后改 canvas 分辨率会导致
    //    投影矩阵与图像识别坐标错位 → 模型偏移 + 抽动
    const { renderer, scene, camera } = mindarThree;

    // 灯光
    scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1.25));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(0, 2, 1.5);
    scene.add(dirLight);

    // 锚点 + 模型
    anchor = mindarThree.addAnchor(0);

    const gltf = await loadBoxModel();
    boxModel = gltf.scene;
    boxModel.position.set(0, 0.38, 0.12);
    boxModel.scale.set(0.18, 0.18, 0.18);
    boxModel.visible = false;           // ← 初始隐藏，识别到才显示
    anchor.group.add(boxModel);

    // ── 识别回调（用 opacity 软隐藏，避免 visible 切换闪烁）────
    let lostTimer = null;

    const setModelOpacity = (opacity) => {
        boxModel.traverse((obj) => {
            if (obj.isMesh && obj.material) {
                obj.material.transparent = true;
                obj.material.opacity = opacity;
                obj.material.needsUpdate = true;
            }
        });
    };

    anchor.onTargetFound = () => {
        if (lostTimer) { clearTimeout(lostTimer); lostTimer = null; }
        boxModel.visible = true;
        setModelOpacity(1);
        setState("found");
        setStatus("已识别到 000-top，3D 模型已显示。", "识别成功。");
    };

    anchor.onTargetLost = () => {
        setState("lost");
        setStatus("目标暂时离开画面，请重新对准 000-top 画作。", "等待重新识别。");
        // 延迟 800ms 再隐藏，给 missTolerance 后续可能重新找到留余量
        lostTimer = setTimeout(() => {
            setModelOpacity(0);
            boxModel.visible = false;
            lostTimer = null;
        }, 800);
    };
};

// ── 启动 ──────────────────────────────────────────────────
const startMindAR = async () => {
    clearDebug();

    // 环境检查
    if (window.location.protocol === "file:") {
        setStatus("请用 HTTPS 或 localhost 访问，不能直接双击本地 HTML。", "无法启动识别。");
        return;
    }
    if (!window.isSecureContext) {
        setStatus("当前不是安全环境，请改用 HTTPS 或 localhost 打开。", "无法启动识别。");
        return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("当前浏览器不支持摄像头调用。", "无法启动识别。");
        return;
    }

    // 打开 modal
    cameraModal.hidden = false;
    document.body.classList.add("camera-open");
    startButton.disabled = true;
    setState("loading");
    setStatus("正在加载识别引擎，请稍候…", "正在准备识别。");

    // 让浏览器先绘制出 modal，再做重操作
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    try {
        await withTimeout(setupMindAR(), 25000, "setupMindAR");

        setState("scanning");
        setStatus("摄像头已就绪，请将镜头对准 000-top 画作。", "正在识别画作。");

        await withTimeout(mindarThree.start(), 20000, "mindarThree.start");

        // ── 修复黑屏：MindAR canvas 覆盖在 video 上，确保 canvas 透明 + video 可见
        const { renderer, scene, camera } = mindarThree;
        renderer.setClearColor(0x000000, 0);       // canvas 背景全透明，video 透上来

        // 找到 MindAR 注入的 video 元素，强制保证它可见并在 canvas 下方
        const videoEl = arContainer.querySelector("video");
        if (videoEl) {
            Object.assign(videoEl.style, {
                position: "absolute",
                inset: "0",
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                zIndex: "0",
            });
        }
        // canvas 在 video 上方，用透明背景叠加 3D 模型
        if (renderer.domElement) {
            renderer.domElement.style.zIndex = "1";
        }

        renderer.setAnimationLoop(() => renderer.render(scene, camera));

    } catch (error) {
        console.error("MindAR start failed:", error);
        showDebug([
            `protocol: ${window.location.protocol}`,
            `secureContext: ${String(window.isSecureContext)}`,
            `userAgent: ${navigator.userAgent}`,
            `error: ${formatError(error)}`,
        ].join("\n"));

        const name = error?.name ?? "";
        if      (name === "NotAllowedError")  setStatus("未获得摄像头权限，请在浏览器里允许相机访问。", "无法启动识别。");
        else if (name === "NotReadableError") setStatus("摄像头被其他应用占用，关闭后再试。", "无法启动识别。");
        else if (name === "AbortError")       setStatus("相机启动被系统中断，请重新点击开始识别。", "无法启动识别。");
        else if (error?.message?.includes("000-top.mind")) setStatus("找不到 000-top.mind，请确认 target 文件已上传到服务器。", "无法启动识别。");
        else if (error?.message?.includes("timeout"))      setStatus("启动超时，MindAR 初始化或相机握手卡住，请刷新重试。", "无法启动识别。");
        else setStatus(`启动失败：${error?.message ?? "未知错误"}，请刷新后重试。`, "无法启动识别。");

        // 重置，允许重新点击
        mindarThree = null;
        anchor = null;
        boxModel = null;
        startButton.disabled = false;
    }
};

// ── 停止 ──────────────────────────────────────────────────
const stopMindAR = () => {
    if (!mindarThree) return;
    try {
        mindarThree.renderer.setAnimationLoop(null);
        mindarThree.stop();
    } catch (_) { /* ignore */ }
    mindarThree = null;
    anchor      = null;
    boxModel    = null;
};

const closeCameraModal = () => {
    // 清理延迟定时器
    // lostTimer 在 anchor 闭包里，关闭时 anchor 也会销毁，无需单独清
    cameraModal.hidden = true;
    document.body.classList.remove("camera-open");
    stopMindAR();
    arContainer.innerHTML = "";
    startButton.disabled  = false;
    setState("scanning"); // 重置 badge
    setStatus("识别已关闭，可以重新开始。", "准备启动识别。");
};

// ── 事件 ──────────────────────────────────────────────────
startButton.addEventListener("click",  startMindAR);
closeButton.addEventListener("click",  closeCameraModal);

cameraModal.addEventListener("click", (e) => {
    if (e.target === cameraModal) closeCameraModal();
});

window.addEventListener("beforeunload", stopMindAR);

window.addEventListener("unhandledrejection", (e) => {
    console.error("Unhandled rejection:", e.reason);
    showDebug([
        `protocol: ${window.location.protocol}`,
        `secureContext: ${String(window.isSecureContext)}`,
        `unhandledrejection: ${formatError(e.reason)}`,
    ].join("\n"));
});

window.addEventListener("error", (e) => {
    if (!e.message) return;
    console.error("Window error:", e.error || e.message);
    showDebug([
        `protocol: ${window.location.protocol}`,
        `secureContext: ${String(window.isSecureContext)}`,
        `error: ${formatError(e.error || e.message)}`,
    ].join("\n"));
});
