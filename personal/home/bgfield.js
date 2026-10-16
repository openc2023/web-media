/* home/bgfield.js — 全页背景字符场（固定在视口后面）
   平时只是稀疏、缓慢漂移的蓝色点阵，偶尔浮现「07S」；光标附近像手电筒一样“照出”字符，其中夹着 0 / 7 / S；
   滚动时点阵按视差移动，滚得越快越亮。
   window.AsciiBg.mount(canvas, { getColors }) → { setOpacity } */
(function () {
    'use strict';

    var RAMP = '.·:-=+*xo%#@';
    var BRAND = '07S';
    var GLITCH = '07S#%/\\<>=+*';

    function hash(x, y) {
        var h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
        return h - Math.floor(h);
    }
    function smooth(t) { return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t); }
    function noise(x, y) {
        var ix = Math.floor(x), iy = Math.floor(y);
        var fx = smooth(x - ix), fy = smooth(y - iy);
        var a = hash(ix, iy), b = hash(ix + 1, iy);
        var c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
        return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    }

    function mount(canvas, opts) {
        var ctx = canvas.getContext('2d');
        var W = 0, H = 0, dpr = 1, cell = 16, fs = 11;
        var pointer = { x: -999, y: -999, on: false };
        var light = 0;                       // 手电筒强度，光标离开后慢慢熄灭
        var lastY = window.scrollY, vel = 0;
        var last = 0;
        var touch = matchMedia('(hover: none)').matches;

        function resize() {
            W = window.innerWidth; H = window.innerHeight;
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            cell = W < 640 ? 18 : 16;
            fs = W < 640 ? 10 : 11;
            canvas.width = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        resize();
        window.addEventListener('resize', resize);
        window.addEventListener('pointermove', function (e) {
            if (e.pointerType === 'touch') return;
            pointer.x = e.clientX; pointer.y = e.clientY; pointer.on = true;
        }, { passive: true });
        document.addEventListener('pointerleave', function () { pointer.on = false; });

        function frame(now) {
            requestAnimationFrame(frame);
            if (now - last < 32) return;     // 约 30fps 就够了
            last = now;
            if (canvas.style.opacity === '0') return;

            var t = now / 1000;
            var sy = window.scrollY;
            vel += ((sy - lastY) - vel) * 0.25;
            lastY = sy;
            var speed = Math.min(1, Math.abs(vel) / 45);
            light += ((pointer.on && !touch ? 1 : 0) - light) * 0.08;

            var C = opts.getColors();
            ctx.clearRect(0, 0, W, H);

            var par = sy * 0.35;             // 视差：背景比正文慢
            var rowShift = Math.floor(par / cell);
            var off = par - rowShift * cell;
            var cols = Math.ceil(W / cell) + 1, rows = Math.ceil(H / cell) + 2;
            var R = 190;

            var dots = [], chars = [];
            for (var r = 0; r < rows; r++) {
                var gy = r + rowShift;
                var py = r * cell - off;
                for (var c = 0; c < cols; c++) {
                    var px = c * cell;
                    var n = noise(c * 0.07 + t * 0.04, gy * 0.07 - t * 0.03);
                    var v = (n - 0.56) * 2.6;
                    if (speed > 0.02) v += speed * 0.55 * hash(c, gy + Math.floor(t * 8));
                    var f = 0;
                    if (light > 0.01) {
                        var d = Math.hypot(px + cell / 2 - pointer.x, py + cell / 2 - pointer.y);
                        f = smooth(1 - d / R) * light;
                        v += f * (0.55 + 0.45 * hash(c * 3.1, gy * 1.7));
                    }
                    if (v < 0.06) continue;
                    // 光标附近，或场本身够密的地方，用字符代替点
                    if (f > 0.12) chars.push(px, py, Math.min(1, v), f);
                    else if (v > 0.42) chars.push(px, py, Math.min(1, v), 0.3 + (v - 0.42) * 0.4);
                    else dots.push(px + cell / 2 - 1, py + cell / 2 - 1, Math.min(1, v));
                }
            }

            ctx.fillStyle = C.dot;
            for (var i = 0; i < dots.length; i += 3) {
                ctx.globalAlpha = 0.18 + dots[i + 2] * 0.5;
                ctx.fillRect(dots[i], dots[i + 1], 2, 2);
            }
            ctx.font = '400 ' + fs + 'px "IBM Plex Mono", ui-monospace, monospace';
            ctx.textBaseline = 'top';
            var lastIdx = RAMP.length - 1;
            var slot = Math.floor(t * 1.5);  // 07S 字符大约每 0.7 秒换一批位置
            var marks = [];
            ctx.fillStyle = C.char;
            for (var j = 0; j < chars.length; j += 4) {
                var cx = chars[j], cy = chars[j + 1];
                var k = hash(cx * 0.119 + slot * 3.7, (cy + par) * 0.143);
                if (k > 0.74) { marks.push(cx, cy, chars[j + 3], BRAND.charAt(Math.floor(k * 1000) % 3)); continue; }
                ctx.globalAlpha = Math.min(0.55, chars[j + 3] * 0.7);
                ctx.fillText(RAMP.charAt(Math.floor(chars[j + 2] * lastIdx)), cx + cell * 0.2, cy + cell * 0.12);
            }
            ctx.fillStyle = C.dot;
            for (var q = 0; q < marks.length; q += 4) {
                ctx.globalAlpha = Math.min(0.8, marks[q + 2] * 1.05);
                ctx.fillText(marks[q + 3], marks[q] + cell * 0.2, marks[q + 1] + cell * 0.12);
            }

            // 散落在场里的「07S」：随机位置浮现，先乱码再收敛成 07S，然后淡出
            for (var wr = 0; wr < rows; wr++) {
                var wy = wr + rowShift;
                for (var wc = 0; wc + 2 < cols; wc += 3) {
                    var seed = hash(wc * 0.31, wy * 0.57);
                    var life = t / 5 + seed * 9;
                    var gen = Math.floor(life);
                    if (hash(wc * 1.7 + gen * 5.3, wy * 2.9) < 0.986) continue;
                    var ph = life - gen;
                    var a = Math.sin(ph * Math.PI);
                    var wx = wc * cell, wpy = wr * cell - off;
                    var near = light > 0.01 ? smooth(1 - Math.hypot(wx + cell * 1.5 - pointer.x, wpy + cell / 2 - pointer.y) / 260) * light : 0;
                    ctx.globalAlpha = Math.min(0.85, a * 0.5 + near * 0.35);
                    for (var w = 0; w < 3; w++) {
                        var settled = ph > 0.18 + w * 0.06;
                        var chw = settled ? BRAND.charAt(w) : GLITCH.charAt(Math.floor(hash(wc + w, wy + Math.floor(t * 12)) * GLITCH.length));
                        ctx.fillText(chw, wx + w * cell + cell * 0.2, wpy + cell * 0.12);
                    }
                }
            }
            ctx.globalAlpha = 1;
        }
        requestAnimationFrame(frame);

        return {
            setOpacity: function (o) { canvas.style.opacity = o <= 0.01 ? '0' : String(o); }
        };
    }

    window.AsciiBg = { mount: mount };
})();
