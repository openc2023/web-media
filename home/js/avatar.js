/* ══════════════════════════════════════════
   avatar.js — Pixel Walking Sprite
   16×16 grid at 5× scale → 80×80 canvas
   水墨RPG简历 · Tian Han 2025
══════════════════════════════════════════ */
(function () {
    'use strict';

    var canvas = document.getElementById('avatarCanvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    canvas.width  = 80;
    canvas.height = 80;

    var S = 5; /* 1 pixel-unit = 5 canvas px */

    /* ── Ink-Space Palette ── */
    var C = {
        HAIR:  '#2e8080',  /* 天青色（加深，白底可见） */
        SKIN:  '#c8a888',  /* warm skin */
        SHIRT: '#1a3030',  /* dark ink shirt */
        TRIM:  '#2e8080',  /* 天青色 collar/trim */
        PANTS: '#1a2828',  /* dark ink pants */
        SHOES: '#c94444',  /* seal red shoes */
        PUPIL: '#2e8080',  /* teal eye color */
        DARK:  '#f2ece0',  /* canvas bg = 宣纸色 */
        GLOW:  'rgba(46,128,128,'  /* prefix for glow */
    };

    /* ── Draw helper ── */
    function px(x, y, w, h, color) {
        ctx.fillStyle = color;
        ctx.fillRect(x * S, y * S, (w || 1) * S, (h || 1) * S);
    }

    /* ── Floating texts (e.g. +EXP) ── */
    var floaters = [];

    function addFloater(text, x, y, color) {
        floaters.push({ text: text, x: x, y: y, life: 1, color: color || C.TRIM });
    }

    /* ── Frame counter ── */
    var frame = 0;

    /* ── Draw one frame of the sprite ── */
    function drawFrame() {
        /* clear */
        ctx.fillStyle = C.DARK;
        ctx.fillRect(0, 0, 80, 80);

        /* walking cycle: 4 phases, 6 ticks each = 24-tick loop */
        var cycle    = Math.floor(frame / 6) % 4;
        var bob      = (cycle === 1 || cycle === 3) ? 1 : 0;   /* body bobs 1px */
        var legLeft  = cycle < 2;                                /* left leg forward? */
        var armSwing = (cycle === 0 || cycle === 1) ? 0 : 1;   /* arm swing phase */

        /* ── Floor glow (radial, non-pixelated) ── */
        var grd = ctx.createRadialGradient(40, 79, 0, 40, 79, 28);
        grd.addColorStop(0, C.GLOW + '0.35)');
        grd.addColorStop(1, C.GLOW + '0)');
        ctx.fillStyle = grd;
        ctx.fillRect(12, 68, 56, 12);

        /* ── Hair ── */
        px(4, 0 + bob, 8, 1, C.HAIR);
        px(3, 1 + bob, 9, 2, C.HAIR);
        /* stray strand */
        px(12, 1 + bob, 1, 1, C.HAIR);

        /* ── Face ── */
        px(4, 2 + bob, 8, 4, C.SKIN);
        /* eyes */
        px(5, 4 + bob, 2, 1, C.PUPIL);
        px(9, 4 + bob, 2, 1, C.PUPIL);
        /* pupils (dark dot) */
        px(6, 4 + bob, 1, 1, C.PANTS);
        px(10, 4 + bob, 1, 1, C.PANTS);
        /* mouth */
        px(6, 5 + bob, 4, 1, '#c89080');
        /* blush */
        px(4, 5 + bob, 1, 1, '#d8a898');
        px(11, 5 + bob, 1, 1, '#d8a898');

        /* ── Collar / scarf ── */
        px(4, 6 + bob, 8, 1, C.TRIM);
        /* collar accent dots */
        px(5, 6 + bob, 1, 1, '#2a5050');
        px(10, 6 + bob, 1, 1, '#2a5050');

        /* ── Torso ── */
        px(3, 7 + bob, 10, 4, C.SHIRT);
        /* shirt detail lines */
        px(7, 8 + bob, 2, 1, C.TRIM);   /* chest badge */
        px(3, 9 + bob, 1, 1, C.TRIM);   /* left trim */
        px(12, 9 + bob, 1, 1, C.TRIM);  /* right trim */

        /* ── Left arm ── */
        var laY = 7 + bob + armSwing;
        px(1, laY, 2, 3, C.SHIRT);
        px(1, laY + 3, 2, 1, C.SKIN);   /* hand */

        /* ── Right arm ── */
        var raY = 7 + bob + (1 - armSwing);
        px(13, raY, 2, 3, C.SHIRT);
        px(13, raY + 3, 2, 1, C.SKIN);  /* hand */

        /* ── Legs ── */
        if (legLeft) {
            /* left leg forward */
            px(4, 11 + bob, 3, 4, C.PANTS);
            px(3, 15 + bob, 4, 1, C.SHOES);   /* left foot fwd (extra width) */
            px(9, 11 + bob, 3, 3, C.PANTS);
            px(9, 14 + bob, 3, 1, C.SHOES);   /* right foot back */
        } else {
            /* right leg forward */
            px(4, 11 + bob, 3, 3, C.PANTS);
            px(4, 14 + bob, 3, 1, C.SHOES);   /* left foot back */
            px(9, 11 + bob, 3, 4, C.PANTS);
            px(9, 15 + bob, 4, 1, C.SHOES);   /* right foot fwd (extra width) */
        }

        /* ── Floating texts ── */
        ctx.font = '6px "Press Start 2P", monospace';
        for (var i = floaters.length - 1; i >= 0; i--) {
            var fl = floaters[i];
            fl.y   -= 0.9;
            fl.life -= 0.02;
            if (fl.life <= 0) { floaters.splice(i, 1); continue; }
            ctx.globalAlpha = fl.life;
            ctx.fillStyle   = fl.color;
            ctx.fillText(fl.text, fl.x, fl.y);
        }
        ctx.globalAlpha = 1;

        frame++;
        requestAnimationFrame(drawFrame);
    }

    drawFrame();

    /* ── Click avatar → +EXP floater ── */
    var wrapper = canvas.parentElement;
    if (wrapper) {
        wrapper.addEventListener('click', function (e) {
            e.stopPropagation();
            var msgs = ['+EXP', '+INT', '+ART', '+INK'];
            var msg  = msgs[Math.floor(Math.random() * msgs.length)];
            addFloater(msg, 8 + Math.random() * 40, 52, C.TRIM);
            if (window.RPG && window.RPG.Audio) window.RPG.Audio.equip();
        });
    }

    /* expose addFloater for external use */
    window.RPG = window.RPG || {};
    window.RPG.addAvatarFloater = addFloater;
}());
