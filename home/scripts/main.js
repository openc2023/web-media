import { defaultLocale, locales } from "../data/locales/index.js";
import { renderPage } from "./render/page.js";

const root = document.querySelector("#site");
const storageKey = "tian-han-locale";

let currentLocale = defaultLocale;

try {
    const saved = window.localStorage.getItem(storageKey);
    if (saved && locales[saved]) {
        currentLocale = saved;
    }
} catch {}

function mount() {
    if (!root) {
        return;
    }
    root.innerHTML = renderPage(locales[currentLocale], currentLocale);
}

if (root) {
    root.addEventListener("click", (event) => {
        const button = event.target.closest("[data-locale]");
        if (!button) {
            return;
        }
        const nextLocale = button.dataset.locale;
        if (!nextLocale || !locales[nextLocale] || nextLocale === currentLocale) {
            return;
        }
        currentLocale = nextLocale;
        try {
            window.localStorage.setItem(storageKey, currentLocale);
        } catch {}
        mount();
    });

    mount();
}
