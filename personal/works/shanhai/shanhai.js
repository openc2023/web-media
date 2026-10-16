/* 山海 — 一套山脊模拟，五种材质
   模拟（沿用原作算法）每帧画进一张离屏画布 inkCanvas。
   水墨：原作，直接显示。青绿：按山脊几何在绢底上一层层画实的山，石青→石绿→赭金，勾金。
   字符（黑底电光蓝）与孔版（双色 Riso）：由山脊几何算浓度，脊线最浓、往下淡出。
   夜山：把水墨画布反相，月下的山与海。
   釜山实时天气（水墨以外）：风速 → 山脊上升速度，湿度 → 墨迹残留时间。 */
(function () {
    'use strict';

    // ======================== 参数（原作） ========================
    const PARAMS = {
        minSpeed: 40, maxSpeed: 80,
        minAmp: 25, maxAmp: 60,
        minSigma: 0.02, maxSigma: 0.08,
        minPeaks: 2, maxPeaks: 4,
        minSeparation: 0.05,
        fadeAlpha: 0.02,
        lineWidth: 1.0,
        noiseAmp: 3,
        noiseFreq1: 3.5, noiseFreq2: 7.0,
        noiseSpeed1: 0.3, noiseSpeed2: 0.6,
        centerDriftAmp: 0.02,
        centerDriftSpeed: 0.12,
        topFlattenStart: 0.85,
        lineCount: 3,
        inkStyle: 'classic'
    };
    // 配色：宣纸、暖墨、淡墨（雾与远山）、赭金（与题字同色）
    const PAPER = '#f5f2e9';          // 原作纸色
    const PAPER_RGB = '245, 242, 233';
    const INK = '#2b2620';
    const INK_RGB = [43, 38, 32];
    const MIST_RGB = [150, 138, 120];
    const MIST = 'rgb(150, 138, 120)';
    const OCHRE = '#a8814f';
    const mix3 = (a, b, t) => [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t));
    const mix = (a, b, t) => `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)}, ${Math.round(a[1] + (b[1] - a[1]) * t)}, ${Math.round(a[2] + (b[2] - a[2]) * t)})`;

    const STYLES = [
        { id: 'ink', zh: '水墨', en: 'Ink', desc: '原作。灰墨在宣纸上层层晕开。' },
        { id: 'qinglv', zh: '青绿', en: 'Azure', desc: '绢本青绿：峰顶石青，往下石绿，山脚赭金化入留白，脊线勾金。' },
        { id: 'ascii', zh: '字符', en: 'ASCII', desc: '黑底电光蓝，与主页同一套字符语言：脊线以 / \\ _ 写成，山体由字符填满。' },
        { id: 'dither', zh: '孔版', en: 'Riso', desc: '双色孔版印刷：靛蓝山脊、赭黄雾气，略带错版。' },
        { id: 'night', zh: '夜山', en: 'Night', desc: '墨色反相。月下的山，与海上的微光。' }
    ];

    // ======================== 画布 ========================
    const stage = document.getElementById('stage');
    const view = document.getElementById('c');
    const vctx = view.getContext('2d');
    const inkCanvas = document.createElement('canvas');
    const ctx = inkCanvas.getContext('2d');           // 模拟画在这里（原作代码里的 ctx）
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    let W = 0, H = 0;
    let style = 'ink';
    try { const s = localStorage.getItem('shanhai-style'); if (STYLES.some(x => x.id === s)) style = s; } catch (e) {}

    function resize() {
        W = Math.floor(stage.clientWidth);
        H = Math.floor(stage.clientHeight);
        for (const c of [view, inkCanvas]) { c.width = Math.floor(W * dpr); c.height = Math.floor(H * dpr); }
        vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = PAPER;
        ctx.fillRect(0, 0, W, H);
        history.length = 0;
    }

    // ======================== 工具 ========================
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const smooth01 = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
    const gauss = (u, mu, sigma) => { const d = (u - mu) / sigma; return Math.exp(-0.5 * d * d); };
    function hash(x, y) { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); }

    function noise1(u, t, seed) {
        const a = Math.sin((u * PARAMS.noiseFreq1 + t * PARAMS.noiseSpeed1 + seed) * Math.PI * 2);
        const b = Math.sin((u * PARAMS.noiseFreq2 + t * PARAMS.noiseSpeed2 + seed * 1.718) * Math.PI * 2);
        return a * 0.66 + b * 0.34;
    }
    function inkNoise(u, t, seed, amp) {
        const n1 = Math.sin((u * 0.01 + t * 0.2 + seed) * Math.PI * 2);
        const n2 = Math.sin((u * 0.025 + t * 0.4 + seed * 2.3) * Math.PI * 2);
        const n3 = Math.sin((u * 0.05 + t * 0.6 + seed * 5.7) * Math.PI * 2);
        return (n1 * 0.5 + n2 * 0.3 + n3 * 0.2) * amp;
    }

    function getInkColors(lineIndex, total) {
        const base = [{ r: 60 }, { r: 80 }, { r: 100 }, { r: 120 }];
        const depth = 0.3 + Math.pow(lineIndex / total, 1.2) * 0.7;
        const opac = 0.3 + Math.pow(lineIndex / total, 0.8) * 0.7;
        const c = (i, a) => { const v = base[i].r * depth; return `rgba(${v}, ${v}, ${v}, ${a})`; };   // 原作灰墨
        return [c(0, 0), c(1, 0.4 * opac), c(2, 0.7 * opac), c(3, 0.9 * opac)];
    }

    function lineRGB() { return [80, 80, 80]; }   // 原作勾线色

    // ======================== 山脊（原作） ========================
    function makePeak() {
        return {
            mu: lerp(0.15, 0.85, Math.random()),
            sigma: lerp(PARAMS.minSigma, PARAMS.maxSigma, Math.random()),
            w: 0.7 + Math.random() * 0.6,
            seed: Math.random() * 10,
            gradientHeight: 0,
            maxGradientHeight: 80 + Math.random() * 100,
            bottomSeed: Math.random() * 100,
            topSeed: Math.random() * 100,
            inkSpread: 0.4 + Math.random() * 0.5,
            peakOpacity: 0.4 + Math.random() * 0.5
        };
    }
    function newPulse(lineIndex) {
        const k = Math.floor(lerp(PARAMS.minPeaks, PARAMS.maxPeaks + 1, Math.random()));
        const peaks = [];
        for (let m = 0; m < k; m++) {
            let chosen = null;
            for (let tries = 0; tries < 12 && !chosen; tries++) {
                const pk = makePeak();
                if (peaks.every(p => Math.abs(pk.mu - p.mu) >= PARAMS.minSeparation) || Math.random() < 0.2) chosen = pk;
            }
            peaks.push(chosen || makePeak());
        }
        const sumW = peaks.reduce((s, p) => s + p.w, 0);
        for (const p of peaks) p.w /= sumW;
        return {
            y: H + 20 + lineIndex * 60,
            speed: lerp(PARAMS.minSpeed, PARAMS.maxSpeed, Math.random()),
            amp: lerp(PARAMS.minAmp, PARAMS.maxAmp, Math.random()),
            peaks,
            born: performance.now() / 1000,
            inkColors: getInkColors(lineIndex, PARAMS.lineCount),
            lineOpacity: 0.3 + Math.random() * 0.6,
            lastSnap: Infinity
        };
    }

    let pulses = [];
    function initPulses() {
        pulses = [];
        for (let i = 0; i < PARAMS.lineCount; i++) pulses.push(newPulse(i));
    }

    function drawPeakGradient(p, peak, t, progress, topFadeFactor, baseY) {
        const N = Math.max(50, Math.floor(W / 6));
        const step = W / (N - 1);
        const grow = clamp(1 - (p.y / (H + 30)), 0, 1);
        if (progress < PARAMS.topFlattenStart) peak.gradientHeight = peak.maxGradientHeight * smooth01(grow);
        else peak.gradientHeight = peak.maxGradientHeight * (1 - Math.sqrt((progress - PARAMS.topFlattenStart) / (1 - PARAMS.topFlattenStart)));

        const pts = [];
        let minY = H;
        for (let i = 0; i < N; i++) {
            const u = i / (N - 1);
            const drift = Math.sin((t - p.born) * PARAMS.centerDriftSpeed * Math.PI * 2 + peak.seed) * PARAMS.centerDriftAmp;
            const g = gauss(u, clamp(peak.mu + drift, 0, 1), peak.sigma);
            const y = baseY - p.amp * peak.w * g - noise1(u, t, 7.7) * PARAMS.noiseAmp * (1 - topFadeFactor);
            pts.push({ x: i * step, y });
            if (y < minY) minY = y;
        }

        const base = p.inkColors[p.inkColors.length - 1];
        const withA = a => base.replace(/[\d.]+\)$/, a + ')');
        const grad = ctx.createLinearGradient(0, minY, 0, minY + peak.gradientHeight);
        grad.addColorStop(0, base);
        grad.addColorStop(0.3, withA(0.5));
        grad.addColorStop(0.7, withA(0.2));
        grad.addColorStop(1, withA(0));

        ctx.beginPath();
        ctx.moveTo(0, pts[0].y);
        for (let i = 1; i < N; i++) ctx.lineTo(pts[i].x, pts[i].y);
        for (let i = N - 1; i >= 0; i--) {
            const amp = 15 * peak.inkSpread * (1 - Math.sqrt(topFadeFactor));
            ctx.lineTo(pts[i].x, Math.min(H, pts[i].y + peak.gradientHeight + inkNoise(i / (N - 1), t, peak.bottomSeed, amp)));
        }
        ctx.closePath();
        const of = 1 - Math.pow(topFadeFactor, 1.5);
        ctx.globalAlpha = p.lineOpacity * peak.peakOpacity * of;
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < N; i++) ctx.lineTo(pts[i].x, pts[i].y);
        const oc = `rgba(${lineRGB().join(', ')}, ${0.8 * p.lineOpacity * peak.peakOpacity * of})`;
        ctx.shadowColor = oc; ctx.shadowBlur = 8; ctx.strokeStyle = oc;
        ctx.lineWidth = PARAMS.lineWidth * 1.2 * (1 - Math.pow(topFadeFactor, 2));
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    // 画一条山脊，返回它的轮廓点（线描模式用）
    function drawInkMountain(p, t) {
        const N = Math.max(100, Math.floor(W / 3.5));
        const step = W / (N - 1);
        const progress = clamp(1 - (p.y / H), 0, 1);
        let ampScale = 1, topFade = 0;
        if (progress >= PARAMS.topFlattenStart) {
            const tt = (progress - PARAMS.topFlattenStart) / (1 - PARAMS.topFlattenStart);
            ampScale = 1 - smooth01(tt);
            topFade = smooth01(tt);
        }

        const top = new Float32Array(N);
        for (let i = 0; i < N; i++) {
            const u = i / (N - 1);
            let g = 0;
            for (const pk of p.peaks) {
                const drift = Math.sin((t - p.born) * PARAMS.centerDriftSpeed * Math.PI * 2 + pk.seed) * PARAMS.centerDriftAmp;
                g += pk.w * gauss(u, clamp(pk.mu + drift, 0, 1), pk.sigma);
            }
            top[i] = p.y - p.amp * ampScale * g - noise1(u, t, 7.7) * PARAMS.noiseAmp * ampScale;
        }

        for (const peak of p.peaks) drawPeakGradient(p, peak, t, progress, topFade, p.y);

        ctx.beginPath();
        ctx.moveTo(0, top[0]);
        for (let i = 1; i < N; i++) ctx.lineTo(i * step, top[i]);
        const oc = `rgba(${lineRGB().join(', ')}, ${0.85 * p.lineOpacity * (1 - Math.pow(topFade, 2))})`;
        ctx.shadowColor = oc; ctx.shadowBlur = 10; ctx.strokeStyle = oc;
        ctx.lineWidth = PARAMS.lineWidth * 1.6 * (1 - Math.pow(topFade, 2));
        ctx.stroke();
        ctx.shadowBlur = 0;

        if (topFade > 0) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            for (let i = 0; i < N; i++) {
                const off = inkNoise(i / (N - 1), t, p.peaks[0].topSeed, 12 * p.peaks[0].inkSpread) * topFade;
                ctx.lineTo(i * step, Math.max(0, top[i] - off));
            }
            ctx.lineTo(W, 0);
            ctx.closePath();
            ctx.fillStyle = PAPER;
            ctx.globalAlpha = 0.7 * Math.sqrt(topFade);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        return { top, step, fade: topFade, opacity: p.lineOpacity };
    }

    // ======================== 天气 ========================
    const weather = { wind: null, humidity: null };
    // 水墨保持原作参数；其他风格才由天气驱动
    function speedMul() { return style === 'ink' || weather.wind == null ? 1 : 0.75 + clamp(weather.wind / 10, 0, 1) * 0.75; }
    function fadeAlpha() { return style === 'ink' || weather.humidity == null ? PARAMS.fadeAlpha : 0.028 - clamp(weather.humidity / 100, 0, 1) * 0.012; }
    async function fetchBusanWeather() {
        try {
            const url = 'https://api.open-meteo.com/v1/forecast?latitude=35.1796&longitude=129.0756&current=temperature_2m,relative_humidity_2m,wind_speed_10m&wind_speed_unit=ms&timezone=Asia/Seoul';
            const data = await (await fetch(url)).json();
            const c = data.current;
            if (!c) return;
            weather.wind = c.wind_speed_10m;
            weather.humidity = c.relative_humidity_2m;
            document.getElementById('temp').textContent = c.temperature_2m.toFixed(1);
            document.getElementById('humidity').textContent = c.relative_humidity_2m;
            document.getElementById('wind').textContent = c.wind_speed_10m.toFixed(1);
        } catch (e) { /* 离线时保持默认速度 */ }
    }

    // ======================== 渲染器 ========================
    const RAMP = ' .·:-~=+*%#';
    const BACK = String.fromCharCode(92);   // 反斜杠
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
    const history = [];   // 山脊每上升一段留一条轮廓，字符 / 点阵里化作淡淡的余痕

    // 由山脊几何算每格浓度：脊线本身最浓，往下像雾一样淡出；轨迹里较新的山脊留下淡淡的线。
    // 同时记录每格最强脊线的斜率，字符模式用它挑 / \ _ 。
    let shapes = [];
    function ridgeField(cols, rows, cw, ch, nowMs, opt) {
        opt = opt || {};
        const depthK = opt.depth || 0.045, gain = opt.gain || 0.42, histA = opt.hist == null ? 0.2 : opt.hist;
        const keep = new Float32Array(cols * rows).fill(1);   // Π(1 - c)，最后取 1 - keep
        const lineStr = new Float32Array(cols * rows);
        const slope = new Float32Array(cols * rows);
        function add(shape, a, fillDepth) {
            const top = shape.top, n = top.length, step = shape.step;
            for (let c = 0; c < cols; c++) {
                const i = Math.min(n - 1, Math.round((c + 0.5) * cw / step));
                const yr = top[i];
                const s = (top[Math.min(n - 1, i + 1)] - top[Math.max(0, i - 1)]) / (2 * step) * (ch / cw);
                const r0 = Math.max(0, Math.floor(yr / ch) - 1);
                const r1 = Math.min(rows - 1, Math.floor((yr + fillDepth * 3) / ch));
                for (let r = r0; r <= r1; r++) {
                    const cy = (r + 0.5) * ch;
                    const dy = cy - yr;
                    const line = Math.exp(-Math.abs(dy) / (ch * 0.55));
                    const mist = dy > 0 && fillDepth > 0 ? Math.exp(-dy / fillDepth) * gain : 0;
                    const v = a * Math.max(line, mist);
                    if (v < 0.01) continue;
                    const k = r * cols + c;
                    keep[k] *= 1 - Math.min(0.95, v);
                    if (a * line > lineStr[k]) { lineStr[k] = a * line; slope[k] = s; }
                }
            }
        }
        for (const h of history) {
            const a = clamp(1 - (nowMs - h.t) / 7000, 0, 1) * (1 - h.fade) * histA;
            if (a > 0.02) add(h, a, 0);
        }
        for (const s of shapes) add(s, (1 - s.fade) * (0.6 + s.opacity * 0.4), H * depthK);
        const v = new Float32Array(cols * rows);
        for (let k = 0; k < v.length; k++) v[k] = 1 - keep[k];
        return { v, lineStr, slope };
    }

    function paper() { vctx.globalAlpha = 1; vctx.fillStyle = PAPER; vctx.fillRect(0, 0, W, H); }

    const SEA_TOP = 0.84;   // 海面占卷底约 16%
    function seaLine(k, x, t) {
        const amp = 1.2 + k * 0.9;
        return Math.sin(x * (0.018 - k * 0.0012) + t * (0.5 + k * 0.07) + k * 1.7) * amp
             + Math.sin(x * 0.047 + t * 0.9 + k) * amp * 0.35;
    }
    function seaRows() {
        const rows = [];
        const top = H * SEA_TOP, depth = H - top;
        for (let k = 0; k < 9; k++) rows.push(top + Math.pow(k / 8, 1.55) * depth * 0.96);
        return rows;
    }
    // 细线水纹，越近（越靠下）越清楚
    function drawSeaStrokes(t, ca, cb, wash) {
        if (wash) {
            const g = vctx.createLinearGradient(0, H * SEA_TOP - 20, 0, H);
            g.addColorStop(0, `rgba(${ca.join(',')}, 0)`);
            g.addColorStop(1, `rgba(${ca.join(',')}, ${wash})`);
            vctx.globalAlpha = 1;
            vctx.fillStyle = g;
            vctx.fillRect(0, H * SEA_TOP - 20, W, H);
        }
        const rows = seaRows();
        vctx.lineWidth = 0.8;
        for (let k = 0; k < rows.length; k++) {
            vctx.beginPath();
            for (let x = 0; x <= W; x += 4) {
                const y = rows[k] + seaLine(k, x, t);
                if (x === 0) vctx.moveTo(x, y); else vctx.lineTo(x, y);
            }
            vctx.strokeStyle = mix(ca, cb, k / 9);
            vctx.globalAlpha = 0.2 + k * 0.05;
            vctx.stroke();
        }
        vctx.globalAlpha = 1;
    }

    function renderInk() { vctx.drawImage(inkCanvas, 0, 0, W, H); }

    // 青绿：绢底上一层层实的山。峰顶石青、往下石绿、山脚赭金再淡出留白；远山更淡，脊线勾金。
    const QL = [[36, 92, 118], [48, 118, 96], [28, 74, 96]];    // 每条山脊的峰顶色
    const QL_GREEN = [88, 150, 116], QL_FAR = [120, 160, 170], QL_GOLD = [190, 144, 70];
    function mountainLayer(top, step, rgb, alpha, depth, gold) {
        const n = top.length;
        let minY = Infinity;
        for (let i = 0; i < n; i++) if (top[i] < minY) minY = top[i];
        const g = vctx.createLinearGradient(0, minY, 0, minY + depth);
        g.addColorStop(0, `rgba(${rgb.join(',')}, ${alpha})`);
        g.addColorStop(0.32, `rgba(${QL_GREEN.join(',')}, ${alpha * 0.85})`);
        g.addColorStop(0.68, `rgba(${QL_GOLD.join(',')}, ${alpha * 0.45})`);
        g.addColorStop(1, `rgba(${QL_GOLD.join(',')}, 0)`);
        vctx.beginPath();
        vctx.moveTo(0, top[0]);
        for (let i = 1; i < n; i++) vctx.lineTo(i * step, top[i]);
        vctx.lineTo(W, top[n - 1] + depth);
        vctx.lineTo(0, top[0] + depth);
        vctx.closePath();
        vctx.fillStyle = g;
        vctx.fill();
        if (gold > 0) {
            vctx.beginPath();
            vctx.moveTo(0, top[0]);
            for (let i = 1; i < n; i++) vctx.lineTo(i * step, top[i]);
            vctx.strokeStyle = `rgba(184, 138, 58, ${gold})`;
            vctx.lineWidth = 1.1;
            vctx.stroke();
        }
    }
    function renderQinglv(t, nowMs) {
        // 绢底
        let g = vctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#efe4cb');
        g.addColorStop(1, '#e3d3b0');
        vctx.globalAlpha = 1;
        vctx.fillStyle = g;
        vctx.fillRect(0, 0, W, H);
        // 远山：从轨迹里挑几条间隔开的旧山脊
        const far = history.filter(h => nowMs - h.t < 12000 && h.fade < 0.9).sort((a, b) => a.base - b.base);
        let lastBase = -Infinity, picked = 0;
        for (const h of far) {
            if (h.base - lastBase < H * 0.07 || picked >= 5) continue;
            lastBase = h.base; picked++;
            const a = clamp(1 - (nowMs - h.t) / 12000, 0, 1) * (1 - h.fade);
            mountainLayer(h.top, h.step, QL_FAR, 0.35 * a, H * 0.16, 0.35 * a);
        }
        // 近山：当前的三条山脊，从远到近画
        const order = shapes.map((s, i) => i).sort((a, b) => Math.min(...shapes[a].top) - Math.min(...shapes[b].top));
        for (const i of order) {
            const s = shapes[i];
            const a = 1 - s.fade;
            if (a <= 0.02) continue;
            mountainLayer(s.top, s.step, QL[i % QL.length], 0.92 * a, H * 0.24, 0.9 * a);
        }
        drawSeaStrokes(t, [60, 120, 140], [176, 136, 66], 0.1);
    }

    // 字符：黑底电光蓝（与主页一致）。脊线亮青，山体用字符梯度填满，越往下越暗越稀。
    const CYAN = [150, 230, 255], BLUE = [40, 110, 255], DEEP = [24, 52, 140];
    function renderAscii(t, nowMs) {
        const cw = W < 360 ? 7 : 8, ch = cw * 1.6;
        const cols = Math.ceil(W / cw), rows = Math.ceil(H / ch);
        const f = ridgeField(cols, rows, cw, ch, nowMs, { depth: 0.12, gain: 0.95, hist: 0 });
        vctx.globalAlpha = 1;
        vctx.fillStyle = '#040508';
        vctx.fillRect(0, 0, W, H);
        vctx.font = `500 ${Math.round(ch * 0.92)}px "IBM Plex Mono", ui-monospace, monospace`;
        vctx.textBaseline = 'top';
        const slot = Math.floor(t * 0.8);
        const last = RAMP.length - 1;
        const cjk = [];
        const seaRow = Math.floor(H * SEA_TOP / ch);
        for (let y = 0; y < rows; y++) {
            const gy = y / rows;
            for (let x = 0; x < cols; x++) {
                const k = y * cols + x;
                const v = f.v[k];
                if (v < 0.08) {
                    if (y >= seaRow) {
                        const d = (y - seaRow) / Math.max(1, rows - seaRow);
                        const w = Math.sin(x * 0.42 - t * (0.9 + d) + y * 1.3) + Math.sin(x * 0.13 + t * 0.4 + y) * 0.6;
                        if (w > 0.7 - d * 0.5) {
                            vctx.fillStyle = mix(DEEP, BLUE, d);
                            vctx.globalAlpha = 0.55 + d * 0.4;
                            vctx.fillText(w > 1.15 ? '~' : '-', x * cw, y * ch);
                        }
                    }
                    continue;
                }
                const ridge = f.lineStr[k] > 0.35 && f.lineStr[k] >= v * 0.75;
                let c;
                if (ridge) {
                    const sl = f.slope[k];
                    c = Math.abs(sl) > 2.4 ? '|' : sl < -0.35 ? '/' : sl > 0.35 ? BACK : '_';
                    vctx.fillStyle = mix(CYAN, [235, 250, 255], f.lineStr[k] * 0.6);
                    vctx.globalAlpha = 1;
                } else if (v > 0.25 && v < 0.55 && hash(x + slot * 3.1, y) > 0.988) {
                    cjk.push(x, y, v);
                    continue;
                } else {
                    c = RAMP.charAt(Math.max(1, Math.round(v * last)));
                    // 山体：浓处偏亮蓝，淡处沉成深蓝；整幅上青下蓝
                    vctx.fillStyle = mix(mix3(DEEP, BLUE, v), CYAN, Math.max(0, v - 0.55) * 0.9 * (1 - gy * 0.5));
                    vctx.globalAlpha = 0.55 + v * 0.45;
                }
                vctx.fillText(c, x * cw, y * ch);
            }
        }
        vctx.font = `600 ${Math.round(ch * 0.9)}px "Noto Serif SC", serif`;
        vctx.fillStyle = '#ffffff';
        for (let i = 0; i < cjk.length; i += 3) {
            vctx.globalAlpha = 0.75;
            vctx.fillText(hash(cjk[i], cjk[i + 1] + slot) > 0.5 ? '山' : '海', cjk[i] * cw - cw * 0.2, cjk[i + 1] * ch);
        }
        vctx.globalAlpha = 1;
    }

    // 孔版：靛蓝 + 赭黄两版，正片叠底，黄版略错位，个别网点漏印
    function renderRiso(nowMs) {
        const cell = W < 360 ? 2.5 : 3;
        const cols = Math.ceil(W / cell), rows = Math.ceil(H / cell);
        const f = ridgeField(cols, rows, cell, cell, nowMs);
        const t = nowMs / 1000;
        const seaRow = Math.floor(H * SEA_TOP / cell);
        vctx.globalAlpha = 1;
        vctx.fillStyle = '#f2ece0';
        vctx.fillRect(0, 0, W, H);
        const blue = new Path2D(), yellow = new Path2D();
        const s = cell - 0.6;
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const k = y * cols + x;
                const v = f.v[k];
                if (v * 1.1 <= BAYER[(x & 3) + ((y & 3) << 2)] || hash(x, y) > 0.96) continue;
                if (f.lineStr[k] > 0.25) blue.rect(x * cell, y * cell, s, s);
                else {
                    yellow.rect(x * cell, y * cell, s, s);
                    if (v > 0.5) blue.rect(x * cell, y * cell, s, s);   // 浓雾处两版叠印
                }
            }
        }
        const sea = seaRows();
        for (let k = 0; k < sea.length; k++) {
            for (let x = 0; x < cols; x++) {
                const y = Math.round((sea[k] + seaLine(k, x * cell, t)) / cell);
                if (y < seaRow || y >= rows) continue;
                if (0.3 + k * 0.07 > BAYER[(x & 3) + ((y & 3) << 2)]) (k > 4 ? blue : yellow).rect(x * cell, y * cell, s, s);
            }
        }
        vctx.globalCompositeOperation = 'multiply';
        vctx.save();
        vctx.translate(1.2, 0.8);
        vctx.fillStyle = '#e3a73a';
        vctx.fill(yellow);
        vctx.restore();
        vctx.fillStyle = '#2d4f8f';
        vctx.fill(blue);
        vctx.globalCompositeOperation = 'source-over';
    }

    // 夜山：水墨画布反相，染成月光蓝，天色压成深靛，加月与星
    function renderNight(t) {
        vctx.globalAlpha = 1;
        vctx.fillStyle = '#fff';
        vctx.fillRect(0, 0, W, H);
        vctx.globalCompositeOperation = 'difference';
        vctx.drawImage(inkCanvas, 0, 0, W, H);
        vctx.globalCompositeOperation = 'multiply';
        let g = vctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#d2dcf0');
        g.addColorStop(1, '#8496b8');
        vctx.fillStyle = g;
        vctx.fillRect(0, 0, W, H);
        vctx.globalCompositeOperation = 'screen';
        g = vctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#1d2742');
        g.addColorStop(1, '#090c15');
        vctx.fillStyle = g;
        vctx.fillRect(0, 0, W, H);
        // 星
        vctx.fillStyle = '#dfe6f5';
        for (let i = 0; i < 46; i++) {
            vctx.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * (0.8 + hash(i, 3)) + i));
            const r = hash(i, 4) > 0.85 ? 1.4 : 0.9;
            vctx.fillRect(hash(i, 1) * W, hash(i, 2) * H * 0.42, r, r);
        }
        // 月
        const mx = W * 0.3, my = H * 0.13, mr = W * 0.055;
        g = vctx.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 5);
        g.addColorStop(0, 'rgba(225, 230, 245, 0.22)');
        g.addColorStop(1, 'rgba(225, 230, 245, 0)');
        vctx.globalAlpha = 1;
        vctx.fillStyle = g;
        vctx.fillRect(mx - mr * 5, my - mr * 5, mr * 10, mr * 10);
        vctx.globalCompositeOperation = 'source-over';
        vctx.fillStyle = '#f1ead6';
        vctx.globalAlpha = 0.95;
        vctx.beginPath();
        vctx.arc(mx, my, mr, 0, Math.PI * 2);
        vctx.fill();
        vctx.globalAlpha = 1;
        drawSeaStrokes(t, [70, 88, 120], [190, 205, 230], 0);
    }

    // ======================== 主循环 ========================
    let lastT = performance.now() / 1000;
    function tick() {
        const nowMs = performance.now();
        const now = nowMs / 1000;
        const dt = Math.min(0.05, now - lastT);
        lastT = now;

        ctx.fillStyle = `rgba(${PAPER_RGB}, ${fadeAlpha()})`;
        ctx.fillRect(0, 0, W, H);

        const mul = speedMul();
        shapes = [];
        for (let i = 0; i < pulses.length; i++) {
            const p = pulses[i];
            p.y -= p.speed * mul * dt;
            const shape = drawInkMountain(p, now);
            shapes.push(shape);
            if (p.lastSnap - p.y > 7) {
                p.lastSnap = p.y;
                const n = shape.top.length, k = 2, top = new Float32Array(Math.ceil(n / k));
                for (let j = 0; j < top.length; j++) top[j] = shape.top[Math.min(n - 1, j * k)];
                history.push({ top, step: shape.step * k, base: p.y, t: nowMs, fade: shape.fade, opacity: shape.opacity });
                if (history.length > 70) history.shift();
            }
            if (p.y < -30) pulses[i] = newPulse(i);
        }

        if (style === 'ascii') renderAscii(now, nowMs);
        else if (style === 'dither') renderRiso(nowMs);
        else if (style === 'qinglv') renderQinglv(now, nowMs);
        else if (style === 'night') renderNight(now);
        else renderInk();

        requestAnimationFrame(tick);
    }

    // ======================== 界面 ========================
    const list = document.getElementById('styles');
    const caption = document.getElementById('caption');
    const desc = document.getElementById('styleDesc');
    function renderStyles() {
        list.innerHTML = STYLES.map((s, i) =>
            `<li><button type="button" data-style="${s.id}" aria-pressed="${s.id === style}">` +
            `<span class="k">0${i + 1}</span><span class="zh">${s.zh}</span><span class="en">${s.en}</span></button></li>`
        ).join('');
        const cur = STYLES.find(s => s.id === style);
        caption.textContent = `${cur.zh} · ${cur.en.toUpperCase()}`;
        desc.textContent = cur.desc;
        document.body.dataset.style = style;
        stage.dataset.style = style;
    }
    function setStyle(id) {
        if (!STYLES.some(s => s.id === id)) return;
        style = id;
        try { localStorage.setItem('shanhai-style', id); } catch (e) {}
        renderStyles();
        // 切换时画面淡入一下
        stage.classList.remove('swap');
        void stage.offsetWidth;
        stage.classList.add('swap');
    }
    list.addEventListener('click', e => {
        const b = e.target.closest('[data-style]');
        if (b) setStyle(b.dataset.style);
    });

    const bgm = document.getElementById('bgm');
    const soundBtn = document.getElementById('soundBtn');
    function toggleSound() {
        const on = bgm.paused;
        if (on) bgm.play().catch(() => {}); else bgm.pause();
        soundBtn.setAttribute('aria-pressed', on);
        document.getElementById('soundLabel').textContent = on ? '声音 开' : '声音 关';
    }
    soundBtn.addEventListener('click', toggleSound);

    stage.addEventListener('click', () => { initPulses(); history.length = 0; });

    document.addEventListener('keydown', e => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (/^[1-5]$/.test(e.key)) setStyle(STYLES[+e.key - 1].id);
        else if (e.key === 'm' || e.key === 'M') setStyle(STYLES[(STYLES.findIndex(s => s.id === style) + 1) % STYLES.length].id);
        else if (e.key === 's' || e.key === 'S') toggleSound();
    });

    new ResizeObserver(() => { resize(); }).observe(stage);
    resize();
    initPulses();
    renderStyles();
    fetchBusanWeather();
    setInterval(fetchBusanWeather, 10 * 60 * 1000);
    requestAnimationFrame(tick);
})();
