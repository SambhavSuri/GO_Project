import * as THREE from '../three.js-master/build/three.module.js';
import { GLTFLoader } from '../three.js-master/examples/jsm/loaders/GLTFLoader.js';
import { VRButton } from "../three.js-master/examples/jsm/webxr/VRButton.js";
import {
  LookingGlassWebXRPolyfill,
  LookingGlassConfig
} from "https://cdn.skypack.dev/@lookingglass/webxr@0.6.0";
import { VRMLoaderPlugin,VRMExpressionLoaderPlugin } from './three-vrm.module.min.js';
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
let speakingAnimationLoop = null;
const clock = new THREE.Clock();

// Animation cache system
let animationCache = {};
let currentAction = null;
const animationPaths = {
  idle: '/static/animations/idleMale.fbx',
  talking: '/static/animations/talking.fbx',
  thinking: '/static/animations/Thinking.fbx'
};

// Speaking animation variables
let isSpeaking = false;
let speakingStartTime = 0;
const mouthOpenTime = 0.3; // How long mouth stays open
const mouthCloseTime = 0.2; // How long mouth stays closed
const blinkInterval = 2.0; // Blink every 2 seconds
let lastBlinkTime = 0;
let mouthState = 'closed'; // 'open' or 'closed'
let lastMouthChangeTime = 0;

// Initialize animation cache and mixer when VRM is loaded
async function initializeAnimationSystem(vrm) {
    if (!vrm) {
        console.warn('VRM not loaded yet');
        return;
    }
    
    // Create mixer once
    if (!currentMixer) {
        currentMixer = new THREE.AnimationMixer(vrm.scene);
        console.log('✅ Animation mixer created');
    }
    
    // Pre-load all animations into cache
    console.log('🔄 Pre-loading animations...');
    const loadPromises = [];
    
    for (const [name, path] of Object.entries(animationPaths)) {
        loadPromises.push(
            loadMixamoAnimation(path, vrm)
                .then((clip) => {
                    const action = currentMixer.clipAction(clip);
                    action.loop = THREE.LoopRepeat;
                    animationCache[name] = action;
                    console.log(`✅ Cached animation: ${name}`);
                })
                .catch((error) => {
                    console.error(`❌ Failed to cache animation ${name}:`, error);
                })
        );
    }
    
    await Promise.all(loadPromises);
    console.log('✅ All animations cached successfully');
    
    // Start with idle animation
    playAnimationSmooth('idle');
}

// Smooth animation switching with crossfade
function playAnimationSmooth(animationName, crossfadeDuration = 0.3) {
    if (!currentVrm || !currentMixer) {
        console.warn('VRM or mixer not ready yet');
        return;
    }
    
    const newAction = animationCache[animationName];
    if (!newAction) {
        console.warn(`Animation "${animationName}" not found in cache`);
        return;
    }
    
    // If this is the first animation or same animation, just play it
    if (!currentAction || currentAction === newAction) {
        newAction.reset();
        newAction.play();
        currentAction = newAction;
        console.log(`✅ Playing animation: ${animationName}`);
        return;
    }
    
    // Smooth crossfade between animations
    newAction.reset();
    newAction.play();
    newAction.setEffectiveWeight(1);
    
    // Crossfade from current to new animation
    currentAction.crossFadeTo(newAction, crossfadeDuration, false);
    currentAction = newAction;
    
    console.log(`✅ Smooth transition to animation: ${animationName}`);
}

// Legacy function for backward compatibility - now uses smooth transitions
function playAnimation(animationPath) {
    // Map path to animation name
    const animationName = Object.keys(animationPaths).find(key => 
        animationPaths[key] === animationPath
    );
    
    if (animationName) {
        playAnimationSmooth(animationName);
    } else {
        console.warn(`Animation path ${animationPath} not found in cache. Please use initializeAnimationSystem first.`);
    }
}

