/* home/main.js — 渲染、语言、主题、键盘导航与底部命令行 */
(function () {
    'use strict';

    var DATA = window.ASCII_DATA;
    var S = DATA.shared;
    var ORDER = ['about', 'path', 'papers', 'works', 'books', 'elsewhere', 'contact'];
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
            return '<a href="#' + k + '"><kbd>' + (i + 1) + '</kbd>' + esc(d.sections[k]) + '</a>';
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

        $('paperList').innerHTML = S.papers.map(function (p, i) {
            var row = d.papers[i];
            return '<li' + (p.award ? ' class="award"' : '') + '><span class="c1">' + p.year + '</span>' +
                '<span class="c2"><strong>' + esc(row[1]) + '</strong>' +
                (p.award ? '<em>★ ' + esc(d.awardLabel) + '</em>' : '') + '</span>' +
                '<span class="c3">' + esc(row[0]) + '</span></li>';
        }).reverse().join('');

        function rows(list) {
            return list.map(function (w) {
                return '<li><span class="c1">' + esc(w.year) + '</span><span class="c2"><strong>' + esc(w.title) + '</strong></span><span class="c3">' + esc(w.body) + '</span></li>';
            }).join('');
        }
        $('workList').innerHTML = rows(d.works);
        $('bookList').innerHTML = rows(d.books);

        $('linkList').innerHTML = S.links.map(function (l, i) {
            var t = d.links[l.key];
            return '<li><a href="' + l.href + '"' + (l.external ? ' target="_blank" rel="noopener"' : '') + '>' +
                '<span class="c1">' + String.fromCharCode(97 + i) + ')</span><strong>' + esc(t[0]) + '</strong>' +
                '<span class="sub">' + esc(t[1]) + '</span><span class="arrow" aria-hidden="true">' + (l.external ? '↗' : '→') + '</span></a></li>';
        }).join('');

        var c = d.contact;
        $('contactList').innerHTML = [
            [c.email, '<a href="mailto:' + S.email + '">' + S.email + '</a>'],
            [c.phone, '<a href="tel:' + S.phone.replace(/-/g, '') + '">' + S.phone + '</a>'],
            [c.base, esc(c.baseValue)],
            [c.org, esc(c.orgValue)]
        ].map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + r[1] + '</dd></div>'; }).join('');

        $('termIn').placeholder = d.prompt.placeholder;
    }

    function setLang(l) {
        if (!DATA[l]) return;
        lang = l;
        try { localStorage.setItem('ascii-lang', l); } catch (e) {}
        render();
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
        colors = { g1: cs.getPropertyValue('--g1').trim(), g2: cs.getPropertyValue('--g2').trim(), hot: cs.getPropertyValue('--hot').trim() };
    }
    readColors();
    new MutationObserver(readColors).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', readColors);

    var hero = window.AsciiHero.mount($('heroCanvas'), {
        glyph: '田漢',
        mode: savedMode || 'dither',
        pointerTarget: $('top'),
        getColors: function () { return colors; },
        // 字形位置：宽屏放右侧，窄屏放上方
        layout: function (w, h) {
            if (w < 900) return { x: 0.5, y: 0.25, size: Math.min(w * 0.4, h * 0.2) };
            return { x: 0.7, y: 0.44, size: Math.min(h * 0.46, w * 0.22) };
        }
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { hero.refresh(); });

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
            es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
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
        if (/^[1-7]$/.test(cmd)) { jump(ORDER[+cmd - 1]); return print(raw); }
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
        if (/^[1-7]$/.test(e.key)) { jump(ORDER[+e.key - 1]); e.preventDefault(); }
        else if (e.key === '/' || e.key === ':') { input.focus(); e.preventDefault(); }
        else if (e.key === 'm' || e.key === 'M') {
            var ms = hero.modes;
            setMode(ms[(ms.indexOf(hero.getMode()) + 1) % ms.length]);
        }
    });

    render();
})();
