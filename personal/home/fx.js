/* home/fx.js — 文字解码效果
   scramble：逐字由乱码收敛到原文。每个字包在 span 里，乱码用 ::after 叠在透明原字上，版面不跳动。
   count：数字从 0 滚动到目标值。 */
(function () {
    'use strict';

    var GLYPHS = '!<>-_\\/[]{}=+*^?#%01░▒▓';
    var DIGITS = '0123456789';
    var running = new WeakMap();

    function pick(set) { return set.charAt(Math.floor(Math.random() * set.length)); }

    function scramble(el, opts) {
        if (!el) return;
        opts = opts || {};
        var prev = running.get(el);
        if (prev) { cancelAnimationFrame(prev.raf); el.textContent = prev.text; }
        var text = el.textContent;
        if (!text.trim()) return;
        var dur = opts.duration || 700;
        var set = opts.digits ? DIGITS : GLYPHS;
        var chars = Array.from(text);
        el.textContent = '';
        var spans = chars.map(function (ch, i) {
            var s = document.createElement('span');
            s.textContent = ch;
            if (ch.trim()) {
                s.className = 'sc on';
                s.dataset.c = pick(set);
                s._at = (i / chars.length) * dur * 0.6 + Math.random() * dur * 0.4;
            }
            el.appendChild(s);
            return s;
        });
        var start = performance.now() + (opts.delay || 0), tick = 0;
        var job = { text: text, raf: 0 };
        running.set(el, job);
        (function step(now) {
            var t = now - start;
            var swap = now - tick > 45;
            if (swap) tick = now;
            var left = 0;
            for (var i = 0; i < spans.length; i++) {
                var s = spans[i];
                if (!s._at) continue;
                if (t >= s._at) { s.className = ''; s._at = 0; continue; }
                left++;
                if (swap && t > -200) s.dataset.c = pick(set);
            }
            if (left) job.raf = requestAnimationFrame(step);
            else { el.textContent = text; running.delete(el); }
        })(performance.now());
    }

    window.FX = { scramble: scramble };
})();
