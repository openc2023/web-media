import {
    renderAbout,
    renderContact,
    renderFooter,
    renderHeader,
    renderHero,
    renderPapers,
    renderProjects,
    renderTimeline
} from "./sections.js";

export function renderPage(content, activeLocale) {
    return `
        ${renderHeader(content, activeLocale)}
        <main id="top">
            ${renderHero(content)}
            ${renderAbout(content)}
            ${renderTimeline(content)}
            ${renderPapers(content)}
            ${renderProjects(content)}
            ${renderContact(content)}
        </main>
        ${renderFooter(content)}
    `;
}
