import { join, mediaFigure, sectionHead, textBlock } from "./helpers.js";

const navLinks = (items) => join(items.map((item) => `<a href="${item.href}">${item.label}</a>`));
const actionLinks = (items) => join(items.map((item) => `<a class="${item.kind}" href="${item.href}">${item.label}</a>`));
const statCards = (items) => join(items.map((item) => textBlock(item.title, item.body, "stat")));
const infoList = (items, className) => `<div class="list">${join(items.map((item) => textBlock(item.title, item.body, className)))}</div>`;
const timelineItems = (items) => join(items.map((item) => `
    <article class="timeline-item">
        <div class="meta">${item.date}</div>
        <div>
            <h3>${item.title}</h3>
            <p>${item.body}</p>
        </div>
    </article>
`));
const taggedCards = (items, cardClass) => join(items.map((item) => `
    <article class="${cardClass}">
        ${item.media ? mediaFigure(item.media, item.title, "", "card-media") : ""}
        <div class="tag ${item.tone}">${item.tag}</div>
        <h3>${item.title}</h3>
        <p>${item.body}</p>
    </article>
`));
const repoLinks = (items) => join(items.map((item) => `
    <a class="linkbox" href="${item.href}">
        <strong>${item.title}</strong>
        <span>${item.body}</span>
    </a>
`));
const contactRows = (items) => join(items.map((item) => `
    <div class="contact-row">
        <div class="meta">${item.label}</div>
        ${item.href ? `<a href="${item.href}">${item.value}</a>` : `<strong>${item.value}</strong>`}
    </div>
`));
const gallery = (items) => `<div class="mini-gallery">${join(items.map((item) => mediaFigure(item.src, item.alt, item.caption, "gallery-item")))}</div>`;

export function renderHeader(content) {
    return `
        <header class="nav">
            <div class="nav-inner">
                <a class="brand" href="#top">
                    <strong>${content.brand.title}</strong>
                    <span>${content.brand.subtitle}</span>
                </a>
                <nav class="nav-links" aria-label="Primary navigation">
                    ${navLinks(content.nav)}
                </nav>
            </div>
        </header>
    `;
}

export function renderHero(content) {
    return `
        <section class="hero">
            <div class="section hero-grid">
                <div class="panel">
                    <div class="eyebrow">${content.hero.eyebrow}</div>
                    <h1 class="hero-title">${content.hero.title}<span>${content.hero.subtitle}</span></h1>
                    <p class="lead">${content.hero.lead}</p>
                    <div class="actions">${actionLinks(content.hero.actions)}</div>
                    <div class="stats">${statCards(content.hero.stats)}</div>
                </div>
                <aside class="panel media-panel">
                    ${mediaFigure(content.hero.portrait.src, content.hero.portrait.alt, "Portrait / profile image placeholder", "hero-portrait")}
                    <div class="institution-card">
                        <img class="institution-logo" src="${content.hero.institution.logo}" alt="${content.hero.institution.alt}">
                        <div>
                            <div class="meta">${content.hero.institution.label}</div>
                            <strong>${content.hero.institution.title}</strong>
                            <p>${content.hero.institution.body}</p>
                        </div>
                    </div>
                    ${infoList(content.hero.overview, "focus")}
                </aside>
            </div>
        </section>
    `;
}

export function renderAbout(content) {
    return `
        <section class="section" id="about">
            ${sectionHead(content.sections.about)}
            <div class="about-grid">
                <article class="card">
                    <h3>${content.about.intro.title}</h3>
                    <p>${content.about.intro.body}</p>
                    ${infoList(content.about.intro.items, "focus")}
                </article>
                <aside class="card">
                    <h3>${content.about.facts.title}</h3>
                    ${infoList(content.about.facts.items, "mini")}
                    ${gallery(content.about.gallery)}
                </aside>
            </div>
        </section>
    `;
}

export function renderTimeline(content) {
    return `
        <section class="section" id="timeline">
            ${sectionHead(content.sections.timeline)}
            <div class="timeline">${timelineItems(content.timeline)}</div>
        </section>
    `;
}

export function renderResearch(content) {
    return `
        <section class="section" id="research">
            ${sectionHead(content.sections.research)}
            <div class="grid2">${taggedCards(content.research, "card card-rich")}</div>
        </section>
    `;
}

export function renderProjects(content) {
    return `
        <section class="section" id="projects">
            ${sectionHead(content.sections.projects)}
            <div class="projects">${taggedCards(content.projects, "project")}</div>
            <div class="about-grid split-gap">
                <article class="card">
                    <h3>${content.repoLinks.title}</h3>
                    <div class="links">${repoLinks(content.repoLinks.items)}</div>
                </article>
                <aside class="card">
                    <h3>${content.publishing.title}</h3>
                    ${infoList(content.publishing.items, "mini")}
                </aside>
            </div>
        </section>
    `;
}

export function renderContact(content) {
    return `
        <section class="section" id="contact">
            ${sectionHead(content.sections.contact)}
            <div class="contact-grid">
                <article class="contact">
                    <h3>${content.contact.intro.title}</h3>
                    <p>${content.contact.intro.body}</p>
                    ${infoList(content.contact.intro.items, "focus")}
                </article>
                <aside class="contact">
                    <h3>${content.contact.info.title}</h3>
                    <div class="contact-list">${contactRows(content.contact.info.items)}</div>
                </aside>
            </div>
        </section>
    `;
}

export function renderFooter(content) {
    return `
        <footer class="footer">
            <div class="footer-inner">
                <p>${content.footer[0]}</p>
                <p>${content.footer[1]}</p>
            </div>
        </footer>
    `;
}
