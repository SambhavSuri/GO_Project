import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { useAudioContext } from '../../logic/AudioProvider';

interface VRMAvatarProps {
  modelUrl?: string;
  width?: number;
  height?: number;
}

export const VRMAvatar: React.FC<VRMAvatarProps> = ({ 
  modelUrl = '/static/assets/6891a06aece5d61d2d726697.glb',
  width = 800,
  height = 600 
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
  const visemeMappingRef = useRef<Record<string, string>>({});
  
  // Animation clips refs
  const idleClipRef = useRef<THREE.AnimationClip | null>(null);
  const talkingClipRef = useRef<THREE.AnimationClip | null>(null);
  const thinkingClipRef = useRef<THREE.AnimationClip | null>(null);

  // Initialize viseme mapping for GLB speaking animation
  const initializeVisemeMapping = () => {
    visemeMappingRef.current = {
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
      O: "viseme_O"      // Open back vowel
    };
  };

  // Azure TTS Viseme ID to morph target mapping (Microsoft Speech SDK standard)
  const azureVisemeToMorphTarget = (visemeId: number): string => {
    const visemeMap: { [key: number]: string } = {
      0: "viseme_sil",    // Silence
      1: "viseme_aa",     // Open vowel (aa as in 'father')
      2: "viseme_E",      // Open front vowel (ae as in 'cat')  
      3: "viseme_aa",     // Open central vowel (ah as in 'father')
      4: "viseme_O",      // Open back vowel (ao as in 'thought')
      5: "viseme_aa",     // Diphthong (aw as in 'cow')
      6: "viseme_I",      // Diphthong (ay as in 'hide')
      7: "viseme_U",      // Close back vowel (b, p, m)
      8: "viseme_CH",     // Palato-alveolar (ch as in 'church')
      9: "viseme_DD",     // Dental/alveolar (d, t, n, l)
      10: "viseme_TH",    // Dental fricative (dh as in 'the')
      11: "viseme_E",     // Mid front vowel (eh as in 'bed')
      12: "viseme_RR",    // R-colored vowel (er as in 'bird')
      13: "viseme_E",     // Mid front vowel (ey as in 'face')
      14: "viseme_FF",    // Labiodental (f, v)
      15: "viseme_kk",    // Velar (g as in 'go')
      16: "viseme_TH",    // Dental fricative (hh as in 'house')
      17: "viseme_I",     // Close front vowel (ih as in 'bit')
      18: "viseme_I",     // Close front vowel (iy as in 'eat')
      19: "viseme_CH",    // Palato-alveolar (jh as in 'judge')
      20: "viseme_kk",    // Velar (k as in 'cat')
      21: "viseme_DD",    // Alveolar lateral (l as in 'lid')
      22: "viseme_PP",    // Bilabial (m as in 'mat')
      23: "viseme_nn",    // Alveolar nasal (n as in 'no')
      24: "viseme_kk",    // Velar nasal (ng as in 'sing')
      25: "viseme_O",     // Mid back vowel (ow as in 'boat')
      26: "viseme_O",     // Diphthong (oy as in 'toy')
      27: "viseme_PP",    // Bilabial (p as in 'put')
      28: "viseme_RR",    // Alveolar approximant (r as in 'red')
      29: "viseme_SS",    // Alveolar fricative (s as in 'sit')
      30: "viseme_CH",    // Palato-alveolar (sh as in 'she')
      31: "viseme_DD",    // Alveolar (t as in 'talk')
      32: "viseme_TH",    // Dental fricative (th as in 'think')
      33: "viseme_U",     // Close back vowel (uh as in 'book')
      34: "viseme_U",     // Close back vowel (uw as in 'too')
      35: "viseme_FF",    // Labiodental (v as in 'vat')
      36: "viseme_U",     // Labio-velar (w as in 'with')
      37: "viseme_I",     // Palatal (y as in 'yard')
      38: "viseme_SS",    // Alveolar fricative (z as in 'zap')
      39: "viseme_CH",    // Palato-alveolar (zh as in 'measure')
    };
    
    return visemeMap[visemeId] || "viseme_sil";
  };

  // Handle Azure TTS viseme events with precise timing
  const handleAzureViseme = (viseme: { visemeId: number; offset: number; duration: number }) => {
    if (modelType !== 'glb' || !modelRef.current) return;
    
    console.log(`👄 Azure Viseme ${viseme.visemeId} -> ${azureVisemeToMorphTarget(viseme.visemeId)} (${viseme.duration}ms)`);
    
    // Reset all visemes first for clean transitions
    const allVisemes = [
      'viseme_sil', 'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U', 
      'viseme_PP', 'viseme_DD', 'viseme_FF', 'viseme_TH', 'viseme_CH', 'viseme_SS', 
      'viseme_nn', 'viseme_RR', 'viseme_kk'
    ];
    
    allVisemes.forEach(viseme => {
      lerpMorphTarget(viseme, 0.0, 0.3);
    });
    
    // Apply the specific viseme with appropriate strength
    const targetMorph = azureVisemeToMorphTarget(viseme.visemeId);
    const strength = viseme.visemeId === 0 ? 0.2 : 1.0; // Silence gets lower strength
    
    lerpMorphTarget(targetMorph, strength, 0.2);
    
    // Schedule reset after viseme duration
    setTimeout(() => {
      if (!speakingIntervalRef.current) { // Only reset if not in manual speaking mode
        lerpMorphTarget(targetMorph, 0.0, 0.3);
      }
    }, viseme.duration);
  };

  // Lerp morph target to a specific value
  const lerpMorphTarget = (targetName: string, value: number, speed: number = 0.1) => {
    if (!modelRef.current || modelType !== 'glb') {
      return;
    }
    
    modelRef.current.traverse((child) => {
      if ((child as any).isSkinnedMesh && (child as any).morphTargetDictionary) {
        const skinnedMesh = child as THREE.SkinnedMesh;
        const index = skinnedMesh.morphTargetDictionary[targetName];
        if (index === undefined || !skinnedMesh.morphTargetInfluences || skinnedMesh.morphTargetInfluences[index] === undefined) {
          return;
        }
        
        // Smoothly interpolate to the target value
        skinnedMesh.morphTargetInfluences[index] = THREE.MathUtils.lerp(
          skinnedMesh.morphTargetInfluences[index],
          value,
          speed
        );
      }
    });
  };

  // Speaking animation for GLB models
  const updateSpeakingAnimation = () => {
    if (modelType !== 'glb' || !modelRef.current) return;
    
    const currentTime = Date.now();
    const mouthOpenTime = 150 + Math.random() * 250; // 150-400ms - longer for more visible movement
    const mouthCloseTime = 80 + Math.random() * 120; // 80-200ms - longer pause for better contrast
    
    // Handle realistic mouth movements using visemes for speaking animation
    if (mouthStateRef.current === 'closed' && currentTime - lastMouthChangeTimeRef.current >= mouthCloseTime) {
      // Reset all visemes first
      ['viseme_sil', 'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U', 'viseme_PP'].forEach(viseme => {
        lerpMorphTarget(viseme, 0.0, 0.1);
      });
      
      // REALISTIC LIP MOVEMENT with proper mouth gap - focus on lips, not teeth
      const lipMovementVisemes = [
        { viseme: 'viseme_aa', strength: 1.2, desc: 'Wide lip separation' },
        { viseme: 'viseme_E', strength: 1.0, desc: 'Mid lip position' },
        { viseme: 'viseme_O', strength: 1.1, desc: 'Round lip pucker' },
        { viseme: 'viseme_I', strength: 0.9, desc: 'Narrow lip spread' },
        { viseme: 'viseme_U', strength: 1.0, desc: 'Lip forward projection' },
        { viseme: 'viseme_PP', strength: 1.1, desc: 'Lip closure/release' },
      ];
      
      const randomLipMovement = lipMovementVisemes[Math.floor(Math.random() * lipMovementVisemes.length)];
      
      // Apply the chosen lip movement with enhanced strength for visibility
      lerpMorphTarget(randomLipMovement.viseme, randomLipMovement.strength, 0.3);
      
      //console.log(`👄 LIP MOVEMENT: ${randomLipMovement.viseme} (${randomLipMovement.desc}) at ${randomLipMovement.strength} strength`);
      
      mouthStateRef.current = 'open';
      lastMouthChangeTimeRef.current = currentTime;
    } else if (mouthStateRef.current === 'open' && currentTime - lastMouthChangeTimeRef.current >= mouthOpenTime) {
      // Close mouth - use silence viseme
      // Reset all speaking visemes for natural lip closure
      ['viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U', 'viseme_PP'].forEach(viseme => {
        lerpMorphTarget(viseme, 0.0, 0.2);
      });
      
      // Apply natural lip closure with slight gap
      lerpMorphTarget('viseme_sil', 0.4, 0.3);  // More neutral closure with better contrast
      
      //console.log(`🤐 LIPS CLOSED: Natural lip position with slight gap`);
      
      mouthStateRef.current = 'closed';
      lastMouthChangeTimeRef.current = currentTime;
    }
  };

  // Start speaking animation for GLB models
  const startSpeakingAnimation = () => {
    if (modelType !== 'glb' || speakingIntervalRef.current) return;
    
    console.log('🎤 Starting GLB speaking animation (triggered by audio playback)');
    initializeVisemeMapping();
    
    // Reset mouth state
    mouthStateRef.current = 'closed';
    lastMouthChangeTimeRef.current = Date.now();
    
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

  // Seal lips completely for idle animation
  const sealLipsForIdle = () => {
    if (modelType === 'glb' && modelRef.current) {
      // Reset ALL visemes to 0 for completely sealed lips
      ['viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U', 'viseme_PP', 'viseme_sil', 'viseme_DD', 'viseme_FF', 'viseme_TH', 'viseme_CH', 'viseme_SS', 'viseme_nn', 'viseme_RR', 'viseme_kk'].forEach(viseme => {
        lerpMorphTarget(viseme, 0.0, 0.4);
      });
      console.log('🔒 Lips completely sealed for idle state - all visemes reset to 0');
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

  // Register Azure TTS viseme callback with audio context
  useEffect(() => {
    if (onViseme && modelType === 'glb') {
      console.log('🎯 Registering Azure TTS viseme callback for GLB model');
      
      onViseme(handleAzureViseme);
      
      return () => {
        // Clean up callback
        onViseme(() => {});
      };
    }
  }, [onViseme, modelType]);
  
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