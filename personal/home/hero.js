/* home/hero.js — 头图字符场：同一个数值场，四种渲染方式
   dither   方点 + Bayer 有序抖动（老电脑屏幕）
   halftone 方点大小随明度变化（印刷网点）
   ascii    字符明度梯度
   braille  盲文点阵式 2×4 细点
   场 = 右上角渐变 + 缓慢流动的噪声 + 「田漢」字形（四周留出暗边）+ 光标落墨 + 点击涟漪
   window.AsciiHero.mount(canvas, { glyph, mode, getColors, layout }) */
(function () {
    'use strict';

    var RAMP = ' .·:-=+*xo%#@';
    var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(function (v) { return (v + 0.5) / 16; });
    var MODES = ['dither', 'halftone', 'ascii', 'braille'];

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
        var glyph = opts.glyph || '田漢';
        var image = opts.image || null;     // 透明底人像：和字形一起出现在场里（imageLayout 定位），或单独使用（field: 'none'）
        var imageLayout = opts.imageLayout || null;
        var fieldOn = opts.field !== 'none'; // field: 'none' 时只画图片本身，不要角落渐变场
        var gain = opts.imageGain || 1;      // 人像在场里的浓淡
        var carve = opts.carve == null ? 1 : opts.carve;      // 人像四周暗边的深浅（0–1，0 为不留暗边）
        var mode = MODES.indexOf(opts.mode) > -1 ? opts.mode : 'dither';
        var getColors = opts.getColors;
        var layout = opts.layout;           // 返回 { x, y, size }：字形中心与字号（0–1 相对画布）

        var W = 0, H = 0, dpr = 1;
        var pw = 7, ph = 7, fs = 12;        // 格子尺寸
        var cols = 0, rows = 0;
        var mask, halo, ink, pmask = null;   // pmask：人像单独一层，可以“呼吸”
        var pointer = { x: -1, y: -1, px: -1, py: -1, inside: false };
        var ripples = [];
        var start = performance.now();
        var visible = true;
        var fade = 0;                       // 滚动离开时整片场溶解成稀疏点阵

        function grid() {
            var small = W < 640;
            if (mode === 'ascii') { fs = small ? 10 : 12; pw = fs * 0.6; ph = fs * 1.2; }
            else if (mode === 'braille') { pw = small ? 3 : 3.5; ph = pw; }
            else if (mode === 'halftone') { pw = ph = small ? 7 : 9; }
            else { pw = ph = small ? 5 : 7; }
            // 人像画布小，格子按比例缩细，五官才认得出来
            if (opts.cell) { pw *= opts.cell; ph *= opts.cell; fs *= opts.cell; }
            cols = Math.ceil(W / pw);
            rows = Math.ceil(H / ph);
            ink = new Float32Array(cols * rows);
            buildMask();
        }

        // 按真实像素画字，再按格子求覆盖率；halo 是字形外扩的暗边，让字从场里“刻”出来
        function buildMask() {
            mask = new Float32Array(cols * rows);
            halo = new Float32Array(cols * rows);
            pmask = image && fieldOn ? new Float32Array(cols * rows) : null;
            if (!W || !H) return;
            if (image && !fieldOn) return buildImageMask();
            var L = layout(W, H);
            var S = 0.25;                   // 降采样渲染，够用且快
            var w = Math.max(1, Math.round(W * S)), h = Math.max(1, Math.round(H * S));
            var off = document.createElement('canvas');
            off.width = w; off.height = h;
            var o = off.getContext('2d', { willReadFrequently: true });
            var size = L.size * S;
            o.fillStyle = '#000'; o.fillRect(0, 0, w, h);
            o.textAlign = 'center'; o.textBaseline = 'middle';
            o.font = '900 ' + size + 'px "Noto Serif SC", "Noto Serif TC", serif';
            o.fillStyle = '#fff';
            o.fillText(glyph, L.x * w, L.y * h + size * 0.04);
            var a = o.getImageData(0, 0, w, h).data;
            o.filter = 'blur(' + Math.max(2, size * 0.07) + 'px)';
            o.fillStyle = '#000'; o.fillRect(0, 0, w, h);
            o.fillStyle = '#fff';
            o.lineWidth = size * 0.07; o.strokeStyle = '#fff';
            o.strokeText(glyph, L.x * w, L.y * h + size * 0.04);
            o.fillText(glyph, L.x * w, L.y * h + size * 0.04);
            var b = o.getImageData(0, 0, w, h).data;
            for (var y = 0; y < rows; y++) {
                var sy = Math.min(h - 1, Math.floor((y + 0.5) * ph * S));
                for (var x = 0; x < cols; x++) {
                    var sx = Math.min(w - 1, Math.floor((x + 0.5) * pw * S));
                    var k = (sy * w + sx) * 4;
                    mask[y * cols + x] = a[k] / 255;
                    halo[y * cols + x] = b[k] / 255;
                }
            }
            if (image) buildImageMask();
        }

        // 人像：透明底灰度照片。放进场里时按 layout 定位（size = 人像高度），四周同样留暗边；
        // 单独使用（field: 'none'）时按 contain 铺满画布。亮处密、暗处留一层淡点勾出轮廓。
        function buildImageMask() {
            if (!image.complete || !image.naturalWidth) return;
            var w = cols, h = rows;
            var off = document.createElement('canvas');
            off.width = w; off.height = h;
            var o = off.getContext('2d', { willReadFrequently: true });
            var ir = image.naturalWidth / image.naturalHeight, dw, dh, cx, cy;
            if (fieldOn) {
                var L = (imageLayout || layout)(W, H);
                dh = L.size; dw = dh * ir; cx = L.x * W; cy = L.y * H;
            } else {
                dw = W / H > ir ? H * ir : W; dh = dw / ir; cx = W / 2; cy = H / 2;
            }
            // 格子不是正方形时按真实像素比例换算，人像不变形
            var x0 = (cx - dw / 2) / pw, y0 = (cy - dh / 2) / ph, ww = dw / pw, hh = dh / ph;
            o.drawImage(image, x0, y0, ww, hh);
            var px = o.getImageData(0, 0, w, h).data;
            var dst = fieldOn ? pmask : mask;
            for (var i = 0; i < dst.length; i++) {
                var a = px[i * 4 + 3] / 255, lum = px[i * 4] / 255;
                dst[i] = a * (0.14 + 0.96 * Math.pow(lum, 1.05)) * gain;
            }
            if (!fieldOn || carve <= 0) return;
            o.clearRect(0, 0, w, h);
            o.filter = 'blur(' + Math.max(1.5, ww * 0.04) + 'px)';
            o.drawImage(image, x0, y0, ww, hh);
            var hb = o.getImageData(0, 0, w, h).data;
            for (var j = 0; j < halo.length; j++) halo[j] = Math.max(halo[j], Math.min(1, hb[j * 4 + 3] / 255 * 1.5) * carve);
        }

        function resize() {
            var rect = canvas.getBoundingClientRect();
            W = rect.width; H = rect.height;
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            grid();
        }

        function toCell(e) {
            var rect = canvas.getBoundingClientRect();
            return { x: (e.clientX - rect.left) / pw, y: (e.clientY - rect.top) / ph };
        }
        var target = opts.pointerTarget || canvas;
        target.addEventListener('pointermove', function (e) {
            var c = toCell(e);
            pointer.x = c.x; pointer.y = c.y; pointer.inside = true;
        });
        target.addEventListener('pointerleave', function () { pointer.inside = false; pointer.px = -1; });
        target.addEventListener('pointerdown', function (e) {
            if (e.target.closest && e.target.closest('a, button, input')) return;
            var c = toCell(e);
            ripples.push({ x: c.x * pw, y: c.y * ph, t: performance.now() });
            if (ripples.length > 6) ripples.shift();
        });

        function deposit() {
            if (!pointer.inside) return;
            var sx = pointer.px < 0 ? pointer.x : pointer.px;
            var sy = pointer.px < 0 ? pointer.y : pointer.py;
            var dx = pointer.x - sx, dy = pointer.y - sy;
            var rpx = 34;                                     // 笔触半径（像素）
            var steps = Math.max(1, Math.ceil(Math.hypot(dx * pw, dy * ph) / 6));
            var rx = rpx / pw, ry = rpx / ph;
            for (var s = 0; s <= steps; s++) {
                var cx = sx + dx * s / steps, cy = sy + dy * s / steps;
                var x0 = Math.max(0, Math.floor(cx - rx)), x1 = Math.min(cols - 1, Math.ceil(cx + rx));
                var y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(rows - 1, Math.ceil(cy + ry));
                for (var y = y0; y <= y1; y++) {
                    for (var x = x0; x <= x1; x++) {
                        var d = Math.hypot((x - cx) / rx, (y - cy) / ry);
                        if (d < 1) {
                            var i = y * cols + x;
                            ink[i] = Math.min(1.2, ink[i] + (1 - d) * (1 - d) * 0.5 / (steps + 1) * 2);
                        }
                    }
                }
            }
            pointer.px = pointer.x; pointer.py = pointer.y;
        }

        function frame(now) {
            requestAnimationFrame(frame);
            if (!visible || !cols) return;
            var t = (now - start) / 1000;
            var C = getColors();
            deposit();
            ctx.clearRect(0, 0, W, H);

            // 渐变色：右上青 → 左下蓝
            var grad = ctx.createLinearGradient(W, 0, W * 0.15, H);
            grad.addColorStop(0, C.g1);
            grad.addColorStop(1, C.g2);

            var front = t * 0.85 - 0.1;     // 开场：从右上角向外铺开
            // 人像若隐若现：整体缓慢明暗起伏，另有一道很淡的光自上而下扫过
            var breath = 0.55 + 0.45 * Math.sin(t * 0.55 - 1.2);
            var sweepY = ((t * 0.08) % 1.4) - 0.2;
            var lvA = [], lvB = [], lvC = [], hot = [];
            var lines = mode === 'ascii' ? [] : null;
            var last = RAMP.length - 1;
            var aspect = H / W;

            for (var y = 0; y < rows; y++) {
                var gy = (y + 0.5) * ph / H;
                var line = '';
                for (var x = 0; x < cols; x++) {
                    var gx = (x + 0.5) * pw / W;
                    var i = y * cols + x;

                    var n = noise(gx * 9 + t * 0.12, gy * 9 * aspect - t * 0.09);
                    var n2 = noise(gx * 31 - t * 0.5, gy * 31 * aspect);
                    var d, v, m = mask[i];
                    if (pmask && pmask[i] > 0) {
                        var sw = Math.max(0, 1 - Math.abs(gy - sweepY) * 7);
                        m = Math.max(m, pmask[i] * (breath + sw * 0.35));
                    }
                    if (!fieldOn) {
                        // 人像：只有照片本身，自上而下显影，明暗随噪声轻轻呼吸
                        d = gy * 1.1;
                        v = m * (1.05 + 0.24 * (n - 0.5)) + (m > 0.02 ? (n2 - 0.5) * 0.08 : 0);
                    } else {
                        d = Math.hypot((1 - gx), gy * aspect * 1.15);
                        var g = Math.pow(smooth(1 - d / 1.12), 1.35);
                        v = g * 1.02 + (n - 0.5) * 0.42 * (0.35 + g) + (n2 - 0.5) * 0.12;
                        if (hash(x * 1.3, y * 0.7) > 0.992) v += 0.35 * (0.5 + 0.5 * Math.sin(t * 2 + x));   // 零星闪点
                        v = v * (1 - halo[i] * 0.92) + m * (0.78 + 0.22 * n);
                    }

                    for (var k = 0; k < ripples.length; k++) {
                        var rp = ripples[k];
                        var age = (now - rp.t) / 1000;
                        var band = Math.hypot((x + 0.5) * pw - rp.x, (y + 0.5) * ph - rp.y) - age * 520;
                        if (band > -26 && band < 26) v += (1 - Math.abs(band) / 26) * 0.5 * Math.max(0, 1 - age / 1.4);
                    }

                    var reveal = smooth((front - d * 0.9) * 2.2);
                    v *= reveal * (1 - fade * (0.55 + 0.45 * n2));
                    var w = ink[i];
                    v += w * 0.75;

                    if (mode === 'ascii') {
                        if (v <= 0.06) { line += ' '; continue; }
                        var ch = RAMP.charAt(Math.min(last, Math.floor(v * last)));
                        if (w > 0.3) { hot.push(x, y, ch); line += ' '; } else line += ch;
                        continue;
                    }

                    var thr = BAYER[(x & 3) + ((y & 3) << 2)];
                    if (mode === 'halftone') {
                        if (v < 0.08) continue;
                        var s = Math.min(1, v) * pw * 0.92;
                        var o = (pw - s) / 2;
                        (w > 0.3 ? hot : v > 0.75 ? lvA : v > 0.45 ? lvB : lvC).push(x * pw + o, y * ph + o, s, s);
                        continue;
                    }
                    if (v <= thr) continue;
                    var gap = mode === 'braille' ? pw * 0.42 : 1.4;
                    (w > 0.3 ? hot : v > 0.8 ? lvA : v > 0.5 ? lvB : lvC).push(x * pw, y * ph, pw - gap, ph - gap);
                }
                if (lines) lines.push(line);
            }

            if (mode === 'ascii') {
                ctx.font = '400 ' + fs + 'px "IBM Plex Mono", ui-monospace, monospace';
                ctx.textBaseline = 'top';
                ctx.fillStyle = grad;
                for (var r = 0; r < lines.length; r++) ctx.fillText(lines[r], 0, r * ph);
                ctx.fillStyle = C.hot;
                for (var a = 0; a < hot.length; a += 3) ctx.fillText(hot[a + 2], hot[a] * pw, hot[a + 1] * ph);
                return finish(now);
            }

            ctx.fillStyle = grad;
            paint(lvC, 0.38); paint(lvB, 0.7); paint(lvA, 1);
            ctx.fillStyle = C.hot;
            paint(hot, 1);
            ctx.globalAlpha = 1;
            finish(now);
        }

        function paint(list, alpha) {
            if (!list.length) return;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            for (var j = 0; j < list.length; j += 4) ctx.rect(list[j], list[j + 1], list[j + 2], list[j + 3]);
            ctx.fill();
        }

        function finish(now) {
            for (var j = 0; j < ink.length; j++) if (ink[j] > 0.001) ink[j] *= 0.965; else ink[j] = 0;
            ripples = ripples.filter(function (rp) { return now - rp.t < 1400; });
        }

        resize();
        requestAnimationFrame(frame);
        new ResizeObserver(function () { resize(); }).observe(canvas);
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(canvas);
        }

        return {
            modes: MODES,
            getMode: function () { return mode; },
            setMode: function (m) { if (MODES.indexOf(m) > -1 && m !== mode) { mode = m; grid(); } },
            refresh: function () { buildMask(); },
            setFade: function (f) { fade = Math.max(0, Math.min(1, f)); },
            replay: function () { start = performance.now(); }
        };
    }

    window.AsciiHero = { mount: mount };
})();
