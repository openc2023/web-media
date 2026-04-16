import { clamp, mix } from "../utils/math.js";

const DEFAULT_MESSAGE = "Demo mode is running. Turn on the mic for live control.";

export function createAudioController() {
  const state = {
    active: false,
    mode: "demo",
    stream: null,
    context: null,
    analyser: null,
    source: null,
    timeData: null,
    freqData: null,
    energy: 0.12,
    brightness: 0.28,
    message: DEFAULT_MESSAGE,
  };

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const context = new window.AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.8;

      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);

      state.stream = stream;
      state.context = context;
      state.analyser = analyser;
      state.source = source;
      state.timeData = new Uint8Array(analyser.fftSize);
      state.freqData = new Uint8Array(analyser.frequencyBinCount);
      state.active = true;
      state.mode = "live";
      state.message = "Live control is on. Keep talking and watch it respond.";
    } catch (error) {
      state.message = "Microphone access was denied, so demo mode stays on.";
      console.error(error);
    }
  }

  function stop() {
    if (state.stream) {
      state.stream.getTracks().forEach((track) => track.stop());
    }

    if (state.context && state.context.state !== "closed") {
      state.context.close();
    }

    state.active = false;
    state.mode = "demo";
    state.stream = null;
    state.context = null;
    state.analyser = null;
    state.source = null;
    state.timeData = null;
    state.freqData = null;
    state.message = DEFAULT_MESSAGE;
  }

  async function toggle() {
    if (state.active) {
      stop();
      return;
    }

    await start();
  }

  function sampleLive() {
    if (!state.analyser || !state.timeData || !state.freqData) {
      return;
    }

    state.analyser.getByteTimeDomainData(state.timeData);
    state.analyser.getByteFrequencyData(state.freqData);

    let rmsAccumulator = 0;
    for (let index = 0; index < state.timeData.length; index += 1) {
      const normalized = (state.timeData[index] - 128) / 128;
      rmsAccumulator += normalized * normalized;
    }

    const rms = Math.sqrt(rmsAccumulator / state.timeData.length);
    const normalizedEnergy = clamp((rms - 0.02) * 7.4, 0, 1);

    let weighted = 0;
    let total = 0;
    for (let index = 1; index < state.freqData.length; index += 1) {
      const value = state.freqData[index] / 255;
      weighted += value * index;
      total += value;
    }

    const centroid = total > 0 ? weighted / total : 0;
    const normalizedBrightness = clamp(centroid / state.freqData.length, 0, 1);

    state.energy = mix(state.energy, normalizedEnergy, 0.18);
    state.brightness = mix(state.brightness, normalizedBrightness, 0.14);
  }

  function sampleDemo(elapsedTime) {
    const pulse = (Math.sin(elapsedTime * 1.8) + 1) * 0.5;
    const shimmer = (Math.sin(elapsedTime * 2.7 + 1.1) + 1) * 0.5;
    state.energy = mix(state.energy, 0.14 + pulse * 0.36, 0.05);
    state.brightness = mix(state.brightness, 0.24 + shimmer * 0.4, 0.05);
  }

  function update(elapsedTime) {
    if (state.mode === "live") {
      sampleLive();
      return;
    }

    sampleDemo(elapsedTime);
  }

  function getReactiveState() {
    return {
      active: state.active,
      energy: state.energy,
      brightness: state.brightness,
      message: state.message,
    };
  }

  return {
    stop,
    toggle,
    update,
    getReactiveState,
  };
}
