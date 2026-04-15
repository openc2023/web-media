const startButton = document.querySelector("#start-recognition");
const closeButton = document.querySelector("#close-camera");
const cameraModal = document.querySelector("#camera-modal");
const cameraVideo = document.querySelector("#camera-video");
const cameraStatus = document.querySelector("#camera-status");
const cameraTitle = document.querySelector("#camera-title");
const cameraOverlayStatus = document.querySelector("#camera-overlay-status");
const targetImage = document.querySelector("#target-image");
const modelAnchor = document.querySelector("#model-anchor");

let activeStream = null;
let cvReady = false;
let recognitionTimer = null;
let targetFeatures = null;
let lastDetectionAt = 0;

const createOrbDetector = (cv) => {
    if (cv.ORB && typeof cv.ORB.create === "function") {
        return cv.ORB.create(1200);
    }
    return new cv.ORB(1200);
};

const setStatus = (message, title) => {
    cameraStatus.textContent = message;
    cameraOverlayStatus.textContent = message;
    if (title) {
        cameraTitle.textContent = title;
    }
};

const stopCamera = () => {
    if (recognitionTimer) {
        window.clearTimeout(recognitionTimer);
        recognitionTimer = null;
    }
    if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
        activeStream = null;
    }
    cameraVideo.srcObject = null;
    modelAnchor.hidden = true;
};

const closeCameraModal = () => {
    cameraModal.hidden = true;
    document.body.classList.remove("camera-open");
    stopCamera();
    setStatus("识别已关闭，可以重新开始。", "准备启动识别。");
};

const waitForCv = () =>
    new Promise((resolve, reject) => {
        const start = Date.now();
        const check = () => {
            if (window.cv && typeof window.cv.Mat === "function") {
                cvReady = true;
                resolve(window.cv);
                return;
            }
            if (Date.now() - start > 12000) {
                reject(new Error("OpenCV load timeout"));
                return;
            }
            window.setTimeout(check, 100);
        };
        check();
    });

const waitForImage = (img) =>
    new Promise((resolve, reject) => {
        if (img.complete && img.naturalWidth > 0) {
            resolve(img);
            return;
        }
        img.addEventListener("load", () => resolve(img), { once: true });
        img.addEventListener("error", () => reject(new Error("Target image load failed")), { once: true });
    });

const ensureTargetFeatures = async () => {
    if (targetFeatures) {
        return targetFeatures;
    }

    const cv = await waitForCv();
    await waitForImage(targetImage);

    const targetMat = cv.imread(targetImage);
    const targetGray = new cv.Mat();
    cv.cvtColor(targetMat, targetGray, cv.COLOR_RGBA2GRAY);

    const orb = createOrbDetector(cv);
    const keypoints = new cv.KeyPointVector();
    const descriptors = new cv.Mat();
    orb.detectAndCompute(targetGray, new cv.Mat(), keypoints, descriptors);

    targetFeatures = {
        cv,
        orb,
        keypoints,
        descriptors,
        width: targetImage.naturalWidth,
        height: targetImage.naturalHeight
    };

    targetMat.delete();
    targetGray.delete();

    return targetFeatures;
};

const mapVideoPointToStage = (x, y) => {
    const stageRect = cameraVideo.getBoundingClientRect();
    const displayedWidth = stageRect.width;
    const displayedHeight = stageRect.height;
    const videoWidth = cameraVideo.videoWidth;
    const videoHeight = cameraVideo.videoHeight;
    const stageAspect = displayedWidth / displayedHeight;
    const videoAspect = videoWidth / videoHeight;

    let scale;
    let offsetX = 0;
    let offsetY = 0;

    if (videoAspect > stageAspect) {
        scale = displayedHeight / videoHeight;
        offsetX = (videoWidth * scale - displayedWidth) / 2;
    } else {
        scale = displayedWidth / videoWidth;
        offsetY = (videoHeight * scale - displayedHeight) / 2;
    }

    return {
        x: x * scale - offsetX,
        y: y * scale - offsetY
    };
};

const updateModelPlacement = (corners) => {
    const mapped = corners.map((corner) => mapVideoPointToStage(corner.x, corner.y));
    const xs = mapped.map((point) => point.x);
    const ys = mapped.map((point) => point.y);
    const minX = Math.max(Math.min(...xs), 0);
    const maxX = Math.min(Math.max(...xs), cameraVideo.clientWidth);
    const minY = Math.max(Math.min(...ys), 0);
    const maxY = Math.min(Math.max(...ys), cameraVideo.clientHeight);
    const width = Math.max(maxX - minX, 40);
    const height = Math.max(maxY - minY, 40);

    modelAnchor.hidden = false;
    modelAnchor.style.left = `${minX}px`;
    modelAnchor.style.top = `${minY - height * 0.45}px`;
    modelAnchor.style.width = `${width}px`;
    modelAnchor.style.height = `${height * 1.2}px`;
};

