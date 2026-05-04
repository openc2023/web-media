import { siteContent } from "../data/site-content.js";
import { renderPage } from "./render/page.js";

const root = document.querySelector("#site");

if (root) {
    root.innerHTML = renderPage(siteContent);
}
