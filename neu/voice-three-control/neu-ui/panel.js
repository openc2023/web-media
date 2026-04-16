export function createCollapsiblePanel({
  dock,
  toggle,
  collapsedClass = "is-collapsed",
  mobileBreakpoint = 720,
  defaultCollapsed = false,
}) {
  const mediaQuery = window.matchMedia(`(max-width: ${mobileBreakpoint}px)`);
  let collapsed = mediaQuery.matches ? true : defaultCollapsed;

  function sync() {
    dock.classList.toggle(collapsedClass, collapsed);
    toggle.setAttribute("aria-expanded", String(!collapsed));
  }

  function setCollapsed(nextCollapsed) {
    collapsed = Boolean(nextCollapsed);
    sync();
  }

  function toggleCollapsed() {
    setCollapsed(!collapsed);
  }

  toggle.addEventListener("click", toggleCollapsed);
  mediaQuery.addEventListener("change", (event) => {
    setCollapsed(event.matches ? true : defaultCollapsed);
  });

  sync();

  return {
    isCollapsed: () => collapsed,
    setCollapsed,
    toggle: toggleCollapsed,
  };
}
