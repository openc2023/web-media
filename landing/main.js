const tiltCard = typeof document !== "undefined" ? document.querySelector("[data-tilt]") : null;
const stage = typeof document !== "undefined" ? document.querySelector("[data-bat-stage]") : null;
const batWrap = typeof document !== "undefined" ? document.querySelector("[data-bat-wrap]") : null;
const codeOutput = typeof document !== "undefined" ? document.querySelector("[data-code-output]") : null;
const codeMeta = typeof document !== "undefined" ? document.querySelector("[data-code-meta]") : null;
const codeStatuses = typeof document !== "undefined" ? [...document.querySelectorAll("[data-code-status], [data-code-status-secondary]")] : [];
const statusText = typeof document !== "undefined" ? document.querySelector("[data-status-text]") : null;
const sceneTitle = typeof document !== "undefined" ? document.querySelector("[data-scene-title]") : null;
const sceneDescription = typeof document !== "undefined" ? document.querySelector("[data-scene-description]") : null;
const sceneLabel = typeof document !== "undefined" ? document.querySelector("[data-scene-label]") : null;
const sceneHeading = typeof document !== "undefined" ? document.querySelector("[data-scene-heading]") : null;
const sceneBody = typeof document !== "undefined" ? document.querySelector("[data-scene-body]") : null;
const scenePoints = typeof document !== "undefined" ? document.querySelector("[data-scene-points]") : null;
const sceneButtons = typeof document !== "undefined" ? [...document.querySelectorAll("[data-scene]")] : [];
const rows = typeof document !== "undefined" ? [...document.querySelectorAll("[data-contact]")] : [];
const actionCards = typeof document !== "undefined" ? [...document.querySelectorAll("[data-action]")] : [];

const scenes = {
    research: {
        label: "Research Scene",
        title: "Research Scene Ready",
        description: "从论文、方向和学术背景进入，再延伸到完整履历页。",
        heading: "把研究方向做成首页的第一入口",
        body: "从动画研究到新媒体艺术实践，先给访客一个明确的进入路径，再引导他们进入完整履历页。",
        points: [
            "论文、学位与研究方向可以继续接入 PDF 与封面。",
            "适合展示中韩双语和跨文化研究背景。",
            "让首页先建立“研究型创作者”的第一印象。"
        ]
    },
    projects: {
        label: "Project Scene",
        title: "Projects Scene Ready",
        description: "把项目、展演和媒介实践做成更快的入口。",
        heading: "把作品入口从“看简历”改成“先逛项目”",
        body: "项目场景更适合快速展示视觉实践、合作经历和媒介输出，访客能更快感受到你做过什么。",
        points: [
            "适合后续接项目封面、视频缩略图和分类标签。",
            "可以把作品分成展览、影像、交互装置与研究合作。",
            "首页就能先传达“能落地执行”的气质。"
        ]
    },
    connect: {
        label: "Contact Scene",
        title: "Contact Scene Ready",
        description: "把联系方式做成可操作模块，而不只是静态文本。",
        heading: "联系信息本身也应该是交互的一部分",
        body: "复制、跳转和联系动作应该直接发生在首页，让访客不用先读完整页才能找到入口。",
        points: [
            "姓名、邮箱和电话都能直接触发反馈。",
            "适合继续接入 WeChat、Instagram 或 PDF CV 下载。",
            "让首页更像工作入口，而不只是展示页。"
        ]
    }
};

const snippets = {
    research: `const scene = {
  mode: "research",
  focus: "home-entry",
  action: "open-profile"
};`,
    projects: `const scene = {
  mode: "projects",
  focus: "selected-works",
  action: "open-project-index"
};`,
    connect: `const scene = {
  mode: "contact",
  focus: "direct-communication",
  action: "copy-or-send"
};`,
    name: `const profile = {
  active: "name",
  value: "\\u7530\\u6c49 / \\ud2f0\\uc564\\ud55c / TIAN HAN",
  action: "copy-to-clipboard"
};`,
    email: `const profile = {
  active: "email",
  value: "angel1993@naver.com",
  action: "copy-to-clipboard"
};`,
    phone: `const profile = {
  active: "phone",
  value: "010-2576-9886",
  action: "copy-to-clipboard"
};`,
    profile: `window.location.href = "/profile/";`,
    archive: `window.location.href = "/profile/#projects";`,
    message: `window.location.href = "mailto:angel1993@naver.com";`
};

const hints = {
    ready: "选择一个场景，或者把鼠标移到右侧卡片上。",
    hover: "预览中，视觉区和代码面板正在联动。",
    focus: "键盘焦点已进入当前模块。",
    copied: "已复制到剪贴板，可以直接粘贴使用。",
    selected: "已选中。当前环境可能不允许写入剪贴板。"
};

const keyToScene = {
    research: "research",
    projects: "projects",
    connect: "connect",
    name: "connect",
    email: "connect",
    phone: "connect",
    profile: "research",
    archive: "projects",
    message: "connect"
};

const state = {
    scene: "research",
    stickyKey: "research"
};

function sceneForKey(key) {
    return keyToScene[key] || "research";
}

