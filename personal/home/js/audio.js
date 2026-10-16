/* ══════════════════════════════════════════
   audio.js — 8-bit Sound Engine + BGM
   水墨RPG简历 · Tian Han 2025
══════════════════════════════════════════ */
window.RPG = window.RPG || {};

window.RPG.Audio = (function () {
    'use strict';

    var AC = window.AudioContext || window.webkitAudioContext;
    var ac = null;

    function ensure() {
        if (!ac) {
            try { ac = new AC(); } catch (e) { return false; }
        }
        if (ac.state === 'suspended') ac.resume();
        return true;
    }

    /* ── Single tone ── */
    function tone(freq, dur, type, vol, slideTo) {
        if (!ac) return;
        var osc  = ac.createOscillator();
        var gain = ac.createGain();
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.type = type || 'square';
        osc.frequency.setValueAtTime(freq, ac.currentTime);
        if (slideTo !== undefined) {
            osc.frequency.linearRampToValueAtTime(slideTo, ac.currentTime + dur);
        }
        gain.gain.setValueAtTime(vol || 0.06, ac.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + dur);
    }

    /* ── Sequence of [freq, dur?, type?, vol?] ── */
    function seq(notes, interval) {
        notes.forEach(function (n, i) {
            setTimeout(function () {
                tone(n[0], n[1] || 0.1, n[2] || 'square', n[3] || 0.06);
            }, i * (interval || 70));
        });
    }

    /* ══════════════════════════════════════════
       BGM — 8-bit ambient loop (pentatonic)
    ══════════════════════════════════════════ */
    var _bgmOn     = false;
    var _bgmTimer  = null;
    var _bgmGain   = null;

    /* Melody: C5 pentatonic descending/ascending phrase */
    var BGM_NOTES = [
        [523,0.14,'triangle',0.032], [659,0.14,'triangle',0.028],
        [784,0.14,'triangle',0.030], [659,0.14,'triangle',0.025],
        [523,0.14,'triangle',0.028], [440,0.14,'triangle',0.022],
        [523,0.14,'triangle',0.025], [392,0.18,'triangle',0.020],
        /* second phrase */
        [392,0.14,'triangle',0.025], [440,0.14,'triangle',0.028],
        [523,0.14,'triangle',0.032], [659,0.14,'triangle',0.030],
        [784,0.18,'triangle',0.028], [659,0.14,'triangle',0.022],
        [523,0.14,'triangle',0.025], [440,0.18,'triangle',0.018]
    ];
    var BGM_INTERVAL = 190; /* ms between notes */
    var BGM_LOOP_MS  = BGM_NOTES.length * BGM_INTERVAL + 400; /* total loop length */

    /* Bass drone under melody */
    var BASS_NOTES = [
        [131,0.35,'sine',0.018], null, null, null,
        [131,0.35,'sine',0.015], null, null, null,
        [110,0.35,'sine',0.018], null, null, null,
        [98, 0.35,'sine',0.015], null, null, null
    ];

    function playBGMCycle() {
        if (!_bgmOn || !ac) return;
        BGM_NOTES.forEach(function (n, i) {
            setTimeout(function () {
                if (!_bgmOn) return;
                tone(n[0], n[1], n[2], n[3]);
            }, i * BGM_INTERVAL);
        });
        BASS_NOTES.forEach(function (n, i) {
            if (!n) return;
            setTimeout(function () {
                if (!_bgmOn) return;
                tone(n[0], n[1], n[2], n[3]);
            }, i * BGM_INTERVAL);
        });
        _bgmTimer = setTimeout(playBGMCycle, BGM_LOOP_MS);
    }

    return {
        init: ensure,

        /* ── SFX ── */
        click:  function () { if (!ensure()) return; tone(660, 0.04, 'square', 0.05); },
        hover:  function () { if (!ensure()) return; tone(1100, 0.025, 'square', 0.02); },
        open:   function () { if (!ensure()) return; seq([[440,0.07],[660,0.07],[880,0.1]], 65); },
        close:  function () { if (!ensure()) return; tone(440, 0.1, 'square', 0.05, 280); },
        select: function () { if (!ensure()) return; tone(1047, 0.07, 'square', 0.05); },
        equip:  function () { if (!ensure()) return; seq([[330,0.06],[440,0.06],[554,0.08]], 55); },
        damage: function () { if (!ensure()) return; seq([[220,0.05,'square',0.07],[180,0.08,'square',0.05]], 60); },

        /* ── Battle hit (sharp noise burst) ── */
        hit: function () {
            if (!ensure()) return;
            seq([[880,0.03,'square',0.08],[440,0.04,'square',0.06],[220,0.06,'square',0.04]], 35);
        },

        /* ── Critical hit ── */
        crit: function () {
            if (!ensure()) return;
            seq([[1047,0.04,'square',0.09],[1319,0.04,'square',0.08],[1568,0.09,'square',0.07]], 40);
        },

        /* ── Level up fanfare ── */
        levelUp: function () {
            if (!ensure()) return;
            seq([
                [262,0.07],[330,0.07],[392,0.07],[523,0.07],
                [659,0.07],[784,0.07],[1047,0.22,'square',0.08]
            ], 70);
        },

        /* ── Save sound ── */
        save: function () {
            if (!ensure()) return;
            seq([
                [784,0.08],[659,0.08],[523,0.08],[392,0.08],
                [523,0.18,'triangle',0.06]
            ], 80);
        },

        /* ── Victory jingle ── */
        victory: function () {
            if (!ensure()) return;
            seq([
                [523,0.07],[523,0.07],[523,0.07],[523,0.14],
                [415,0.14],[466,0.14],[523,0.28,'square',0.07]
            ], 90);
        },

        segFill: function (i) {
            if (!ac) return;
            tone(260 + i * 38, 0.06, 'square', 0.04);
        },

        start: function () {
            if (!ensure()) return;
            var melody = [
                [262,0.09],[330,0.09],[392,0.09],
                [523,0.09],[659,0.09],[784,0.09],
                [1047,0.18,'square',0.07]
            ];
            seq(melody, 72);
        },

        /* ── BGM control ── */
        bgmStart: function () {
            if (!ensure()) return;
            if (_bgmOn) return;
            _bgmOn = true;
            playBGMCycle();
        },
        bgmStop: function () {
            _bgmOn = false;
            if (_bgmTimer) { clearTimeout(_bgmTimer); _bgmTimer = null; }
        },
        bgmIsOn: function () { return _bgmOn; }
    };
}());