const detectTarget = async () => {
    try {
        if (!activeStream || !cvReady || cameraVideo.readyState < 2) {
            recognitionTimer = window.setTimeout(detectTarget, 300);
            return;
        }

        const { cv, orb, keypoints: targetKeypoints, descriptors: targetDescriptors, width, height } = await ensureTargetFeatures();
        const canvas = document.createElement("canvas");
        canvas.width = cameraVideo.videoWidth;
        canvas.height = cameraVideo.videoHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);

        const frameMat = cv.imread(canvas);
        const frameGray = new cv.Mat();
        cv.cvtColor(frameMat, frameGray, cv.COLOR_RGBA2GRAY);

        const frameKeypoints = new cv.KeyPointVector();
        const frameDescriptors = new cv.Mat();
        orb.detectAndCompute(frameGray, new cv.Mat(), frameKeypoints, frameDescriptors);

        if (frameDescriptors.rows >= 4 && targetDescriptors.rows >= 4) {
            const matcher = new cv.BFMatcher(cv.NORM_HAMMING, false);
            const matches = new cv.DMatchVectorVector();
            matcher.knnMatch(targetDescriptors, frameDescriptors, matches, 2);

            const goodMatches = [];
            for (let i = 0; i < matches.size(); i += 1) {
                const pair = matches.get(i);
                if (pair.size() < 2) {
                    pair.delete();
                    continue;
                }
                const m1 = pair.get(0);
                const m2 = pair.get(1);
                if (m1.distance < 0.72 * m2.distance) {
                    goodMatches.push(m1);
                } else {
                    m1.delete();
                }
                m2.delete();
                pair.delete();
            }

            if (goodMatches.length >= 12) {
                const srcPoints = [];
                const dstPoints = [];
                goodMatches.forEach((match) => {
                    const src = targetKeypoints.get(match.queryIdx).pt;
                    const dst = frameKeypoints.get(match.trainIdx).pt;
                    srcPoints.push(src.x, src.y);
                    dstPoints.push(dst.x, dst.y);
                    match.delete();
                });

                const srcMat = cv.matFromArray(goodMatches.length, 1, cv.CV_32FC2, srcPoints);
                const dstMat = cv.matFromArray(goodMatches.length, 1, cv.CV_32FC2, dstPoints);
                const mask = new cv.Mat();
                const homography = cv.findHomography(srcMat, dstMat, cv.RANSAC, 5, mask);

                if (homography && !homography.empty()) {
                    const corners = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, width, 0, width, height, 0, height]);
                    const projected = new cv.Mat();
                    cv.perspectiveTransform(corners, projected, homography);
                    const data = projected.data32F;

                    updateModelPlacement([
                        { x: data[0], y: data[1] },
                        { x: data[2], y: data[3] },
                        { x: data[4], y: data[5] },
                        { x: data[6], y: data[7] }
                    ]);

                    lastDetectionAt = Date.now();
                    setStatus("已识别到目标画作，box 模型已叠加。", "识别成功。");

                    corners.delete();
                    projected.delete();
                } else if (Date.now() - lastDetectionAt > 1200) {
                    modelAnchor.hidden = true;
                    setStatus("正在寻找目标画作，请对准 000-top 画面。", "正在识别画作。");
                }

                srcMat.delete();
                dstMat.delete();
                mask.delete();
                if (homography) {
                    homography.delete();
                }
            } else if (Date.now() - lastDetectionAt > 1200) {
                modelAnchor.hidden = true;
                setStatus("正在寻找目标画作，请对准 000-top 画面。", "正在识别画作。");
            }

            matches.delete();
            matcher.delete();
        }

        frameMat.delete();
        frameGray.delete();
        frameKeypoints.delete();
        frameDescriptors.delete();

        recognitionTimer = window.setTimeout(detectTarget, 280);
    } catch (error) {
        modelAnchor.hidden = true;
        setStatus("识别过程出错，请刷新页面后重试。", "识别暂时不可用。");
    }
};

const startCamera = async () => {
    if (window.location.protocol === "file:") {
        setStatus("不能直接双击本地 HTML 打开相机，请用 HTTPS 页面访问。", "当前无法启动识别。");
        return;
    }

    if (window.isSecureContext === false) {
        setStatus("当前不是安全环境，请改用 HTTPS 或 localhost 打开。", "当前无法启动识别。");
        return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus("当前浏览器不支持摄像头调用。");
        return;
    }

    cameraModal.hidden = false;
    document.body.classList.add("camera-open");
    setStatus("正在启动摄像头...", "正在准备识别。");

    try {
        activeStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: {
                    ideal: "environment"
                }
            },
            audio: false
        });

        cameraVideo.srcObject = activeStream;
        await cameraVideo.play();
        setStatus("摄像头已启动，正在加载识别能力...", "正在准备识别。");
        await ensureTargetFeatures();
        setStatus("摄像头已启动，正在寻找 000-top 画作。", "正在识别画作。");
        detectTarget();
    } catch (error) {
        cameraModal.hidden = false;
        document.body.classList.add("camera-open");

        if (error && error.name === "AbortError") {
            setStatus("摄像头启动被中断，请重新点击开始识别。", "当前无法启动识别。");
            return;
        }

        if (window.isSecureContext === false) {
            setStatus("摄像头需要在 HTTPS 或 localhost 环境下打开。", "当前无法启动识别。");
            return;
        }

        if (error && error.message === "OpenCV load timeout") {
            setStatus("识别库加载失败，请刷新页面后重试。", "当前无法启动识别。");
            return;
        }

        if (error && error.name === "NotAllowedError") {
            setStatus("未获得摄像头权限，请允许浏览器访问相机。", "当前无法启动识别。");
            return;
        }

        if (error && error.name === "NotReadableError") {
            setStatus("摄像头被其他应用占用，先关闭占用相机的程序再试。", "当前无法启动识别。");
            return;
        }

        if (error && error.name === "OverconstrainedError") {
            setStatus("当前设备后置摄像头不可用，建议切到系统浏览器再试。", "当前无法启动识别。");
            return;
        }

        setStatus("摄像头启动失败，请检查设备和浏览器设置。", "当前无法启动识别。");
    }
};

startButton.addEventListener("click", startCamera);
closeButton.addEventListener("click", closeCameraModal);

cameraModal.addEventListener("click", (event) => {
    if (event.target === cameraModal) {
        closeCameraModal();
    }
});

window.addEventListener("beforeunload", stopCamera);
