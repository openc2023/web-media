import * as THREE from "three";
import { createAudioController } from "./audio/audioController.js";
import { createWorld } from "./core/world.js";
import { createFireflies } from "./objects/fireflies.js";
import { createVoiceDrivenModels } from "./objects/voiceDrivenModels.js";
import { createUiController } from "./ui/uiController.js";
import { clamp, mix } from "./utils/math.js";

const ui = createUiController();
const audio = createAudioController();
const world = createWorld();
const models = createVoiceDrivenModels(world.scene, world);
const fireflies = createFireflies(world.scene);

const clock = new THREE.Clock();
let elapsedTime = 0;
let speed = ui.getBaseSpeed();
let voiceRankSeconds = 0;

const VOICE_RANK_MAX_SECONDS = 18;
const VOICE_RANK_INSTANT_TRIGGER = 0.008;

function updateVoiceRank(dt, reactiveState, normalizedEnergy) {
  const isTriggered =
    reactiveState.active &&
    (reactiveState.instantEnergy > VOICE_RANK_INSTANT_TRIGGER || normalizedEnergy > 0);

  if (isTriggered) {
    voiceRankSeconds += dt;
  } else {
    voiceRankSeconds = 0;
  }

  const cappedSeconds = Math.min(voiceRankSeconds, VOICE_RANK_MAX_SECONDS);
  const holdProgress = clamp(cappedSeconds / VOICE_RANK_MAX_SECONDS, 0, 1);
  const livePulse = isTriggered
    ? Math.max(0.14, normalizedEnergy * 0.28 + reactiveState.instantEnergy * 0.34)
    : 0;
  const progress = Math.max(holdProgress, livePulse);
  const level = voiceRankSeconds === 0 ? -1 : Math.min(4, Math.floor(progress * 5));

  return {
    voiceRankSeconds,
    voiceRankDisplaySeconds: voiceRankSeconds,
    voiceRankMaxSeconds: VOICE_RANK_MAX_SECONDS,
    voiceRankProgress: progress,
    voiceRankLevel: level,
  };
}

function getFrameState(dt = 0) {
  const reactiveState = audio.getReactiveState();
  const response = ui.getBaseSpeed();
  const threshold = 0.035;
  const normalized =
    reactiveState.energy <= threshold
      ? 0
      : clamp((reactiveState.energy - threshold) / (1 - threshold), 0, 1);
  const targetSpeed =
    normalized === 0 ? 0 : (0.2 + normalized * 3.8) * response;

  speed = mix(speed, targetSpeed, 0.09);

  return {
    ...reactiveState,
    response,
    speed,
    ...updateVoiceRank(dt, reactiveState, normalized),
  };
}

async function handleMicrophoneToggle() {
  await audio.toggle();
  ui.update(getFrameState());
}

async function handleNoiseReductionChange(enabled) {
  await audio.setNoiseReductionEnabled(enabled);
  ui.update(getFrameState());
}

ui.bindToggle(handleMicrophoneToggle);
ui.bindBaseSpeedChange(() => {
  ui.update(getFrameState());
});
ui.bindNoiseReductionChange(handleNoiseReductionChange);

window.addEventListener("resize", world.resize);
window.addEventListener("beforeunload", () => {
  audio.stop();
});

function animate() {
  requestAnimationFrame(animate);

  const dt = clock.getDelta();
  elapsedTime += dt;

  audio.update(elapsedTime);
  const frameState = getFrameState(dt);
  models.update(dt, frameState);
  fireflies.update(elapsedTime, frameState);

  ui.update(frameState);
  world.render();
}

ui.update({
  ...audio.getReactiveState(),
  speed,
});
ui.setNoiseReductionEnabled(audio.getReactiveState().noiseReductionEnabled);

animate();
