import * as THREE from 'https://cdn.skypack.dev/three@0.128.0';
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/loaders/GLTFLoader.js';
import { VRButton } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/webxr/VRButton.js';
// WebXR polyfill loaded via _app.tsx to prevent conflicts
// import { LookingGlassWebXRPolyfill, LookingGlassConfig } from 'https://cdn.skypack.dev/@lookingglass/webxr@0.6.0';

// Reuse the exact same viseme mapping from the main VRM avatar
const READY_PLAYER_ME_VISEME_MAP = {
  "0": { "morphTarget": "viseme_sil", "intensity": 0.3, "smoothFactor": 0.3 },      // Silence
  "1": { "morphTarget": "viseme_aa", "intensity": 0.3, "smoothFactor": 0.4 },      // æ, ə, ʌ (TRAP, schwa, STRUT vowels)
  "2": { "morphTarget": "viseme_aa", "intensity": 0.3, "smoothFactor": 0.3 },      // ɑ (PALM vowel - open back "ah")
  "3": { "morphTarget": "viseme_O", "intensity": 0.3, "smoothFactor": 0.3 },       // ɔ (THOUGHT vowel - "aw")
  "4": { "morphTarget": "viseme_E", "intensity": 0.3, "smoothFactor": 0.3 },       // ɛ, ʊ (DRESS, FOOT vowels)
  "5": { "morphTarget": "viseme_RR", "intensity": 0.3, "smoothFactor": 0.4 },      // ɝ (R-colored vowel)
  "6": { "morphTarget": "viseme_I", "intensity": 0.3, "smoothFactor": 0.3 },       // j, i, ɪ (y-sound, FLEECE, KIT vowels)
  "7": { "morphTarget": "viseme_U", "intensity": 0.3, "smoothFactor": 0.4 },       // w, u (w-sound, GOOSE vowel)
  "8": { "morphTarget": "viseme_O", "intensity": 0.3, "smoothFactor": 0.3 },       // o (close-mid back rounded)
  "9": { "morphTarget": "viseme_aa", "intensity": 0.3, "smoothFactor": 0.3 },      // aʊ (MOUTH diphthong)
  "10": { "morphTarget": "viseme_O", "intensity": 0.3, "smoothFactor": 0.3 },      // ɔɪ (CHOICE diphthong)
  "11": { "morphTarget": "viseme_aa", "intensity": 0.3, "smoothFactor": 0.3 },     // aɪ (PRICE diphthong)
  "12": { "morphTarget": "viseme_sil", "intensity": 0.1, "smoothFactor": 0.6 },    // h (aspiration - minimal mouth)
  "13": { "morphTarget": "viseme_RR", "intensity": 0.3, "smoothFactor": 0.5 },     // ɹ (R sound)
  "14": { "morphTarget": "viseme_DD", "intensity": 0.3, "smoothFactor": 0.6 },     // l (L sound - alveolar lateral)
  "15": { "morphTarget": "viseme_SS", "intensity": 0.3, "smoothFactor": 0.6 },     // s, z (voiceless/voiced sibilants)
  "16": { "morphTarget": "viseme_CH", "intensity": 0.3, "smoothFactor": 0.6 },     // ʃ, tʃ, dʒ, ʒ (SH, CH, J, ZH sounds)
  "17": { "morphTarget": "viseme_TH", "intensity": 0.3, "smoothFactor": 0.5 },     // ð (voiced TH as in "the")
  "18": { "morphTarget": "viseme_FF", "intensity": 0.3, "smoothFactor": 0.7 },     // f, v (labiodental fricatives)
  "19": { "morphTarget": "viseme_DD", "intensity": 0.3, "smoothFactor": 0.8 },     // d, t, n, θ (alveolar stops, nasal, voiceless TH)
  "20": { "morphTarget": "viseme_kk", "intensity": 0.3, "smoothFactor": 0.7 },     // k, g, ŋ (velar stops, NG)
  "21": { "morphTarget": "viseme_PP", "intensity": 0.3, "smoothFactor": 0.8 }      // p, b, m (bilabial sounds)
};

