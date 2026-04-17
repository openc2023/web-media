import * as THREE from "three";

export function createFireflies(scene) {
  const count = 150;
  const positions = new Float32Array(count * 3);
  const basePositions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 5);

  const geometry = new THREE.BufferGeometry();
  const color = new THREE.Color();
  const glowTexture = createGlowTexture();

  for (let index = 0; index < count; index += 1) {
    const stride = index * 3;
    const radius = 2.8 + Math.random() * 6.8;
    const angle = Math.random() * Math.PI * 2;
    const height = 2 + Math.random() * 10.5;

    positions[stride] = Math.cos(angle) * radius;
    positions[stride + 1] = height;
    positions[stride + 2] = Math.sin(angle) * radius;
    basePositions[stride] = positions[stride];
    basePositions[stride + 1] = positions[stride + 1];
    basePositions[stride + 2] = positions[stride + 2];

    color.setHSL(0.54 + Math.random() * 0.03, 0.82, 0.76 + Math.random() * 0.12);
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;

    seeds[index * 5] = Math.random() * Math.PI * 2;
    seeds[index * 5 + 1] = 0.18 + Math.random() * 0.55;
    seeds[index * 5 + 2] = 0.12 + Math.random() * 0.4;
    seeds[index * 5 + 3] = 0.35 + Math.random() * 0.65;
    seeds[index * 5 + 4] = Math.random();
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.28,
    map: glowTexture,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    alphaTest: 0.02,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  function update(elapsedTime, reactiveState) {
    const positionArray = geometry.attributes.position.array;
    const colorArray = geometry.attributes.color.array;
    const instantEnergy = Math.min(reactiveState.instantEnergy ?? reactiveState.energy ?? 0, 1);
    const soundDrive = Math.min(
      1,
      (reactiveState.energy ?? 0) * 0.7 + instantEnergy * 1.25
    );
    const motionBoost = 0.58 + soundDrive * 3.4;
    const glowBoost = 0.2 + soundDrive * 0.8;

    for (let index = 0; index < count; index += 1) {
      const stride = index * 3;
      const seedStride = index * 5;
      const phase = seeds[seedStride];
      const driftSpeed = seeds[seedStride + 1];
      const driftAmount = seeds[seedStride + 2];
      const flicker = seeds[seedStride + 3];
      const hueSeed = seeds[seedStride + 4];
      const flowTime = elapsedTime * driftSpeed * motionBoost;
      const sideAmplitude = 0.06 + driftAmount * (0.18 + soundDrive * 0.36);
      const verticalAmplitude = 0.1 + driftAmount * (0.2 + soundDrive * 0.62);
      const riseLift =
        soundDrive *
        (0.24 + driftAmount * 0.9) *
        ((Math.sin(elapsedTime * (1.6 + flicker * 2.4) + phase) + 1) * 0.5);

      positionArray[stride] =
        basePositions[stride] +
        Math.sin(flowTime + phase) * sideAmplitude;
      positionArray[stride + 1] =
        basePositions[stride + 1] +
        Math.sin(flowTime * 1.7 + phase) * verticalAmplitude +
        riseLift;
      positionArray[stride + 2] =
        basePositions[stride + 2] +
        Math.cos(flowTime * 1.12 + phase) * sideAmplitude;

      const blink =
        0.28 +
        ((Math.sin(elapsedTime * (0.8 + driftAmount) + phase) + 1) * 0.5) *
          (0.32 + flicker * (0.42 + soundDrive * 0.95));
      const hueSwing =
        Math.sin(elapsedTime * (0.7 + flicker * 1.8) + phase) * (0.015 + soundDrive * 0.18);
      const hue = (0.53 + hueSeed * 0.05 + hueSwing + soundDrive * hueSeed * 0.32) % 1;
      const saturation = Math.min(0.84 + soundDrive * 0.16 + hueSeed * 0.08, 1);
      const lightness = Math.min(0.5 + blink * 0.28 + glowBoost * (0.16 + hueSeed * 0.18), 0.88);

      color.setHSL(hue < 0 ? hue + 1 : hue, saturation, lightness);
      colorArray[stride] = color.r;
      colorArray[stride + 1] = color.g;
      colorArray[stride + 2] = color.b;
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    material.opacity = 0.66 + reactiveState.brightness * 0.16 + soundDrive * 0.2;
    material.size = 0.2 + reactiveState.energy * 0.06 + instantEnergy * 0.08;
  }

  return {
    update,
  };
}

function createGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;

  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 64);
  gradient.addColorStop(0, "rgba(220, 250, 255, 1)");
  gradient.addColorStop(0.2, "rgba(160, 230, 255, 0.95)");
  gradient.addColorStop(0.45, "rgba(110, 205, 255, 0.55)");
  gradient.addColorStop(0.72, "rgba(70, 165, 255, 0.18)");
  gradient.addColorStop(1, "rgba(70, 165, 255, 0)");

  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
