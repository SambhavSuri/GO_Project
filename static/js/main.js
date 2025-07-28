import * as THREE from '../three.js-master/build/three.module.js';
import { GLTFLoader } from '../three.js-master/examples/jsm/loaders/GLTFLoader.js';
import { VRButton } from "../three.js-master/examples/jsm/webxr/VRButton.js";
import {
  LookingGlassWebXRPolyfill,
  LookingGlassConfig
} from "https://cdn.skypack.dev/@lookingglass/webxr@0.6.0";
import { VRMLoaderPlugin } from './three-vrm.module.min.js';
import { loadMixamoAnimation } from './loadMixamoAnimation.js';

console.log('🚀 main.js starting...');

// scene
const scene = new THREE.Scene();
scene.background = new THREE.Color('#efead7');
console.log('✅ Scene created');

// Update camera
const camera = new THREE.PerspectiveCamera(30.0, window.innerWidth / window.innerHeight, 0.1, 20.0);
camera.position.set(0.0, 1.0, 2.73);
console.log('📷 Camera created and positioned');

// helperRoot
const helperRoot = new THREE.Group();
helperRoot.renderOrder = 10000;
scene.add(helperRoot);

// UI Root
const uiRoot = new THREE.Group();
uiRoot.renderOrder = 99999;
camera.add(uiRoot);

// camera controls
let controls;

// light
const light = new THREE.DirectionalLight(0xffffff, Math.PI);
light.position.set(1.0, 1.0, 1.0).normalize();
scene.add(light);
console.log('✅ Directional light added');

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

// Animation variables
let currentVrm = null;
let currentMixer = null;
const clock = new THREE.Clock();

// Play animation function
function playAnimation(animationPath) {
    if (!currentVrm) {
        console.warn('VRM not loaded yet');
        return;
    }
    
    currentVrm.humanoid.resetNormalizedPose();
    
    if (currentMixer) {
        currentMixer.stopAllAction();
    }
    currentMixer = new THREE.AnimationMixer(currentVrm.scene);
    
    loadMixamoAnimation(animationPath, currentVrm)
        .then((clip) => {
            const action = currentMixer.clipAction(clip);
            action.play();
            console.log('✅ Animation playing:', animationPath);
        })
        .catch((error) => {
            console.error('❌ Failed to load animation:', error);
        });
}

// Load model
console.log("�� Starting VRM model load...");

const loader = new GLTFLoader();
loader.register((parser) => {
    return new VRMLoaderPlugin(parser);
});

loader.load(
  '/static/assets/AvatarSample_C.vrm',
  function (gltf) {
    console.log('✅ VRM model loaded successfully:', gltf);
    
    // Get VRM object
    currentVrm = gltf.userData.vrm;
    let model = currentVrm.scene;
    
    scene.add(model);
    model.rotation.y = Math.PI;
    console.log('✅ VRM model added to scene');
    
    // Play animation after VRM loads
    playAnimation('/static/animations/talking.fbx'); // Change this to your animation file
    
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

// Renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x000000, 0); // Make renderer background transparent
document.body.appendChild(renderer.domElement);

renderer.xr.enabled = true;
console.log('✅ Renderer configured');

// Animation Loop
renderer.setAnimationLoop(() => {
  const deltaTime = clock.getDelta();
  
  // Update animation mixer
  if (currentMixer) {
    currentMixer.update(deltaTime);
  }
  
  // Update VRM
  if (currentVrm) {
    currentVrm.update(deltaTime);
  }
  
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

// Add XR session handling for Looking Glass
function StartXRSession() {
    // Reposition UI for clear viewing in Looking Glass
    uiRoot.position.x = 0.8;
    uiRoot.position.z = 0.5;
    console.log('✅ XR Session started - UI repositioned for Looking Glass');
}

function EndXRSession() {
    // Reload page on XR Session end to fix view
    console.log('XR Session Ended. Reloading page...');
    location.reload();
}

renderer.xr.addEventListener('sessionstart', StartXRSession);
renderer.xr.addEventListener("sessionend", EndXRSession);

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener("resize", resize);
console.log('✅ Resize handler added');

console.log('🎉 main.js initialization complete!');