// All possible Ready Player Me viseme names (same as VRM avatar)
const ALL_READY_PLAYER_ME_VISEMES = [
  "viseme_sil", "viseme_PP", "viseme_FF", "viseme_TH", "viseme_DD",
  "viseme_kk", "viseme_CH", "viseme_SS", "viseme_nn", "viseme_RR",
  "viseme_aa", "viseme_E", "viseme_I", "viseme_O", "viseme_U"
];

// Map Azure viseme ID to Ready Player Me viseme (same function as VRM avatar)
function mapAzureVisemeToReadyPlayerMe(azureVisemeId) {
  const visemeMapping = READY_PLAYER_ME_VISEME_MAP[azureVisemeId.toString()];
  if (!visemeMapping) {
    console.warn(`[LookingGlass] Unknown Azure viseme ID: ${azureVisemeId}, falling back to silence`);
    return { "morphTarget": "viseme_sil", "intensity": 0.1, "smoothFactor": 0.2 };
  }
  return visemeMapping;
}

// Get viseme intensity (same as VRM avatar)
function getVisemeIntensity(azureVisemeId) {
  const visemeMapping = mapAzureVisemeToReadyPlayerMe(azureVisemeId);
  return visemeMapping.intensity;
}

// Set up renderer to use full screen with WebGL2 support
const renderer = new THREE.WebGLRenderer({ 
  antialias: true,
  context: undefined, // Let Three.js choose the best context
  failIfMajorPerformanceCaveat: false // Allow fallback to WebGL1 if needed
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x000000, 0); // Make renderer background transparent
document.getElementById('scene-container').appendChild(renderer.domElement);

// Update camera with proper XR clipping planes
const camera = new THREE.PerspectiveCamera(70.0, window.innerWidth / window.innerHeight, 0.01, 5000.0);
camera.position.set(0.0, 1.0, 2.73);

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color('#efead7');
scene.add(camera);

// Light
const light = new THREE.DirectionalLight(0xffffff, Math.PI);
light.position.set(1.0, 1.0, 1.0).normalize();
scene.add(light);

// Global variables (same structure as reference code)
let currentModel = undefined;
let currentMixer = undefined;
let currentAnimationName = 'idle';
let currentSpeaker = 'Character';

let lastBlinkTime = 0;
const blinkInterval = 4; // Average time between blinks in seconds
const blinkDuration = 0.17; // Duration of a blink in seconds

// Animation paths (same as reference code)
const animationPaths = {
    idle: '/public/static/animations/idleMale.glb',
    talking: '/public/static/animations/Talking.glb',
    thinking: '/public/static/animations/listenNod.glb', 
    walking: '/public/static/animations/walkingLeftTurn.glb',
    waving: '/public/static/animations/waving.glb'
};

// Viseme animation state (same as VRM avatar)
let previousViseme = "viseme_sil";
let activeVisemes = new Map();
let targetVisemes = new Map();
let visemeAnimationEnabled = true;
let currentActiveViseme = null;
let playedVisemes = [];

// Audio timing (same as VRM avatar)
let audioStartTime = null;
let scheduledVisemes = new Map();

// Cancel all scheduled visemes (same as VRM avatar)
function cancelAllScheduledVisemes() {
    console.log(`🚫 [LookingGlass] Cancelling ${scheduledVisemes.size} scheduled visemes`);
    scheduledVisemes.forEach((timeout) => {
        clearTimeout(timeout);
    });
    scheduledVisemes.clear();
    audioStartTime = null;
}

// Handle direct viseme (same as VRM avatar)
function handleDirectViseme(visemeId, offset) {
    if (!currentModel) {
        console.error(`❌ [LookingGlass] Viseme ${visemeId} BLOCKED: No model loaded`);
        return;
    }
    
    if (!visemeAnimationEnabled) {
        console.error(`❌ [LookingGlass] Viseme ${visemeId} BLOCKED: Animation disabled`);
        return;
    }
    
    // Clear previous scheduled visemes if this is the start of a new TTS session
    if (!currentActiveViseme || currentActiveViseme.timestamp < Date.now() - 500) {
        console.log('🔥 [LookingGlass] New TTS session detected - clearing previous scheduled visemes');
        
        scheduledVisemes.forEach((timeout) => {
            clearTimeout(timeout);
        });
        scheduledVisemes.clear();
        audioStartTime = null;
        
        if (playedVisemes.length > 0) {
            console.log(`🎭 [LookingGlass] ====== END VISEME SUMMARY ======`);
            playedVisemes = [];
        }
    }
    
    // Map Azure viseme to Ready Player Me
    const visemeMapping = mapAzureVisemeToReadyPlayerMe(visemeId);
    const visemeName = visemeMapping.morphTarget;
    const intensity = visemeMapping.intensity;
    
    // Record viseme for summary
    playedVisemes.push({
        azureId: visemeId,
        readyPlayerMe: visemeName,
        intensity: intensity,
        timestamp: Date.now(),
        offset: offset
    });
    
    // Schedule viseme application
    const scheduledTime = Date.now() + offset;
    const timeout = setTimeout(() => {
        applyVisemeToModel(visemeName, intensity);
        scheduledVisemes.delete(scheduledTime);
    }, offset);
    
    scheduledVisemes.set(scheduledTime, timeout);
    
    // Update current active viseme
    currentActiveViseme = {
        name: visemeName,
        intensity: intensity,
        timestamp: Date.now()
    };
    
    console.log(`🔥 [LookingGlass] Viseme scheduled: ${visemeName} (${intensity}) @ +${offset}ms`);
}

// Apply viseme to model (same as VRM avatar)
function applyVisemeToModel(visemeName, intensity) {
    if (!currentModel) return;
    
    console.log(`🔮 [LookingGlass] Applying viseme: ${visemeName} (${intensity})`);
    
    // Reset all visemes first
    ALL_READY_PLAYER_ME_VISEMES.forEach(viseme => {
        applyMorphTarget(viseme, 0.0);
    });
    
    // Apply the specific viseme
    if (visemeName !== "viseme_sil") {
        applyMorphTarget(visemeName, intensity);
    }
}

// Apply morph target (same as VRM avatar)
function applyMorphTarget(targetName, value) {
    if (!currentModel) return;
    
    currentModel.traverse((child) => {
        if (child.isMesh && child.morphTargetDictionary) {
            const index = child.morphTargetDictionary[targetName];
            if (index !== undefined && child.morphTargetInfluences) {
                child.morphTargetInfluences[index] = value;
            }
        }
    });
}

// Load main model (same as reference code)
async function loadModel() {
    console.log('📦 Loading model...');
    
    const loader = new GLTFLoader();
    try {
        const gltf = await loader.loadAsync('/static/assets/6891a06aece5d61d2d726697.glb');
        currentModel = gltf.scene;
        
        // Scale and position the model
        currentModel.scale.set(1, 1, 1);
        currentModel.position.set(0, 0, 0);
        
        // Center the model
        const box = new THREE.Box3().setFromObject(currentModel);
        const center = box.getCenter(new THREE.Vector3());
        currentModel.position.sub(center);
        currentModel.position.y = 0;
        
        // Enable shadows
        currentModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        scene.add(currentModel);
        
        // Create animation mixer
        currentMixer = new THREE.AnimationMixer(currentModel);
        
        console.log('✅ Model loaded successfully');
        
    } catch (error) {
        console.error('❌ Failed to load model:', error);
    }
}

// Load animations (same as reference code)
async function loadAnimations() {
    const promises = Object.entries(animationPaths).map(async ([name, path]) => {
        try {
            const loader = new GLTFLoader();
            const gltf = await loader.loadAsync(path);
            const clip = gltf.animations[0];
            
            if (clip) {
                const action = currentMixer.clipAction(clip);
                action.loop = THREE.LoopRepeat;
                console.log(`✅ Cached animation: ${name}`);
            }
        } catch (error) {
            console.error(`Failed to load animation ${name}:`, error);
        }
    });
    
    await Promise.all(promises);
    console.log('✅ All animations loaded');
}

// Play animation (same as reference code)
function playAnimation(animationName) {
    if (!currentMixer) return;
    
    // Stop current animation
    currentMixer.stopAllAction();
    
    // Load and play new animation
    const loader = new GLTFLoader();
    loader.loadAsync(animationPaths[animationName]).then((gltf) => {
        const clip = gltf.animations[0];
        if (clip) {
            const action = currentMixer.clipAction(clip);
            action.loop = THREE.LoopRepeat;
            action.play();
            currentAnimationName = animationName;
            console.log(`🎭 Playing animation: ${animationName}`);
        }
    }).catch(error => {
        console.error(`Failed to play animation ${animationName}:`, error);
    });
}

// Update blink (same as reference code)
function updateBlink(deltaTime) {
    if (!currentModel) return;

    lastBlinkTime += deltaTime;

    // Check if it's time to blink
    if (lastBlinkTime > blinkInterval) {
        // Reset the blink timer with some randomness
        lastBlinkTime = -Math.random() * 2;

        // Perform the blink
        let blinkProgress = 0;
        const blinkAnimation = setInterval(() => {
            blinkProgress += 1 / 60; // Assuming 60 FPS
            const blinkValue = Math.sin(Math.PI * blinkProgress / blinkDuration);
            
            // Apply blink morph target
            applyMorphTarget('blink', blinkValue);

            if (blinkProgress >= blinkDuration) {
                clearInterval(blinkAnimation);
                applyMorphTarget('blink', 0);
            }
        }, 1000 / 60); // Run the animation at 60 FPS
    }
}

// WebXR for Looking Glass Functions (same as reference code)
renderer.xr.enabled = true;

// Looking Glass configuration - will be set by _app.tsx
console.log('✅ Looking Glass config will be set by _app.tsx');

// WebXR polyfill initialization handled by _app.tsx to prevent conflicts
console.log('✅ WebXR polyfill initialization handled by _app.tsx');

// Add Start Session Button
document.body.append(VRButton.createButton(renderer));

function StartXRSession() {
    // Reposition UI for clear viewing in Looking Glass
    console.log('🔮 [LookingGlass] XR Session started');
}

function EndXRSession() {
    // Reload page on XR Session end to fix view
    console.log('🔮 [LookingGlass] XR Session ended. Reloading page...');
    location.reload();
}

renderer.xr.addEventListener('sessionstart', StartXRSession);
renderer.xr.addEventListener("sessionend", EndXRSession);

// Animation mirroring from main app
function setupAnimationMirroring() {
    console.log('🔗 Setting up animation mirroring...');
    
    window.addEventListener('message', (event) => {
        console.log('📨 Received message:', event.data);
        
        // Only accept messages from same origin
        if (event.origin !== window.location.origin) {
            return;
        }
        
        if (event.data && event.data.type === 'MIRROR_ANIMATION') {
            const { animationType, data } = event.data;
            
            console.log(`🔮 [LookingGlass] Mirroring ${animationType}:`, data);
            
            switch (animationType) {
                case 'viseme':
                    // Handle viseme data from main app
                    if (data.visemeId !== undefined && data.offset !== undefined) {
                        handleDirectViseme(data.visemeId, data.offset);
                    } else if (data.visemeId !== undefined) {
                        // Fallback for simple viseme data
                        const visemeMapping = mapAzureVisemeToReadyPlayerMe(data.visemeId);
                        applyVisemeToModel(visemeMapping.morphTarget, visemeMapping.intensity);
                    }
                    break;
                case 'speaking':
                    if (data.isSpeaking) {
                        playAnimation('talking');
                    } else {
                        playAnimation('idle');
                    }
                    break;
                case 'session':
                    if (!data.isActive) {
                        cancelAllScheduledVisemes();
                        playAnimation('idle');
                    }
                    break;
                default:
                    console.log(`🔮 [LookingGlass] Unknown animation type: ${animationType}`);
            }
        }
    });
    
    console.log('🔗 Animation mirroring ready');
}

// Initialize everything
async function init() {
    console.log('🚀 Initializing Looking Glass 3D Viewer...');
    
    await loadModel();
    await loadAnimations();
    setupAnimationMirroring();
    
    // Hide loading overlay
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
    
    console.log('✅ Looking Glass Viewer ready!');
}

// Animate
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const deltaTime = clock.getDelta();

    if (currentMixer) {
        currentMixer.update(deltaTime);
    }

    if (currentModel) {
        updateBlink(deltaTime);
    }

    renderer.render(scene, camera);
}

// Resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize when page loads
window.addEventListener('load', () => {
    init().then(() => {
        animate();
    });
});
