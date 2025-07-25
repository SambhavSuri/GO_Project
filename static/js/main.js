import * as THREE from '../three.js-master/build/three.module.js';
import { GLTFLoader } from '../three.js-master/examples/jsm/loaders/GLTFLoader.js';
import { VRButton } from "../three.js-master/examples/jsm/webxr/VRButton.js";
import {
  LookingGlassWebXRPolyfill,
  LookingGlassConfig
} from "https://cdn.skypack.dev/@lookingglass/webxr@0.6.0";

console.log('🚀 main.js starting...');

const scene = new THREE.Scene();
console.log('✅ Scene created');

// Initialize Looking Glass configuration
const config = LookingGlassConfig;
config.targetY = 1;
config.targetZ = 0;
config.targetDiam = 3;
config.fovy = (14 * Math.PI) / 180;
console.log('✅ Looking Glass config initialized');

// Initialize Looking Glass WebXR Polyfill
try {
    new LookingGlassWebXRPolyfill();
    console.log('✅ Looking Glass WebXR Polyfill initialized');
} catch (error) {
    console.log('⚠️ Looking Glass WebXR Polyfill warning (non-critical):', error.message);
}

// Load model
console.log("🎯 Starting VRM model load...");

const loader = new GLTFLoader();
loader.load(
  '/static/assets/AvatarSample_C.vrm',
  function (gltf) {
    console.log('✅ VRM model loaded successfully:', gltf);
    const model = gltf.scene;
    model.rotation.y = Math.PI;
    scene.add(model);
    console.log('✅ VRM model added to scene');
    render(); // Initial render
  },
  function (xhr) {
    const progress = (xhr.loaded / xhr.total) * 100;
    console.log(`📊 Loading progress: ${progress.toFixed(1)}%`);
  },
  function (error) {
    console.error('❌ Error loading VRM model:', error);
  }
);

// Lighting
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(2, 2, 5);
scene.add(light);
console.log('✅ Directional light added');

// Add ambient light for better visibility
const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
scene.add(ambientLight);
console.log('✅ Ambient light added');

// Sizes
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};
console.log('📐 Canvas size:', sizes);

// Camera
const camera = new THREE.PerspectiveCamera(30, sizes.width / sizes.height, 0.1, 20);
camera.position.set(0, 1, 2.73);
scene.add(camera);
console.log('📷 Camera created and positioned');

// Renderer
const canvas = document.querySelector('.webgl');
let renderer;

if (canvas) {
    console.log('✅ Found webgl canvas, using it for renderer');
    renderer = new THREE.WebGLRenderer({ 
        canvas: canvas,
        antialias: true 
    });
} else {
    console.log('✅ No webgl canvas found, creating new renderer');
    renderer = new THREE.WebGLRenderer({ antialias: true });
    document.body.append(renderer.domElement);
}

renderer.xr.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.outputEncoding = THREE.sRGBEncoding;

renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.outputEncoding = THREE.sRGBEncoding;
console.log('✅ Renderer configured');

// Animation Loop
renderer.setAnimationLoop(() => {
  render();
});
console.log('✅ Animation loop started');
 
function render() {
  renderer.render(scene, camera);
}
 
// Add VR button
const vrButton = VRButton.createButton(renderer);
document.body.appendChild(vrButton);
console.log('✅ VR button added to body');

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener("resize", resize);
console.log('✅ Resize handler added');

console.log('🎉 main.js initialization complete!');

