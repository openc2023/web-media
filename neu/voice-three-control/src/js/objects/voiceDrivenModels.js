import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clamp, mix } from "../utils/math.js";
import { CONFIG } from "../config.js";

export function createVoiceDrivenModels(scene, world) {
  const loader = new GLTFLoader();
  const root = new THREE.Group();
  const content = new THREE.Group();
  root.add(content);
  scene.add(root);

  const windmillOutlineMaterials = [];
  const windmillBaseMaterials = [];
  const bladeMatEntries = [];
  const bladePalette = CONFIG.blade.palette.map((hex) => new THREE.Color(hex));

  let bladeColorTimer = 0;

  const mixerState = {
    mixer: null,
    actions: [],
    speed: 0,
  };

  const playbackTuning = CONFIG.playback;

  const { lights } = CONFIG;
  scene.add(new THREE.AmbientLight(lights.ambient.color, lights.ambient.intensity));

  const keyLight = new THREE.DirectionalLight(lights.key.color, lights.key.intensity);
  keyLight.position.set(...lights.key.position);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(lights.fill.color, lights.fill.intensity);
  fillLight.position.set(...lights.fill.position);
  scene.add(fillLight);

  const rimLight = new THREE.PointLight(lights.rim.color, lights.rim.intensity, lights.rim.distance, 2);
  rimLight.position.set(...lights.rim.position);
  scene.add(rimLight);

  function isBladeMesh(mesh) {
    const n = CONFIG.models.bladeMeshName;
    return mesh.isMesh && (mesh.name === n || (mesh.parent && mesh.parent.name === n));
  }

  function optimizeModel(model) {
    model.traverse((child) => {
      if (!child.isMesh) {
        return;
      }

      child.castShadow = false;
      child.receiveShadow = true;
      child.frustumCulled = true;
    });
  }

  function cloneWindmillMaterial(material, emissiveColor) {
    if (Array.isArray(material)) {
      return material.map((entry) =>
        cloneSingleWindmillMaterial(entry, emissiveColor)
      );
    }

    return cloneSingleWindmillMaterial(material, emissiveColor);
  }

  function cloneSingleWindmillMaterial(originalMaterial, emissiveColor) {
    const clonedMaterial = originalMaterial.clone();

    if ("emissive" in clonedMaterial) {
      clonedMaterial.emissive = emissiveColor.clone();
      clonedMaterial.emissiveIntensity = 0.55;
    }

    clonedMaterial.needsUpdate = true;
    return clonedMaterial;
  }

  function applyWindmillGlow(model) {
    const outlineColor = new THREE.Color(0x7fe8ff);
    const emissiveColor = new THREE.Color(0x5fdcff);

    model.traverse((child) => {
      if (!child.isMesh || child.name.startsWith("__outline__")) {
        return;
      }

      if (child.material) {
        child.material = cloneWindmillMaterial(child.material, emissiveColor);

        const materialList = Array.isArray(child.material)
          ? child.material
          : [child.material];

        materialList.forEach((material) => {
          windmillBaseMaterials.push(material);

          if (isBladeMesh(child) && material.color) {
            bladeMatEntries.push({
              mat: material,
              base: material.color.clone(),
              current: material.color.clone(),
              target: material.color.clone(),
              glow: emissiveColor.clone(),
            });
          }
        });
      }

      const outlineMaterial = new THREE.MeshBasicMaterial({
        color: outlineColor,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.32,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const outlineMesh = new THREE.Mesh(child.geometry, outlineMaterial);
      outlineMesh.name = `__outline__${child.name || "mesh"}`;
      outlineMesh.scale.setScalar(1.06);
      outlineMesh.renderOrder = 2;
      child.add(outlineMesh);
      windmillOutlineMaterials.push(outlineMaterial);
    });
  }

  function loadModel(path) {
    return new Promise((resolve, reject) => {
      loader.load(path, resolve, undefined, reject);
    });
  }

  function normalizeContent() {
    const box = new THREE.Box3().setFromObject(content);
    if (box.isEmpty()) {
      return;
    }

    const size = box.getSize(new THREE.Vector3());
    const maxSize = Math.max(size.x, size.y, size.z);

    if (maxSize > 0) {
      content.scale.setScalar(CONFIG.scene.targetSize / maxSize);
    }

    const normalizedBox = new THREE.Box3().setFromObject(content);
    const normalizedCenter = normalizedBox.getCenter(new THREE.Vector3());
    const minY = normalizedBox.min.y;

    content.position.x -= normalizedCenter.x;
    content.position.z -= normalizedCenter.z;
    content.position.y -= minY;
  }

  function playClips(gltf) {
    if (!gltf.animations || gltf.animations.length === 0) {
      return;
    }

    const mixer = new THREE.AnimationMixer(gltf.scene);
    const actions = gltf.animations.map((clip) => {
      const action = mixer.clipAction(clip);
      action.enabled = true;
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.play();
      return action;
    });

    mixerState.mixer = mixer;
    mixerState.actions = actions;
  }

  async function load() {
    try {
      const [mogu, fengche] = await Promise.all([
        loadModel(CONFIG.models.background),
        loadModel(CONFIG.models.animated),
      ]);

      optimizeModel(mogu.scene);
      optimizeModel(fengche.scene);
      applyWindmillGlow(fengche.scene);

      content.add(mogu.scene);
      content.add(fengche.scene);

      playClips(fengche);
      normalizeContent();
      world.frameObject(root);
    } catch (error) {
      console.error("Failed to load scene models.", error);
    }
  }

  function getPlaybackSpeed(energy, response) {
    const threshold = 0.035;
    if (energy <= threshold) {
      return 0;
    }

    const normalized = clamp((energy - threshold) / (1 - threshold), 0, 1);
    return (0.2 + normalized * 3.8) * response;
  }

  function updateBladeColors(dt, reactiveState) {
    if (bladeMatEntries.length === 0) {
      return;
    }

    const isActive = reactiveState.energy > CONFIG.blade.activeThreshold;
    const colorLerp = isActive ? 0.14 + reactiveState.energy * 0.22 : 0.05;

    if (isActive) {
      bladeColorTimer -= dt * (1 + reactiveState.energy * 4);
      if (bladeColorTimer <= 0) {
        bladeColorTimer = 0.08 + Math.random() * 0.18;
        bladeMatEntries.forEach((entry, index) => {
          const nextColor =
            bladePalette[Math.floor(Math.random() * bladePalette.length)].clone();
          if (index % 2 === 1) {
            nextColor.offsetHSL(0, 0, -0.08);
          }
          entry.target.copy(nextColor);
        });
      }
    } else {
      bladeColorTimer = 0;
    }

    bladeMatEntries.forEach((entry) => {
      const targetColor = isActive ? entry.target : entry.base;
      entry.current.lerp(targetColor, colorLerp);
      entry.mat.color.copy(entry.current);

      if ("emissive" in entry.mat) {
        entry.mat.emissive.copy(isActive ? entry.current : entry.glow);
        entry.mat.emissiveIntensity = isActive
          ? 0.85 + reactiveState.energy * 1.8
          : 0.4 + reactiveState.energy * 1.15;
      }
    });
  }

  function update(dt, reactiveState) {
    rimLight.intensity = 8 + reactiveState.energy * 18;
    fillLight.intensity = 1.2 + reactiveState.brightness * 1.8;
    keyLight.intensity = 2 + reactiveState.brightness * 1.2;

    windmillOutlineMaterials.forEach((material) => {
      material.opacity = 0.26 + reactiveState.energy * 0.4;
      material.color.setHSL(0.54, 0.95, 0.68 + reactiveState.energy * 0.12);
    });

    windmillBaseMaterials.forEach((material) => {
      if ("emissiveIntensity" in material) {
        material.emissiveIntensity = 0.4 + reactiveState.energy * 1.15;
      }
    });

    updateBladeColors(dt, reactiveState);

    if (!mixerState.mixer) {
      return;
    }

    const targetSpeed = getPlaybackSpeed(
      reactiveState.energy,
      reactiveState.response
    );
    const easing =
      targetSpeed > mixerState.speed
        ? playbackTuning.attack
        : playbackTuning.release;
    mixerState.speed = mix(mixerState.speed, targetSpeed, easing);

    mixerState.actions.forEach((action) => {
      action.paused = mixerState.speed < playbackTuning.pauseThreshold;
      action.timeScale = Math.max(
        mixerState.speed,
        playbackTuning.minActiveSpeed
      );
    });

    mixerState.mixer.update(dt);
  }

  load();

  return {
    update,
  };
}
