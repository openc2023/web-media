import { clamp } from "../utils/math.js";

export function createUiController() {
  const panelDock = document.querySelector("#panelDock");
  const panelToggle = document.querySelector("#panelToggle");
  const micButton = document.querySelector("#micButton");
  const baseSpeedInput = document.querySelector("#baseSpeed");
  const statusText = document.querySelector("#statusText");
  const energyBar = document.querySelector("#energyBar");
  const brightnessBar = document.querySelector("#brightnessBar");
  const speedBar = document.querySelector("#speedBar");
  const energyText = document.querySelector("#energyText");
  const brightnessText = document.querySelector("#brightnessText");
  const speedText = document.querySelector("#speedText");
  const mobileQuery = window.matchMedia("(max-width: 720px)");
  let collapsed = mobileQuery.matches;

  function syncPanelState() {
    panelDock.classList.toggle("is-collapsed", collapsed);
    panelToggle.setAttribute("aria-expanded", String(!collapsed));
    panelToggle.textContent = collapsed ? "Show Panel" : "Hide Panel";
  }

  function setCollapsed(nextCollapsed) {
    collapsed = nextCollapsed;
    syncPanelState();
  }

  function togglePanel() {
    setCollapsed(!collapsed);
  }

  panelToggle.addEventListener("click", togglePanel);
  mobileQuery.addEventListener("change", (event) => {
    setCollapsed(event.matches);
  });
  syncPanelState();

  function update(state) {
    energyBar.style.width = `${Math.round(state.energy * 100)}%`;
    brightnessBar.style.width = `${Math.round(state.brightness * 100)}%`;
    speedBar.style.width = `${Math.round(clamp(state.speed / 5.5, 0, 1) * 100)}%`;
    energyText.textContent = `${Math.round(state.energy * 100)}%`;
    brightnessText.textContent = `${Math.round(state.brightness * 100)}%`;
    speedText.textContent = `${state.speed.toFixed(2)}x`;
    statusText.textContent = state.message;
    micButton.textContent = state.active ? "Disable Microphone" : "Enable Microphone";
  }

  function bindToggle(handler) {
    micButton.addEventListener("click", handler);
  }

  function bindBaseSpeedChange(handler) {
    baseSpeedInput.addEventListener("input", handler);
  }

  function getBaseSpeed() {
    return Number(baseSpeedInput.value);
  }

  return {
    update,
    bindToggle,
    bindBaseSpeedChange,
    getBaseSpeed,
    setCollapsed,
  };
}
