/* ═══════════════════════════════════════════════
   PREMIUM MINIMAL — Interactive Engine
   ═══════════════════════════════════════════════ */

// ── DOM refs ──
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const tiltCard = $("[data-tilt]");
const stageEl = $("[data-stage]");
const canvas = $("#scene-canvas");
const ctx = canvas ? canvas.getContext("2d") : null;
const codeOutput = $("[data-code-output]");
const codeMeta = $("[data-code-meta]");
const codeStatuses = $$("[data-code-status], [data-code-status-secondary]");
const statusText = $("[data-status-text]");
const sceneTitle = $("[data-scene-title]");
const sceneDesc = $("[data-scene-desc]");
const sceneLabel = $("[data-scene-label]");
const sceneHeading = $("[data-scene-heading]");
const sceneBody = $("[data-scene-body]");
const scenePoints = $("[data-scene-points]");
const sceneButtons = $$("[data-scene]");
const contactRows = $$("[data-contact]");
const actionCards = $$("[data-action]");
const detailPanel = $("[data-panel='detail']");
const contactPanel = $("[data-panel='contact']");
const cursorGlow = $(".cursor-glow");
const copyToast = $("#copy-toast");

// ── Scene data ──
const scenes = {
    research: {
        label: "Research",
        title: "Research Scene",
        desc: "从论文和研究方向进入",
        heading: "研究方向与学术背景",
        body: "从动画研究到新媒体艺术实践，先给访客一个明确的进入路径。",
        points: [
            "论文、学位与研究方向可继续接入 PDF 与封面",
            "适合展示中韩双语和跨文化研究背景",
            "建立'研究型创作者'的第一印象"
        ],
        color: { r: 110, g: 161, b: 212 }
    },
    projects: {
        label: "Projects",
        title: "Projects Scene",
        desc: "把项目与媒介实践做成更快的入口",
        heading: "作品与项目入口",
        body: "项目场景更适合快速展示视觉实践和合作经历，访客能更快感受到你做过什么。",
        points: [
            "适合后续接项目封面、视频缩略图和分类标签",
            "可以把作品分成展览、影像、交互装置与研究合作",
            "首页就能先传达'能落地执行'的气质"
        ],
        color: { r: 212, g: 149, b: 110 }
    },
    connect: {
        label: "Contact",
        title: "Contact Scene",
        desc: "联系方式变成可操作模块",
        heading: "联系信息也是交互的一部分",
        body: "复制、跳转和联系动作直接在首页发生，不用先读完整页。",
        points: [
            "姓名、邮箱和电话都能直接触发反馈",
            "适合继续接入 WeChat、Instagram 或 PDF CV 下载",
            "让首页更像工作入口，而不只是展示页"
        ],
        color: { r: 94, g: 196, b: 138 }
    }
};

const snippets = {
    research: `const scene = {\n  mode: "research",\n  focus: "home-entry",\n  action: "open-profile"\n};`,
    projects: `const scene = {\n  mode: "projects",\n  focus: "selected-works",\n  action: "open-archive"\n};`,
    connect: `const scene = {\n  mode: "contact",\n  focus: "direct-reach",\n  action: "copy-or-send"\n};`
};

const hints = {
    ready: "选择一个场景开始探索",
    hover: "预览中 — 视觉与面板正在联动",
    copied: "已复制到剪贴板",
    selected: "已切换到当前场景"
};

// ── State ──
const state = {
    scene: "research",
    stickyScene: "research",
    mouseX: 0,
    mouseY: 0,
    canvasMouseX: 0.5,
    canvasMouseY: 0.5
};

// ══════════════════════════════════════════════
// Particle System
// ══════════════════════════════════════════════
const PARTICLE_COUNT = 32;
const CONNECTION_DIST = 100;

class Particle {
    constructor(w, h) {
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.tx = this.x;
        this.ty = this.y;
        this.vx = (Math.random() - 0.5) * 0.15;
        this.vy = (Math.random() - 0.5) * 0.15;
        this.radius = 1.2 + Math.random() * 0.6;
        this.baseSpeed = 0.003 + Math.random() * 0.003;
    }

    setTarget(x, y) {
        this.tx = x;
        this.ty = y;
    }

    update(w, h, mx, my) {
        // Drift toward target
        this.x += (this.tx - this.x) * this.baseSpeed;
        this.y += (this.ty - this.y) * this.baseSpeed;

        // Add gentle noise drift
        this.x += this.vx;
        this.y += this.vy;

        // Soft mouse repulsion
        const dx = this.x - mx;
        const dy = this.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 80) {
            const force = (80 - dist) / 80 * 0.4;
            this.x += (dx / dist) * force;
            this.y += (dy / dist) * force;
        }

        // Wrap boundaries with padding
        if (this.x < -10) this.x = w + 10;
        if (this.x > w + 10) this.x = -10;
        if (this.y < -10) this.y = h + 10;
        if (this.y > h + 10) this.y = -10;
    }
}

let particles = [];
let canvasW = 0;
let canvasH = 0;
let animFrame = null;

