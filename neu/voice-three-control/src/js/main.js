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

function getFrameState() {
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
  };
}

async function handleMicrophoneToggle() {
  await audio.toggle();
  ui.update(getFrameState());
}

ui.bindToggle(handleMicrophoneToggle);
ui.bindBaseSpeedChange(() => {
  ui.update(getFrameState());
});

window.addEventListener("resize", world.resize);
window.addEventListener("beforeunload", () => {
  audio.stop();
});

function animate() {
  requestAnimationFrame(animate);

  const dt = clock.getDelta();
  elapsedTime += dt;

  audio.update(elapsedTime);
  const frameState = getFrameState();
  models.update(dt, frameState);
  fireflies.update(elapsedTime, frameState);

  ui.update(frameState);
  world.render();
}

ui.update({
  ...audio.getReactiveState(),
  speed,
});

animate();
