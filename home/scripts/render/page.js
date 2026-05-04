import {
    renderAbout,
    renderContact,
    renderFooter,
    renderHeader,
    renderHero,
    renderProjects,
    renderResearch,
    renderTimeline
} from "./sections.js";

export function renderPage(content) {
    return `
        ${renderHeader(content)}
        <main id="top">
            ${renderHero(content)}
            ${renderAbout(content)}
            ${renderTimeline(content)}
            ${renderResearch(content)}
            ${renderProjects(content)}
            ${renderContact(content)}
        </main>
        ${renderFooter(content)}
    `;
}
