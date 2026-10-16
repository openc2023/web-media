/* ══════════════════════════════════════════
   bg.js — 水墨宣纸 Background Canvas
   Ink Wash on Rice Paper — Light Theme
   水墨RPG简历 · Tian Han 2025
══════════════════════════════════════════ */
window.RPG = window.RPG || {};

window.RPG.BG = (function () {
    'use strict';

    var canvas = document.getElementById('bgCanvas');
    var ctx    = canvas.getContext('2d');
    var W = 0, H = 0, T = 0;

    var stars       = [];
    var inkClouds   = [];
    var inkDrops    = [];
    var particles   = [];
    var cursorTrail = [];

    /* 水墨宣纸调色板 */
    var PAPER   = '#f2ece0';
    var PCOLORS = [
        '#2e8080','#1a5050','#5aacac',
        '#c94444','#8a6018','#3a2010'
    ];

    function resize() {
        W = canvas.width  = window.innerWidth;
        H = canvas.height = window.innerHeight;
        initSpecks();
        initClouds();
    }

    function initSpecks() {
        stars = [];
        for (var i = 0; i < 80; i++) {
            var snap = 4;
            stars.push({
                x:     Math.floor(Math.random() * W / snap) * snap,
                y:     Math.floor(Math.random() * H / snap) * snap,
                sz:    Math.random() < 0.05 ? 3 : (Math.random() < 0.2 ? 2 : 1),
                base:  0.04 + Math.random() * 0.10,
                phase: Math.random() * Math.PI * 2,
                spd:   0.005 + Math.random() * 0.01
            });
        }
    }

    function initClouds() {
        var defs = [
            { cx:0.15, cy:0.20, rx:320, ry:200, col:'46,128,128', a:0.045, vx: 0.10, vy: 0.07 },
            { cx:0.85, cy:0.75, rx:260, ry:220, col:'46,128,128', a:0.038, vx:-0.09, vy:-0.06 },
            { cx:0.50, cy:0.10, rx:380, ry:140, col:'26,80,80',   a:0.042, vx: 0.08, vy: 0.10 },
            { cx:0.08, cy:0.80, rx:200, ry:160, col:'26,21,16',   a:0.030, vx: 0.12, vy:-0.08 },
            { cx:0.92, cy:0.15, rx:180, ry:240, col:'26,21,16',   a:0.025, vx:-0.10, vy: 0.09 },
            { cx:0.60, cy:0.65, rx:260, ry:180, col:'138,96,24',  a:0.022, vx:-0.07, vy:-0.05 }
        ];
        inkClouds = defs.map(function (c) {
            return {
                x:c.cx*W, y:c.cy*H,
                rx:c.rx, ry:c.ry,
                vx:c.vx, vy:c.vy,
                col:c.col, base:c.a,
                phase:Math.random()*Math.PI*2
            };
        });
    }

    var dropTimer = 0;
    function spawnDrop() {
        inkDrops.push({
            x:     Math.floor(Math.random() * W / 4) * 4,
            y:     -12,
            r:     2 + Math.random() * 4,
            spd:   0.3 + Math.random() * 0.5,
            trail: [],
            alpha: 0.22 + Math.random() * 0.18,
            col:   Math.random() < 0.65 ? '46,128,128' : '26,21,16'
        });
    }

    function tick() {
        T++;

        ctx.fillStyle = PAPER;
        ctx.fillRect(0, 0, W, H);

        /* 水墨晕染云 */
        inkClouds.forEach(function (c) {
            c.x += c.vx; c.y += c.vy;
            if (c.x < -c.rx) c.x = W+c.rx;
            if (c.x > W+c.rx) c.x = -c.rx;
            if (c.y < -c.ry) c.y = H+c.ry;
            if (c.y > H+c.ry) c.y = -c.ry;
            var pulse = c.base * (0.70 + 0.30 * Math.sin(T*0.004+c.phase));
            ctx.save();
            ctx.translate(c.x, c.y);
            ctx.scale(1, c.ry/c.rx);
            var grd = ctx.createRadialGradient(0,0,0, 0,0,c.rx);
            grd.addColorStop(0,   'rgba('+c.col+','+pulse.toFixed(3)+')');
            grd.addColorStop(0.5, 'rgba('+c.col+','+(pulse*0.25).toFixed(3)+')');
            grd.addColorStop(1,   'rgba('+c.col+',0)');
            ctx.fillStyle = grd;
            ctx.beginPath(); ctx.arc(0,0,c.rx,0,Math.PI*2); ctx.fill();
            ctx.restore();
        });

        /* 墨点 */
        stars.forEach(function (s) {
            var a = s.base * (0.5 + 0.5 * Math.sin(T*s.spd+s.phase));
            ctx.fillStyle = 'rgba(26,21,16,'+a.toFixed(3)+')';
            ctx.fillRect(s.x, s.y, s.sz, s.sz);
        });

        /* 墨滴 */
        dropTimer++;
        if (dropTimer > 220 + Math.random()*300) { dropTimer=0; spawnDrop(); }
        for (var d = inkDrops.length-1; d >= 0; d--) {
            var dr = inkDrops[d];
            dr.trail.push({x:dr.x, y:dr.y, r:dr.r*0.65});
            if (dr.trail.length > 12) dr.trail.shift();
            dr.y += dr.spd;
            if (dr.y > H+30) { inkDrops.splice(d,1); continue; }
            dr.trail.forEach(function (t, ti) {
                var ta = (ti/dr.trail.length) * dr.alpha * 0.35;
                ctx.fillStyle = 'rgba('+dr.col+','+ta.toFixed(3)+')';
                var pr = Math.max(1, t.r*(ti/dr.trail.length));
                var px2=Math.floor(t.x/2)*2, py2=Math.floor(t.y/2)*2;
                var ps=Math.floor(pr/2)*2||2;
                ctx.fillRect(px2-ps/2, py2-ps/2, ps, ps);
            });
            ctx.fillStyle = 'rgba('+dr.col+','+dr.alpha.toFixed(2)+')';
            var ds = Math.floor(dr.r/2)*2;
            ctx.fillRect(Math.floor(dr.x/2)*2-ds/2, Math.floor(dr.y/2)*2-ds/2, ds, ds);
        }

        /* 鼠标墨迹 */
        for (var ct = cursorTrail.length-1; ct >= 0; ct--) {
            var tr = cursorTrail[ct];
            tr.life -= 0.055;
            if (tr.life <= 0) { cursorTrail.splice(ct,1); continue; }
            ctx.fillStyle = 'rgba(46,128,128,'+(tr.life*0.22).toFixed(3)+')';
            ctx.fillRect(Math.floor(tr.x/2)*2, Math.floor(tr.y/2)*2, 2, 2);
        }

        /* 爆炸粒子 */
        for (var p = particles.length-1; p >= 0; p--) {
            var pt = particles[p];
            pt.x+=pt.vx; pt.y+=pt.vy; pt.vy+=0.08;
            pt.life -= 0.024;
            if (pt.life <= 0) { particles.splice(p,1); continue; }
            ctx.globalAlpha = Math.max(0, pt.life);
            ctx.fillStyle   = pt.color;
            ctx.fillRect(Math.floor(pt.x/2)*2, Math.floor(pt.y/2)*2, 4, 4);
        }
        ctx.globalAlpha = 1;

        requestAnimationFrame(tick);
    }

    resize();
    window.addEventListener('resize', resize);
    tick();

    return {
        explode: function (x, y) {
            var n = 20;
            for (var i = 0; i < n; i++) {
                var angle = (i/n)*Math.PI*2 + (Math.random()-0.5)*0.5;
                var spd   = 1.2 + Math.random()*3.2;
                particles.push({
                    x:x, y:y,
                    vx:Math.cos(angle)*spd, vy:Math.sin(angle)*spd-1.6,
                    color: PCOLORS[Math.floor(Math.random()*PCOLORS.length)],
                    life: 0.6 + Math.random()*0.5
                });
            }
        },
        addTrail: function (x, y) {
            if (Math.random() > 0.3) return;
            cursorTrail.push({x:x, y:y, life:1});
        }
    };
}());
