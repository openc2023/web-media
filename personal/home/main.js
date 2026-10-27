/* home/main.js — 渲染、语言、主题、键盘导航、底部命令行，以及滚动与文字解码等交互 */
(function () {
    'use strict';

    var DATA = window.ASCII_DATA;
    var S = DATA.shared;
    var ORDER = ['about', 'path', 'papers', 'works', 'books', 'elsewhere', 'company', 'contact'];
    var lang = 'zh';
    var root = document.documentElement;

    function $(id) { return document.getElementById(id); }
    function esc(s) {
        return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
    }
    function pad(n) { return (n < 10 ? '0' : '') + n; }

    try {
        var saved = localStorage.getItem('ascii-lang');
        if (saved && DATA[saved]) lang = saved;
        else if (/^ko/i.test(navigator.language)) lang = 'ko';
        else if (/^en/i.test(navigator.language)) lang = 'en';
    } catch (e) {}

    function linkRows(list, labels) {
        return list.map(function (l, i) {
            var t = labels[l.key];
            return '<li><a href="' + l.href + '"' + (l.external ? ' target="_blank" rel="noopener"' : '') + '>' +
                '<span class="c1">' + String.fromCharCode(97 + i) + ')</span><strong>' + esc(t[0]) + '</strong>' +
                '<span class="sub">' + esc(t[1]) + '</span><span class="arrow" aria-hidden="true">' + (l.external ? '↗' : '→') + '</span></a></li>';
        }).join('');
    }

    /* ── render ── */
    function render() {
        var d = DATA[lang];
        root.lang = d.htmlLang;
        root.dataset.lang = lang;

        document.querySelectorAll('[data-t]').forEach(function (el) {
            el.textContent = d[el.getAttribute('data-t')];
        });
        document.querySelectorAll('[data-lang]').forEach(function (b) {
            b.setAttribute('aria-pressed', b.dataset.lang === lang);
        });

        $('roles').innerHTML = d.roles.map(function (r) { return '<span>' + esc(r) + '</span>'; }).join('<i aria-hidden="true">/</i>');
        $('stats').innerHTML = S.stats.map(function (s) {
            return '<div><dt>' + s[0] + '</dt><dd>' + esc(d.statLabels[s[1]]) + '</dd></div>';
        }).join('');

        $('index').innerHTML = ORDER.map(function (k, i) {
            return '<a href="#' + k + '" data-sec="' + k + '"><kbd>' + (i + 1) + '</kbd><span class="lbl">' + esc(d.sections[k]) + '</span></a>';
        }).join('');
        document.querySelectorAll('.pane').forEach(function (p) {
            p.querySelector('.pane-h').innerHTML = '<span class="n">' + p.dataset.n + '</span><span class="t">' + esc(d.sections[p.id]) + '</span><span class="rule" aria-hidden="true"></span>';
        });

        $('aboutBody').innerHTML = d.about.map(function (p, i) {
            return '<p><span class="ln" aria-hidden="true">' + pad(i + 1) + '</span>' + esc(p) + '</p>';
        }).join('');
        $('skills').innerHTML = d.skills.map(function (s) { return '<li>[ ' + esc(s) + ' ]</li>'; }).join('');

        $('pathList').innerHTML = d.path.map(function (p, i) {
            return '<li' + (i < 2 ? ' class="now"' : '') + '><span class="node" aria-hidden="true">' + (i < 2 ? '◉' : '○') + '</span>' +
                '<time>' + esc(p.date) + '</time><strong>' + esc(p.title) + '</strong><span class="sub">' + esc(p.body) + '</span></li>';
        }).join('');

        $('grepIn').placeholder = d.grep;
        renderPapers();

        function rows(list) {
            return list.map(function (w) {
                return '<li><span class="c1">' + esc(w.year) + '</span><span class="c2"><strong>' + esc(w.title) + '</strong></span><span class="c3">' + esc(w.body) + '</span></li>';
            }).join('');
        }
        $('workList').innerHTML = rows(d.works);
        $('bookList').innerHTML = rows(d.books);

        $('linkList').innerHTML = linkRows(S.links, d.links);
        $('companyNote').textContent = d.companyNote;
        $('companyList').innerHTML = linkRows(S.company, d.companyItems);

        var c = d.contact;
        $('contactList').innerHTML = [
            [c.email, '<a href="mailto:' + S.email + '">' + S.email + '</a>'],
            [c.phone, '<a href="tel:' + S.phone.replace(/-/g, '') + '">' + S.phone + '</a>'],
            [c.base, esc(c.baseValue)],
            [c.org, esc(c.orgValue)]
        ].map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + r[1] + '</dd></div>'; }).join('');

        $('termIn').placeholder = d.prompt.placeholder;
    }

    /* 论文：grep 式筛选，命中部分高亮 */
    var query = '';
    function mark(text) {
        var t = esc(text);
        if (!query) return t;
        var i = text.toLowerCase().indexOf(query);
        if (i < 0) return t;
        return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + query.length)) + '</mark>' + esc(text.slice(i + query.length));
    }
    function renderPapers() {
        var d = DATA[lang];
        var shown = 0;
        var html = S.paperTypes.map(function (type) {
            var rows = [];
            S.papers.forEach(function (p, i) {
                if (p.type !== type) return;
                var row = d.papers[i];
                var trackLabel = d.paperTrackLabels[p.track];
                var hay = (p.year + ' ' + row[0] + ' ' + row[1] + ' ' + d.paperTypeLabels[type] + ' ' + trackLabel + ' ' + (p.award ? '★ ' + d.awardLabel : '')).toLowerCase();
                if (query && hay.indexOf(query) < 0) return;
                rows.unshift('<li' + (p.award ? ' class="award"' : '') + '><span class="c1">' + mark(p.year) + '</span>' +
                    '<span class="c2"><strong>' + mark(row[1]) + '</strong>' +
                    '<span class="meta"><button type="button" class="tag" data-track="' + esc(trackLabel) + '"># ' + mark(trackLabel) + '</button>' +
                    (p.award ? '<em>★ ' + mark(d.awardLabel) + '</em>' : '') + '</span></span>' +
                    '<span class="c3">' + mark(row[0]) + '</span></li>');
            });
            if (!rows.length) return '';
            shown += rows.length;
            return '<li class="group"><span class="c1">' + pad(rows.length) + '</span><span class="c2">' + esc(d.paperTypeLabels[type]) + '</span></li>' + rows.join('');
        }).join('');
        $('paperList').innerHTML = html || '<li class="empty"><span class="c1">0</span><span class="c2">grep: no match</span></li>';
        $('grepN').textContent = pad(shown) + '/' + pad(S.papers.length);
    }
    $('grepIn').addEventListener('input', function () {
        query = this.value.trim().toLowerCase();
        renderPapers();
    });
    // 点研究方向标签 = 用这个方向筛选
    $('paperList').addEventListener('click', function (e) {
        var tag = e.target.closest('.tag');
        if (!tag) return;
        var input = $('grepIn');
        input.value = input.value.trim() === tag.dataset.track ? '' : tag.dataset.track;
        query = input.value.trim().toLowerCase();
        renderPapers();
    });

    function setLang(l) {
        if (!DATA[l]) return;
        lang = l;
        try { localStorage.setItem('ascii-lang', l); } catch (e) {}
        render();
        decodeVisible();
    }

    /* ── theme ── */
    function currentTheme() {
        return root.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    }
    function setTheme(t) {
        root.dataset.theme = t;
        try { localStorage.setItem('ascii-theme', t); } catch (e) {}
    }
    $('themeBtn').addEventListener('click', function () { setTheme(currentTheme() === 'dark' ? 'light' : 'dark'); });
    document.querySelectorAll('[data-lang]').forEach(function (b) {
        b.addEventListener('click', function () { setLang(b.dataset.lang); });
    });

    /* ── clock (Busan) ── */
    var fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    function tick() { $('clock').textContent = fmt.format(new Date()) + ' KST'; }
    tick(); setInterval(tick, 1000);

    /* ── hero ── */
    var savedMode = null;
    try { savedMode = localStorage.getItem('ascii-mode'); } catch (e) {}
    var colors = null;
    function readColors() {
        var cs = getComputedStyle(root);
        var v = function (n) { return cs.getPropertyValue(n).trim(); };
        colors = { g1: v('--g1'), g2: v('--g2'), hot: v('--hot'), dot: v('--accent'), char: v('--ink-2') };
    }
    readColors();
    new MutationObserver(readColors).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', readColors);

    // 人像：透明底灰度照片，在左侧名字后面若隐若现（缓慢明暗起伏），颜色跟随主题
    var portraitImg = new Image();
    // 右侧：STUDIO 7 标志，与 07S desk 同样的处理——标志不发光，只在一片密集点阵里挖出负形
    var markImg = new Image();
    var hero = window.AsciiHero.mount($('heroCanvas'), {
        glyph: '田漢',
        glyphImage: markImg,
        glyphGain: 0,
        glyphBacking: 0.9,
        image: portraitImg,
        imageGain: 0.45,
        carve: 0,
        imageLayout: function (w, h) {
            if (w < 900) return { x: 0.7, y: 0.53, size: Math.min(h * 0.42, w * 0.95) };
            return { x: 0.27, y: 0.36, size: Math.min(h * 0.74, w * 0.4) };
        },
        mode: savedMode || 'dither',
        pointerTarget: $('top'),
        getColors: function () { return colors; },
        // 字形位置：宽屏放右侧，窄屏放上方
        layout: function (w, h) {
            if (w < 900) return { x: 0.5, y: 0.25, size: Math.min(w * 0.56, h * 0.28) };
            return { x: 0.72, y: 0.44, size: Math.min(h * 0.56, w * 0.3) };
        }
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { hero.refresh(); });
    portraitImg.onload = function () { hero.refresh(); };
    markImg.onload = function () { hero.refresh(); };
    markImg.src = 'personal/home/icons/studio7-mark.png?v=1';
    portraitImg.src = 'personal/home/portrait.png?v=1';


    function renderModes() {
        var cur = hero.getMode();
        $('modes').innerHTML = hero.modes.map(function (m) {
            return '<button type="button" role="radio" aria-checked="' + (m === cur) + '" data-mode="' + m + '">' + m + '</button>';
        }).join('');
    }
    function setMode(m) {
        hero.setMode(m);
        try { localStorage.setItem('ascii-mode', hero.getMode()); } catch (e) {}
        renderModes();
    }
    $('modes').addEventListener('click', function (e) {
        var b = e.target.closest('[data-mode]');
        if (b) setMode(b.dataset.mode);
    });
    renderModes();

    /* ── reveal panes on scroll ── */
    if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (es) {
            es.forEach(function (e) {
                if (!e.isIntersecting) return;
                e.target.classList.add('in');
                io.unobserve(e.target);
                window.FX.scramble(e.target.querySelector('.pane-h .t'), { duration: 900, delay: 150 });
            });
        }, { rootMargin: '0px 0px -10% 0px' });
        document.querySelectorAll('.pane').forEach(function (p) { io.observe(p); });
    } else {
        document.querySelectorAll('.pane').forEach(function (p) { p.classList.add('in'); });
    }

    /* ── terminal ── */
    var out = $('termOut'), input = $('termIn');
    function print(cmd, msg) {
        var line = document.createElement('p');
        line.innerHTML = '<span class="ps1">$</span> ' + esc(cmd) + (msg ? '<br><span class="res">' + esc(msg) + '</span>' : '');
        out.appendChild(line);
        while (out.children.length > 4) out.removeChild(out.firstChild);
    }
    function jump(id) {
        var el = $(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    function run(raw) {
        var cmd = raw.trim().toLowerCase();
        var p = DATA[lang].prompt;
        if (!cmd) return;
        if (cmd === 'help' || cmd === '?') return print(raw, p.help);
        if (cmd === 'clear') { out.innerHTML = ''; return; }
        if (DATA[cmd] && cmd !== 'shared') { setLang(cmd); return print(raw, DATA[cmd].prompt.lang); }
        if (cmd === 'light' || cmd === 'dark') { setTheme(cmd); return print(raw, p.theme); }
        var mm = cmd.match(/^mode\s+(\w+)$/);
        if (mm || hero.modes.indexOf(cmd) > -1) {
            var target = mm ? mm[1] : cmd;
            if (hero.modes.indexOf(target) < 0) return print(raw, 'mode: ' + hero.modes.join(' / '));
            setMode(target); jump('top');
            return print(raw, 'render → ' + target);
        }
        if (cmd === 'whoami') { jump('top'); hero.replay(); return print(raw, DATA[lang].name + ' · ' + DATA[lang].alias); }
        if (ORDER.indexOf(cmd) > -1) { jump(cmd); return print(raw); }
        if (/^[1-8]$/.test(cmd)) { jump(ORDER[+cmd - 1]); return print(raw); }
        print(raw, p.unknown + raw.trim());
    }
    $('termForm').addEventListener('submit', function (e) {
        e.preventDefault();
        run(input.value);
        input.value = '';
    });

    /* ── keyboard ── */
    document.addEventListener('keydown', function (e) {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        var typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
        if (typing) {
            if (e.key === 'Escape') input.blur();
            return;
        }
        if (/^[1-8]$/.test(e.key)) { jump(ORDER[+e.key - 1]); e.preventDefault(); }
        else if (e.key === '/' || e.key === ':') { input.focus(); e.preventDefault(); }
        else if (e.key === 'm' || e.key === 'M') {
            var ms = hero.modes;
            setMode(ms[(ms.indexOf(hero.getMode()) + 1) % ms.length]);
        }
    });

    render();

    /* ── 文字解码 ── */
    function decodeVisible() {
        document.querySelectorAll('.pane.in .pane-h .t').forEach(function (t) { window.FX.scramble(t, { duration: 650 }); });
        window.FX.scramble(document.querySelector('.name [data-t="name"]'), { duration: 650 });
    }
    function hoverDecode(container, hostSel, targetSel) {
        container.addEventListener('pointerover', function (e) {
            var host = e.target.closest(hostSel);
            if (!host || !container.contains(host) || host.contains(e.relatedTarget)) return;
            window.FX.scramble(host.querySelector(targetSel), { duration: 420 });
        });
    }
    hoverDecode($('linkList'), 'a', 'strong');
    hoverDecode($('companyList'), 'a', 'strong');
    hoverDecode($('index'), 'a', '.lbl');

    /* ── 背景字符场 + 滚动 ── */
    var bg = window.AsciiBg.mount($('bgField'), { getColors: function () { return colors; } });
    var heroEl = $('top'), prog = $('barProg'), pct = $('barPct');
    var ticking = false;
    function onScroll() {
        ticking = false;
        var y = window.scrollY, hh = heroEl.offsetHeight;
        var max = document.documentElement.scrollHeight - window.innerHeight;
        var p = max > 0 ? Math.min(1, y / max) : 0;
        prog.style.width = (p * 100).toFixed(2) + '%';
        pct.textContent = ('00' + Math.round(p * 100)).slice(-3) + '%';
        hero.setFade(Math.min(1, Math.max(0, y / (hh * 0.85))));
        bg.setOpacity(Math.min(1, Math.max(0, (y - hh * 0.35) / (hh * 0.5))));
    }
    window.addEventListener('scroll', function () {
        if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    }, { passive: true });
    window.addEventListener('resize', onScroll);

    /* ── 当前栏目高亮 ── */
    if ('IntersectionObserver' in window) {
        var spy = new IntersectionObserver(function (es) {
            es.forEach(function (e) {
                if (!e.isIntersecting) return;
                document.querySelectorAll('#index a').forEach(function (a) {
                    a.classList.toggle('on', a.dataset.sec === e.target.id);
                });
            });
        }, { rootMargin: '-40% 0px -55% 0px' });
        document.querySelectorAll('.pane').forEach(function (p) { spy.observe(p); });
    }

    /* ── 头图坐标读数 ── */
    var readout = $('readout');
    heroEl.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch' || e.target.closest('.hero-text, .hero-meta')) { readout.classList.remove('on'); return; }
        var r = heroEl.getBoundingClientRect();
        var x = e.clientX - r.left, y = e.clientY - r.top;
        readout.style.transform = 'translate(' + (x + 16) + 'px,' + (y + 14) + 'px)';
        readout.textContent = 'x' + ('000' + Math.round(x)).slice(-4) + ' y' + ('000' + Math.round(y)).slice(-4) + ' · ' + hero.getMode();
        readout.classList.add('on');
    });
    heroEl.addEventListener('pointerleave', function () { readout.classList.remove('on'); });

    /* ── 开场：每次会话只播一次，点击或按键可跳过 ── */
    function intro() {
        window.FX.scramble(document.querySelector('.name [data-t="name"]'), { duration: 900, delay: 900 });
        document.querySelectorAll('#stats dt').forEach(function (dt, i) {
            window.FX.scramble(dt, { digits: true, duration: 900, delay: 1500 + i * 90 });
        });
    }
    (function boot() {
        var el = $('boot'), log = $('bootLog');
        var seen = false;
        try { seen = sessionStorage.getItem('ascii-booted') === '1'; sessionStorage.setItem('ascii-booted', '1'); } catch (e) {}
        if (seen) { el.remove(); intro(); return; }
        root.classList.add('booting');
        function dots(label) { return label + ' ' + new Array(Math.max(4, 32 - label.length)).join('.') + ' ok'; }
        var lines = [
            'TIAN HAN / 田漢 — personal terminal',
            dots('> mount ~/personal/home'),
            dots('> field ' + hero.getMode()),
            dots('> locale ' + DATA[lang].htmlLang),
            '> ready_'
        ];
        var i = 0, done = false;
        function finish() {
            if (done) return;
            done = true;
            el.classList.add('out');
            root.classList.remove('booting');
            hero.replay();
            intro();
            setTimeout(function () { el.remove(); }, 500);
        }
        (function next() {
            if (done) return;
            if (i >= lines.length) { setTimeout(finish, 260); return; }
            log.textContent += (i ? '\n' : '') + lines[i++];
            setTimeout(next, 150);
        })();
        el.addEventListener('pointerdown', finish);
        window.addEventListener('keydown', finish, { once: true });
    })();
    onScroll();
})();