function setSceneButtons(sceneKey) {
    sceneButtons.forEach((button) => {
        button.classList.toggle("is-active", button.dataset.scene === sceneKey);
    });
}

function setContactRows(activeKey) {
    rows.forEach((row) => {
        row.classList.toggle("is-active", row.dataset.contact === activeKey);
    });
}

function setActionCards(activeKey) {
    actionCards.forEach((card) => {
        card.classList.toggle("is-active", card.dataset.action === activeKey);
    });
}

function updateScene(sceneKey) {
    const scene = scenes[sceneKey];
    if (!scene) {
        return;
    }

    if (stage) {
        stage.dataset.sceneMode = sceneKey;
    }

    if (sceneTitle) {
        sceneTitle.textContent = scene.title;
    }

    if (sceneDescription) {
        sceneDescription.textContent = scene.description;
    }

    if (sceneLabel) {
        sceneLabel.textContent = scene.label;
    }

    if (sceneHeading) {
        sceneHeading.textContent = scene.heading;
    }

    if (sceneBody) {
        sceneBody.textContent = scene.body;
    }

    if (scenePoints) {
        scenePoints.innerHTML = scene.points.map((item) => `<li>${item}</li>`).join("");
    }

    setSceneButtons(sceneKey);
}

function setCode(key, status = "ready") {
    if (codeOutput && snippets[key]) {
        codeOutput.textContent = snippets[key];
    }

    codeStatuses.forEach((node) => {
        node.textContent = status;
    });

    if (statusText) {
        statusText.textContent = hints[status] || hints.ready;
    }

    if (codeMeta) {
        codeMeta.textContent = `scene: "${sceneForKey(key)}"`;
    }

    setContactRows(rows.some((row) => row.dataset.contact === key) ? key : null);
    setActionCards(actionCards.some((card) => card.dataset.action === key) ? key : null);
}

function previewKey(key, status = "hover") {
    updateScene(sceneForKey(key));
    setCode(key, status);
}

function commitKey(key, status = "selected") {
    state.stickyKey = key;
    state.scene = sceneForKey(key);
    updateScene(state.scene);
    setCode(key, status);
}

function restoreSticky() {
    updateScene(state.scene);
    setCode(state.stickyKey, "ready");
}

async function copyText(value) {
    try {
        await navigator.clipboard.writeText(value);
        return true;
    } catch {
        return false;
    }
}

sceneButtons.forEach((button) => {
    const key = button.dataset.scene;
    if (!key) {
        return;
    }

    button.addEventListener("mouseenter", () => previewKey(key, "hover"));
    button.addEventListener("focus", () => previewKey(key, "focus"));
    button.addEventListener("mouseleave", restoreSticky);
    button.addEventListener("blur", restoreSticky);
    button.addEventListener("click", () => commitKey(key, "selected"));
});

rows.forEach((row) => {
    const key = row.dataset.contact;
    if (!key) {
        return;
    }

    row.addEventListener("mouseenter", () => previewKey(key, "hover"));
    row.addEventListener("focus", () => previewKey(key, "focus"));
    row.addEventListener("mouseleave", restoreSticky);
    row.addEventListener("blur", restoreSticky);
    row.addEventListener("click", async () => {
        const ok = await copyText(row.dataset.copy || "");
        commitKey(key, ok ? "copied" : "selected");
    });
});

actionCards.forEach((card) => {
    const key = card.dataset.action;
    if (!key) {
        return;
    }

    card.addEventListener("mouseenter", () => previewKey(key, "hover"));
    card.addEventListener("focus", () => previewKey(key, "focus"));
    card.addEventListener("mouseleave", restoreSticky);
    card.addEventListener("blur", restoreSticky);
    card.addEventListener("click", () => commitKey(key, "selected"));
});

if (tiltCard) {
    tiltCard.addEventListener("mousemove", (event) => {
        const rect = tiltCard.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const rx = (y / rect.height - 0.5) * -4;
        const ry = (x / rect.width - 0.5) * 5;
        tiltCard.style.transform = `perspective(1400px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    });

    tiltCard.addEventListener("mouseleave", () => {
        tiltCard.style.transform = "perspective(1400px) rotateX(0deg) rotateY(0deg)";
    });
}

if (stage && batWrap) {
    stage.addEventListener("mousemove", (event) => {
        const rect = stage.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const px = x / rect.width;
        const py = y / rect.height;
        const dx = (px - 0.5) * 36;
        const dy = (py - 0.5) * 24;
        const rotate = (px - 0.5) * 10;

        stage.style.setProperty("--pointer-x", `${(px * 100).toFixed(2)}%`);
        stage.style.setProperty("--pointer-y", `${(py * 100).toFixed(2)}%`);
        batWrap.style.transform = `translate(calc(-50% + ${dx.toFixed(1)}px), calc(-50% + ${dy.toFixed(1)}px)) rotate(${rotate.toFixed(2)}deg)`;
    });

    stage.addEventListener("mouseleave", () => {
        stage.style.setProperty("--pointer-x", "50%");
        stage.style.setProperty("--pointer-y", "50%");
        batWrap.style.transform = "translate(-50%, -50%) rotate(0deg)";
        restoreSticky();
    });
}

restoreSticky();
