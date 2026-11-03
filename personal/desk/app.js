(function () {
  "use strict";

  var LANGUAGES = window.DESK_LANGUAGES;
  function detectLanguage() {
    try {
      var saved = localStorage.getItem("desk-lang");
      if (["zh", "en", "ko"].indexOf(saved) > -1) return saved;
    } catch (e) {}
    var preferred = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""];
    for (var i = 0; i < preferred.length; i++) {
      var code = String(preferred[i]).toLowerCase().split(/[-_]/)[0];
      if (["zh", "en", "ko"].indexOf(code) > -1) return code;
    }
    return "en";
  }
  var lang = detectLanguage();
  var DATA = LANGUAGES[lang];
  var ORDER = ["about", "path", "papers", "works", "books", "elsewhere", "company", "contact"];

  var root = document.documentElement, app = document.getElementById("app");
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  var layout = "scroll", active = "top", query = "";

  /* theme */
  function setTheme(t) { root.dataset.theme = t; $("statusTheme").textContent = "theme: " + t; }
  $("themeBtn").addEventListener("click", function () { setTheme(root.dataset.theme === "dark" ? "light" : "dark"); });
  $("statusTheme").addEventListener("click", function () { setTheme(root.dataset.theme === "dark" ? "light" : "dark"); });

  function readColors() {
    var cs = getComputedStyle(root), v = function (n) { return cs.getPropertyValue(n).trim(); };
    return { g1: v("--g1"), g2: v("--g2"), hot: v("--hot"), dot: v("--accent"), char: v("--ink-2") };
  }
  var colors = readColors();
  new MutationObserver(function () { colors = readColors(); }).observe(root, { attributes: true, attributeFilter: ["data-theme"] });

  function hash(x, y) { var h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); }
  function smooth(t) { return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t); }
  function noise(x, y) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = smooth(x - ix), fy = smooth(y - iy);
    var a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }

  function mountBg(canvas, opts) {
    var RAMP = ".·:-=+*xo%#@", BRAND = "07S", GLITCH = "07S#%/\\<>=+*";
    var ctx = canvas.getContext("2d"), W = 0, H = 0, dpr = 1, cell = 16, fs = 11;
    var pointer = { x: -999, y: -999, on: false }, light = 0, lastY = 0, vel = 0, last = 0;
    var touch = matchMedia("(hover: none)").matches;
    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cell = W < 640 ? 18 : 16; fs = W < 640 ? 10 : 11;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", function (e) { if (e.pointerType !== "touch") { pointer.x = e.clientX; pointer.y = e.clientY; pointer.on = true; } }, { passive: true });
    document.addEventListener("pointerleave", function () { pointer.on = false; });
    function frame(now) {
      requestAnimationFrame(frame);
      if (now - last < 32) return; last = now;
      if (canvas.style.opacity === "0") return;
      var t = now / 1000, sy = opts.getScrollY();
      vel += ((sy - lastY) - vel) * 0.25; lastY = sy;
      var speed = Math.min(1, Math.abs(vel) / 45);
      light += ((pointer.on && !touch ? 1 : 0) - light) * 0.08;
      var C = opts.getColors();
      ctx.clearRect(0, 0, W, H);
      var par = sy * 0.5, rowShift = Math.floor(par / cell), off = par - rowShift * cell;
      var cols = Math.ceil(W / cell) + 1, rows = Math.ceil(H / cell) + 2, R = 190, dots = [], chars = [];
      for (var r = 0; r < rows; r++) {
        var gy = r + rowShift, py = r * cell - off;
        for (var c = 0; c < cols; c++) {
          var px = c * cell, n = noise(c * 0.07 + t * 0.04, gy * 0.07 - t * 0.03), v = (n - 0.56) * 2.6;
          if (speed > 0.02) v += speed * 0.55 * hash(c, gy + Math.floor(t * 8));
          var f = 0;
          if (light > 0.01) { var d = Math.hypot(px + cell / 2 - pointer.x, py + cell / 2 - pointer.y); f = smooth(1 - d / R) * light; v += f * (0.55 + 0.45 * hash(c * 3.1, gy * 1.7)); }
          if (v < 0.06) continue;
          if (f > 0.12) chars.push(px, py, Math.min(1, v), f);
          else if (v > 0.42) chars.push(px, py, Math.min(1, v), 0.3 + (v - 0.42) * 0.4);
          else dots.push(px + cell / 2 - 1, py + cell / 2 - 1, Math.min(1, v));
        }
      }
      ctx.fillStyle = C.dot;
      for (var i = 0; i < dots.length; i += 3) { ctx.globalAlpha = 0.18 + dots[i + 2] * 0.5; ctx.fillRect(dots[i], dots[i + 1], 2, 2); }
      ctx.font = "400 " + fs + 'px "IBM Plex Mono", ui-monospace, monospace'; ctx.textBaseline = "top";
      var lastIdx = RAMP.length - 1, slot = Math.floor(t * 1.5), marks = [];
      ctx.fillStyle = C.char;
      for (var j = 0; j < chars.length; j += 4) {
        var cx = chars[j], cy = chars[j + 1], k = hash(cx * 0.119 + slot * 3.7, (cy + par) * 0.143);
        if (k > 0.74) { marks.push(cx, cy, chars[j + 3], BRAND.charAt(Math.floor(k * 1000) % 3)); continue; }
        ctx.globalAlpha = Math.min(0.55, chars[j + 3] * 0.7);
        ctx.fillText(RAMP.charAt(Math.floor(chars[j + 2] * lastIdx)), cx + cell * 0.2, cy + cell * 0.12);
      }
      ctx.fillStyle = C.dot;
      for (var q = 0; q < marks.length; q += 4) { ctx.globalAlpha = Math.min(0.8, marks[q + 2] * 1.05); ctx.fillText(marks[q + 3], marks[q] + cell * 0.2, marks[q + 1] + cell * 0.12); }
      for (var wr = 0; wr < rows; wr++) {
        var wy = wr + rowShift;
        for (var wc = 0; wc + 2 < cols; wc += 3) {
          var seed = hash(wc * 0.31, wy * 0.57), life = t / 5 + seed * 9, gen = Math.floor(life);
          if (hash(wc * 1.7 + gen * 5.3, wy * 2.9) < 0.986) continue;
          var ph = life - gen, a = Math.sin(ph * Math.PI), wx = wc * cell, wpy = wr * cell - off;
          ctx.globalAlpha = Math.min(0.85, a * 0.5);
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
    return { setOpacity: function (o) { canvas.style.opacity = o <= 0.01 ? "0" : String(o); } };
  }

  function mountHero(canvas, opts) {
    var RAMP = " .·:-=+*xo%#@";
    var MARK = "M161.001,304C234.469,180.024,367.89,104,512,104s277.531,76.024,350.999,200H161.001z M111.92,432H585L301.519,861.517C154.021,772.693,78.16,600.836,111.92,432z M744,432h168.08c26.899,134.521-15.606,273.554-113.127,370.038s-237.001,137.5-371.226,109.164L744,432z";
    var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(function (v) { return (v + 0.5) / 16; });
    var MODES = ["dither", "halftone", "ascii", "braille"];
    var ctx = canvas.getContext("2d"), glyph = opts.glyph == null ? "田漢" : opts.glyph;
    var mode = MODES.indexOf(opts.mode) > -1 ? opts.mode : "dither";
    var W = 0, H = 0, dpr = 1, cols = 0, rows = 0, pw = 7, ph = 7, fs = 12, mask, halo, ink;
    var pointer = { x: -1, y: -1, px: -1, py: -1, inside: false };
    var ripples = [];
    var portraitMask = null, portraitMotion = matchMedia("(prefers-reduced-motion: reduce)");
    var start = performance.now(), visible = true, fade = 0;
    function grid() {
      var small = W < 640;
      if (mode === "ascii") { fs = small ? 10 : 12; pw = fs * 0.6; ph = fs * 1.2; }
      else if (mode === "braille") { pw = small ? 3 : 3.5; ph = pw; }
      else if (mode === "halftone") { pw = ph = small ? 7 : 9; }
      else { pw = ph = small ? 5 : 7; }
      cols = Math.ceil(W / pw); rows = Math.ceil(H / ph);
      ink = new Float32Array(cols * rows); buildMask();
    }
    function buildMask() {
      mask = new Float32Array(cols * rows); halo = new Float32Array(cols * rows);
      if (!W || !H) return;
      var L = opts.layout(W, H), S = 0.25;
      var w = Math.max(1, Math.round(W * S)), h = Math.max(1, Math.round(H * S));
      var off = document.createElement("canvas"); off.width = w; off.height = h;
      var o = off.getContext("2d", { willReadFrequently: true }), size = L.size * S;
      o.textAlign = "center"; o.textBaseline = "middle";
      o.font = "900 " + size + 'px "Noto Serif SC", "Noto Serif TC", serif';
      o.fillStyle = "#000"; o.fillRect(0, 0, w, h);
      o.fillStyle = "#fff";
      if (glyph && size > 0) o.fillText(glyph, L.x * w, L.y * h + size * 0.04);
      if (opts.markLayout) {
        var mL = opts.markLayout(W, H), ms = mL.size * S;
        o.save();
        // Layout coordinates describe the logo center, as on the reference page.
        o.translate(mL.x * w - ms / 2, mL.y * h - ms / 2);
        o.scale(ms / 1024, ms / 1024);
        o.fillStyle = "#fff";
        o.fill(new Path2D(MARK));
        o.restore();
      }
      var a = o.getImageData(0, 0, w, h).data;
      // Feather the negative shape into the moving dots, matching the reference.
      var blurred = document.createElement("canvas"); blurred.width = w; blurred.height = h;
      var bctx = blurred.getContext("2d", { willReadFrequently: true });
      bctx.filter = "blur(" + Math.max(2, (opts.markLayout ? opts.markLayout(W, H).size * S : size) * 0.045) + "px)";
      bctx.drawImage(off, 0, 0);
      var b = bctx.getImageData(0, 0, w, h).data;
      for (var y = 0; y < rows; y++) {
        var sy = Math.min(h - 1, Math.floor((y + 0.5) * ph * S));
        for (var x = 0; x < cols; x++) {
          var sx = Math.min(w - 1, Math.floor((x + 0.5) * pw * S)), k = (sy * w + sx) * 4;
          mask[y * cols + x] = a[k] / 255;
          halo[y * cols + x] = Math.min(1, b[k] / 255 * 1.5);
        }
      }
      buildPortraitMask();
    }
    function buildPortraitMask() {
      portraitMask = null;
      var image = opts.portrait;
      if (!image || !image.complete || !image.naturalWidth || !cols || !rows) return;
      var position = opts.portraitLayout(W, H);
      var height = position.size, width = height * image.naturalWidth / image.naturalHeight;
      var off = document.createElement("canvas"); off.width = cols; off.height = rows;
      var context = off.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, (position.x * W - width / 2) / pw, (position.y * H - height / 2) / ph, width / pw, height / ph);
      var pixels = context.getImageData(0, 0, cols, rows).data;
      portraitMask = new Float32Array(cols * rows);
      for (var i = 0; i < portraitMask.length; i++) {
        var alpha = pixels[i * 4 + 3] / 255, luminance = pixels[i * 4] / 255;
        portraitMask[i] = alpha * (0.14 + 0.96 * Math.pow(luminance, 1.05)) * 0.38;
      }
    }
    function resize() {
      var rect = canvas.getBoundingClientRect();
      W = rect.width; H = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); grid();
    }
    function toCell(e) { var r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / pw, y: (e.clientY - r.top) / ph }; }
    opts.pointerTarget.addEventListener("pointermove", function (e) { var c = toCell(e); pointer.x = c.x; pointer.y = c.y; pointer.inside = true; });
    opts.pointerTarget.addEventListener("pointerleave", function () { pointer.inside = false; pointer.px = -1; });
    opts.pointerTarget.addEventListener("pointerdown", function (e) {
      if (e.target.closest && e.target.closest("a, button, input")) return;
      var c = toCell(e);
      ripples.push({ x: c.x * pw, y: c.y * ph, t: performance.now() });
      if (ripples.length > 6) ripples.shift();
    });
    function deposit() {
      if (!pointer.inside) return;
      var sx = pointer.px < 0 ? pointer.x : pointer.px, sy = pointer.px < 0 ? pointer.y : pointer.py;
      var dx = pointer.x - sx, dy = pointer.y - sy, rpx = 34, steps = Math.max(1, Math.ceil(Math.hypot(dx * pw, dy * ph) / 6)), rx = rpx / pw, ry = rpx / ph;
      for (var s = 0; s <= steps; s++) {
        var cx = sx + dx * s / steps, cy = sy + dy * s / steps;
        var x0 = Math.max(0, Math.floor(cx - rx)), x1 = Math.min(cols - 1, Math.ceil(cx + rx));
        var y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(rows - 1, Math.ceil(cy + ry));
        for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
          var d = Math.hypot((x - cx) / rx, (y - cy) / ry);
          if (d < 1) { var i = y * cols + x; ink[i] = Math.min(1.2, ink[i] + (1 - d) * (1 - d) * 0.5 / (steps + 1) * 2); }
        }
      }
      pointer.px = pointer.x; pointer.py = pointer.y;
    }
    function frame(now) {
      requestAnimationFrame(frame);
      if (!visible || !cols) return;
      var t = (now - start) / 1000, C = opts.getColors();
      deposit(); ctx.clearRect(0, 0, W, H);
      var grad = ctx.createLinearGradient(W, 0, W * 0.15, H); grad.addColorStop(0, C.g1); grad.addColorStop(1, C.g2);
      var front = t * 0.85 - 0.1, aspect = H / W, last = RAMP.length - 1;
      // Same slow luminance breathing as the existing GitHub portrait, without a separate image overlay.
      var breath = portraitMotion.matches ? 0.65 : 0.55 + 0.45 * Math.sin(t * 0.55 - 1.2);
      var portraitGain = opts.portraitGain ? opts.portraitGain() : 1;
      var sweepY = ((t * 0.08) % 1.4) - 0.2;
      var lvA = [], lvB = [], lvC = [], hot = [], lines = mode === "ascii" ? [] : null;
      for (var y = 0; y < rows; y++) {
        var gy = (y + 0.5) * ph / H, line = "";
        for (var x = 0; x < cols; x++) {
          var gx = (x + 0.5) * pw / W, i = y * cols + x;
          var n = noise(gx * 9 + t * 0.12, gy * 9 * aspect - t * 0.09), n2 = noise(gx * 31 - t * 0.5, gy * 31 * aspect);
          var d = Math.hypot(1 - gx, gy * aspect * 1.15), g = Math.pow(smooth(1 - d / 1.12), 1.35);
          var v = g * 1.02 + (n - 0.5) * 0.42 * (0.35 + g) + (n2 - 0.5) * 0.12;
          if (hash(x * 1.3, y * 0.7) > 0.992) v += 0.35 * (0.5 + 0.5 * Math.sin(t * 2 + x));
          v = v * (1 - halo[i] * 0.95);
          if (portraitMask && portraitMask[i] > 0) {
            var scan = portraitMotion.matches ? 0 : Math.max(0, 1 - Math.abs(gy - sweepY) * 7);
            v += portraitMask[i] * portraitGain * (breath + scan * 0.35) * (1 - halo[i]) * (0.78 + 0.22 * n);
          }
          var reveal = smooth((front - d * 0.9) * 2.2);
          v *= reveal * (1 - fade * (0.55 + 0.45 * n2));
          var w = ink[i]; v += w * 0.75;
          for (var k = 0; k < ripples.length; k++) {
            var rp = ripples[k];
            var age = (now - rp.t) / 1000;
            var band = Math.hypot((x + 0.5) * pw - rp.x, (y + 0.5) * ph - rp.y) - age * 520;
            if (band > -26 && band < 26) v += (1 - Math.abs(band) / 26) * 0.5 * Math.max(0, 1 - age / 1.4);
          }
          if (mode === "ascii") {
            if (v <= 0.06) { line += " "; continue; }
            var ch = RAMP.charAt(Math.min(last, Math.floor(v * last)));
            if (w > 0.3) { hot.push(x, y, ch); line += " "; } else line += ch;
            continue;
          }
          var thr = BAYER[(x & 3) + ((y & 3) << 2)];
          if (mode === "halftone") { if (v < 0.08) continue; var s = Math.min(1, v) * pw * 0.92, o = (pw - s) / 2; (w > 0.3 ? hot : v > 0.75 ? lvA : v > 0.45 ? lvB : lvC).push(x * pw + o, y * ph + o, s, s); continue; }
          if (v <= thr) continue;
          var gap = mode === "braille" ? pw * 0.42 : 1.4;
          (w > 0.3 ? hot : v > 0.8 ? lvA : v > 0.5 ? lvB : lvC).push(x * pw, y * ph, pw - gap, ph - gap);
        }
        if (lines) lines.push(line);
      }
      if (mode === "ascii") {
        ctx.font = "400 " + fs + 'px "IBM Plex Mono", ui-monospace, monospace'; ctx.textBaseline = "top"; ctx.fillStyle = grad;
        for (var r = 0; r < lines.length; r++) ctx.fillText(lines[r], 0, r * ph);
        ctx.fillStyle = C.hot;
        for (var a = 0; a < hot.length; a += 3) ctx.fillText(hot[a + 2], hot[a] * pw, hot[a + 1] * ph);
        return finish(now);
      }
      function paint(list, alpha) { if (!list.length) return; ctx.globalAlpha = alpha; ctx.beginPath(); for (var j = 0; j < list.length; j += 4) ctx.rect(list[j], list[j + 1], list[j + 2], list[j + 3]); ctx.fill(); }
      ctx.fillStyle = grad; paint(lvC, 0.38); paint(lvB, 0.7); paint(lvA, 1);
      ctx.fillStyle = C.hot; paint(hot, 1); ctx.globalAlpha = 1; finish(now);
    }
    function finish(now) {
      for (var j = 0; j < ink.length; j++) { if (ink[j] > 0.001) ink[j] *= 0.965; else ink[j] = 0; }
      ripples = ripples.filter(function (rp) { return now - rp.t < 1400; });
    }
    resize(); requestAnimationFrame(frame);
    new ResizeObserver(function () { resize(); }).observe(canvas);
    if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }, { root: opts.root }).observe(canvas);
    return { modes: MODES, getMode: function () { return mode; }, setMode: function (m) { if (MODES.indexOf(m) > -1 && m !== mode) { mode = m; grid(); } }, refresh: function () { buildMask(); }, setFade: function (f) { fade = Math.max(0, Math.min(1, f)); }, replay: function () { start = performance.now(); } };
  }

  /* ---------- content renderers ---------- */
  function linkRows(list) {
    return list.map(function (l, i) {
      return '<li><a href="' + l.href + '"' + (l.external ? ' target="_blank" rel="noopener"' : "") + '><span class="c1">' + String.fromCharCode(97 + i) + ')</span><strong>' + esc(l.label[0]) + '</strong><span class="sub">' + esc(l.label[1]) + '</span><span class="arrow" aria-hidden="true">' + (l.external ? "↗" : "→") + '</span></a></li>';
    }).join("");
  }
  function sectionInner(id) {
    if (id === "about") {
      return '<div class="about-body">' + DATA.about.map(function (p, i) { return '<p><span class="ln" aria-hidden="true">' + pad(i + 1) + '</span>' + esc(p) + '</p>'; }).join("") + '</div><ul class="tags">' + DATA.skills.map(function (s) { return '<li>[ ' + esc(s) + ' ]</li>'; }).join("") + '</ul>';
    }
    if (id === "path") {
      return '<ol class="log">' + DATA.path.map(function (p, i) { return '<li' + (i < 2 ? ' class="now"' : "") + '><span class="node" aria-hidden="true">' + (i < 2 ? "◉" : "○") + '</span><time>' + esc(p[0]) + '</time><strong>' + esc(p[1]) + '</strong><span class="sub">' + esc(p[2]) + '</span></li>'; }).join("") + '</ol>';
    }
    if (id === "papers") {
      return '<label class="grep"><span class="ps1">$ grep</span><input id="grepIn" type="search" spellcheck="false" autocomplete="off" placeholder="' + esc(DATA.grep) + '" value="' + esc(query) + '"><span class="grep-n" id="grepN"></span></label><ol class="table" id="paperList"></ol>';
    }
    if (id === "works") return '<ol class="table">' + DATA.works.map(function (w) { return '<li><span class="c1">' + esc(w[0]) + '</span><span class="c2"><strong>' + esc(w[1]) + '</strong></span><span class="c3">' + esc(w[2]) + '</span></li>'; }).join("") + '</ol>';
    if (id === "books") return '<ol class="table">' + DATA.books.map(function (w) { return '<li><span class="c1">' + esc(w[0]) + '</span><span class="c2"><strong>' + esc(w[1]) + '</strong></span><span class="c3">' + esc(w[2]) + '</span></li>'; }).join("") + '</ol>';
    if (id === "elsewhere") return '<ul class="links">' + linkRows(DATA.links) + '</ul>';
    if (id === "company") return '<p class="pane-note">' + esc(DATA.companyNote) + '</p><ul class="links">' + linkRows(DATA.company) + '</ul>';
    if (id === "contact") return '<dl class="contact">' + DATA.contact.map(function (c, i) { var val = i === 0 ? '<a href="mailto:' + esc(c[1]) + '">' + esc(c[1]) + '</a>' : i === 1 ? '<a href="tel:' + c[1].replace(/-/g, "") + '">' + esc(c[1]) + '</a>' : esc(c[1]); return '<div><dt>' + esc(c[0]) + '</dt><dd>' + val + '</dd></div>'; }).join("") + '</dl>';
    return "";
  }
  function renderPapers() {
    var list = $("paperList"); if (!list) return;
    var shown = 0;
    var html = Object.keys(DATA.paperTypes).map(function (type) {
      var rows = [];
      DATA.papers.forEach(function (p) {
        if (p.type !== type) return;
        var hay = (p.year + " " + p.title + " " + p.venue + " " + p.track).toLowerCase();
        if (query && hay.indexOf(query) < 0) return;
        rows.push('<li' + (p.award ? ' class="award"' : "") + '><span class="c1">' + esc(p.year) + '</span><span class="c2"><strong>' + esc(p.title) + '</strong><span class="meta"><button type="button" class="tag" data-track="' + esc(p.track) + '"># ' + esc(p.track) + '</button>' + (p.award ? "<em>★ " + DATA.awardLabel + "</em>" : "") + '</span></span><span class="c3">' + esc(p.venue) + '</span></li>');
      });
      if (!rows.length) return "";
      shown += rows.length;
      return '<li class="group"><span class="c1">' + pad(rows.length) + '</span><span class="c2">' + esc(DATA.paperTypes[type]) + '</span></li>' + rows.join("");
    }).join("");
    list.innerHTML = html || '<li class="empty"><span class="c1">0</span><span class="c2">' + esc(DATA.ui.empty) + '</span></li>';
    var n = $("grepN"); if (n) n.textContent = pad(shown) + "/" + pad(DATA.papers.length);
  }
  function panel(id) {
    var filename = id + ".md";
    var n = pad(ORDER.indexOf(id) + 1);
    return '<section class="panel" id="s-' + id + '"><div class="panel-title"><span class="pdots"><i></i><i></i><i></i></span><span class="pt">' + filename + '</span></div><div class="panel-body"><div class="code-h"><span class="com">//</span> <span class="num">' + n + '</span> <span class="kw">' + esc(DATA.sections[id]) + '</span></div>' + sectionInner(id) + '</div></section>';
  }
  function renderSections() {
    var heroEl = $("top"), secs = $("sections"), html = "";
    if (layout === "scroll") {
      heroEl.style.display = "";
      html = ORDER.map(panel).join("");
    } else {
      if (active === "top") { heroEl.style.display = ""; html = ""; }
      else { heroEl.style.display = "none"; html = panel(active); }
    }
    secs.innerHTML = html;
    renderPapers();
    setupSpy();
  }
  /* ---------- scramble / clock ---------- */
  /* 逐字由乱码收敛到原文：原字透明占位，乱码用 ::after 叠在上面，版面不跳 */
  var scrambling = new WeakMap();
  function scramble(el, opts) {
    if (!el) return;
    opts = opts || {};
    var prev = scrambling.get(el);
    if (prev) { cancelAnimationFrame(prev.raf); el.textContent = prev.text; }
    var text = el.textContent;
    if (!text.trim()) return;
    var dur = opts.duration || 700, set = opts.digits ? "0123456789" : "!<>-_\/[]{}=+*^?#%01░▒▓";
    var pick = function () { return set.charAt(Math.floor(Math.random() * set.length)); };
    var chars = Array.from(text);
    el.textContent = "";
    var spans = chars.map(function (ch, i) {
      var sp = document.createElement("span");
      sp.textContent = ch;
      if (ch.trim()) { sp.className = "sc on"; sp.dataset.c = pick(); sp._at = (i / chars.length) * dur * 0.6 + Math.random() * dur * 0.4; }
      el.appendChild(sp);
      return sp;
    });
    var start = performance.now() + (opts.delay || 0), last = 0, job = { text: text, raf: 0 };
    scrambling.set(el, job);
    (function step(now) {
      var t = now - start, swap = now - last > 45, left = 0;
      if (swap) last = now;
      for (var i = 0; i < spans.length; i++) {
        var sp = spans[i];
        if (!sp._at) continue;
        if (t >= sp._at) { sp.className = ""; sp._at = 0; continue; }
        left++;
        if (swap && t > -200) sp.dataset.c = pick();
      }
      if (left) job.raf = requestAnimationFrame(step);
      else { el.textContent = text; scrambling.delete(el); }
    })(performance.now());
  }
  var fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  function tick() { $("statusClock").textContent = fmt.format(new Date()) + " KST"; }
  tick(); setInterval(tick, 1000);

  function renderProfile() {
    root.lang = DATA.htmlLang; root.dataset.lang = lang;
    $("nameMain").textContent = DATA.name;
    $("alias").textContent = DATA.alias;
    $("lead").textContent = DATA.lead;
    $("base").textContent = DATA.base;
    $("quote").textContent = DATA.quote;
    $("roles").innerHTML = DATA.roles.map(function (role) { return "<span>" + esc(role) + "</span>"; }).join('<i aria-hidden="true">/</i>');
    $("stats").innerHTML = DATA.stats.map(function (stat) { return "<div><dt>" + stat[0] + "</dt><dd>" + esc(stat[1]) + "</dd></div>"; }).join("");
    document.querySelector(".hero-hint").textContent = DATA.hint;
    $("termIn").placeholder = DATA.prompt.placeholder;
    $("languageSwitch").setAttribute("aria-label", DATA.ui.language);
    $("themeBtn").setAttribute("aria-label", DATA.ui.theme);
    document.querySelector(".sidebar-head").textContent = DATA.ui.explorer;
    document.querySelectorAll("#languageSwitch [data-lang]").forEach(function (button) { button.setAttribute("aria-pressed", String(button.dataset.lang === lang)); });
    ORDER.forEach(function (id) {
      var tab = document.querySelector('.tab[data-file="' + id + '"]');
      if (tab) { tab.title = DATA.sections[id]; tab.setAttribute("aria-label", id + ".md · " + DATA.sections[id]); }
      var row = document.querySelector('.tree-row[data-file="' + id + '"]');
      if (row) row.title = DATA.sections[id];
    });
    var skip = $("spSkip");
    if (skip) { skip.textContent = DATA.ui.skip; skip.setAttribute("aria-label", DATA.ui.skipLabel); $("boot").setAttribute("aria-label", "STUDIO 7 " + DATA.ui.boot); }
  }
  function setLanguage(next) {
    if (!Object.prototype.hasOwnProperty.call(LANGUAGES, next) || next === lang) return;
    var current = active, oldPanel = $("s-" + current);
    var probeOffset = Math.min(160, stageScroll.clientHeight * 0.28);
    var panelOffset = oldPanel ? oldPanel.getBoundingClientRect().top - stageScroll.getBoundingClientRect().top : 0;
    var progress = oldPanel ? Math.max(0, Math.min(0.99, (probeOffset - panelOffset) / oldPanel.offsetHeight)) : 0;
    var oldY = stageScroll.scrollTop;
    lang = next; DATA = LANGUAGES[lang]; query = "";
    try { localStorage.setItem("desk-lang", lang); } catch (e) {}
    renderProfile(); renderSections();
    var panel = $("s-" + current);
    var targetY = panel ? stageScroll.scrollTop + panel.getBoundingClientRect().top - stageScroll.getBoundingClientRect().top + progress * panel.offsetHeight - probeOffset : oldY;
    stageScroll.scrollTo({ top: targetY, behavior: "instant" });
    active = current; updateNav(); onScroll();
  }
  $("languageSwitch").addEventListener("click", function (event) {
    var button = event.target.closest("[data-lang]"); if (button) setLanguage(button.dataset.lang);
  });

  /* ---------- mount canvases ---------- */
  var stageScroll = $("stageScroll");
  var portraitImage = new Image();
  var hero = mountHero($("heroCanvas"), { glyph: "", mode: "dither", portrait: portraitImage, portraitLayout: function (w, h) {
    if (w < 900) return { x: 0.7, y: 0.53, size: Math.min(h * 0.42, w * 0.95) };
    return { x: 0.27, y: 0.36, size: Math.min(h * 0.74, w * 0.4) };
  },
  // 浅色底上淡蓝点几乎看不见，人像在浅色主题下加重，读起来和深色一样若隐若现
  portraitGain: function () { return document.documentElement.dataset.theme === "dark" ? 1 : 1.9; },
  pointerTarget: $("top"), root: stageScroll, getColors: function () { return colors; }, layout: function (w, h) { return { x: 0.8, y: 0.3, size: 0 }; }, markLayout: function (w, h) { if (w < 900) return { x: 0.8, y: 0.11, size: Math.min(h * 0.15, w * 0.36) }; return { x: 0.8, y: 0.3, size: Math.min(h * 0.44, w * 0.22) }; } });
  portraitImage.onload = function () { hero.refresh(); };
  portraitImage.src = "personal/home/portrait.png";
  var bg = mountBg($("bgField"), { getColors: function () { return colors; }, getScrollY: function () { return stageScroll.scrollTop; } });

  function renderModes() {
    var cur = hero.getMode();
    $("modes").innerHTML = hero.modes.map(function (m) { return '<button type="button" role="radio" aria-checked="' + (m === cur) + '" data-mode="' + m + '">' + m + '</button>'; }).join("");
  }
  function setMode(m) { hero.setMode(m); renderModes(); }
  $("modes").addEventListener("click", function (e) { var b = e.target.closest("[data-mode]"); if (b) setMode(b.dataset.mode); });
  renderModes();

  /* ---------- navigation (sidebar + tabs + layouts) ---------- */
  var lastNav = null;
  var reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  function setupSpy() { lastNav = null; }
  function syncScrollSection() {
    if (layout !== "scroll") return;
    var bounds = stageScroll.getBoundingClientRect();
    var probe = bounds.top + Math.min(160, bounds.height * 0.28);
    var next = "top";
    document.querySelectorAll(".panel").forEach(function (panel) {
      if (panel.getBoundingClientRect().top <= probe) next = panel.id.replace("s-", "");
    });
    if (stageScroll.scrollTop > 0 && stageScroll.scrollTop + stageScroll.clientHeight >= stageScroll.scrollHeight - 2) next = ORDER[ORDER.length - 1];
    if (next !== active) { active = next; updateNav(); }
  }
  function updateNav() {
    document.querySelectorAll(".tab").forEach(function (tab) {
      var selected = tab.dataset.file === active;
      tab.classList.toggle("active", selected);
      if (selected) tab.setAttribute("aria-current", "page"); else tab.removeAttribute("aria-current");
    });
    document.querySelectorAll(".tree-row").forEach(function (row) { row.classList.toggle("active", row.dataset.file === active); });
    $("statusLayout").textContent = "layout: " + layout;
    // Scroll only the tab strip; scrollIntoView could also move the page vertically.
    if (lastNav !== active) {
      lastNav = active;
      var strip = $("tabs"), tab = strip.querySelector(".tab.active");
      if (tab) {
        var outer = strip.getBoundingClientRect(), inner = tab.getBoundingClientRect();
        if (inner.left < outer.left + 12 || inner.right > outer.right - 12) {
          strip.scrollTo({ left: strip.scrollLeft + inner.left - outer.left - (outer.width - inner.width) / 2, behavior: reducedMotion.matches ? "auto" : "smooth" });
        }
      }
    }
  }
  function navigate(id) {
    active = id; updateNav();
    if (layout === "scroll") {
      if (id === "top") stageScroll.scrollTo({ top: 0, behavior: "smooth" });
      else { var el = $("s-" + id); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }
    } else {
      renderSections();
      if (id === "top") stageScroll.scrollTo({ top: 0, behavior: "smooth" });
    }
    onScroll();
  }
  function setLayout(l) {
    layout = l; app.dataset.layout = l;
    if (l === "scroll") active = "top";
    document.querySelectorAll("#layouts button").forEach(function (b) { b.classList.toggle("active", b.dataset.layout === l); });
    renderSections(); updateNav();
    stageScroll.scrollTo({ top: 0 });
    onScroll();
  }
  $("layouts").addEventListener("click", function (e) { var b = e.target.closest("[data-layout]"); if (b) setLayout(b.dataset.layout); });

  var tabsHTML = '<div class="tab active" data-file="top"><span class="dot"></span>terminal.sh</div>';
  tabsHTML += ORDER.map(function (k) { return '<div class="tab" data-file="' + k + '">' + k + '.md</div>'; }).join("");
  $("tabs").innerHTML = tabsHTML;
  document.querySelectorAll(".tab").forEach(function (t) { t.addEventListener("click", function () { navigate(t.dataset.file); }); });

  var treeHTML = '<div class="tree-row" data-file="top"><span class="ico">▸</span><span>~/desk</span></div>';
  treeHTML += ORDER.map(function (k) { return '<div class="tree-row sub" data-file="' + k + '"><span class="ico">·</span><span>' + k + '.md</span></div>'; }).join("");
  $("tree").innerHTML = treeHTML;
  document.querySelectorAll(".tree-row").forEach(function (r) { r.addEventListener("click", function () { navigate(r.dataset.file); }); });

  /* ---------- scroll ---------- */
  var heroEl = $("top"), statusPct = $("statusPct");
  function onScroll() {
    var y = stageScroll.scrollTop, hh = heroEl.offsetHeight || 1;
    var max = stageScroll.scrollHeight - stageScroll.clientHeight;
    var p = max > 0 ? Math.min(1, y / max) : 0;
    statusPct.textContent = Math.round(p * 100) + "%";
    syncScrollSection();
    var heroVisible = heroEl.style.display !== "none";
    // 与线上一致：首屏不显示背景字符场，滚过首屏三分之一后才渐渐浮现
    bg.setOpacity(heroVisible ? Math.min(1, Math.max(0, (y - hh * 0.35) / (hh * 0.5))) : 1);
    if (heroVisible) hero.setFade(Math.min(1, Math.max(0, y / (hh * 0.85))));
  }
  var ticking = false;
  stageScroll.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; onScroll(); }); } }, { passive: true });
  window.addEventListener("resize", function () { lastNav = null; updateNav(); onScroll(); });

  /* ---------- command line ---------- */
  function print(outEl, cmd, msg) {
    var p = document.createElement("p");
    p.innerHTML = '<span class="ps1">$</span> ' + esc(cmd) + (msg ? '<br><span class="res">' + esc(msg) + '</span>' : "");
    outEl.appendChild(p);
    while (outEl.children.length > 4) outEl.removeChild(outEl.firstChild);
    outEl.scrollTop = outEl.scrollHeight;
  }
  function exec(raw, outEl) {
    var cmd = raw.trim().toLowerCase();
    if (!cmd) return;
    if (cmd === "help" || cmd === "?") return print(outEl, raw, DATA.prompt.help + " · whoami");
    if (["zh", "en", "ko"].indexOf(cmd) > -1) { setLanguage(cmd); return print(outEl, raw, DATA.prompt.lang + " → " + lang); }
    if (cmd === "clear") { outEl.innerHTML = ""; return; }
    if (cmd === "light" || cmd === "dark") { setTheme(cmd); return print(outEl, raw, "theme → " + cmd); }
    if (cmd === "whoami") { navigate("top"); hero.replay(); return print(outEl, raw, DATA.name + " · " + DATA.en + " · " + DATA.alias); }
    var mm = cmd.match(/^mode\s+(\w+)$/);
    if (mm || hero.modes.indexOf(cmd) > -1) {
      var target = mm ? mm[1] : cmd;
      if (hero.modes.indexOf(target) < 0) return print(outEl, raw, "mode: " + hero.modes.join(" / "));
      setMode(target); return print(outEl, raw, "render → " + target);
    }
    if (ORDER.indexOf(cmd) > -1) { navigate(cmd); return print(outEl, raw); }
    if (/^[1-8]$/.test(cmd)) { navigate(ORDER[+cmd - 1]); return print(outEl, raw); }
    print(outEl, raw, DATA.prompt.unknown + raw);
  }
  $("termForm").addEventListener("submit", function (e) { e.preventDefault(); exec($("termIn").value, $("termOut")); $("termIn").value = ""; });

  /* ---------- delegated grep ---------- */
  document.addEventListener("input", function (e) { if (e.target.id === "grepIn") { query = e.target.value.trim().toLowerCase(); renderPapers(); } });
  document.addEventListener("click", function (e) {
    var tag = e.target.closest(".tag"); if (!tag) return;
    var input = $("grepIn"); if (!input) return;
    input.value = input.value.trim() === tag.dataset.track ? "" : tag.dataset.track;
    query = input.value.trim().toLowerCase(); renderPapers();
  });

  /* ---------- keyboard ---------- */
  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
    if (typing) { if (e.key === "Escape") document.activeElement.blur(); return; }
    if (/^[1-8]$/.test(e.key)) { navigate(ORDER[+e.key - 1]); e.preventDefault(); }
    else if (e.key === "/" || e.key === ":") { $("termIn").focus(); e.preventDefault(); }
    else if (e.key === "m" || e.key === "M") { var ms = hero.modes; setMode(ms[(ms.indexOf(hero.getMode()) + 1) % ms.length]); }
  });

  /* ---------- boot splash (rhine-lab style) ---------- */
  function intro() {
    scramble($("nameMain"), { duration: 900, delay: 900 });
    document.querySelectorAll("#stats dt").forEach(function (dt, i) { scramble(dt, { digits: true, duration: 900, delay: 1500 + i * 90 }); });
  }
  (function boot() {
    var el = $("boot"), status = $("spStatus"), bar = $("spBar"), count = $("spCount"), log = $("spLog"), title = $("spTitle");
    var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    var done = false, raf = 0, start = performance.now(), lastPhase = -1;
    root.classList.add("booting");
    var phases = [
      { at: 0, name: "access", label: "REQUESTING ACCESS", title: "STUDIO 7", lines: ["<span>00</span><b>$</b> connect ~/desk", "<span>01</span>initializing visual field..."] },
      { at: 1050, name: "identity", label: "ID CONFIRMED : TIAN HAN", title: "IDENTITY VERIFIED", lines: ["<span>00</span><b>[ok]</b> signature / studio7", "<span>01</span><b>[ok]</b> identity / tianhan", "<span>02</span>request received_"] },
      { at: 2150, name: "scan", label: "START PROCESSING...", title: "SYNCING MODULES", lines: ["<span>00</span><b>[ok]</b> canvas.render / ready", "<span>01</span><b>[ok]</b> archive.mount / ready", "<span>02</span>opening personal terminal_"] },
      { at: 3400, name: "ready", label: "PERMISSION AUTHORIZED", title: "WELCOME, TIAN HAN", lines: ["<span>00</span><b>[ok]</b> visual field / online", "<span>01</span><b>[ok]</b> personal archive / mounted", "<span>02</span><b>$</b> session.open()"] }
    ];
    var stops = [[0,0],[300,4],[1050,24],[2150,53],[3400,94],[4000,100]];
    function finish() {
      if (done) return;
      done = true; cancelAnimationFrame(raf);
      window.removeEventListener("keydown", skipKey);
      el.classList.add("out"); root.classList.remove("booting"); hero.replay(); intro();
      setTimeout(function () { el.remove(); }, 560);
    }
    function skipKey(e) {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") { e.preventDefault(); finish(); }
    }
    $("spSkip").addEventListener("click", finish);
    window.addEventListener("keydown", skipKey);
    function frame(now) {
      if (done) return;
      var t = now - start, phase = 0;
      for (var i = 1; i < phases.length; i++) if (t >= phases[i].at) phase = i;
      if (reduced) phase = 3;
      var current = phases[phase];
      if (phase !== lastPhase) {
        lastPhase = phase; el.dataset.phase = current.name;
        title.textContent = current.title;
        log.innerHTML = current.lines.map(function (line) { return "<p>" + line + "</p>"; }).join("");
        el.querySelectorAll(".boot-rail span").forEach(function (node, index) { node.classList.toggle("active", index <= phase); });
      }
      var letters = Math.min(current.label.length, Math.floor((t - current.at) / 20));
      status.textContent = reduced ? current.label : current.label.slice(0, letters);
      var pct = 100;
      for (var j = 1; j < stops.length; j++) {
        if (t < stops[j][0]) { var a = stops[j - 1], b = stops[j]; pct = a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0]); break; }
      }
      if (reduced) pct = 100;
      bar.style.width = pct + "%"; count.textContent = String(Math.floor(pct)).padStart(3, "0");
      if (t >= (reduced ? 900 : 4350)) finish(); else raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
  })();

  renderProfile();
  renderSections();
  updateNav();
  onScroll();
})();
