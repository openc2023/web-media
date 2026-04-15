import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MindARThree } from "mindar-image-three";

const startButton = document.querySelector("#start-recognition");
const closeButton = document.querySelector("#close-camera");
const cameraModal = document.querySelector("#camera-modal");
const arContainer = document.querySelector("#ar-container");
const cameraStatus = document.querySelector("#camera-status");
const cameraTitle = document.querySelector("#camera-title");
const cameraOverlayStatus = document.querySelector("#camera-overlay-status");

let mindarThree = null;
let animationRunning = false;
let anchor = null;
let boxModel = null;
const imageTargetSrc = "./assets/targets/000-top.mind";

const setStatus = (message, title) => {
    cameraStatus.textContent = message;
    cameraOverlayStatus.textContent = message;
    if (title) {
        cameraTitle.textContent = title;
    }
};

const loadBoxModel = async () =>
    new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        loader.load(
            "./assets/3d/gltf/box.glb",
            (gltf) => resolve(gltf),
            undefined,
            (error) => reject(error)
        );
    });

const setupMindAR = async () => {
    try {
        mindarThree = new MindARThree({
            container: arContainer,
            imageTargetSrc,
            maxTrack: 1
        });

        const { renderer, scene, camera } = mindarThree;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1.25);
        scene.add(hemisphereLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
        directionalLight.position.set(0, 2, 1.5);
        scene.add(directionalLight);

        anchor = mindarThree.addAnchor(0);
        const gltf = await loadBoxModel();
        boxModel = gltf.scene;
        boxModel.position.set(0, 0.38, 0.12);
        boxModel.scale.set(0.18, 0.18, 0.18);
        anchor.group.add(boxModel);

        anchor.onTargetFound = () => {
            setStatus("已识别到 000-top，box 已固定到画作上方。", "识别成功。");
        };

        anchor.onTargetLost = () => {
            setStatus("目标暂时离开画面，请重新对准 000-top。", "等待重新识别。");
        };

        return { renderer, scene, camera };
    } catch (error) {
        mindarThree = null;
        anchor = null;
        boxModel = null;
        throw error;
    }
};

const startMindAR = async () => {
    if (window.location.protocol === "file:") {
        setStatus("不能直接双击本地 HTML 运行 MindAR，请用 HTTPS 页面访问。", "当前无法启动识别。");
        return;
    }

    if (window.isSecureContext === false) {
        setStatus("当前不是安全环境，请改用 HTTPS 或 localhost 打开。", "当前无法启动识别。");
        return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus("当前浏览器不支持摄像头调用。", "当前无法启动识别。");
        return;
    }

    cameraModal.hidden = false;
    document.body.classList.add("camera-open");
    setStatus("正在启动 MindAR 相机...", "正在准备识别。");

    try {
        if (!mindarThree) {
            await setupMindAR();
        }

        await mindarThree.start();
        setStatus("摄像头已启动，请对准 000-top 画作。", "正在识别画作。");

        if (!animationRunning) {
            animationRunning = true;
            const { renderer, scene, camera } = mindarThree;
            renderer.setAnimationLoop(() => {
                renderer.render(scene, camera);
            });
        }
    } catch (error) {
        const errorName = error && error.name ? error.name : "";

        if (errorName === "NotAllowedError") {
            setStatus("未获得摄像头权限，请在浏览器里允许相机访问。", "当前无法启动识别。");
            return;
        }

        if (errorName === "NotReadableError") {
            setStatus("摄像头被其他应用占用，关闭后再试。", "当前无法启动识别。");
            return;
        }

        if (error && error.message && error.message.includes("000-top.mind")) {
            setStatus("找不到 000-top.mind，请确认 target 文件已发布到服务器。", "当前无法启动识别。");
            return;
        }

        setStatus("MindAR 启动失败，请刷新页面后重试。", "当前无法启动识别。");
    }
};

const stopMindAR = () => {
    if (!mindarThree) {
        return;
    }

    mindarThree.stop();
    mindarThree.renderer.setAnimationLoop(null);
    animationRunning = false;
};

const closeCameraModal = () => {
    cameraModal.hidden = true;
    document.body.classList.remove("camera-open");
    stopMindAR();
    setStatus("识别已关闭，可以重新开始。", "准备启动识别。");
};

startButton.addEventListener("click", startMindAR);
closeButton.addEventListener("click", closeCameraModal);

cameraModal.addEventListener("click", (event) => {
    if (event.target === cameraModal) {
        closeCameraModal();
    }
});

window.addEventListener("beforeunload", () => {
    stopMindAR();
});