// Helper function to test expressions
function testExpression(expressionName, weight = 0.5) {
    if (!currentVrm || !currentVrm.expressionManager) {
        console.warn('❌ No VRM or expression manager available');
        return;
    }
    
    // Try to get available expressions from _expressionMap
    let availableExpressions = [];
    if (currentVrm.expressionManager._expressionMap) {
        availableExpressions = Object.keys(currentVrm.expressionManager._expressionMap);
    } else if (currentVrm.expressionManager.expressionNames) {
        availableExpressions = currentVrm.expressionManager.expressionNames;
    }
    
    if (availableExpressions.length === 0) {
        console.warn('⚠️ No expressions found, but trying to set expression anyway');
        try {
            currentVrm.expressionManager.setValue(expressionName, weight);
            console.log(`✅ Set expression "${expressionName}" to weight ${weight} (without validation)`);
        } catch (error) {
            console.error(`❌ Error setting expression "${expressionName}":`, error);
        }
        return;
    }
    
    if (!availableExpressions.includes(expressionName)) {
        console.warn(`❌ Expression "${expressionName}" not found. Available:`, availableExpressions);
        return;
    }
    
    currentVrm.expressionManager.setValue(expressionName, weight);
    console.log(`✅ Set expression "${expressionName}" to weight ${weight}`);
}

// Helper function to list all available expressions
function listExpressions() {
    if (!currentVrm || !currentVrm.expressionManager) {
        console.warn('❌ No VRM or expression manager available');
        return;
    }
    
    if (currentVrm.expressionManager._expressionMap) {
        const expressions = Object.keys(currentVrm.expressionManager._expressionMap);
        console.log('📋 Available expressions:', expressions);
        return expressions;
    } else if (currentVrm.expressionManager.expressionNames) {
        console.log('📋 Available expressions:', currentVrm.expressionManager.expressionNames);
        return currentVrm.expressionManager.expressionNames;
    } else {
        console.warn('⚠️ No expression list available');
        return [];
    }
}

// Start speaking animation with full synchronization
function startSpeaking() {
    console.log('🎤 startSpeaking() called');
    if (!currentVrm || !currentVrm.expressionManager) {
        console.warn('❌ No VRM or expression manager available');
        return;
    }
    
    isSpeaking = true;
    speakingStartTime = clock.getElapsedTime();
    lastBlinkTime = speakingStartTime;
    lastMouthChangeTime = speakingStartTime;
    mouthState = 'closed';
    
    // Start the talking animation for speaking
    playAnimationSmooth('talking');
    
    console.log('🎤 Started synchronized speaking: talking.fbx animation + face expressions');
}

// Enhanced speaking function that combines talking animation with expressions
function startSynchronizedSpeaking() {
    console.log('🎬🎤 startSynchronizedSpeaking() called');
    
    // First switch to talking animation
    switchToTalking();
    
    // Then start the facial expressions
    startSpeaking();
    
    console.log('🎬🎤 Started fully synchronized speaking with talking animation and expressions');
}

// Stop speaking animation
function stopSpeaking() {
    console.log('🔇 stopSpeaking() called');
    if (!currentVrm || !currentVrm.expressionManager) {
        console.warn('❌ No VRM or expression manager available');
        return;
    }
    
    isSpeaking = false;
    
    // Reset expressions to neutral
    currentVrm.expressionManager.resetValues();
    
    // Return to idle animation
    playAnimationSmooth('idle');
    
    console.log('🔇 Stopped speaking animation and returned to idle');
}

// Update speaking animation
function updateSpeakingAnimation(deltaTime) {
    if (!isSpeaking || !currentVrm || !currentVrm.expressionManager) {
        return;
    }
    
    const currentTime = clock.getElapsedTime();
    
    // Handle blinking
    if (currentTime - lastBlinkTime >= blinkInterval) {
        currentVrm.expressionManager.setValue('blink', 1.0);
        lastBlinkTime = currentTime;
        
        // Reset blink after a short time
        setTimeout(() => {
            if (currentVrm && currentVrm.expressionManager) {
                currentVrm.expressionManager.setValue('blink', 0.0);
            }
        }, 150);
    }
    
    // Handle mouth movements
    if (mouthState === 'closed' && currentTime - lastMouthChangeTime >= mouthCloseTime) {
        // Open mouth
        currentVrm.expressionManager.setValue('aa', 0.8);
        currentVrm.expressionManager.setValue('ee', 0.0);
        mouthState = 'open';
        lastMouthChangeTime = currentTime;
    } else if (mouthState === 'open' && currentTime - lastMouthChangeTime >= mouthOpenTime) {
        // Close mouth
        currentVrm.expressionManager.setValue('aa', 0.0);
        currentVrm.expressionManager.setValue('ee', 0.3);
        mouthState = 'closed';
        lastMouthChangeTime = currentTime;
    }
}

