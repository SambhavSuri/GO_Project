import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { useAudioContext } from '../../logic/AudioProvider';
import { 
  ALL_READY_PLAYER_ME_VISEMES,
  getVisemeIntensity,
  getVisemeIntensityByName,
  getVisemeTransitionSpeed,
  convertAzureVisemeToReadyPlayerMe,
  logVisemeMapping 
} from '../../lib/visemeMapper';
import LipSyncDebugger from '../../lib/lipSyncDebugger';

interface VRMAvatarProps {
  modelUrl?: string;
  width?: number;
  height?: number;
  onVisemeMirror?: (viseme: any) => void;
}

export const VRMAvatar: React.FC<VRMAvatarProps> = ({ 
  modelUrl = '/static/assets/6891a06aece5d61d2d726697.glb',
  width = 800,
  height = 600,
  onVisemeMirror
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const vrmRef = useRef<VRM | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  const controlsRef = useRef<OrbitControls | null>(null);
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelType, setModelType] = useState<'vrm' | 'glb'>('glb');
  
  // Get audio context for syncing with speech
  const { isAvatarTalking, isProcessingResponse, onGLBAudioStart, onViseme } = useAudioContext();
  
  // Speaking animation state for GLB models
  const speakingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mouthStateRef = useRef<'open' | 'closed'>('closed');
  const lastMouthChangeTimeRef = useRef<number>(0);
  
  // Animation clips refs
  const idleClipRef = useRef<THREE.AnimationClip | null>(null);
  const talkingClipRef = useRef<THREE.AnimationClip | null>(null);
  const thinkingClipRef = useRef<THREE.AnimationClip | null>(null);

  // Track previous viseme for smoother transitions
  const previousVisemeRef = useRef<string>("viseme_sil");
  const activeVisemesRef = useRef<Map<string, number>>(new Map());
  
  // Lip sync debugger
  const debuggerRef = useRef<LipSyncDebugger | null>(null);

  // 🎯 ENHANCED: Direct viseme application with professional smooth factors
  const handleDirectViseme = useCallback((visemeId: number, offset: number) => {
    if (modelType !== 'glb' || !modelRef.current) return;
    
    // 🗺️ STEP 1: Azure ID → Ready Player Me enhanced viseme data
    const visemeData = { visemeId, offset, duration: 100 };
    const readyPlayerMeViseme = convertAzureVisemeToReadyPlayerMe(visemeData, previousVisemeRef.current);
    
    console.log(`🎯 Enhanced: Azure ${visemeId} → ${readyPlayerMeViseme.visemeName} (intensity: ${readyPlayerMeViseme.intensity}, smooth: ${readyPlayerMeViseme.smoothFactor})`);
    
    // Mirror to Looking Glass if callback provided  
    if (onVisemeMirror) {
      onVisemeMirror({ visemeId, offset });
    }
    
    // 🚀 STEP 2: Smart conflict resolution - reset only conflicting mouth shapes
    const conflictingVisemes = getConflictingVisemes(readyPlayerMeViseme.visemeName);
    conflictingVisemes.forEach(conflictViseme => {
      if (conflictViseme !== readyPlayerMeViseme.visemeName) {
        setMorphTargetSmooth(conflictViseme, 0.0, readyPlayerMeViseme.smoothFactor);
        activeVisemesRef.current.delete(conflictViseme);
      }
    });
    
    // 💥 STEP 3: Apply viseme with enhanced smooth transitions!
    setMorphTargetSmooth(readyPlayerMeViseme.visemeName, readyPlayerMeViseme.intensity, readyPlayerMeViseme.smoothFactor);
    activeVisemesRef.current.set(readyPlayerMeViseme.visemeName, readyPlayerMeViseme.intensity);
    
    // Update previous viseme for smooth transitions
    previousVisemeRef.current = readyPlayerMeViseme.visemeName;
  }, [modelType, onVisemeMirror]);

  // OPTIMIZED: Direct morph target assignment for real-time visemes (no lerping delays)
  const setMorphTargetDirect = (targetName: string, value: number) => {
    if (!modelRef.current || modelType !== 'glb') {
      return;
    }
    
    modelRef.current.traverse((child) => {
      if ((child as any).isSkinnedMesh && (child as any).morphTargetDictionary) {
        const skinnedMesh = child as THREE.SkinnedMesh;
        const index = skinnedMesh.morphTargetDictionary[targetName];
        
        if (index !== undefined && skinnedMesh.morphTargetInfluences) {
          const oldValue = skinnedMesh.morphTargetInfluences[index];
          skinnedMesh.morphTargetInfluences[index] = value; // Direct assignment for real-time
          
          // Debug significant changes
          if (Math.abs(value - oldValue) > 0.1) {
            console.log(`[VRMAvatar] 👄 Direct Applied '${targetName}': ${oldValue.toFixed(2)} → ${value.toFixed(2)}`);
          }
        }
      }
    });
  };

  // 🎯 ENHANCED: Smooth morph target transitions with professional smoothFactor
  const setMorphTargetSmooth = (targetName: string, targetValue: number, smoothFactor: number) => {
    if (!modelRef.current || modelType !== 'glb') {
      return;
    }
    
    modelRef.current.traverse((child) => {
      if ((child as any).isSkinnedMesh && (child as any).morphTargetDictionary) {
        const skinnedMesh = child as THREE.SkinnedMesh;
        const index = skinnedMesh.morphTargetDictionary[targetName];
        
        if (index !== undefined && skinnedMesh.morphTargetInfluences) {
          const currentValue = skinnedMesh.morphTargetInfluences[index];
          
          // 🚀 ENHANCED: Use professional smoothFactor for natural transitions
          const newValue = currentValue + (targetValue - currentValue) * smoothFactor;
          skinnedMesh.morphTargetInfluences[index] = newValue;
          
          // Debug significant changes
          if (Math.abs(newValue - currentValue) > 0.05) {
            console.log(`[VRMAvatar] 🎯 Smooth Applied '${targetName}': ${currentValue.toFixed(2)} → ${newValue.toFixed(2)} (smooth: ${smoothFactor})`);
          }
        }
      }
    });
  };

  // OPTIMIZED: Get conflicting visemes to avoid mouth shape conflicts
  const getConflictingVisemes = (visemeName: string): string[] => {
    // Define mouth shape groups that conflict with each other
    const mouthGroups = {
      vowels: ['viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U'],
      consonants: ['viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD', 'viseme_kk', 'viseme_CH', 'viseme_SS', 'viseme_nn', 'viseme_RR'],
      neutral: ['viseme_sil']
    };
    
    // Find which group the current viseme belongs to
    for (const [groupName, group] of Object.entries(mouthGroups)) {
      if (group.includes(visemeName)) {
        return group; // Return all visemes in the same group as conflicting
      }
    }
    
    // If not found in any group, only conflict with self
    return [visemeName];
  };

  // Lerp morph target to a specific value with enhanced debugging (for non-real-time usage)
  const lerpMorphTarget = (targetName: string, value: number, speed: number = 0.1) => {
    if (!modelRef.current || modelType !== 'glb') {
      console.warn('[VRMAvatar] lerpMorphTarget: No model or not GLB format');
      return;
    }
    
    let found = false;
    modelRef.current.traverse((child) => {
      if ((child as any).isSkinnedMesh && (child as any).morphTargetDictionary) {
        const skinnedMesh = child as THREE.SkinnedMesh;
        const index = skinnedMesh.morphTargetDictionary[targetName];
        
        if (index === undefined) {
          // Don't spam logs, but log missing morph targets occasionally
          if (Math.random() < 0.1) { // 10% chance to log
            console.warn(`[VRMAvatar] Morph target '${targetName}' not found. Available targets:`, Object.keys(skinnedMesh.morphTargetDictionary));
          }
          return;
        }
        
        if (!skinnedMesh.morphTargetInfluences || skinnedMesh.morphTargetInfluences[index] === undefined) {
          console.warn(`[VRMAvatar] Morph target influences not available for '${targetName}'`);
          return;
        }
        
        // Smoothly interpolate to the target value
        const oldValue = skinnedMesh.morphTargetInfluences[index];
        skinnedMesh.morphTargetInfluences[index] = THREE.MathUtils.lerp(oldValue, value, speed);
        
        // Debug significant changes
        if (Math.abs(value - oldValue) > 0.1) {
          console.log(`[VRMAvatar] 👄 Applied '${targetName}': ${oldValue.toFixed(2)} → ${value.toFixed(2)} (speed: ${speed})`);
        }
        
        found = true;
      }
    });
    
    if (!found && Math.random() < 0.05) { // 5% chance to log when not found
      console.warn(`[VRMAvatar] No skinned mesh with morph targets found for '${targetName}'`);
    }
  };

  // Speaking animation for GLB models
  const updateSpeakingAnimation = () => {
    if (modelType !== 'glb' || !modelRef.current) return;
    
    const currentTime = Date.now();
    const mouthOpenTime = 150 + Math.random() * 250; // 150-400ms - longer for more visible movement
    const mouthCloseTime = 80 + Math.random() * 120; // 80-200ms - longer pause for better contrast
    
    // Handle realistic mouth movements using Ready Player Me visemes for speaking animation
    if (mouthStateRef.current === 'closed' && currentTime - lastMouthChangeTimeRef.current >= mouthCloseTime) {
      // Reset all Ready Player Me visemes first
      ALL_READY_PLAYER_ME_VISEMES.forEach(viseme => {
        lerpMorphTarget(viseme, 0.0, 0.1);
      });
      
      // REALISTIC LIP MOVEMENT with proper mouth gap using Ready Player Me visemes
      const lipMovementVisemes = [
        { viseme: 'viseme_aa', strength: getVisemeIntensityByName('viseme_aa'), desc: 'Wide lip separation' },
        { viseme: 'viseme_E', strength: getVisemeIntensityByName('viseme_E'), desc: 'Mid lip position' },
        { viseme: 'viseme_O', strength: getVisemeIntensityByName('viseme_O'), desc: 'Round lip pucker' },
        { viseme: 'viseme_I', strength: getVisemeIntensityByName('viseme_I'), desc: 'Narrow lip spread' },
        { viseme: 'viseme_U', strength: getVisemeIntensityByName('viseme_U'), desc: 'Lip forward projection' },
        { viseme: 'viseme_PP', strength: getVisemeIntensityByName('viseme_PP'), desc: 'Lip closure/release' },
      ];
      
      const randomLipMovement = lipMovementVisemes[Math.floor(Math.random() * lipMovementVisemes.length)];
      const transitionSpeed = getVisemeTransitionSpeed(previousVisemeRef.current, randomLipMovement.viseme);
      
      // Apply the chosen lip movement with scientifically calculated intensity
      lerpMorphTarget(randomLipMovement.viseme, randomLipMovement.strength, transitionSpeed);
      previousVisemeRef.current = randomLipMovement.viseme;
      
      //console.log(`👄 LIP MOVEMENT: ${randomLipMovement.viseme} (${randomLipMovement.desc}) at ${randomLipMovement.strength} strength`);
      
      mouthStateRef.current = 'open';
      lastMouthChangeTimeRef.current = currentTime;
    } else if (mouthStateRef.current === 'open' && currentTime - lastMouthChangeTimeRef.current >= mouthOpenTime) {
      // Close mouth - use silence viseme
      // Reset all speaking visemes for natural lip closure
      ALL_READY_PLAYER_ME_VISEMES.forEach(viseme => {
        if (viseme !== 'viseme_sil') {
          lerpMorphTarget(viseme, 0.0, 0.2);
        }
      });
      
      // Apply natural lip closure with Ready Player Me silence viseme
      const silenceIntensity = getVisemeIntensityByName('viseme_sil');
      const transitionSpeed = getVisemeTransitionSpeed(previousVisemeRef.current, 'viseme_sil');
      lerpMorphTarget('viseme_sil', silenceIntensity, transitionSpeed);
      previousVisemeRef.current = 'viseme_sil';
      
      //console.log(`🤐 LIPS CLOSED: Natural lip position with Ready Player Me silence viseme`);
      
      mouthStateRef.current = 'closed';
      lastMouthChangeTimeRef.current = currentTime;
    }
  };

  // Start speaking animation for GLB models
  const startSpeakingAnimation = () => {
    if (modelType !== 'glb' || speakingIntervalRef.current) return;
    
    console.log('🎤 Starting GLB speaking animation with Ready Player Me visemes (triggered by audio playback)');
    
    // Reset mouth state and previous viseme tracking
    mouthStateRef.current = 'closed';
    lastMouthChangeTimeRef.current = Date.now();
    previousVisemeRef.current = 'viseme_sil';
    
    // Start speaking animation loop
    speakingIntervalRef.current = setInterval(updateSpeakingAnimation, 50); // 20 FPS
  };

  // Stop speaking animation for GLB models
  const stopSpeakingAnimation = () => {
    if (speakingIntervalRef.current) {
      clearInterval(speakingIntervalRef.current);
      speakingIntervalRef.current = null;
      console.log('🤐 Stopped GLB speaking animation');
    }
    
    // Completely seal lips for idle state
    sealLipsForIdle();
  };

  // Seal lips completely for idle animation using Ready Player Me visemes
  const sealLipsForIdle = () => {
    if (modelType === 'glb' && modelRef.current) {
      // OPTIMIZED: Use direct assignment for instant mouth closure
      activeVisemesRef.current.forEach((value, visemeName) => {
        setMorphTargetDirect(visemeName, 0.0);
      });
      activeVisemesRef.current.clear();
      
      // Also reset any remaining visemes that might not be tracked
      ALL_READY_PLAYER_ME_VISEMES.forEach(viseme => {
        setMorphTargetDirect(viseme, 0.0);
      });
      
      previousVisemeRef.current = 'viseme_sil';
      console.log('🔒 Lips completely sealed for idle state - all Ready Player Me visemes reset to 0');
    }
  };

  // Store eye objects and their original transforms to preserve them
  const eyeObjectsRef = useRef<Map<string, { 
    object: THREE.Object3D, 
    originalPosition: THREE.Vector3,
    originalRotation: THREE.Euler,
    originalScale: THREE.Vector3
  }>>(new Map());

  // Function to fix material issues for proper rendering
  const fixModelMaterials = (model: THREE.Object3D) => {
    console.log('🎨 Fixing materials for proper rendering...');
    
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Ensure mesh casts and receives shadows
        child.castShadow = true;
        child.receiveShadow = true;
        
        // Check if this is an eye-related mesh and store its original transform
        const meshName = child.name.toLowerCase();
        const isEyeMesh = meshName.includes('eye') || meshName.includes('pupil') || meshName.includes('iris') || 
                         meshName.includes('cornea') || meshName.includes('eyeball');
        
        if (isEyeMesh) {
          console.log(`👁️ Found eye mesh: ${child.name}, preserving original transform`);
          eyeObjectsRef.current.set(child.uuid, {
            object: child,
            originalPosition: child.position.clone(),
            originalRotation: child.rotation.clone(),
            originalScale: child.scale.clone()
          });
          
          // Make eye objects immune to animation transforms
          child.matrixAutoUpdate = false;
          child.updateMatrix();
          
          // Also preserve the parent hierarchy to prevent inherited transforms
          if (child.parent) {
            console.log(`👁️ Eye object ${child.name} has parent: ${child.parent.name}`);
          }
        }
        
        // Fix material properties
        if (child.material) {
          const material = Array.isArray(child.material) ? child.material[0] : child.material;
          
          if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial) {
            // Ensure materials are properly lit
            material.needsUpdate = true;
            
            // Fix common rendering issues
            material.side = THREE.FrontSide; // Ensure proper face culling
            material.transparent = material.opacity < 1.0;
            
            // Improve material properties for better visibility
            if (material.roughness !== undefined) {
              material.roughness = Math.min(material.roughness, 0.8); // Prevent overly rough surfaces
            }
            
            if (material.metalness !== undefined) {
              material.metalness = Math.max(material.metalness, 0.1); // Add slight metallness for better lighting
            }
            
            // Special handling for eye materials (common naming patterns)
            if (isEyeMesh) {
              console.log(`👁️ Applying special eye material properties to: ${child.name}`);
              material.roughness = 0.1; // Make eyes more reflective
              material.metalness = 0.0;
              material.transparent = false; // Ensure eyes are not transparent
              material.opacity = 1.0;
              material.alphaTest = 0.0;
              material.depthWrite = true;
              material.depthTest = true;
              
              if (material.emissive) {
                material.emissive.setHex(0x222222); // Slight emissive glow for eyes
              }
              
              // Force material update
              material.needsUpdate = true;
            }
          }
        }
        
        // Ensure geometry is properly computed
        if (child.geometry) {
          child.geometry.computeBoundingBox();
          child.geometry.computeBoundingSphere();
          if (!child.geometry.attributes.normal) {
            child.geometry.computeVertexNormals();
          }
        }
      }
    });
    
    console.log('✅ Material fixes applied, eye objects preserved');
  };

  // Load animations for GLB models
  const loadAnimationsForGLB = async () => {
    const loader = new GLTFLoader();
    
    try {
      // Load idle animation
      const idleGltf = await loader.loadAsync('/static/animations/idleMale.glb');
      if (idleGltf.animations.length > 0) {
        idleClipRef.current = idleGltf.animations[0];
        idleClipRef.current.name = 'idle';
      }
      
      // Load talking animation
      const talkingGltf = await loader.loadAsync('/static/animations/Talking.glb');
      if (talkingGltf.animations.length > 0) {
        talkingClipRef.current = talkingGltf.animations[0];
        talkingClipRef.current.name = 'talking';
      }
      
      // Load waving animation as alternative
      const wavingGltf = await loader.loadAsync('/static/animations/waving.glb');
      if (wavingGltf.animations.length > 0 && !talkingClipRef.current) {
        talkingClipRef.current = wavingGltf.animations[0];
        talkingClipRef.current.name = 'talking';
      }
      
      // Use idle as thinking for now
      thinkingClipRef.current = idleClipRef.current;
      
      console.log('✅ Animations loaded for GLB model');
    } catch (error) {
      console.warn('⚠️ Some animations failed to load:', error);
    }
  };

  // Retarget animation to model bones
  const retargetAnimation = (clip: THREE.AnimationClip, model: THREE.Object3D): THREE.AnimationClip => {
    const tracks: THREE.KeyframeTrack[] = [];
    
    // Eye-related bone names to exclude from animation retargeting
    const eyeExcludedBones = [
      'eye', 'eyes', 'eyeball', 'eyeballs', 'pupil', 'iris', 'cornea',
      'lefteye', 'righteye', 'eyel', 'eyer', 'eye_l', 'eye_r',
      'left_eye', 'right_eye', 'eyebone', 'eyeroot'
    ];
    
    clip.tracks.forEach((track) => {
      // Get the bone name from the track
      const parts = track.name.split('.');
      const boneName = parts[0].toLowerCase();
      const property = parts.slice(1).join('.');
      
      // Skip eye-related bones to prevent eye disappearing
      const isEyeBone = eyeExcludedBones.some(excludedBone => 
        boneName.includes(excludedBone) || excludedBone.includes(boneName)
      );
      
      if (isEyeBone) {
        console.log(`🚫 Excluding eye bone from animation: ${parts[0]}`);
        return; // Skip this track
      }
      
      // Try to find corresponding bone in the model
      let targetBone: THREE.Object3D | undefined;
      model.traverse((child) => {
        const childNameLower = child.name.toLowerCase();
        
        // Skip if this is an eye-related object
        const isEyeObject = eyeExcludedBones.some(excludedBone => 
          childNameLower.includes(excludedBone)
        );
        
        if (isEyeObject) {
          return; // Skip eye objects
        }
        
        if (child.name === parts[0] || 
            childNameLower.includes(boneName) ||
            boneName.includes(childNameLower)) {
          targetBone = child;
        }
      });
      
      if (targetBone) {
        // Create new track with the correct target
        const newTrack = track.clone();
        newTrack.name = `${targetBone.name}.${property}`;
        tracks.push(newTrack);
        console.log(`✅ Retargeted animation track: ${parts[0]} -> ${targetBone.name}`);
      }
    });
    
    console.log(`🎬 Retargeted animation with ${tracks.length} tracks (eye bones excluded)`);
    return new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode);
  };

  // Play animation
  const playAnimation = (clipName: 'idle' | 'talking' | 'thinking') => {
    if (!mixerRef.current || !modelRef.current) return;
    
    let clip: THREE.AnimationClip | null = null;
    
    switch (clipName) {
      case 'idle':
        clip = idleClipRef.current;
        break;
      case 'talking':
        clip = talkingClipRef.current;
        break;
      case 'thinking':
        clip = thinkingClipRef.current;
        break;
    }
    
    if (!clip) {
      console.warn(`Animation clip "${clipName}" not available`);
      return;
    }
    
    // Stop current animation with fade
    if (currentActionRef.current) {
      currentActionRef.current.fadeOut(0.5);
    }
    
    // Retarget animation for GLB models
    const targetClip = modelType === 'glb' ? retargetAnimation(clip, modelRef.current) : clip;
    
    // Play new animation
    const action = mixerRef.current.clipAction(targetClip);
    action.reset();
    action.fadeIn(0.5);
    action.play();
    currentActionRef.current = action;
    
    const syncStatus = modelType === 'glb' && clipName === 'talking' ? ' (synchronized with audio)' : '';
    console.log(`🎬 Playing animation: ${clipName}${syncStatus}`);
  };

  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current) return;
    
    // Detect model type from URL
    const isVRM = modelUrl.endsWith('.vrm');
    setModelType(isVRM ? 'vrm' : 'glb');
    
    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    sceneRef.current = scene;
    
    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      30,
      width / height,
      0.1,
      20
    );
    camera.position.set(0, 1.4, 3);
    cameraRef.current = camera;
    
    // Enhanced Renderer setup for better model visibility
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Enhanced rendering settings for better materials
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    
    rendererRef.current = renderer;
    
    mountRef.current.appendChild(renderer.domElement);
    
    // Controls setup
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 1;
    controls.maxDistance = 10;
    controls.maxPolarAngle = Math.PI / 2;
    controls.update();
    controlsRef.current = controls;
    
    // Enhanced Lighting Setup for Better Model Visibility
    
    // Main directional light (sunlight)
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(5, 10, 5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    scene.add(mainLight);
    
    // Fill light from the opposite side
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);
    
    // Front light for face/eye illumination
    const frontLight = new THREE.DirectionalLight(0xffffff, 0.6);
    frontLight.position.set(0, 2, 8);
    scene.add(frontLight);
    
    // Ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    
    // Hemisphere light for natural color variation
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);
    
    // Grid helper
    const gridHelper = new THREE.GridHelper(10, 10);
    scene.add(gridHelper);
    
    // Load model
    const loader = new GLTFLoader();
    
    setIsLoading(true);
    setError(null);
    
    if (isVRM) {
      // Load as VRM
      loader.register((parser) => new VRMLoaderPlugin(parser));
      
      loader.load(
        modelUrl,
        async (gltf) => {
          const vrm = gltf.userData.vrm as VRM;
          
          // Rotate model if needed
          VRMUtils.rotateVRM0(vrm);
          
          // Fix materials for proper rendering
          fixModelMaterials(vrm.scene);
          
          scene.add(vrm.scene);
          vrmRef.current = vrm;
          modelRef.current = vrm.scene;
          
          // Create animation mixer
          mixerRef.current = new THREE.AnimationMixer(vrm.scene);
          
          // Load animations
          await loadAnimationsForGLB();
          
          // Start with idle animation
          playAnimation('idle');
          
          setIsLoading(false);
          console.log('✅ VRM model loaded successfully');
        },
        (progress) => {
          console.log('Loading VRM:', (progress.loaded / progress.total * 100).toFixed(2) + '%');
        },
        (error) => {
          console.error('Error loading VRM:', error);
          setError('Failed to load VRM model');
          setIsLoading(false);
        }
      );
    } else {
      // Load as regular GLB
      loader.load(
        modelUrl,
        async (gltf) => {
          const model = gltf.scene;
          
          // Scale and position the model
          model.scale.set(1, 1, 1);
          model.position.set(0, 0, 0);
          
          // Center the model
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          model.position.sub(center);
          model.position.y = 0;
          
          // Fix materials for proper rendering
          fixModelMaterials(model);
          
          scene.add(model);
          modelRef.current = model;
          
          // Create animation mixer
          mixerRef.current = new THREE.AnimationMixer(model);
          
          // Use embedded animations if available
          if (gltf.animations && gltf.animations.length > 0) {
            console.log(`Found ${gltf.animations.length} embedded animations`);
            gltf.animations.forEach((clip, index) => {
              console.log(`Animation ${index}: ${clip.name}`);
              if (index === 0) idleClipRef.current = clip;
              if (index === 1) talkingClipRef.current = clip;
              if (index === 2) thinkingClipRef.current = clip;
            });
          }
          
          // Load external animations
          await loadAnimationsForGLB();
          
          // Start with idle animation
          playAnimation('idle');
          
          // Ensure lips are sealed on initial load
          setTimeout(() => sealLipsForIdle(), 500);
          
          // Initialize lip sync debugger
          debuggerRef.current = new LipSyncDebugger(model);
          const report = debuggerRef.current.generateReport();
          console.log(report);
          
          // Check viseme availability
          const visemeCheck = debuggerRef.current.checkReadyPlayerMeVisemes();
          if (visemeCheck.missing.length > 0) {
            console.warn('[VRMAvatar] ⚠️ Missing Ready Player Me visemes. Lip sync may be imperfect.');
            console.warn('[VRMAvatar] Missing visemes:', visemeCheck.missing);
          } else {
            console.log('[VRMAvatar] ✅ All Ready Player Me visemes found on model');
          }
          
          setIsLoading(false);
          console.log('✅ GLB model loaded successfully');
        },
        (progress) => {
          console.log('Loading GLB:', (progress.loaded / progress.total * 100).toFixed(2) + '%');
        },
        (error) => {
          console.error('Error loading GLB:', error);
          setError('Failed to load GLB model');
          setIsLoading(false);
        }
      );
    }
    
    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      
      const deltaTime = clockRef.current.getDelta();
      
      if (mixerRef.current) {
        mixerRef.current.update(deltaTime);
      }
      
      if (vrmRef.current) {
        vrmRef.current.update(deltaTime);
      }
      
      // Restore eye transforms after animation updates to prevent disappearing
      eyeObjectsRef.current.forEach((eyeData) => {
        const { object, originalPosition, originalRotation, originalScale } = eyeData;
        if (object && object.parent) {
          // Restore original transforms
          object.position.copy(originalPosition);
          object.rotation.copy(originalRotation);
          object.scale.copy(originalScale);
          
          // Ensure visibility properties are maintained
          object.visible = true;
          object.updateMatrix();
          object.updateMatrixWorld(true);
          
          // Force material update if needed
          if (object instanceof THREE.Mesh && object.material) {
            const material = Array.isArray(object.material) ? object.material[0] : object.material;
            if (material instanceof THREE.Material) {
              material.needsUpdate = true;
            }
          }
        }
      });
      
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      
      renderer.render(scene, camera);
    };
    animate();
    
    // Cleanup
    return () => {
      // Stop speaking animation
      if (speakingIntervalRef.current) {
        clearInterval(speakingIntervalRef.current);
        speakingIntervalRef.current = null;
      }
      
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [modelUrl, width, height]);
  
  // Register GLB animation callback with audio context for when audio actually starts
  useEffect(() => {
    if (onGLBAudioStart && modelType === 'glb') {
      const triggerAnimation = () => {
        console.log('🎬 GLB Animation triggered when audio actually starts playing');
        console.log('🎭 Starting Talking.glb body animation synchronized with audio');
        console.log('👄 Starting GLB lip sync animation synchronized with audio');
        // Start both the body talking animation and lip sync animation
        playAnimation('talking');
        startSpeakingAnimation();
      };
      
      onGLBAudioStart(triggerAnimation);
      
      return () => {
        // Clean up callback
        onGLBAudioStart(() => {});
      };
    }
  }, [onGLBAudioStart, modelType]);

  // 🎯 STREAMLINED: Register direct viseme callback for immediate application  
  useEffect(() => {
    if (onViseme && modelType === 'glb') {
      console.log('🚀 Registering DIRECT viseme callback for GLB model');
      
      // Pass the streamlined direct handler
      onViseme(handleDirectViseme);
      
      return () => {
        // Clean up callback
        onViseme(() => {});
      };
    }
  }, [onViseme, modelType, handleDirectViseme]);
  
  // Sync animations with audio state
  useEffect(() => {
    if (isAvatarTalking) {
      // For GLB models, both body and lip animations are triggered by onGLBAudioStart callback
      // when audio actually starts playing, so we don't start them here
      if (modelType === 'vrm') {
        // For VRM models, start animations immediately since they don't have the audio sync
        playAnimation('talking');
        startSpeakingAnimation();
      }
      // For GLB models, we do nothing here - animations will start when audio actually plays
    } else if (isProcessingResponse) {
      playAnimation('thinking');
      // Stop speaking animation when thinking and seal lips
      if (modelType === 'glb') {
        stopSpeakingAnimation();
        // Ensure lips are sealed during thinking
        setTimeout(() => sealLipsForIdle(), 200);
      }
    } else {
      playAnimation('idle');
      // Stop speaking animation when idle and seal lips completely
      if (modelType === 'glb') {
        stopSpeakingAnimation();
        // Ensure lips are completely sealed during idle
        setTimeout(() => sealLipsForIdle(), 200);
      }
    }
  }, [isAvatarTalking, isProcessingResponse, modelType]);
  
  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current) return;
      
      const newWidth = mountRef.current?.clientWidth || width;
      const newHeight = mountRef.current?.clientHeight || height;
      
      cameraRef.current.aspect = newWidth / newHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newWidth, newHeight);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [width, height]);


  
  return (
    <div className="vrm-avatar-container relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading 3D Avatar...</p>
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 rounded-lg">
          <div className="text-center text-red-600">
            <p className="font-semibold">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}
      
      <div 
        ref={mountRef} 
        className="vrm-mount rounded-lg overflow-hidden"
        style={{ 
          width: width + 'px', 
          height: height + 'px',
          display: isLoading || error ? 'none' : 'block'
        }}
      />
      
      {/* Animation status indicator */}
      <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
        {isAvatarTalking 
          ? (modelType === 'glb' ? 'Speaking (Audio Synchronized)' : 'Speaking') 
          : isProcessingResponse 
          ? (modelType === 'glb' ? 'Processing (Lips Sealed)' : 'Processing')
          : (modelType === 'glb' ? 'Ready (Lips Sealed)' : 'Ready')
        }
      </div>


    </div>
  );
};