function initCanvas() {
    if (!canvas || !ctx) return;
    resizeCanvas();
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push(new Particle(canvasW, canvasH));
    }
    setParticleTargets(state.scene);
    renderLoop();
}

function resizeCanvas() {
    if (!canvas || !stageEl) return;
    const rect = stageEl.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvasW = rect.width;
    canvasH = rect.height;
    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    canvas.style.width = canvasW + "px";
    canvas.style.height = canvasH + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function setParticleTargets(sceneKey) {
    const w = canvasW;
    const h = canvasH;
    const cx = w / 2;
    const cy = h / 2;

    particles.forEach((p, i) => {
        const t = i / PARTICLE_COUNT;
        switch (sceneKey) {
            case "research": {
                // Scattered constellation
                const angle = t * Math.PI * 2 + Math.random() * 0.4;
                const radius = 40 + Math.random() * Math.min(w, h) * 0.35;
                p.setTarget(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
                break;
            }
            case "projects": {
                // Loose grid
                const cols = 6;
                const rows = Math.ceil(PARTICLE_COUNT / cols);
                const col = i % cols;
                const row = Math.floor(i / cols);
                const gapX = w / (cols + 1);
                const gapY = h / (rows + 1);
                p.setTarget(
                    gapX * (col + 1) + (Math.random() - 0.5) * 16,
                    gapY * (row + 1) + (Math.random() - 0.5) * 16
                );
                break;
            }
            case "connect": {
                // Gentle orbit
                const orbitAngle = t * Math.PI * 2;
                const orbitR = 30 + t * Math.min(w, h) * 0.28;
                p.setTarget(cx + Math.cos(orbitAngle) * orbitR, cy + Math.sin(orbitAngle) * orbitR);
                break;
            }
        }
    });
}

function renderLoop() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasW, canvasH);

    const scene = scenes[state.scene];
    const { r, g, b } = scene.color;
    const mx = state.canvasMouseX * canvasW;
    const my = state.canvasMouseY * canvasH;

    // Update particles
    particles.forEach((p) => p.update(canvasW, canvasH, mx, my));

    // Draw connections
    ctx.lineWidth = 0.5;
    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            const a = particles[i];
            const bP = particles[j];
            const dx = a.x - bP.x;
            const dy = a.y - bP.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < CONNECTION_DIST) {
                const alpha = (1 - dist / CONNECTION_DIST) * 0.15;
                ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(bP.x, bP.y);
                ctx.stroke();
            }
        }
    }

    // Draw particles
    particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.4)`;
        ctx.fill();
    });

    animFrame = requestAnimationFrame(renderLoop);
}

// ══════════════════════════════════════════════
// Typewriter
// ══════════════════════════════════════════════
let typewriterTimer = null;

function typeCode(text) {
    if (!codeOutput) return;
    clearTimeout(typewriterTimer);
    codeOutput.textContent = "";

    // Remove any existing cursor
    const oldCursor = codeOutput.parentElement?.querySelector(".tw-cursor");
    if (oldCursor) oldCursor.remove();

    // Create cursor
    const cursor = document.createElement("span");
    cursor.className = "tw-cursor";
    codeOutput.after(cursor);

    let i = 0;
    function tick() {
        if (i < text.length) {
            codeOutput.textContent += text[i];
            i++;
            typewriterTimer = setTimeout(tick, 22);
        } else {
            // Remove cursor after a delay
            setTimeout(() => cursor.remove(), 2000);
        }
    }
    tick();
}

// ══════════════════════════════════════════════
// Scene Switching
// ══════════════════════════════════════════════
function updateSceneContent(sceneKey, animate = true) {
    const scene = scenes[sceneKey];
    if (!scene) return;

    if (sceneTitle) sceneTitle.textContent = scene.title;
    if (sceneDesc) sceneDesc.textContent = scene.desc;

    // Detail card content
    if (sceneLabel) sceneLabel.textContent = scene.label;
    if (sceneHeading) sceneHeading.textContent = scene.heading;
    if (sceneBody) sceneBody.textContent = scene.body;
    if (scenePoints) {
        scenePoints.innerHTML = scene.points.map((p) => `<li>${p}</li>`).join("");
    }

    // Panel visibility: show contact panel only in connect scene
    if (contactPanel) {
        contactPanel.classList.toggle("is-visible", sceneKey === "connect");
    }

    // Scene buttons
    sceneButtons.forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.scene === sceneKey);
    });

    // Canvas particles
    setParticleTargets(sceneKey);
}

function setStatusText(hint) {
    if (statusText) statusText.textContent = hints[hint] || hints.ready;
}

function setCodeStatuses(text) {
    codeStatuses.forEach((el) => (el.textContent = text));
}

function commitScene(sceneKey) {
    state.scene = sceneKey;
    state.stickyScene = sceneKey;
    updateSceneContent(sceneKey);
    typeCode(snippets[sceneKey] || snippets.research);
    setCodeStatuses("active");
    setStatusText("selected");
    if (codeMeta) codeMeta.textContent = `scene: "${sceneKey}"`;

    // Reset contact/action highlights
    contactRows.forEach((r) => r.classList.remove("is-active"));
    actionCards.forEach((a) => a.classList.remove("is-active"));
}

function previewScene(sceneKey) {
    state.scene = sceneKey;
    updateSceneContent(sceneKey, false);
    setCodeStatuses("preview");
    setStatusText("hover");
    if (codeOutput) codeOutput.textContent = snippets[sceneKey] || "";
    if (codeMeta) codeMeta.textContent = `scene: "${sceneKey}"`;
    setParticleTargets(sceneKey);
}

function restoreSticky() {
    state.scene = state.stickyScene;
    updateSceneContent(state.stickyScene, false);
    setCodeStatuses("ready");
    setStatusText("ready");
    if (codeOutput) codeOutput.textContent = snippets[state.stickyScene] || "";
    if (codeMeta) codeMeta.textContent = `scene: "${state.stickyScene}"`;
    setParticleTargets(state.stickyScene);
    contactRows.forEach((r) => r.classList.remove("is-active"));
    actionCards.forEach((a) => a.classList.remove("is-active"));
}

// ══════════════════════════════════════════════
// Copy & Toast
// ══════════════════════════════════════════════
let toastTimer = null;

async function copyText(value) {
    try {
        await navigator.clipboard.writeText(value);
        return true;
    } catch {
        return false;
    }
}

function showToast(text) {
    if (!copyToast) return;
    copyToast.textContent = text || "已复制到剪贴板";
    copyToast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => copyToast.classList.remove("is-visible"), 1800);
}

// ══════════════════════════════════════════════
// Event Bindings
// ══════════════════════════════════════════════

// Scene buttons
sceneButtons.forEach((btn) => {
    const key = btn.dataset.scene;
    if (!key) return;
    btn.addEventListener("mouseenter", () => previewScene(key));
    btn.addEventListener("mouseleave", restoreSticky);
    btn.addEventListener("click", () => commitScene(key));
});

// Contact rows
contactRows.forEach((row) => {
    const key = row.dataset.contact;
    if (!key) return;
    row.addEventListener("mouseenter", () => {
        previewScene("connect");
        row.classList.add("is-active");
    });
    row.addEventListener("mouseleave", () => {
        row.classList.remove("is-active");
        restoreSticky();
    });
    row.addEventListener("click", async () => {
        const ok = await copyText(row.dataset.copy || "");
        commitScene("connect");
        row.classList.add("is-active");
        showToast(ok ? "已复制到剪贴板" : "请手动复制");
    });
});

// Action cards
actionCards.forEach((card) => {
    const key = card.dataset.action;
    if (!key) return;
    const sceneMap = { profile: "research", archive: "projects", message: "connect" };
    card.addEventListener("mouseenter", () => {
        previewScene(sceneMap[key] || "research");
        card.classList.add("is-active");
    });
    card.addEventListener("mouseleave", () => {
        card.classList.remove("is-active");
        restoreSticky();
    });
});

// ── Tilt ──
const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;

if (tiltCard && !isTouchDevice) {
    tiltCard.addEventListener("mousemove", (e) => {
        const rect = tiltCard.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const rx = (y / rect.height - 0.5) * -2;
        const ry = (x / rect.width - 0.5) * 2.5;
        tiltCard.style.transform = `perspective(1600px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    });
    tiltCard.addEventListener("mouseleave", () => {
        tiltCard.style.transform = "perspective(1600px) rotateX(0) rotateY(0)";
    });
}

