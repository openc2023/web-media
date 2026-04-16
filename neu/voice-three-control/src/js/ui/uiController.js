import { clamp } from "../utils/math.js";
import {
  bindCheckboxControl,
  createCollapsiblePanel,
} from "../../../neu-ui/index.js";

export function createUiController() {
  const panelDock = document.querySelector("#panelDock");
  const panelToggle = document.querySelector("#panelToggle");
  const micButton = document.querySelector("#micButton");
  const baseSpeedInput = document.querySelector("#baseSpeed");
  const noiseReductionInput = document.querySelector("#noiseReduction");
  const statusText = document.querySelector("#statusText");
  const energyBar = document.querySelector("#energyBar");
  const brightnessBar = document.querySelector("#brightnessBar");
  const speedBar = document.querySelector("#speedBar");
  const energyText = document.querySelector("#energyText");
  const brightnessText = document.querySelector("#brightnessText");
  const speedText = document.querySelector("#speedText");
  const voiceRankFill = document.querySelector("#voiceRankFill");
  const voiceRankTrack = document.querySelector(".ui-rank-scale-track");
  const voiceRankTime = document.querySelector("#voiceRankTime");
  const voiceRankSteps = Array.from(document.querySelectorAll("[data-rank-level]"));
  const panelController = createCollapsiblePanel({
    dock: panelDock,
    toggle: panelToggle,
  });
  const rankBaseBackground = "rgba(255, 255, 255, 0.12)";
  const rankFillGradient = "linear-gradient(0deg, #39d0b6, #ff7a59)";

  function update(state) {
    energyBar.style.width = `${Math.round(state.energy * 100)}%`;
    brightnessBar.style.width = `${Math.round(state.brightness * 100)}%`;
    speedBar.style.width = `${Math.round(clamp(state.speed / 5.5, 0, 1) * 100)}%`;
    energyText.textContent = `${Math.round(state.energy * 100)}%`;
    brightnessText.textContent = `${Math.round(state.brightness * 100)}%`;
    speedText.textContent = `${state.speed.toFixed(2)}x`;
    statusText.textContent = state.message;
    micButton.textContent = state.active ? "Disable Microphone" : "Enable Microphone";

    const rankSeconds = Math.max(0, Number(state.voiceRankDisplaySeconds ?? 0));
    const rankMaxSeconds = Math.max(1, Number(state.voiceRankMaxSeconds ?? 18));
    const rankProgress = clamp(rankSeconds / rankMaxSeconds, 0, 1);
    const trackHeight = voiceRankTrack.getBoundingClientRect().height || 208;
    const filledHeight =
      rankSeconds > 0 ? Math.max(8, Math.round(trackHeight * rankProgress)) : 0;
    voiceRankFill.style.height = `${filledHeight}px`;
    voiceRankTrack.style.background = filledHeight > 0
      ? `${rankFillGradient} bottom / 100% ${filledHeight}px no-repeat, ${rankBaseBackground}`
      : rankBaseBackground;
    voiceRankTime.textContent = `${rankSeconds.toFixed(1)}s`;

    const activeLevel = state.voiceRankLevel ?? -1;
    voiceRankSteps.forEach((step) => {
      const level = Number(step.dataset.rankLevel);
      step.classList.toggle("is-reached", activeLevel >= 0 && level <= activeLevel);
      step.classList.toggle("is-active", level === activeLevel);
    });
  }

  function bindToggle(handler) {
    micButton.addEventListener("click", handler);
  }

  function bindBaseSpeedChange(handler) {
    baseSpeedInput.addEventListener("input", handler);
  }

  function bindNoiseReductionChange(handler) {
    bindCheckboxControl(noiseReductionInput, handler);
  }

  function getBaseSpeed() {
    return Number(baseSpeedInput.value);
  }

  function getNoiseReductionEnabled() {
    return noiseReductionInput.checked;
  }

  function setNoiseReductionEnabled(enabled) {
    noiseReductionInput.checked = enabled;
  }

  return {
    update,
    bindToggle,
    bindBaseSpeedChange,
    bindNoiseReductionChange,
    getBaseSpeed,
    getNoiseReductionEnabled,
    setCollapsed: panelController.setCollapsed,
    setNoiseReductionEnabled,
  };
}
