import * as THREE from "three";

export function createReactiveSculpture(scene) {
  scene.add(new THREE.AmbientLight(0xffffff, 1.15));

  const keyLight = new THREE.DirectionalLight(0xffe8c0, 2.4);
  keyLight.position.set(5, 6, 4);
  scene.add(keyLight);

  const fillLight = new THREE.PointLight(0x39d0b6, 14, 30, 2);
  fillLight.position.set(-6, 3, 6);
  scene.add(fillLight);

  const rimLight = new THREE.PointLight(0xff7a59, 12, 30, 2);
  rimLight.position.set(6, 2, -4);
  scene.add(rimLight);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(8, 64),
    new THREE.MeshStandardMaterial({
      color: 0x09100d,
      roughness: 0.9,
      metalness: 0.04,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.8;
  scene.add(floor);

  const floorRing = new THREE.Mesh(
    new THREE.RingGeometry(4.5, 5.6, 96),
    new THREE.MeshBasicMaterial({
      color: 0x1e4037,
      transparent: true,
      opacity: 0.36,
      side: THREE.DoubleSide,
    })
  );
  floorRing.rotation.x = -Math.PI / 2;
  floorRing.position.y = -1.79;
  scene.add(floorRing);

  const sculpture = new THREE.Group();
  scene.add(sculpture);

  const coreMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x39d0b6,
    emissive: 0x153a34,
    emissiveIntensity: 1.8,
    roughness: 0.2,
    metalness: 0.55,
    clearcoat: 0.6,
    clearcoatRoughness: 0.15,
  });

  const core = new THREE.Mesh(
    new THREE.TorusKnotGeometry(1.15, 0.34, 240, 32),
    coreMaterial
  );
  sculpture.add(core);

  const heartMaterial = new THREE.MeshStandardMaterial({
    color: 0xff7a59,
    emissive: 0x632313,
    emissiveIntensity: 1.4,
    roughness: 0.18,
    metalness: 0.25,
  });

  const heart = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.62, 1),
    heartMaterial
  );
  sculpture.add(heart);

  const orbitGroup = new THREE.Group();
  sculpture.add(orbitGroup);

  const orbGeometry = new THREE.SphereGeometry(0.15, 24, 24);
  const orbMaterials = [
    new THREE.MeshStandardMaterial({
      color: 0xf4bf4f,
      emissive: 0x77500b,
      emissiveIntensity: 0.9,
    }),
    new THREE.MeshStandardMaterial({
      color: 0xff7a59,
      emissive: 0x6a2712,
      emissiveIntensity: 0.9,
    }),
    new THREE.MeshStandardMaterial({
      color: 0x8cf0c8,
      emissive: 0x215947,
      emissiveIntensity: 0.9,
    }),
  ];

  const orbiters = [];
  for (let index = 0; index < 12; index += 1) {
    const orb = new THREE.Mesh(orbGeometry, orbMaterials[index % orbMaterials.length]);
    orb.userData.offset = (index / 12) * Math.PI * 2;
    orb.userData.lift = index % 2 === 0 ? 0.45 : -0.45;
    orbitGroup.add(orb);
    orbiters.push(orb);
  }

  const spokes = new THREE.Group();
  sculpture.add(spokes);
  for (let index = 0; index < 6; index += 1) {
    const spoke = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 2.2, 16),
      new THREE.MeshStandardMaterial({
        color: 0xf6f4ee,
        transparent: true,
        opacity: 0.48,
        emissive: 0x0f1412,
        roughness: 0.45,
        metalness: 0.2,
      })
    );

    spoke.rotation.z = (index / 6) * Math.PI * 2 + Math.PI / 2;
    spokes.add(spoke);
  }

  const glowRing = new THREE.Mesh(
    new THREE.TorusGeometry(3.2, 0.05, 16, 140),
    new THREE.MeshBasicMaterial({
      color: 0xf4bf4f,
      transparent: true,
      opacity: 0.7,
    })
  );
  glowRing.rotation.x = Math.PI / 2;
  scene.add(glowRing);

  const tempColor = new THREE.Color();

  function update(dt, elapsedTime, reactiveState) {
    const phase = elapsedTime;
    const spread = 2.45 + reactiveState.brightness * 1.7;
    const pulse =
      1 + reactiveState.energy * 0.42 + Math.sin(phase * 2.4) * 0.06;

    sculpture.rotation.y += dt * 0.42;
    sculpture.rotation.x = Math.sin(phase * 0.4) * 0.14;
    sculpture.position.y = Math.sin(phase * 0.75) * 0.22;

    core.rotation.x += dt * 0.65;
    core.rotation.y += dt * 0.94;
    core.scale.setScalar(pulse);

    heart.rotation.y -= dt * 1.2;
    heart.rotation.z += dt * 0.7;
    heart.scale.setScalar(0.92 + reactiveState.energy * 0.45);

    orbitGroup.rotation.y -= dt * 0.22;
    spokes.rotation.y += dt * 0.35;
    spokes.scale.setScalar(1 + reactiveState.brightness * 0.18);

    orbiters.forEach((orb, index) => {
      const angle = phase * 0.7 + orb.userData.offset;
      const verticalWave = Math.sin(phase * 1.4 + index) * 0.35;

      orb.position.set(
        Math.cos(angle) * spread,
        orb.userData.lift + verticalWave,
        Math.sin(angle) * spread
      );

      const scale = 0.78 + reactiveState.energy * 1.2 + (index % 3) * 0.08;
      orb.scale.setScalar(scale);
    });

    floorRing.scale.setScalar(1 + reactiveState.energy * 0.16);
    floorRing.material.opacity = 0.2 + reactiveState.brightness * 0.35;

    glowRing.rotation.z += dt * 0.15;
    glowRing.scale.setScalar(0.92 + reactiveState.energy * 0.36);
    glowRing.material.opacity = 0.34 + reactiveState.energy * 0.38;

    tempColor.setHSL(0.46 - reactiveState.brightness * 0.18, 0.72, 0.54);
    coreMaterial.color.copy(tempColor);
    coreMaterial.emissive.copy(tempColor).multiplyScalar(0.28);

    tempColor.setHSL(0.07 + reactiveState.energy * 0.04, 0.88, 0.6);
    heartMaterial.color.copy(tempColor);
    heartMaterial.emissive.copy(tempColor).multiplyScalar(0.34);

    fillLight.intensity = 9 + reactiveState.brightness * 12;
    rimLight.intensity = 8 + reactiveState.energy * 11;
    keyLight.intensity = 1.8 + reactiveState.energy * 1.1;
  }

  return {
    update,
  };
}
