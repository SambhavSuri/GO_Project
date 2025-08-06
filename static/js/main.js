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
let currentModel = null;  // For both VRM and GLB models
let currentMixer = null;
let speakingAnimationLoop = null;
const clock = new THREE.Clock();

// GLB morph target variables
let morphTargets = {};
let expressionMeshes = [];

// Facial expression presets for morph targets
const facialExpressions = {
  default: {},
  smile: {
    browInnerUp: 0.17,
    eyeSquintLeft: 0.4,
    eyeSquintRight: 0.44,
    noseSneerLeft: 0.17,
    noseSneerRight: 0.14,
    mouthPressLeft: 0.61,
    mouthPressRight: 0.41,
  },
  funnyFace: {
    jawLeft: 0.63,
    mouthPucker: 0.53,
    noseSneerLeft: 1,
    noseSneerRight: 0.39,
    mouthLeft: 1,
    eyeLookUpLeft: 1,
    eyeLookUpRight: 1,
    cheekPuff: 0.999,
    mouthDimpleLeft: 0.414,
    mouthRollLower: 0.32,
    mouthSmileLeft: 0.355,
    mouthSmileRight: 0.355,
  },
  sad: {
    mouthFrownLeft: 1,
    mouthFrownRight: 1,
    mouthShrugLower: 0.783,
    browInnerUp: 0.452,
    eyeSquintLeft: 0.72,
    eyeSquintRight: 0.75,
    eyeLookDownLeft: 0.5,
    eyeLookDownRight: 0.5,
    jawForward: 1,
  },
  surprised: {
    eyeWideLeft: 0.5,
    eyeWideRight: 0.5,
    jawOpen: 0.351,
    mouthFunnel: 1,
    browInnerUp: 1,
  },
  angry: {
    browDownLeft: 1,
    browDownRight: 1,
    eyeSquintLeft: 1,
    eyeSquintRight: 1,
    jawForward: 1,
    jawLeft: 1,
    mouthShrugLower: 1,
    noseSneerLeft: 1,
    noseSneerRight: 0.42,
    eyeLookDownLeft: 0.16,
    eyeLookDownRight: 0.16,
    cheekSquintLeft: 1,
    cheekSquintRight: 1,
    mouthClose: 0.23,
    mouthFunnel: 0.63,
    mouthDimpleRight: 1,
  },
  crazy: {
    browInnerUp: 0.9,
    jawForward: 1,
    noseSneerLeft: 0.57,
    noseSneerRight: 0.51,
    eyeLookDownLeft: 0.394,
    eyeLookUpRight: 0.404,
    eyeLookInLeft: 0.962,
    eyeLookInRight: 0.962,
    jawOpen: 0.962,
    mouthDimpleLeft: 0.962,
    mouthDimpleRight: 0.962,
    mouthStretchLeft: 0.279,
    mouthStretchRight: 0.289,
    mouthSmileLeft: 0.558,
    mouthSmileRight: 0.385,
    tongueOut: 0.962,
  },
};

// Viseme mapping for lip sync using your model's actual visemes
const visemeMapping = {
  A: "viseme_aa",    // Open mouth sound
  B: "viseme_PP",    // Bilabial sounds (B, P, M)
  C: "viseme_I",     // Close front vowel
  D: "viseme_DD",    // Dental/alveolar sounds (D, T, N, L)
  E: "viseme_E",     // Mid front vowel
  F: "viseme_U",     // Close back vowel (OO sound)
  G: "viseme_FF",    // Labiodental sounds (F, V)
  H: "viseme_TH",    // Dental fricative (TH)
  X: "viseme_sil",   // Silence
  SIL: "viseme_sil", // Silence
  CH: "viseme_CH",   // Palato-alveolar sounds (CH, SH)
  SS: "viseme_SS",   // Sibilant sounds (S, Z)
  NN: "viseme_nn",   // Nasal sounds
  RR: "viseme_RR",   // R sounds
  KK: "viseme_kk",   // Velar sounds (K, G)
  O: "viseme_O",     // Open back vowel
};

// Current facial expression state
let currentFacialExpression = "default";
let currentLipsync = null;
let currentAudio = null;

