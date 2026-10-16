/* ═══════════════════════════════════════════════
   Premium Minimal — Interactive Engine
   Full-screen particle field with mouse interaction
   ═══════════════════════════════════════════════ */

(function () {
    var canvas = document.getElementById("bg-canvas");
    var ctx = canvas ? canvas.getContext("2d") : null;
    var glow = document.querySelector(".cursor-glow");
    var toast = document.getElementById("toast");
    var hint = document.getElementById("center-hint");
    var copyItems = document.querySelectorAll("[data-copy]");
    var reveals = document.querySelectorAll(".reveal-item");

    var W = 0, H = 0;
    var mouseX = -9999, mouseY = -9999;
    var glowX = -9999, glowY = -9999;
    var hasMoved = false;
    var isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;

    // ══════════════════════════════════════════
    // Particles — more particles, richer interaction
    // ══════════════════════════════════════════
    var COUNT = 60;
    var CONNECT_DIST = 140;
    var MOUSE_RADIUS = 160;
    var particles = [];

    // Accent color
    var CR = 201, CG = 168, CB = 124;

    function Particle() {
        this.x = Math.random() * W;
        this.y = Math.random() * H;
        this.vx = (Math.random() - 0.5) * 0.25;
        this.vy = (Math.random() - 0.5) * 0.25;
        this.r = 1.2 + Math.random() * 1;
        this.baseR = this.r;
    }

    function initParticles() {
        particles = [];
        for (var i = 0; i < COUNT; i++) particles.push(new Particle());
    }

    function resize() {
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + "px";
        canvas.style.height = H + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);

        for (var i = 0; i < particles.length; i++) {
            var p = particles[i];

            // Drift
            p.x += p.vx;
            p.y += p.vy;

            // Mouse attraction (gentle pull toward cursor) + close repulsion
            var dx = mouseX - p.x;
            var dy = mouseY - p.y;
            var dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < MOUSE_RADIUS && dist > 0) {
                if (dist < 50) {
                    // Close: push away
                    var pushForce = (50 - dist) / 50 * 0.6;
                    p.x -= (dx / dist) * pushForce;
                    p.y -= (dy / dist) * pushForce;
                } else {
                    // Mid-range: gentle pull
                    var pullForce = (MOUSE_RADIUS - dist) / MOUSE_RADIUS * 0.15;
                    p.x += (dx / dist) * pullForce;
                    p.y += (dy / dist) * pullForce;
                }
                // Particles near mouse grow slightly
                p.r = p.baseR + (1 - dist / MOUSE_RADIUS) * 1.5;
            } else {
                p.r += (p.baseR - p.r) * 0.05;
            }

            // Wrap
            if (p.x < -30) p.x = W + 30;
            if (p.x > W + 30) p.x = -30;
            if (p.y < -30) p.y = H + 30;
            if (p.y > H + 30) p.y = -30;

            // Draw dot
            var dotAlpha = 0.3;
            if (dist < MOUSE_RADIUS) dotAlpha = 0.3 + (1 - dist / MOUSE_RADIUS) * 0.4;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(" + CR + "," + CG + "," + CB + "," + dotAlpha + ")";
            ctx.fill();
        }

        // Draw connections
        ctx.lineWidth = 0.5;
        for (var i = 0; i < particles.length; i++) {
            for (var j = i + 1; j < particles.length; j++) {
                var a = particles[i], b = particles[j];
                var dx2 = a.x - b.x, dy2 = a.y - b.y;
                var d = Math.sqrt(dx2 * dx2 + dy2 * dy2);
                if (d < CONNECT_DIST) {
                    var lineAlpha = (1 - d / CONNECT_DIST) * 0.1;

                    // Lines near mouse are brighter
                    var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
                    var md = Math.sqrt((mx - mouseX) * (mx - mouseX) + (my - mouseY) * (my - mouseY));
                    if (md < MOUSE_RADIUS) {
                        lineAlpha += (1 - md / MOUSE_RADIUS) * 0.12;
                    }

                    ctx.strokeStyle = "rgba(" + CR + "," + CG + "," + CB + "," + lineAlpha + ")";
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.stroke();
                }
            }
        }

        // Mouse glow ring on canvas
        if (hasMoved && mouseX > 0 && mouseY > 0) {
            var grad = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, 80);
            grad.addColorStop(0, "rgba(" + CR + "," + CG + "," + CB + ",0.03)");
            grad.addColorStop(1, "rgba(" + CR + "," + CG + "," + CB + ",0)");
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(mouseX, mouseY, 80, 0, Math.PI * 2);
            ctx.fill();
        }

        requestAnimationFrame(draw);
    }

    // ══════════════════════════════════════════
    // Cursor Glow (DOM element, smoother)
    // ══════════════════════════════════════════
    function updateGlow() {
        glowX += (mouseX - glowX) * 0.05;
        glowY += (mouseY - glowY) * 0.05;
        if (glow) {
            glow.style.left = glowX + "px";
            glow.style.top = glowY + "px";
        }
        requestAnimationFrame(updateGlow);
    }

    // ══════════════════════════════════════════
    // Copy & Toast
    // ══════════════════════════════════════════
    var toastTimer;

    function showToast(text) {
        if (!toast) return;
        toast.textContent = text || "已复制";
        toast.classList.add("visible");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toast.classList.remove("visible"); }, 1600);
    }

    for (var i = 0; i < copyItems.length; i++) {
        (function (el) {
            el.addEventListener("click", function (e) {
                var value = el.getAttribute("data-copy");
                if (!value) return;
                e.preventDefault();
                navigator.clipboard.writeText(value).then(function () {
                    showToast("已复制: " + value);
                }).catch(function () {
                    showToast("请手动复制");
                });
            });
        })(copyItems[i]);
    }

    // ══════════════════════════════════════════
    // Events
    // ══════════════════════════════════════════
    if (!isTouchDevice) {
        document.addEventListener("mousemove", function (e) {
            mouseX = e.clientX;
            mouseY = e.clientY;
            if (!hasMoved) {
                hasMoved = true;
                if (hint) hint.classList.remove("visible");
            }
        });
    }

    // Touch: use touch position for particles
    if (isTouchDevice) {
        document.addEventListener("touchmove", function (e) {
            if (e.touches.length > 0) {
                mouseX = e.touches[0].clientX;
                mouseY = e.touches[0].clientY;
                hasMoved = true;
            }
        }, { passive: true });
        document.addEventListener("touchend", function () {
            mouseX = -9999;
            mouseY = -9999;
        });
    }

    var resizeTimer;
    window.addEventListener("resize", function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 100);
    });

    // ══════════════════════════════════════════
    // Init
    // ══════════════════════════════════════════
    function init() {
        if (canvas && ctx) {
            resize();
            initParticles();
            draw();
        }
        if (glow && !isTouchDevice) updateGlow();

        // Show hint after a moment
        if (hint && !isTouchDevice) {
            setTimeout(function () { hint.classList.add("visible"); }, 1200);
        }

        // Entry animation
        for (var i = 0; i < reveals.length; i++) {
            (function (el, idx) {
                setTimeout(function () { el.classList.add("revealed"); }, 400 + idx * 200);
            })(reveals[i], i);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
