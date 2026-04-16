import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export function createWorld() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.Fog(0x000000, 55, 220);

  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(0, 2.8, 8);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 5;
  controls.maxDistance = 12;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.autoRotate = false;

  function frameObject(object, padding = 0.86) {
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) {
      return;
    }

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxSize = Math.max(size.x, size.y, size.z);
    const fitHeightDistance =
      maxSize / (2 * Math.tan((Math.PI * camera.fov) / 360));
    const fitWidthDistance = fitHeightDistance / camera.aspect;
    const isMobile = window.innerWidth <= 720;
    const framingDistance = isMobile
      ? fitHeightDistance
      : Math.max(fitHeightDistance, fitWidthDistance);
    const framingPadding = isMobile ? 0.86 : padding;
    const distance = framingPadding * framingDistance;
    const direction = isMobile
      ? new THREE.Vector3(0, -0.03, 1).normalize()
      : new THREE.Vector3(0, 0.018, 1).normalize();
    const frontLift = isMobile
      ? new THREE.Vector3(0, maxSize * 0.09 - 0.9, 0)
      : new THREE.Vector3(0, maxSize * -0.012, 0);

    camera.position.copy(center).add(frontLift).add(direction.multiplyScalar(distance));
    camera.near = Math.max(distance / 100, 0.1);
    camera.far = Math.max(distance * 40, 200);
    camera.updateProjectionMatrix();

    controls.target.copy(center).add(frontLift);
    controls.minDistance = Math.max(distance * 0.25, 1.5);
    controls.maxDistance = Math.max(distance * 4, 12);
    controls.update();
  }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  function render() {
    controls.update();
    renderer.render(scene, camera);
  }

  return {
    camera,
    controls,
    frameObject,
    render,
    renderer,
    resize,
    scene,
  };
}