// Animation cache system
let animationCache = {};
let currentAction = null;
const animationPaths = {
  idle: '/static/animations/idleMale.glb',
  talking: '/static/animations/Talking.glb',
  thinking: '/static/animations/Thinking.fbx'  // Keep FBX for now since no GLB version
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

// Initialize animation cache and mixer when model is loaded
async function initializeAnimationSystem(model, isVRM = false) {
    if (!model) {
        console.warn('Model not loaded yet');
        return;
    }
    
    // Get the scene object for the mixer
    const scene = isVRM ? model.scene : model;
    
    // Create mixer once
    if (!currentMixer) {
        currentMixer = new THREE.AnimationMixer(scene);
        console.log('✅ Animation mixer created');
    }
    
    // Pre-load all animations into cache
    console.log('🔄 Pre-loading animations...');
    const loadPromises = [];
    
    for (const [name, path] of Object.entries(animationPaths)) {
        loadPromises.push(
            loadAnimationFile(path, model, isVRM)
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

// Find morph targets in GLB model
function findMorphTargets() {
    if (!currentModel) {
        console.warn('❌ No model loaded for morph target discovery');
        return;
    }
    
    morphTargets = {};
    expressionMeshes = [];
    
    currentModel.traverse((child) => {
        if (child.isSkinnedMesh && child.morphTargetDictionary) {
            console.log(`🎭 Found morph targets in mesh "${child.name}":`, Object.keys(child.morphTargetDictionary));
            
            // Store reference to this mesh for expression control
            expressionMeshes.push(child);
            
            // Add all morph targets from this mesh
            Object.keys(child.morphTargetDictionary).forEach(targetName => {
                morphTargets[targetName] = child.morphTargetDictionary[targetName];
            });
        }
    });
    
    console.log(`✅ Found ${Object.keys(morphTargets).length} total morph targets across ${expressionMeshes.length} meshes`);
    return morphTargets;
}

// Lerp morph target to a specific value (similar to reference code)
function lerpMorphTarget(targetName, value, speed = 0.1) {
    if (!currentModel) {
        return;
    }
    
    currentModel.traverse((child) => {
        if (child.isSkinnedMesh && child.morphTargetDictionary) {
            const index = child.morphTargetDictionary[targetName];
            if (index === undefined || child.morphTargetInfluences[index] === undefined) {
                return;
            }
            
            // Smoothly interpolate to the target value
            child.morphTargetInfluences[index] = THREE.MathUtils.lerp(
                child.morphTargetInfluences[index],
                value,
                speed
            );
        }
    });
}

// Set facial expression using morph targets
function setFacialExpression(expressionName) {
    if (!currentModel || !facialExpressions[expressionName]) {
        console.warn(`Expression "${expressionName}" not found or model not loaded`);
        return;
    }
    
    currentFacialExpression = expressionName;
    const expression = facialExpressions[expressionName];
    
    console.log(`🎭 Setting facial expression: ${expressionName}`);
    
    // Apply the expression morph targets
    Object.keys(morphTargets).forEach(targetName => {
        const value = expression[targetName] || 0;
        lerpMorphTarget(targetName, value, 0.1);
    });
}

// Set a specific morph target value directly
function setMorphTarget(targetName, value) {
    if (!currentModel) {
        console.warn('No model loaded');
        return;
    }
    
    currentModel.traverse((child) => {
        if (child.isSkinnedMesh && child.morphTargetDictionary) {
            const index = child.morphTargetDictionary[targetName];
            if (index !== undefined && child.morphTargetInfluences[index] !== undefined) {
                child.morphTargetInfluences[index] = value;
            }
        }
    });
}

// Reset all morph targets to neutral
function resetAllMorphTargets() {
    if (!currentModel) {
        return;
    }
    
    currentModel.traverse((child) => {
        if (child.isSkinnedMesh && child.morphTargetInfluences) {
            for (let i = 0; i < child.morphTargetInfluences.length; i++) {
                child.morphTargetInfluences[i] = 0;
            }
        }
    });
}

// Load Mixamo animation for GLB models with proper bone mapping
async function loadMixamoAnimationForGLB(url, model) {
    console.log(`🎬 Loading Mixamo animation for GLB: ${url}`);
    
    const loader = new FBXLoader();
    
    return loader.loadAsync(url).then((asset) => {
        const clip = THREE.AnimationClip.findByName(asset.animations, 'mixamo.com');
        
        if (!clip) {
            throw new Error('No Mixamo animation found in FBX file');
        }
        
        console.log(`🎬 Found Mixamo clip: ${clip.name}, duration: ${clip.duration}s`);
        
        // Get all bones in the GLB model
        const modelBones = {};
        model.traverse((child) => {
            if (child.isBone) {
                modelBones[child.name] = child;
            }
        });
        
        console.log('📋 GLB model bones:', Object.keys(modelBones));
        console.log('📋 Animation tracks:', clip.tracks.map(t => t.name.split('.')[0]));
        
        // Create new tracks with proper bone name mapping
        const newTracks = [];
        
        clip.tracks.forEach(track => {
            const [boneName, property] = track.name.split('.');
            
            // Remove "mixamorig:" prefix from animation bone names
            let targetBoneName = boneName.replace('mixamorig:', '').replace('mixamorig', '');
            
            // Handle special cases and common name variations
            const boneNameMap = {
                'Hips': 'Hips',
                'Spine': 'Spine', 
                'Spine1': 'Spine1',
                'Spine2': 'Spine2',
                'Neck': 'Neck',
                'Head': 'Head',
                'LeftShoulder': 'LeftShoulder',
                'LeftArm': 'LeftArm', 
                'LeftForeArm': 'LeftForeArm',
                'LeftHand': 'LeftHand',
                'RightShoulder': 'RightShoulder',
                'RightArm': 'RightArm',
                'RightForeArm': 'RightForeArm', 
                'RightHand': 'RightHand',
                'LeftUpLeg': 'LeftUpLeg',
                'LeftLeg': 'LeftLeg',
                'LeftFoot': 'LeftFoot',
                'RightUpLeg': 'RightUpLeg',
                'RightLeg': 'RightLeg',
                'RightFoot': 'RightFoot'
            };
            
            // Try mapped name first
            if (boneNameMap[targetBoneName]) {
                targetBoneName = boneNameMap[targetBoneName];
            }
            
            // Check if this bone exists in the GLB model
            if (modelBones[targetBoneName]) {
                console.log(`✅ Mapping: ${boneName} -> ${targetBoneName}`);
                
                // Create new track with the correct bone name
                const TrackConstructor = track.constructor;
                const newTrack = new TrackConstructor(
                    `${targetBoneName}.${property}`,
                    track.times,
                    track.values
                );
                newTracks.push(newTrack);
            } else {
                console.warn(`⚠️ Bone "${targetBoneName}" not found in GLB model, skipping track`);
            }
        });
        
        console.log(`✅ Created ${newTracks.length} tracks for GLB animation`);
        
        return new THREE.AnimationClip(`glb_${clip.name}`, clip.duration, newTracks);
    });
}

// Universal animation loader that handles both GLB and FBX files
async function loadAnimationFile(url, model, isVRM = false) {
    const fileExtension = url.split('.').pop().toLowerCase();
    
    console.log(`🎬 Loading ${fileExtension.toUpperCase()} animation: ${url}`);
    
    if (fileExtension === 'glb' || fileExtension === 'gltf') {
        // Load GLB animation file
        const loader = new GLTFLoader();
        
        return loader.loadAsync(url).then((gltf) => {
            console.log(`📦 GLB file loaded from ${url}:`, {
                animations: gltf.animations ? gltf.animations.length : 0,
                scene: !!gltf.scene,
                nodes: gltf.scene ? gltf.scene.children.length : 0
            });
            
            if (!gltf.animations || gltf.animations.length === 0) {
                console.error(`❌ No animations found in GLB file: ${url}`);
                console.log('Available properties:', Object.keys(gltf));
                throw new Error('No animations found in GLB file');
            }
            
            // List all animations in the file
            console.log(`📋 Found ${gltf.animations.length} animations in GLB:`);
            gltf.animations.forEach((anim, index) => {
                console.log(`  ${index}: "${anim.name}" (${anim.duration}s, ${anim.tracks.length} tracks)`);
            });
            
            // Use the first animation in the GLB file
            const clip = gltf.animations[0];
            console.log(`✅ Using GLB animation: ${clip.name}, duration: ${clip.duration}s, tracks: ${clip.tracks.length}`);
            
            return clip;
        }).catch((error) => {
            console.error(`❌ Failed to load GLB animation from ${url}:`, error);
            throw error;
        });
        
    } else if (fileExtension === 'fbx') {
        // Load FBX animation file (for VRM or with bone mapping for GLB)
        if (isVRM) {
            return loadMixamoAnimation(url, model);
        } else {
            return loadMixamoAnimationForGLB(url, model);
        }
        
    } else {
        throw new Error(`Unsupported animation file format: ${fileExtension}`);
    }
}

// Smooth animation switching with crossfade
function playAnimationSmooth(animationName, crossfadeDuration = 0.3) {
    if (!currentModel || !currentMixer) {
        console.warn('Model or mixer not ready yet');
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
        
        // Auto-start speaking animation if this is the talking animation
        if (animationName === 'talking') {
            console.log('🎤 Auto-starting speaking with mouth movement...');
            startSpeaking();
        } else {
            // Stop speaking if switching to non-talking animation
            if (isSpeaking) {
                console.log('🔇 Stopping speaking for non-talking animation...');
                stopSpeaking();
            }
        }
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
    
    // Auto-start/stop speaking animation based on animation type
    if (animationName === 'talking') {
        console.log('🎤 Auto-starting speaking with mouth movement...');
        startSpeaking();
    } else {
        // Stop speaking if switching to non-talking animation
        if (isSpeaking) {
            console.log('🔇 Stopping speaking for non-talking animation...');
            stopSpeaking();
        }
    }
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
    
    // Check if we have VRM or GLB model
    const hasVRM = currentVrm && currentVrm.expressionManager;
    const hasGLB = currentModel && Object.keys(morphTargets).length > 0;
    
    if (!hasVRM && !hasGLB) {
        console.warn('❌ No VRM expression manager or GLB morph targets available');
        return;
    }
    
    console.log(`🎤 Model type detected: ${hasVRM ? 'VRM' : 'GLB with morph targets'}`);
    
    isSpeaking = true;
    speakingStartTime = clock.getElapsedTime();
    lastBlinkTime = speakingStartTime;
    lastMouthChangeTime = speakingStartTime;
    mouthState = 'closed';
    
    // Don't call playAnimationSmooth here if we're already being called from it
    // This prevents infinite loops
    
    console.log(`🎤 Started speaking facial expressions: ${hasVRM ? 'VRM' : 'morph target'} system`);
    console.log(`🎤 Speaking state: isSpeaking=${isSpeaking}, mouthState=${mouthState}`);
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
    
    const hasVRM = currentVrm && currentVrm.expressionManager;
    const hasGLB = currentModel && Object.keys(morphTargets).length > 0;
    
    if (!hasVRM && !hasGLB) {
        console.warn('❌ No VRM expression manager or GLB morph targets available');
        return;
    }
    
    isSpeaking = false;
    
    // Reset expressions to neutral
    if (hasVRM) {
        currentVrm.expressionManager.resetValues();
    } else if (hasGLB) {
        // Reset all visemes to neutral/silence
        const allVisemes = ['viseme_sil', 'viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD', 'viseme_kk', 'viseme_CH', 'viseme_SS', 'viseme_nn', 'viseme_RR', 'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U'];
        allVisemes.forEach(viseme => {
            lerpMorphTarget(viseme, 0.0, 0.3);
        });
        // Set slight silence expression
        lerpMorphTarget('viseme_sil', 0.2, 0.3);
        currentFacialExpression = "default";
    }
    
    console.log('🔇 Stopped speaking animation and returned to idle');
}

// Update speaking animation
function updateSpeakingAnimation(deltaTime) {
    if (!isSpeaking) {
        return;
    }
    
    const hasVRM = currentVrm && currentVrm.expressionManager;
    const hasGLB = currentModel && Object.keys(morphTargets).length > 0;
    
    if (!hasVRM && !hasGLB) {
        return;
    }
    
    const currentTime = clock.getElapsedTime();
    
    // Handle blinking
    if (currentTime - lastBlinkTime >= blinkInterval) {
        if (hasVRM) {
            currentVrm.expressionManager.setValue('blink', 1.0);
            // Reset blink after a short time
            setTimeout(() => {
                if (currentVrm && currentVrm.expressionManager) {
                    currentVrm.expressionManager.setValue('blink', 0.0);
                }
            }, 150);
        } else if (hasGLB) {
            // Use morph targets for blinking
            lerpMorphTarget('eyeBlinkLeft', 1.0, 0.5);
            lerpMorphTarget('eyeBlinkRight', 1.0, 0.5);
            // Reset blink after a short time
            setTimeout(() => {
                lerpMorphTarget('eyeBlinkLeft', 0.0, 0.5);
                lerpMorphTarget('eyeBlinkRight', 0.0, 0.5);
            }, 150);
        }
        lastBlinkTime = currentTime;
    }
    
    // Handle realistic mouth movements using your visemes for speaking animation
    if (mouthState === 'closed' && currentTime - lastMouthChangeTime >= mouthCloseTime) {
        // Open mouth with varied visemes for natural talking
        if (hasVRM) {
            currentVrm.expressionManager.setValue('aa', 0.8);
            currentVrm.expressionManager.setValue('ee', 0.0);
        } else if (hasGLB) {
            // Reset all visemes first
            ['viseme_sil', 'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U', 'viseme_PP'].forEach(viseme => {
                lerpMorphTarget(viseme, 0.0, 0.1);
            });
            
            // MUCH MORE DRAMATIC speaking visemes for clear visibility
            const speakingVisemes = [
                { viseme: 'viseme_aa', strength: 1.0 },  // WIDE OPEN mouth
                { viseme: 'viseme_E', strength: 0.9 },   // Mid-open (dramatic)
                { viseme: 'viseme_O', strength: 1.0 },   // ROUND OPEN mouth
                { viseme: 'viseme_I', strength: 0.8 },   // Narrow but strong
                { viseme: 'viseme_DD', strength: 0.9 },  // Dental (strong)
                { viseme: 'viseme_PP', strength: 0.7 },  // Lip movement
            ];
            
            const randomViseme = speakingVisemes[Math.floor(Math.random() * speakingVisemes.length)];
            lerpMorphTarget(randomViseme.viseme, randomViseme.strength, 0.15);
            
            console.log(`👄 MOUTH WIDE OPEN: ${randomViseme.viseme} at ${randomViseme.strength} strength`);
        }
        mouthState = 'open';
        lastMouthChangeTime = currentTime;
    } else if (mouthState === 'open' && currentTime - lastMouthChangeTime >= mouthOpenTime) {
        // Close mouth - use silence viseme
        if (hasVRM) {
            currentVrm.expressionManager.setValue('aa', 0.0);
            currentVrm.expressionManager.setValue('ee', 0.3);
        } else if (hasGLB) {
            // Reset all speaking visemes more quickly for dramatic contrast
            ['viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U', 'viseme_DD', 'viseme_PP'].forEach(viseme => {
                lerpMorphTarget(viseme, 0.0, 0.15);
            });
            
            // Apply minimal silence for maximum contrast
            lerpMorphTarget('viseme_sil', 0.1, 0.15);
            
            console.log(`🤐 MOUTH CLOSED: viseme_sil at 0.1 strength`);
        }
        mouthState = 'closed';
        lastMouthChangeTime = currentTime;
    }
    
    // Handle lip sync if available
    if (currentLipsync && currentAudio && hasGLB) {
        handleLipSync();
    }
}

// Handle lip sync (similar to reference code)
function handleLipSync() {
    if (!currentAudio || !currentLipsync || !currentLipsync.mouthCues) {
        return;
    }
    
    const currentAudioTime = currentAudio.currentTime;
    const appliedMorphTargets = [];
    
    // Find the current mouth cue
    for (let i = 0; i < currentLipsync.mouthCues.length; i++) {
        const mouthCue = currentLipsync.mouthCues[i];
        if (currentAudioTime >= mouthCue.start && currentAudioTime <= mouthCue.end) {
            const visemeTarget = visemeMapping[mouthCue.value];
            if (visemeTarget) {
                appliedMorphTargets.push(visemeTarget);
                lerpMorphTarget(visemeTarget, 1.0, 0.2);
            }
            break;
        }
    }
    
    // Reset other viseme targets
    Object.values(visemeMapping).forEach((visemeTarget) => {
        if (!appliedMorphTargets.includes(visemeTarget)) {
            lerpMorphTarget(visemeTarget, 0.0, 0.1);
        }
    });
}

// Toggle speaking animation
function toggleSpeaking() {
    if (isSpeaking) {
        stopSpeaking();
    } else {
        startSpeaking();
    }
}

// Set lip sync data for talking animation
function setLipSync(lipsyncData, audioData) {
    currentLipsync = lipsyncData;
    if (audioData) {
        currentAudio = new Audio(audioData);
    }
    console.log('🎵 Lip sync data set:', currentLipsync ? 'available' : 'none');
}

// Apply facial expression while maintaining current mouth state during speaking
function applyFacialExpression(expressionName, maintainMouth = true) {
    if (!currentModel || !facialExpressions[expressionName]) {
        console.warn(`Expression "${expressionName}" not found or model not loaded`);
        return;
    }
    
    const expression = facialExpressions[expressionName];
    console.log(`🎭 Applying facial expression: ${expressionName}`);
    
    // Save current mouth state if we're speaking and want to maintain it
    let savedMouthTargets = {};
    if (maintainMouth && isSpeaking) {
        const mouthTargets = ['jawOpen', 'mouthOpen', 'mouthClose', 'viseme_AA', 'viseme_PP', 'viseme_kk', 'viseme_I', 'viseme_O', 'viseme_U', 'viseme_FF', 'viseme_TH'];
        mouthTargets.forEach(target => {
            currentModel.traverse((child) => {
                if (child.isSkinnedMesh && child.morphTargetDictionary && child.morphTargetDictionary[target] !== undefined) {
                    savedMouthTargets[target] = child.morphTargetInfluences[child.morphTargetDictionary[target]];
                }
            });
        });
    }
    
    // Apply the expression
    Object.keys(morphTargets).forEach(targetName => {
        const value = expression[targetName] || 0;
        lerpMorphTarget(targetName, value, 0.1);
    });
    
    // Restore mouth state if needed
    if (maintainMouth && isSpeaking) {
        Object.keys(savedMouthTargets).forEach(target => {
            lerpMorphTarget(target, savedMouthTargets[target], 0.2);
        });
    }
    
    currentFacialExpression = expressionName;
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
window.debugTalkingAnimation = debugTalkingAnimation;
window.resizeModel = resizeModel;
window.scaleModel = scaleModel;
window.centerModel = centerModel;
window.adjustCamera = adjustCamera;
window.setupModelForLookingGlass = setupModelForLookingGlass;

// Morph target functions
window.setFacialExpression = setFacialExpression;
window.setMorphTarget = setMorphTarget;
window.lerpMorphTarget = lerpMorphTarget;
window.resetAllMorphTargets = resetAllMorphTargets;
window.applyFacialExpression = applyFacialExpression;
window.setLipSync = setLipSync;

// Debug functions for morph targets
window.listMorphTargets = () => {
    console.log('Available morph targets:', Object.keys(morphTargets));
    console.log('Expression meshes:', expressionMeshes.length);
    console.log('Current model:', !!currentModel);
    return Object.keys(morphTargets);
};
window.listFacialExpressions = () => {
    console.log('Available facial expressions:', Object.keys(facialExpressions));
    return Object.keys(facialExpressions);
};
window.testMouthOpen = () => {
    console.log('🧪 Testing DRAMATIC mouth open with your visemes');
    // Test with MAXIMUM values for visibility
    lerpMorphTarget('viseme_aa', 1.0, 1.0);  // MAXIMUM mouth open
    lerpMorphTarget('viseme_O', 1.0, 1.0);   // MAXIMUM round mouth
    lerpMorphTarget('viseme_sil', 0.0, 1.0); // Zero silence
    setTimeout(() => {
        console.log('🧪 Resetting mouth to minimal silence');
        lerpMorphTarget('viseme_aa', 0.0, 1.0);
        lerpMorphTarget('viseme_O', 0.0, 1.0);
        lerpMorphTarget('viseme_sil', 0.1, 1.0); // Minimal silence for contrast
    }, 3000);  // Longer to see the dramatic effect
};
window.testBlink = () => {
    console.log('🧪 Testing blink');
    lerpMorphTarget('eyeBlinkLeft', 1.0, 1.0);
    lerpMorphTarget('eyeBlinkRight', 1.0, 1.0);
    setTimeout(() => {
        lerpMorphTarget('eyeBlinkLeft', 0.0, 1.0);
        lerpMorphTarget('eyeBlinkRight', 0.0, 1.0);
    }, 300);
};

// Comprehensive test for morph target facial expressions
window.testMorphTargetSystem = () => {
    console.log('🎭 Testing Morph Target Facial Expression System');
    
    if (!currentModel) {
        console.error('❌ No model loaded');
        return;
    }
    
    if (Object.keys(morphTargets).length === 0) {
        console.error('❌ No morph targets found');
        return;
    }
    
    console.log('✅ Model loaded:', !!currentModel);
    console.log('✅ Morph targets found:', Object.keys(morphTargets).length);
    console.log('📋 Available morph targets:', Object.keys(morphTargets));
    console.log('📋 Available expressions:', Object.keys(facialExpressions));
    
    // Test sequence
    let step = 0;
    const testSequence = [
        () => {
            console.log('🧪 Step 1: Testing mouth open');
            setFacialExpression('surprised');
        },
        () => {
            console.log('🧪 Step 2: Testing smile');
            setFacialExpression('smile');
        },
        () => {
            console.log('🧪 Step 3: Testing sad expression');
            setFacialExpression('sad');
        },
        () => {
            console.log('🧪 Step 4: Testing angry expression');
            setFacialExpression('angry');
        },
        () => {
            console.log('🧪 Step 5: Testing talking animation');
            playAnimationSmooth('talking');
        },
        () => {
            console.log('🧪 Step 6: Resetting to default');
            setFacialExpression('default');
            playAnimationSmooth('idle');
            console.log('✅ Morph target system test complete!');
        }
    ];
    
    function runNextTest() {
        if (step < testSequence.length) {
            testSequence[step]();
            step++;
            setTimeout(runNextTest, 2000);
        }
    }
    
    runNextTest();
};

// Test all your visemes one by one
window.testAllVisemes = () => {
    console.log('🧪 Testing all your visemes...');
    
    const visemes = [
        'viseme_sil', 'viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD', 
        'viseme_kk', 'viseme_CH', 'viseme_SS', 'viseme_nn', 'viseme_RR', 
        'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U'
    ];
    
    let currentIndex = 0;
    
    function testNextViseme() {
        if (currentIndex < visemes.length) {
            const viseme = visemes[currentIndex];
            console.log(`🎭 Testing ${viseme}...`);
            
            // Reset all visemes first
            visemes.forEach(v => lerpMorphTarget(v, 0.0, 0.5));
            
            // Apply current viseme with MAXIMUM intensity
            lerpMorphTarget(viseme, 1.0, 0.5);
            
            currentIndex++;
            setTimeout(testNextViseme, 1500); // 1.5 seconds per viseme
        } else {
            console.log('✅ All visemes tested! Resetting to silence...');
            visemes.forEach(v => lerpMorphTarget(v, 0.0, 0.5));
            lerpMorphTarget('viseme_sil', 0.3, 0.5);
        }
    }
    
    testNextViseme();
};

// Test dramatic mouth opening for speaking
window.testDramaticSpeaking = () => {
    console.log('🎭 Testing DRAMATIC speaking animation...');
    
    let cycle = 0;
    const maxCycles = 5;
    
    function dramaticCycle() {
        if (cycle >= maxCycles) {
            console.log('✅ Dramatic speaking test complete');
            // Reset to neutral
            ['viseme_aa', 'viseme_E', 'viseme_O', 'viseme_I'].forEach(v => lerpMorphTarget(v, 0.0, 0.5));
            lerpMorphTarget('viseme_sil', 0.1, 0.5);
            return;
        }
        
        // WIDE OPEN phase
        console.log(`🗣️ Cycle ${cycle + 1}: MOUTH WIDE OPEN`);
        lerpMorphTarget('viseme_sil', 0.0, 0.1);
        lerpMorphTarget('viseme_aa', 1.0, 0.2);  // Maximum open
        
        setTimeout(() => {
            // CLOSED phase
            console.log(`🤐 Cycle ${cycle + 1}: MOUTH CLOSED`);
            lerpMorphTarget('viseme_aa', 0.0, 0.2);
            lerpMorphTarget('viseme_sil', 0.1, 0.2);
            cycle++;
            setTimeout(dramaticCycle, 500);
        }, 800);
    }
    
    dramaticCycle();
};

// Debug function to check mouth movement issues
window.debugMouthMovement = () => {
    console.log('🔍 Debugging Mouth Movement...');
    
    // Check model type
    const hasVRM = currentVrm && currentVrm.expressionManager;
    const hasGLB = currentModel && Object.keys(morphTargets).length > 0;
    
    console.log('Model Type Check:');
    console.log('- Has VRM:', hasVRM);
    console.log('- Has GLB with morph targets:', hasGLB);
    console.log('- Current model exists:', !!currentModel);
    console.log('- Morph targets found:', Object.keys(morphTargets).length);
    console.log('- Current VRM:', !!currentVrm);
    
    // Check speaking state
    console.log('Speaking State:');
    console.log('- Is speaking:', isSpeaking);
    console.log('- Mouth state:', mouthState);
    console.log('- Animation playing:', currentAction ? currentAction.isRunning() : 'No current action');
    console.log('- Speaking start time:', speakingStartTime);
    console.log('- Last mouth change time:', lastMouthChangeTime);
    console.log('- Current time:', clock.getElapsedTime());
    
    // Force start speaking for testing
    console.log('🎤 Force starting speaking animation...');
    console.log('Calling playAnimationSmooth("talking")...');
    playAnimationSmooth('talking');
    
    setTimeout(() => {
        console.log('Status after 1 second:');
        console.log('- Is speaking:', isSpeaking);
        console.log('- Mouth state:', mouthState);
        console.log('- Animation action:', currentAction ? currentAction.getClip().name : 'No action');
        console.log('- Animation running:', currentAction ? currentAction.isRunning() : 'No action');
    }, 1000);
    
    setTimeout(() => {
        console.log('Status after 3 seconds:');
        console.log('- Is speaking:', isSpeaking);
        console.log('- Mouth state:', mouthState);
        console.log('- Has changed mouth:', lastMouthChangeTime > speakingStartTime);
    }, 3000);
};

// Simple function to force mouth open for testing
window.forceMouthOpen = () => {
    console.log('🧪 Force opening mouth...');
    if (!currentModel) {
        console.warn('❌ No model loaded');
        return;
    }
    
    // Try multiple possible mouth morph targets
    const possibleMouthTargets = [
        'jawOpen', 'mouthOpen', 'viseme_AA', 'viseme_A', 'mouth_A', 
        'A', 'aa', 'Aa', 'mouth_open', 'MouthOpen', 'Jaw_Open'
    ];
    
    console.log('🔍 Searching for mouth morph targets...');
    let foundTargets = [];
    
    currentModel.traverse((child) => {
        if (child.isSkinnedMesh && child.morphTargetDictionary) {
            const availableTargets = Object.keys(child.morphTargetDictionary);
            console.log(`Mesh "${child.name}" has targets:`, availableTargets);
            
            possibleMouthTargets.forEach(target => {
                if (child.morphTargetDictionary[target] !== undefined) {
                    console.log(`✅ Found ${target} in mesh ${child.name}`);
                    const index = child.morphTargetDictionary[target];
                    child.morphTargetInfluences[index] = 0.8;
                    foundTargets.push(target);
                }
            });
        }
    });
    
    if (foundTargets.length === 0) {
        console.warn('❌ No mouth morph targets found. Available targets:');
        listMorphTargets();
    } else {
        console.log(`✅ Applied mouth opening to: ${foundTargets.join(', ')}`);
        
        // Reset after 3 seconds
        setTimeout(() => {
            console.log('🔄 Resetting mouth...');
            foundTargets.forEach(target => {
                setMorphTarget(target, 0.0);
            });
        }, 3000);
    }
};

// Quick fix to make model visible
window.fixModelPosition = () => {
    if (!currentModel) {
        console.warn('❌ No model loaded');
        return;
    }
    
    console.log('🔧 Fixing model position...');
    
    // Reset model transformations
    currentModel.scale.set(1, 1, 1);
    currentModel.rotation.set(0, 0, 0);
    currentModel.position.set(0, 0, 0);
    
    // Get model bounds
    const box = new THREE.Box3().setFromObject(currentModel);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    // Position model to show full body (legs visible)
    currentModel.position.set(-center.x, -center.y - size.y * 0.3, -center.z);
    
    // Scale down if too big
    const maxDimension = Math.max(size.x, size.y, size.z);
    if (maxDimension > 2) {
        const scaleFactor = 2 / maxDimension;
        currentModel.scale.multiplyScalar(scaleFactor);
        console.log(`📏 Scaled model by ${scaleFactor.toFixed(2)}`);
    }
    
    console.log('✅ Model fixed at position:', currentModel.position);
    console.log('📐 Model scale:', currentModel.scale);
};

// Function to adjust model position to show full body
function showFullBody() {
    if (!currentModel) {
        console.warn('❌ No model loaded');
        return;
    }
    
    console.log('👥 Adjusting to show full body...');
    
    const box = new THREE.Box3().setFromObject(currentModel);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    // Move model down to show legs, up to show head
    currentModel.position.x = -center.x;
    currentModel.position.y = -center.y - size.y * 0.3; // Adjust this value to show more/less of the body
    currentModel.position.z = -center.z;
    
    console.log('✅ Full body positioning:', {
        position: currentModel.position,
        modelSize: size,
        adjustment: 'Moved down by 30% of model height'
    });
}

// Also expose on window object for console access
window.showFullBody = showFullBody;

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

// Debug talking animation specifically
function debugTalkingAnimation() {
    console.log('🔍 Debugging talking animation...');
    
    // Check if talking animation is in cache
    console.log('💾 Animation cache:', Object.keys(animationCache));
    console.log('🎭 Talking animation cached:', !!animationCache.talking);
    
    if (animationCache.talking) {
        const talkingAction = animationCache.talking;
        console.log('📊 Talking animation details:', {
            clip: talkingAction._clip.name,
            duration: talkingAction._clip.duration,
            tracks: talkingAction._clip.tracks.length,
            enabled: talkingAction.enabled,
            weight: talkingAction.weight,
            time: talkingAction.time,
            isRunning: talkingAction.isRunning(),
            loop: talkingAction.loop
        });
        
        console.log('🦴 First 10 animation tracks target these bones:');
        talkingAction._clip.tracks.slice(0, 10).forEach(track => {
            const boneName = track.name.split('.')[0];
            console.log(`  - ${boneName}`);
        });
        
    } else {
        console.error('❌ Talking animation not found in cache');
    }
    
    // Try to force play talking animation
    console.log('🎬 Forcing talking animation play...');
    try {
        playAnimationSmooth('talking');
    } catch (error) {
        console.error('❌ Error playing talking animation:', error);
    }
    
    return {
        cached: !!animationCache.talking,
        details: animationCache.talking ? {
            name: animationCache.talking._clip.name,
            duration: animationCache.talking._clip.duration,
            tracks: animationCache.talking._clip.tracks.length
        } : null
    };
}

// Resize model function
function resizeModel(scale) {
    if (!currentModel) {
        console.warn('❌ No model loaded to resize');
        return;
    }
    
    if (typeof scale === 'number') {
        currentModel.scale.setScalar(scale);
        console.log(`📏 Model resized to ${scale * 100}%. New scale:`, currentModel.scale);
    }
    
    return currentModel.scale;
}

// Scale model by factor
function scaleModel(factor) {
    if (!currentModel) {
        console.warn('❌ No model loaded to scale');
        return;
    }
    
    currentModel.scale.multiplyScalar(factor);
    console.log(`📏 Model scaled by ${factor}x. New scale:`, currentModel.scale);
    
    return currentModel.scale;
}

// Center model function  
function centerModel() {
    if (!currentModel) {
        console.warn('❌ No model to center');
        return;
    }
    
    const box = new THREE.Box3().setFromObject(currentModel);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    // Position model to show full body from head to feet
    currentModel.position.x = -center.x;
    currentModel.position.y = -center.y - size.y * 0.2; // Move down to show legs
    currentModel.position.z = -center.z;
    
    console.log('✅ Model centered. Size:', size, 'Position:', currentModel.position);
    return { center, size };
}

// Adjust camera to fit model
function adjustCamera() {
    if (!currentModel) {
        console.warn('❌ No model to adjust camera for');
        return;
    }
    
    const box = new THREE.Box3().setFromObject(currentModel);
    const size = box.getSize(new THREE.Vector3());
    const maxSize = Math.max(size.x, size.y, size.z);
    
    // Position camera to see the whole model centered
    const distance = maxSize * 2.5;
    camera.position.set(0, 0, distance);
    camera.lookAt(0, 0, 0);
    
    console.log('✅ Camera adjusted. Distance:', distance, 'Looking at center: (0,0,0)');
}

// Setup model for optimal Looking Glass compatibility
function setupModelForLookingGlass() {
    if (!currentModel) {
        console.warn('❌ No model to setup for Looking Glass');
        return;
    }
    
    console.log('🔮 Setting up model for Looking Glass compatibility...');
    
    // 1. Resize to 80%
    //resizeModel(0.5);
    
    // 2. Position model at origin for Looking Glass
    // Looking Glass works best when the model is centered at (0,0,0)
    const box = new THREE.Box3().setFromObject(currentModel);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    // Position model to show full body (move down to show legs)  
    currentModel.position.set(-center.x, -center.y - size.y * 0.3, -center.z);
    
    // 3. Ensure model faces forward (Looking Glass expects Z-forward)
    // Don't rotate GLB models as they should already face the right direction
    // VRM models are already rotated 180° in the loading code if needed
    
    // 4. Ensure model is within Looking Glass optimal viewing volume
    // Looking Glass config: targetDiam = 3, so model should fit within this
    const maxDimension = Math.max(size.x, size.y, size.z);
    if (maxDimension > 2.5) {
        const scaleFactor = 2.5 / maxDimension;
        currentModel.scale.multiplyScalar(scaleFactor);
        console.log(`📏 Model scaled down by ${scaleFactor} for Looking Glass viewing volume`);
    }
    
    // 5. Remove any existing transformations that might interfere
    currentModel.updateMatrixWorld(true);
    
    console.log('✅ Model setup complete for Looking Glass:', {
        position: currentModel.position,
        rotation: currentModel.rotation,
        scale: currentModel.scale,
        boundingBoxSize: size
    });
    
    return {
        position: currentModel.position.clone(),
        rotation: currentModel.rotation.clone(),
        scale: currentModel.scale.clone(),
        boundingBoxSize: size
    };
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
  '/static/assets/6891a06aece5d61d2d726697.glb',
  async function (gltf) {
    console.log('✅ Model loaded successfully:', gltf);
    
    // Check if this is a VRM or regular GLB model
    const isVRM = !!(gltf.userData && gltf.userData.vrm);
    
    if (isVRM) {
      // VRM Model
      currentVrm = gltf.userData.vrm;
      currentModel = currentVrm.scene;
      console.log('🎭 VRM model detected');
    
    // Debug VRM object structure
    console.log('🔍 VRM object structure:', {
      hasVrm: !!currentVrm,
      vrmKeys: currentVrm ? Object.keys(currentVrm) : [],
      hasExpressionManager: currentVrm ? !!currentVrm.expressionManager : false,
      expressionManagerType: currentVrm && currentVrm.expressionManager ? typeof currentVrm.expressionManager : 'undefined'
    });
    } else {
      // Regular GLB Model
      currentModel = gltf.scene;
      currentVrm = null; // Clear VRM reference
      console.log('🎯 GLB model detected');
      
      // Find morph targets for GLB facial expressions
      findMorphTargets();
      console.log('🎭 Found morph targets:', Object.keys(morphTargets));
    }
    
    scene.add(currentModel);
    resizeModel(0.8);
    showFullBody();
    // Only rotate VRM models (they typically face backwards)
    if (isVRM) {
      currentModel.rotation.y = Math.PI;
    }
    
    console.log(`✅ ${isVRM ? 'VRM' : 'GLB'} model added to scene`);
    
    // Log available expressions if expression manager exists (VRM only)
    if (isVRM && currentVrm && currentVrm.expressionManager) {
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
    } else if (isVRM) {
      console.log('⚠️ No expression manager found in VRM');
      console.log('🔍 Checking if expression manager is in userData:', gltf.userData);
    } else {
      console.log('🎯 GLB model loaded - using morph targets for expressions');
    }
    
    // Initialize animation system after model loads
    await initializeAnimationSystem(isVRM ? currentVrm : currentModel, isVRM);
    
    // Auto-position model to show full body by default
    setTimeout(() => {
      showFullBody();
    }, 100);
    
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