export const join = (items) => items.join("");

export const textBlock = (title, body, className) => `
    <div class="${className}">
        <strong>${title}</strong>
        <span>${body}</span>
    </div>
`;

export const sectionHead = ({ label, title, desc = "" }) => `
    <div class="section-head">
        <div class="label">${label}</div>
        <h2 class="section-title">${title}</h2>
        ${desc ? `<p class="desc">${desc}</p>` : ""}
    </div>
`;

export const mediaFigure = (src, alt, caption = "", className = "media-frame") => `
    <figure class="${className}">
        <img src="${src}" alt="${alt}">
        ${caption ? `<figcaption>${caption}</figcaption>` : ""}
    </figure>
`;
