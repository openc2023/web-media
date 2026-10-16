/* 作品页用的背景字符场：与主页同一个 bgfield.js，常亮、颜色固定为主页的电光蓝。
   页面需要先引入 bgfield.js，并放一个 <canvas id="bgField" class="bg-field">。
   body 带 camera-open 时（TOP 打开相机）整片关掉，不占用 AR 的性能。 */
(function () {
    'use strict';
    var canvas = document.getElementById('bgField');
    if (!canvas || !window.AsciiBg) return;
    var colors = { dot: '#3fa4ff', char: '#8b97ab' };
    var bg = window.AsciiBg.mount(canvas, { getColors: function () { return colors; } });
    var ON = 0.9;
    function sync() { bg.setOpacity(document.body.classList.contains('camera-open') ? 0 : ON); }
    sync();
    new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();
