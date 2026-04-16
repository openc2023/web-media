import * as THREE from "three";

export function createParticleField(scene) {
  const particleCount = 900;
  const particleGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const basePositions = new Float32Array(particleCount * 3);
  const seeds = new Float32Array(particleCount * 3);

  for (let index = 0; index < particleCount; index += 1) {
    const stride = index * 3;
    const angle = Math.random() * Math.PI * 2;
    const radius = 6 + Math.random() * 10;
    const height = (Math.random() - 0.5) * 8;

    positions[stride] = Math.cos(angle) * radius;
    positions[stride + 1] = height;
    positions[stride + 2] = Math.sin(angle) * radius;

    basePositions[stride] = positions[stride];
    basePositions[stride + 1] = positions[stride + 1];
    basePositions[stride + 2] = positions[stride + 2];

    seeds[stride] = Math.random() * Math.PI * 2;
    seeds[stride + 1] = 0.25 + Math.random() * 1.2;
    seeds[stride + 2] = 0.25 + Math.random() * 1.2;
  }

  particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const pointsMaterial = new THREE.PointsMaterial({
    color: 0x8cf0c8,
    size: 0.06,
    transparent: true,
    opacity: 0.92,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(particleGeometry, pointsMaterial);
  scene.add(points);

  function update(phase, reactiveState) {
    const positionArray = particleGeometry.attributes.position.array;

    for (let index = 0; index < particleCount; index += 1) {
      const stride = index * 3;
      const seedAngle = seeds[stride];
      const amplitude = seeds[stride + 1];
      const drift = seeds[stride + 2];
      const baseX = basePositions[stride];
      const baseY = basePositions[stride + 1];
      const baseZ = basePositions[stride + 2];
      const driftOffset =
        Math.sin(phase * 0.22 + seedAngle) * (0.2 + drift * 0.45);

      positionArray[stride + 1] =
        baseY + Math.sin(phase * 0.28 * drift + seedAngle) * (1.5 + amplitude * 1.8);
      positionArray[stride] = baseX + Math.sin(phase * 0.18 + seedAngle) * driftOffset;
      positionArray[stride + 2] =
        baseZ + Math.cos(phase * 0.18 + seedAngle) * driftOffset;
    }

    particleGeometry.attributes.position.needsUpdate = true;
    pointsMaterial.color.setHSL(
      0.14 + reactiveState.brightness * 0.25,
      0.76,
      0.68
    );
    pointsMaterial.size = 0.045 + reactiveState.energy * 0.07;
  }

  return {
    update,
  };
}
