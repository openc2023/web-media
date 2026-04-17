import { clamp, mix } from "../utils/math.js";

const DEFAULT_MESSAGE = "Demo mode is running. Turn on the mic for live control.";

export function createAudioController() {
  const state = {
    active: false,
    mode: "demo",
    noiseReductionEnabled: true,
    stream: null,
    context: null,
    analyser: null,
    source: null,
    timeData: null,
    freqData: null,
    energy: 0.12,
    instantEnergy: 0,
    brightness: 0.28,
    message: DEFAULT_MESSAGE,
  };

  async function start() {
    let context = null;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        state.message = "This browser does not expose microphone access.";
        return;
      }

      if (!window.isSecureContext) {
        state.message = "On iPhone Safari, microphone access needs HTTPS or localhost.";
        return;
      }

      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) {
        state.message = "This browser does not support Web Audio.";
        return;
      }

      // Chrome 移动端要求：先拿 stream，再创建 AudioContext
      // 顺序颠倒会导致 Android Chrome 麦克风静音
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: state.noiseReductionEnabled,
          noiseSuppression: state.noiseReductionEnabled,
          autoGainControl: state.noiseReductionEnabled,
        },
      });

      context = new AudioContextCtor();
      if (context.state === "suspended") {
        await context.resume();
      }

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
      state.message = state.noiseReductionEnabled
        ? "Live control is on. Noise reduction is enabled."
        : "Live control is on. Noise reduction is disabled.";
    } catch (error) {
      if (context && context.state !== "closed") {
        context.close();
      }

      if (error && error.name === "NotAllowedError") {
        state.message = "Microphone permission was denied, so demo mode stays on.";
      } else if (error && error.name === "NotFoundError") {
        state.message = "No microphone was found on this device.";
      } else if (error && error.name === "NotReadableError") {
        state.message = "The microphone is busy in another app or tab.";
      } else {
        state.message = "Microphone access failed, so demo mode stays on.";
      }
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
    state.instantEnergy = 0;
    state.message = DEFAULT_MESSAGE;
  }

  async function toggle() {
    if (state.active) {
      stop();
      return;
    }

    await start();
  }

  async function setNoiseReductionEnabled(enabled) {
    const nextEnabled = Boolean(enabled);
    if (state.noiseReductionEnabled === nextEnabled) {
      return;
    }

    state.noiseReductionEnabled = nextEnabled;

    if (!state.active) {
      state.message = nextEnabled
        ? "Noise reduction is enabled for the next microphone session."
        : "Noise reduction is disabled for the next microphone session.";
      return;
    }

    stop();
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

    state.instantEnergy = normalizedEnergy;
    state.energy = mix(state.energy, normalizedEnergy, 0.18);
    state.brightness = mix(state.brightness, normalizedBrightness, 0.14);
  }

  function sampleDemo(elapsedTime) {
    const pulse = (Math.sin(elapsedTime * 1.8) + 1) * 0.5;
    const shimmer = (Math.sin(elapsedTime * 2.7 + 1.1) + 1) * 0.5;
    state.instantEnergy = 0;
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
      instantEnergy: state.instantEnergy,
      brightness: state.brightness,
      message: state.message,
      noiseReductionEnabled: state.noiseReductionEnabled,
    };
  }

  return {
    setNoiseReductionEnabled,
    stop,
    toggle,
    update,
    getReactiveState,
  };
}
