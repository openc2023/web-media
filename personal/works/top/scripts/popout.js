/* TOP 入口页：画作的纸面与炸弹层随光标倾斜，炸弹从纸面凸起。
   只读写 #sheet 上的 CSS 变量，不碰识别流程。触屏设备只播放 CSS 里的待机动画。 */
(function () {
    'use strict';
    var sheet = document.getElementById('sheet');
    if (!sheet || !window.matchMedia('(hover: hover)').matches) return;

    var target = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
    var raf = 0;

    function step() {
        cur.x += (target.x - cur.x) * 0.12;
        cur.y += (target.y - cur.y) * 0.12;
        sheet.style.setProperty('--rx', (cur.y * -6).toFixed(2) + 'deg');
        sheet.style.setProperty('--ry', (cur.x * 7).toFixed(2) + 'deg');
        // 越靠近炸弹，炸弹抬得越高
        sheet.style.setProperty('--lift', (0.35 + 0.65 * Math.max(0, 1 - Math.hypot(cur.x + 0.55, cur.y - 0.25) / 1.3)).toFixed(3));
        if (Math.abs(target.x - cur.x) + Math.abs(target.y - cur.y) > 0.001) raf = requestAnimationFrame(step);
        else raf = 0;
    }
    function kick() { if (!raf) raf = requestAnimationFrame(step); }

    window.addEventListener('pointermove', function (e) {
        if (document.body.classList.contains('camera-open')) return;
        var r = sheet.getBoundingClientRect();
        target.x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width * 0.8)));
        target.y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height * 0.8)));
        sheet.classList.add('live');
        kick();
    }, { passive: true });
    document.addEventListener('pointerleave', function () { target.x = 0; target.y = 0; kick(); });
})();