// Toggle speaking animation
function toggleSpeaking() {
    if (isSpeaking) {
        stopSpeaking();
    } else {
        startSpeaking();
    }
}

// Switch to talking animation
function switchToTalking() {
    if (!currentVrm) {
        console.warn('❌ No VRM available');
        return;
    }
    
    console.log('🎬 Switching to talking animation...');
    playAnimationSmooth('talking');
}

// Switch to thinking animation
function switchToThinking() {
    console.log('🤔 switchToThinking() called');
    if (!currentVrm) {
        console.warn('❌ No VRM available');
        return;
    }
    
    console.log('🤔 Switching to thinking animation...');
    playAnimationSmooth('thinking');
}

// Switch to idle animation
function switchToIdle() {
    if (!currentVrm) {
        console.warn('❌ No VRM available');
        return;
    }
    
    console.log('😴 Switching to idle animation...');
    playAnimationSmooth('idle');
}

// Toggle between talking and idle animations
function toggleAnimation() {
    if (!currentVrm) {
        console.warn('❌ No VRM available');
        return;
    }
    
    // Check current animation by looking at the mixer
    if (currentMixer && currentMixer._actions.length > 0) {
        const currentAction = currentMixer._actions[0];
        const currentClipName = currentAction._clip.name;
        
        if (currentClipName.includes('talking')) {
            console.log('🔄 Switching from talking to idle...');
            switchToIdle();
        } else {
            console.log('🔄 Switching from idle to talking...');
            switchToTalking();
        }
    } else {
        console.log('🔄 No current animation, switching to talking...');
        switchToTalking();
    }
}

// Make functions available globally for debugging and frontend integration
// Expose immediately after function definitions
window.testExpression = testExpression;
window.listExpressions = listExpressions;
window.startSpeaking = startSpeaking;
window.startSynchronizedSpeaking = startSynchronizedSpeaking;
window.stopSpeaking = stopSpeaking;
window.toggleSpeaking = toggleSpeaking;
window.switchToTalking = switchToTalking;
window.switchToThinking = switchToThinking;
window.switchToIdle = switchToIdle;
window.toggleAnimation = toggleAnimation;
window.playAnimationSmooth = playAnimationSmooth;
window.initializeAnimationSystem = initializeAnimationSystem;

console.log('✅ Animation functions exposed to window object');

// Debug functions
function updateDebugStatus() {
    console.log('🔍 VRM Status Debug:');
    console.log('- currentVrm:', !!currentVrm);
    console.log('- currentMixer:', !!currentMixer);
    console.log('- expressionManager:', currentVrm ? !!currentVrm.expressionManager : 'N/A');
    console.log('- isSpeaking:', isSpeaking);
    
    // Display status in page if element exists
    const statusElement = document.getElementById('vrm-debug-status');
    if (statusElement) {
        statusElement.innerHTML = `
            VRM: ${currentVrm ? '✅' : '❌'} | 
            Mixer: ${currentMixer ? '✅' : '❌'} | 
            Expressions: ${currentVrm && currentVrm.expressionManager ? '✅' : '❌'} | 
            Speaking: ${isSpeaking ? '✅' : '❌'}
        `;
    }
}

function debugAnimationSystem() {
    console.log('🔧 Animation System Debug:');
    updateDebugStatus();
    
    console.log('Available window functions:');
    const funcs = ['switchToThinking', 'switchToTalking', 'switchToIdle', 'startSpeaking', 'stopSpeaking', 'startSynchronizedSpeaking'];
    funcs.forEach(func => {
        console.log(`- window.${func}:`, typeof window[func]);
    });
    
    if (currentVrm && currentVrm.expressionManager) {
        console.log('Available expressions:', listExpressions());
    }
}

