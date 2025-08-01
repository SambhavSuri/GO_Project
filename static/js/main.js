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

// Speaking animation variables
let isSpeaking = false;
let speakingStartTime = 0;
const mouthOpenTime = 0.3; // How long mouth stays open
const mouthCloseTime = 0.2; // How long mouth stays closed
const blinkInterval = 2.0; // Blink every 2 seconds
let lastBlinkTime = 0;
let mouthState = 'closed'; // 'open' or 'closed'
let lastMouthChangeTime = 0;

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

// Start speaking animation
function startSpeaking() {
    if (!currentVrm || !currentVrm.expressionManager) {
        console.warn('❌ No VRM or expression manager available');
        return;
    }
    
    isSpeaking = true;
    speakingStartTime = clock.getElapsedTime();
    lastBlinkTime = speakingStartTime;
    lastMouthChangeTime = speakingStartTime;
    mouthState = 'closed';
    
    // Start the idleMale animation
    playAnimation('/static/animations/idleMale.fbx');
    
    console.log('🎤 Started speaking animation');
}

// Stop speaking animation
function stopSpeaking() {
    if (!currentVrm || !currentVrm.expressionManager) {
        return;
    }
    
    isSpeaking = false;
    
    // Reset expressions
    currentVrm.expressionManager.resetValues();
    
    // Stop the animation
    if (currentMixer) {
        currentMixer.stopAllAction();
    }
    
    console.log('🔇 Stopped speaking animation');
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
    playAnimation('/static/animations/talking.fbx');
}

// Switch to idle animation
function switchToIdle() {
    if (!currentVrm) {
        console.warn('❌ No VRM available');
        return;
    }
    
    console.log('😴 Switching to idle animation...');
    playAnimation('/static/animations/idleMale.fbx');
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

// Make testExpression available globally for debugging
window.testExpression = testExpression;
window.listExpressions = listExpressions;
window.startSpeaking = startSpeaking;
window.stopSpeaking = stopSpeaking;
window.toggleSpeaking = toggleSpeaking;
window.switchToTalking = switchToTalking;
window.switchToIdle = switchToIdle;
window.toggleAnimation = toggleAnimation;

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
  function (gltf) {
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
    
    // Play animation after VRM loads
    playAnimation('/static/animations/idleMale.fbx'); // Changed to idleMale for speaking animation
    
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
  
  // Update speaking animation
  updateSpeakingAnimation(deltaTime);
  
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