// ── Canvas mouse ──
if (stageEl) {
    stageEl.addEventListener("mousemove", (e) => {
        const rect = stageEl.getBoundingClientRect();
        state.canvasMouseX = (e.clientX - rect.left) / rect.width;
        state.canvasMouseY = (e.clientY - rect.top) / rect.height;
    });
    stageEl.addEventListener("mouseleave", () => {
        state.canvasMouseX = 0.5;
        state.canvasMouseY = 0.5;
    });
}

// ── Cursor glow ──
if (cursorGlow && !isTouchDevice) {
    let glowX = 0, glowY = 0;
    let targetX = 0, targetY = 0;

    document.addEventListener("mousemove", (e) => {
        targetX = e.clientX;
        targetY = e.clientY;
    });

    function updateGlow() {
        glowX += (targetX - glowX) * 0.08;
        glowY += (targetY - glowY) * 0.08;
        cursorGlow.style.left = glowX + "px";
        cursorGlow.style.top = glowY + "px";
        requestAnimationFrame(updateGlow);
    }
    updateGlow();
}

// ── Resize ──
let resizeTimer;
window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        resizeCanvas();
        setParticleTargets(state.scene);
    }, 150);
});

// ══════════════════════════════════════════════
// Init
// ══════════════════════════════════════════════
function init() {
    // Init canvas
    initCanvas();

    // Initial scene
    updateSceneContent("research", false);
    typeCode(snippets.research);

    // Entry animations (stagger reveal)
    const targets = $$(".reveal-target");
    targets.forEach((el, i) => {
        setTimeout(() => el.classList.add("revealed"), 100 + i * 80);
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