window.updateDebugStatus = updateDebugStatus;
window.debugAnimationSystem = debugAnimationSystem;

// Load model
console.log("🚀 Starting VRM model load...");

const loader = new GLTFLoader();

// Register VRM plugins in the correct order
loader.register((parser) => {
    return new VRMLoaderPlugin(parser);
});
loader.register((parser) => {
    return new VRMExpressionLoaderPlugin(parser);
});

loader.load(
  '/static/assets/AvatarSample_C.vrm',
  async function (gltf) {
    console.log('✅ VRM model loaded successfully:', gltf);
    
    // Get VRM object
    currentVrm = gltf.userData.vrm;
    let model = currentVrm.scene;
    
    scene.add(model);
    model.rotation.y = Math.PI;
    console.log('✅ VRM model added to scene');
    
    // Debug VRM object structure
    console.log('🔍 VRM object structure:', {
      hasVrm: !!currentVrm,
      vrmKeys: currentVrm ? Object.keys(currentVrm) : [],
      hasExpressionManager: currentVrm ? !!currentVrm.expressionManager : false,
      expressionManagerType: currentVrm && currentVrm.expressionManager ? typeof currentVrm.expressionManager : 'undefined'
    });
    
    // Log available expressions if expression manager exists
    if (currentVrm.expressionManager) {
      console.log('✅ Expression manager found!');
      
      // Quick test: Force mouth open expression
      console.log('🧪 Testing mouth open expression...');
      try {
        currentVrm.expressionManager.setValue('aa', 1.0);
        currentVrm.update(0.016);
        console.log('✅ Mouth open test completed - check if mouth is open!');
      } catch (error) {
        console.error('❌ Error testing mouth expression:', error);
      }
      
      // Check if expressionNames exists and is accessible
      if (currentVrm.expressionManager.expressionNames) {
        console.log('Available expressions:', currentVrm.expressionManager.expressionNames);
        
        // Test setting an expression
        if (currentVrm.expressionManager.expressionNames.length > 0) {
          const firstExpression = currentVrm.expressionManager.expressionNames[0];
          console.log(`🎭 Testing expression: ${firstExpression}`);
          currentVrm.expressionManager.setValue(firstExpression, 0.5);
        }
      } else {
        console.log('⚠️ expressionNames is undefined, but expression manager exists');
        console.log('🔍 Expression manager properties:', Object.keys(currentVrm.expressionManager));
        
        // Try to get expressions from _expressionMap
        if (currentVrm.expressionManager._expressionMap) {
          const availableExpressions = Object.keys(currentVrm.expressionManager._expressionMap);
          console.log('✅ Found expressions in _expressionMap:', availableExpressions);
          
          // Test a few common expressions
          const testExpressions = ['aa', 'ee', 'happy', 'sad', 'angry', 'blink'];
          testExpressions.forEach(expr => {
            if (availableExpressions.includes(expr)) {
              console.log(`🎭 Testing expression: ${expr}`);
              currentVrm.expressionManager.setValue(expr, 0.3);
            }
          });
        }
        
        // Also check _expressions array
        if (currentVrm.expressionManager._expressions) {
          console.log('📋 _expressions array length:', currentVrm.expressionManager._expressions.length);
        }
      }
    } else {
      console.log('⚠️ No expression manager found in VRM');
      console.log('🔍 Checking if expression manager is in userData:', gltf.userData);
    }
    
    // Initialize animation system after VRM loads
    await initializeAnimationSystem(currentVrm);
    
    // Update debug status
    updateDebugStatus();
    
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
let debugUpdateCounter = 0;
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
  
  // Update speaking animation
  updateSpeakingAnimation(deltaTime);
  
  // Update debug status every 60 frames (approximately 1 second)
  debugUpdateCounter++;
  if (debugUpdateCounter >= 60) {
    updateDebugStatus();
    debugUpdateCounter = 0;
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