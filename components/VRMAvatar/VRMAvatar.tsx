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
  mapAzureVisemeToReadyPlayerMe,
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
  const { isAvatarTalking, isProcessingResponse, onGLBAudioStart, onViseme, setIsAvatarTalking } = useAudioContext();
  
  // Speaking animation state for GLB models
  const speakingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mouthStateRef = useRef<'open' | 'closed'>('closed');
  const lastMouthChangeTimeRef = useRef<number>(0);
  
  // Animation clips refs
  const idleClipRef = useRef<THREE.AnimationClip | null>(null);
  const talkingClipRef = useRef<THREE.AnimationClip | null>(null);
  const thinkingClipRef = useRef<THREE.AnimationClip | null>(null);

  // 🎯 PROFESSIONAL: Real-time viseme animation system
  const previousVisemeRef = useRef<string>("viseme_sil");
  const activeVisemesRef = useRef<Map<string, number>>(new Map());
  
  // 🚀 NEW: Target visemes for smooth real-time animation
  const targetVisemesRef = useRef<Map<string, {target: number, speed: number}>>(new Map());
  const visemeAnimationEnabledRef = useRef<boolean>(true);
  
  // 🎯 REAL-TIME: Current active viseme for smooth lip sync (inspired by reference)
  const currentActiveVisemeRef = useRef<{name: string, intensity: number, timestamp: number} | null>(null);
  
  // 📊 TRACKING: Record all played visemes for summary logging
  const playedVisemesRef = useRef<Array<{azureId: number, readyPlayerMe: string, intensity: number, timestamp: number, offset: number}>>([])
  
  // Lip sync debugger
  const debuggerRef = useRef<LipSyncDebugger | null>(null);

  // 🚨 MANUAL TEST: Global function for testing visemes directly
  const testManualViseme = useCallback((visemeName: string = 'viseme_aa', intensity: number = 1.0) => {
    if (!modelRef.current || modelType !== 'glb') {
      console.error(`🚨 [VRMAvatar] MANUAL TEST BLOCKED: model=${!!modelRef.current}, type=${modelType}`);
      return;
    }
    
    let foundMeshes = 0;
    let appliedTargets = 0;
    
    // Apply to ALL SkinnedMesh objects that have the morph target
    modelRef.current.traverse((child) => {
      if ((child as any).isSkinnedMesh && (child as any).morphTargetDictionary) {
        foundMeshes++;
        const skinnedMesh = child as THREE.SkinnedMesh;
        const index = skinnedMesh.morphTargetDictionary[visemeName];
        
        if (index !== undefined && skinnedMesh.morphTargetInfluences) {
          skinnedMesh.morphTargetInfluences[index] = intensity; // Direct application for testing
          appliedTargets++;
        }
      }
    });
  }, [modelType]);

  // 📊 VISEME SUMMARY: Display complete played viseme sequence when TTS completes
  const displayVisemeSummary = useCallback(() => {
    if (playedVisemesRef.current.length === 0) {
      return;
    }

    // Create summary table
    playedVisemesRef.current.forEach((viseme, index) => {
      const phonemeMap: {[key: number]: string} = {
        0: 'silence', 1: 'æ,ə,ʌ', 2: 'ɑ', 3: 'ɔ', 4: 'ɛ,ʊ', 5: 'ɝ', 
        6: 'j,i,ɪ', 7: 'w,u', 8: 'o', 9: 'aʊ', 10: 'ɔɪ', 11: 'aɪ', 
        12: 'h', 13: 'ɹ', 14: 'l', 15: 's,z', 16: 'ʃ,tʃ,dʒ,ʒ', 17: 'ð', 
        18: 'f,v', 19: 'd,t,n,θ', 20: 'k,g,ŋ', 21: 'p,b,m'
      };
      const phoneme = phonemeMap[viseme.azureId] || 'unknown';
    });
    
    // Summary statistics
    const uniqueVisemes = Array.from(new Set(playedVisemesRef.current.map(v => v.readyPlayerMe)));
  }, []);

  // 🎯 AUDIO OFFSET TIMING: Track when TTS audio actually starts for proper synchronization
  const audioStartTimeRef = useRef<number | null>(null);
  const scheduledVisemesRef = useRef<Map<number, NodeJS.Timeout>>(new Map());
  
  // 🎯 CLEANUP: Cancel all scheduled visemes (for TTS stop/restart)
  const cancelAllScheduledVisemes = useCallback(() => {
    scheduledVisemesRef.current.forEach((timeout) => {
      clearTimeout(timeout);
    });
    scheduledVisemesRef.current.clear();
    audioStartTimeRef.current = null;
  }, []);
  
  // 🎯 PROPER TIMING: Professional lip sync system with real audioOffset synchronization
  const handleDirectViseme = useCallback((visemeId: number, offset: number) => {
    // 🚨 ENHANCED DEBUGGING: Check each blocking condition separately
    const modelTypeOK = modelType === 'glb';
    const modelRefOK = !!modelRef.current;
    const animationEnabledOK = visemeAnimationEnabledRef.current;
    
    if (!modelTypeOK || !modelRefOK || !animationEnabledOK) {
      console.error(`❌ [VRMAvatar] AZURE VISEME BLOCKED: ID=${visemeId} - modelType=${modelType}(${modelTypeOK}), model=${modelRefOK}, enabled=${animationEnabledOK}`);
      return;
    }
    
    // 🎯 AUDIO OFFSET TIMING: Schedule viseme based on proper audioOffset timing
    
    // Clear previous scheduled visemes if this is the start of a new TTS session
    if (!currentActiveVisemeRef.current || currentActiveVisemeRef.current.timestamp < Date.now() - 500) {
      // Clear any previously scheduled visemes
      scheduledVisemesRef.current.forEach((timeout) => {
        clearTimeout(timeout);
      });
      scheduledVisemesRef.current.clear();
      
      // Reset audio start time for new session
      audioStartTimeRef.current = null;
      
      // Clear old tracking data
      if (playedVisemesRef.current.length > 0) {
        displayVisemeSummary();
        playedVisemesRef.current = [];
      }
    }
    
    // 🗺️ Azure ID → Ready Player Me enhanced viseme data
    const visemeMapping = mapAzureVisemeToReadyPlayerMe(visemeId);
    const readyPlayerMeViseme = {
      visemeName: visemeMapping.morphTarget,
      intensity: visemeMapping.intensity
    };
    
    // Mirror to Looking Glass if callback provided  
    if (onVisemeMirror) {
      onVisemeMirror({ visemeId, offset });
    }
    
    // 🎯 SCHEDULE VISEME: Apply at correct time based on audioOffset
    const scheduleVisemeApplication = () => {
      const now = Date.now();
      
      // If audio hasn't started yet, wait for it
      if (!audioStartTimeRef.current) {
        // Check every 50ms for audio start
        const waitForAudio = setInterval(() => {
          if (audioStartTimeRef.current) {
            clearInterval(waitForAudio);
            const delayMs = Math.max(0, (audioStartTimeRef.current + offset) - Date.now());
            
            const timeout = setTimeout(() => {
              applyVisemeAtCorrectTime(visemeId, readyPlayerMeViseme, offset);
            }, delayMs);
            
            scheduledVisemesRef.current.set(visemeId, timeout);
          }
        }, 50);
        
        return;
      }
      
      // Audio already started - calculate delay from now
      const delayMs = Math.max(0, (audioStartTimeRef.current + offset) - now);
      
      const timeout = setTimeout(() => {
        applyVisemeAtCorrectTime(visemeId, readyPlayerMeViseme, offset);
      }, delayMs);
      
      scheduledVisemesRef.current.set(visemeId, timeout);
    };
    
    // 🎯 APPLY VISEME: The actual application function
    const applyVisemeAtCorrectTime = (id: number, viseme: any, originalOffset: number) => {
      // Clear all visemes first for clean state
      const allVisemes = [
        'viseme_sil', 'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U',
        'viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD', 'viseme_kk',
        'viseme_CH', 'viseme_SS', 'viseme_nn', 'viseme_RR'
      ];
      
      allVisemes.forEach(v => setMorphTargetDirect(v, 0.0));
      
      // Apply the timed viseme
      const enhancedIntensity = Math.min(viseme.intensity * 1.5, 1.0);
      setMorphTargetDirect(viseme.visemeName, enhancedIntensity);
      
      // Update tracking
      const timestamp = Date.now();
      currentActiveVisemeRef.current = {
        name: viseme.visemeName,
        intensity: enhancedIntensity,
        timestamp: timestamp
      };
      
      // Track for summary
      playedVisemesRef.current.push({
        azureId: id,
        readyPlayerMe: viseme.visemeName,
        intensity: viseme.intensity,
        timestamp: timestamp,
        offset: originalOffset
      });
      
      // Clean up this scheduled viseme
      scheduledVisemesRef.current.delete(id);
      
      // Handle TTS end detection
      if (id === 0 && playedVisemesRef.current.length > 1) {
        setTimeout(() => {
          if (playedVisemesRef.current.length > 0) {
            displayVisemeSummary();
            playedVisemesRef.current = [];
            currentActiveVisemeRef.current = null;
            audioStartTimeRef.current = null;
          }
        }, 1000);
      }
    };
    
    // Start the scheduling process
    scheduleVisemeApplication();
  }, [modelType, onVisemeMirror]);

  // 🎯 NATURAL: Smooth morph target lerping (inspired by reference implementation)
  const lerpMorphTarget = useCallback((targetName: string, value: number, speed: number = 0.2) => {
    if (!modelRef.current || modelType !== 'glb') {
      console.error(`🚨 [VRMAvatar] lerpMorphTarget BLOCKED: model=${!!modelRef.current}, type=${modelType}`);
      return;
    }
    
    let foundMeshes = 0;
    let appliedTargets = 0;
    
    // Apply to ALL SkinnedMesh objects that have the morph target (like reference)
    modelRef.current.traverse((child) => {
      if ((child as any).isSkinnedMesh && (child as any).morphTargetDictionary) {
        foundMeshes++;
        const skinnedMesh = child as THREE.SkinnedMesh;
        const index = skinnedMesh.morphTargetDictionary[targetName];
        
        if (index !== undefined && skinnedMesh.morphTargetInfluences) {
          const currentValue = skinnedMesh.morphTargetInfluences[index];
          const newValue = THREE.MathUtils.lerp(currentValue, value, speed);
          skinnedMesh.morphTargetInfluences[index] = newValue;
          appliedTargets++;
        } else if (targetName.includes('viseme_')) {
          console.warn(`🚨 [VRMAvatar] VISEME NOT FOUND: ${targetName} in mesh with ${Object.keys(skinnedMesh.morphTargetDictionary).length} targets`);
        }
      }
    });
  }, [modelType]);

  // ⚡ INSTANT: Direct morph target assignment with ZERO delay (Enhanced for Raw Mode)
  const lastAppliedVisemeRef = useRef<{name: string, value: number, timestamp: number} | null>(null);
  
  const setMorphTargetDirect = (targetName: string, value: number) => {
    if (!modelRef.current || modelType !== 'glb') {
      console.error(`❌ [setMorphTargetDirect] BLOCKED: ${targetName}=${value} - model=${!!modelRef.current}, type=${modelType}`);
      return;
    }
    
    // 🚨 SPAM PREVENTION: Don't repeatedly apply the same viseme within 50ms
    const now = Date.now();
    const lastApplied = lastAppliedVisemeRef.current;
    if (lastApplied && 
        lastApplied.name === targetName && 
        Math.abs(lastApplied.value - value) < 0.001 && 
        now - lastApplied.timestamp < 50) {
      return; // Skip repeated applications
    }
    
    // Apply to ALL SkinnedMesh objects for consistent raw mode
    let appliedCount = 0;
    
    modelRef.current.traverse((child) => {
      if ((child as any).isSkinnedMesh && (child as any).morphTargetDictionary) {
        const skinnedMesh = child as THREE.SkinnedMesh;
        const index = skinnedMesh.morphTargetDictionary[targetName];
        
        if (index !== undefined && skinnedMesh.morphTargetInfluences) {
          const previousValue = skinnedMesh.morphTargetInfluences[index];
          skinnedMesh.morphTargetInfluences[index] = value;
          appliedCount++;
        }
      }
    });
    
    if (appliedCount === 0 && targetName.includes('viseme_')) {
      console.warn(`⚠️ [RAW] ${targetName} not found in any mesh!`);
    }
    
    // Track last applied to prevent spam
    lastAppliedVisemeRef.current = { name: targetName, value, timestamp: now };
  };

  // Expose test function globally (after setMorphTargetDirect declaration)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).testViseme = testManualViseme;
      (window as any).testMouthOpen = () => testManualViseme('viseme_aa', 1.0);
      (window as any).testMouthClosed = () => testManualViseme('viseme_sil', 1.0);
      (window as any).testMouthPP = () => testManualViseme('viseme_PP', 1.0);
      (window as any).showVisemeSummary = () => {
        displayVisemeSummary();
        playedVisemesRef.current = []; // Clear after showing
      };
      (window as any).cancelScheduledVisemes = () => {
        cancelAllScheduledVisemes();
      };
      (window as any).showAudioTiming = () => {
        const audioStart = audioStartTimeRef.current;
        const scheduled = scheduledVisemesRef.current.size;
        if (audioStart) {
          console.log(`⏰ [TIMING DEBUG] Time since audio start: ${Date.now() - audioStart}ms`);
        }
      };
      (window as any).testVisemeSwitch = () => {
        let isI = false;
        const switchInterval = setInterval(() => {
          if (isI) {
            // Test viseme_PP (Azure ID 21 - p,b,m sounds)
            setMorphTargetDirect('viseme_I', 0.0);
            setMorphTargetDirect('viseme_PP', 0.8);
          } else {
            // Test viseme_I (Azure ID 6 - i sounds)  
            setMorphTargetDirect('viseme_PP', 0.0);
            setMorphTargetDirect('viseme_I', 0.7);
          }
          isI = !isI;
        }, 500); // Switch every 500ms
        
        // Stop after 10 seconds
        setTimeout(() => {
          clearInterval(switchInterval);
          setMorphTargetDirect('viseme_PP', 0.0);
          setMorphTargetDirect('viseme_I', 0.0);
          setMorphTargetDirect('viseme_sil', 0.1);
        }, 10000);
      };
      
      // 🚨 MOUTH TEST: Opening and closing test function as requested
      (window as any).testMouthOpenClose = () => {
        console.log('🚨 [MOUTH TEST] Starting mouth open/close test...');
        
        // Clear all visemes first
        const allVisemes = [
          'viseme_sil', 'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U',
          'viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD', 'viseme_kk',
          'viseme_CH', 'viseme_SS', 'viseme_nn', 'viseme_RR'
        ];
        allVisemes.forEach(v => setMorphTargetDirect(v, 0.0));
        
        let isOpen = false;
        let testCount = 0;
        const maxTests = 6; // 3 open/close cycles
        
        const testInterval = setInterval(() => {
          if (isOpen) {
            // Close mouth - use silence viseme
            setMorphTargetDirect('viseme_aa', 0.0);
            setMorphTargetDirect('viseme_sil', 0.1);
            console.log('🚨 [MOUTH TEST] CLOSED - Applied viseme_sil');
            isOpen = false;
          } else {
            // Open mouth - use 'aa' viseme (wide open)
            setMorphTargetDirect('viseme_sil', 0.0);
            setMorphTargetDirect('viseme_aa', 0.9);
            console.log('🚨 [MOUTH TEST] OPEN - Applied viseme_aa at 0.9 intensity');
            isOpen = true;
          }
          
          testCount++;
          if (testCount >= maxTests) {
            clearInterval(testInterval);
            // End in closed position
            setMorphTargetDirect('viseme_aa', 0.0);
            setMorphTargetDirect('viseme_sil', 0.1);
            console.log('🚨 [MOUTH TEST] Completed 3 open/close cycles. Mouth should now be closed.');
          }
        }, 1000); // 1 second intervals
      };
      
      // 🎬 BODY ANIMATION TEST: Test body animation manually
      (window as any).testBodyAnimation = () => {
        console.log('🎬 [BODY ANIMATION TEST] Starting body animation test...');
        
        let currentAnim = 'idle';
        let testCount = 0;
        const maxTests = 9; // 3 cycles of idle -> talking -> thinking
        
        const testInterval = setInterval(() => {
          switch (currentAnim) {
            case 'idle':
              console.log('🎬 [BODY ANIMATION TEST] Playing TALKING animation');
              playAnimation('talking');
              currentAnim = 'talking';
              break;
            case 'talking':
              console.log('🎬 [BODY ANIMATION TEST] Playing THINKING animation');
              playAnimation('thinking');
              currentAnim = 'thinking';
              break;
            case 'thinking':
              console.log('🎬 [BODY ANIMATION TEST] Playing IDLE animation');
              playAnimation('idle');
              currentAnim = 'idle';
              break;
          }
          
          testCount++;
          if (testCount >= maxTests) {
            clearInterval(testInterval);
            // End in idle position
            playAnimation('idle');
            console.log('🎬 [BODY ANIMATION TEST] Completed 3 animation cycles. Avatar should now be idle.');
          }
        }, 2000); // 2 second intervals
      };
      
      // 🎬 TTS SIMULATION TEST: Simulate TTS body animation trigger
      (window as any).testTTSBodyAnimation = () => {
        console.log('🎬 [TTS SIMULATION TEST] Simulating TTS body animation...');
        
        // Directly trigger the talking animation without waiting for callback
        console.log('🎬 [TTS SIMULATION TEST] Directly triggering talking animation');
        playAnimation('talking');
        
        // Simulate audio start time for viseme synchronization
        audioStartTimeRef.current = Date.now();
        console.log('🎬 [TTS SIMULATION TEST] Audio start time set for viseme sync');
        
        // Stop after 5 seconds
        setTimeout(() => {
          console.log('🎬 [TTS SIMULATION TEST] Stopping talking animation - returning to idle');
          playAnimation('idle');
          audioStartTimeRef.current = null;
        }, 5000);
      };
      
      // 🎬 STATE DEBUG: Check current state and force talking animation
      (window as any).debugAvatarState = () => {
        console.log('🎬 [DEBUG] Current Avatar State:', {
          isAvatarTalking,
          isProcessingResponse,
          modelType,
          talkingClipAvailable: !!talkingClipRef.current,
          idleClipAvailable: !!idleClipRef.current,
          mixerAvailable: !!mixerRef.current,
          modelAvailable: !!modelRef.current,
          currentAction: currentActionRef.current?.getClip()?.name || 'none',
          audioStartTime: audioStartTimeRef.current
        });
        
        // Force talking animation regardless of state
        console.log('🎬 [DEBUG] Force triggering talking animation...');
        playAnimation('talking');
      };
      
      // 🎬 FORCE TALKING STATE: Manually set talking state to true
      (window as any).forceTalkingState = () => {
        console.log('🎬 [FORCE] Setting isAvatarTalking to true...');
        setIsAvatarTalking(true);
        audioStartTimeRef.current = Date.now();
      };
    }
  }, [testManualViseme, displayVisemeSummary, isAvatarTalking, isProcessingResponse, modelType, setIsAvatarTalking]);

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
        }
      }
    });
  };

  // 🚨 RAW VISEME MODE: COMPLETELY DISABLED - No interference with direct viseme application
  const updateVisemeAnimations = (deltaTime: number) => {
    // 🚨 RAW MODE: DISABLED COMPLETELY - Azure TTS has full control
    // No animation loop interference to see pure viseme switching
    return;
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
      
      mouthStateRef.current = 'closed';
      lastMouthChangeTimeRef.current = currentTime;
    }
  };

  // Start speaking animation for GLB models
  const startSpeakingAnimation = () => {
    // 🚨 RAW MODE: COMPLETELY DISABLED - Azure TTS controls all visemes directly
    return; // Exit immediately to prevent interference with Azure TTS
  };

  // Stop speaking animation for GLB models
  const stopSpeakingAnimation = () => {
    if (speakingIntervalRef.current) {
      clearInterval(speakingIntervalRef.current);
      speakingIntervalRef.current = null;
    }
    
    // 🎯 SMART STOP: Don't clear Azure TTS viseme state or seal lips during active TTS
    const hasActiveAzureTTS = currentActiveVisemeRef.current && 
                             (Date.now() - currentActiveVisemeRef.current.timestamp < 2000);
    
    if (hasActiveAzureTTS) {
      return; // Don't clear state or seal lips during active Azure TTS
    }
    
    // Only clear state and seal lips if no active Azure TTS
    currentActiveVisemeRef.current = null;
    activeVisemesRef.current.clear();
    targetVisemesRef.current.clear();
    sealLipsForIdle();
  };

  // 🎯 AZURE TTS INTEGRATION: Prepare avatar for Azure TTS lip sync
  const prepareForAzureTTS = useCallback(() => {
    if (modelType === 'glb' && modelRef.current) {
      // Stop any existing speaking animations
      stopSpeakingAnimation();
      
      // Clear all lip sync state
      currentActiveVisemeRef.current = null;
      activeVisemesRef.current.clear();
      targetVisemesRef.current.clear();
      previousVisemeRef.current = 'viseme_sil';
      
      // Reset all viseme morph targets to neutral
      const allVisemes = [
        'viseme_sil', 'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U',
        'viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD', 'viseme_kk',
        'viseme_CH', 'viseme_SS', 'viseme_nn', 'viseme_RR'
      ];
      
      allVisemes.forEach(viseme => {
        lerpMorphTarget(viseme, 0.0, 0.1); // Quick reset
      });
      
      // Set subtle silence for natural lip position
      setTimeout(() => {
        lerpMorphTarget('viseme_sil', 0.1, 0.3);
      }, 50);
    }
  }, [modelType, lerpMorphTarget]);

  // 🚨 RAW MODE: Direct lip sealing without smooth transitions (Enhanced protection)
  const sealLipsForIdle = () => {
    if (modelType === 'glb' && modelRef.current) {
      // 🚨 RAW MODE: Enhanced protection - don't seal if Azure TTS is active
      const now = Date.now();
      const hasActiveVisemes = currentActiveVisemeRef.current || playedVisemesRef.current.length > 0;
      const recentVisemeActivity = currentActiveVisemeRef.current && now - currentActiveVisemeRef.current.timestamp < 1000; // Extended to 1 second
      
      if (hasActiveVisemes || recentVisemeActivity) {
        return;
      }
      
      // Clear all active tracking only if no Azure TTS activity
      currentActiveVisemeRef.current = null;
      activeVisemesRef.current.clear();
      targetVisemesRef.current.clear();
      
      // 🚨 RAW MODE: Direct application without smooth transitions
      setMorphTargetDirect('viseme_sil', 0.1); // Direct neutral position
      
      previousVisemeRef.current = 'viseme_sil';
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
          eyeObjectsRef.current.set(child.uuid, {
            object: child,
            originalPosition: child.position.clone(),
            originalRotation: child.rotation.clone(),
            originalScale: child.scale.clone()
          });
          
          // Make eye objects immune to animation transforms
          child.matrixAutoUpdate = false;
          child.updateMatrix();
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
  };

  // Load animations for GLB models
  const loadAnimationsForGLB = async () => {
    const loader = new GLTFLoader();
    console.log('🎬 [VRMAvatar] Starting to load animations...');
    
    try {
      // Load idle animation
      console.log('🎬 [VRMAvatar] Loading idle animation...');
      const idleGltf = await loader.loadAsync('/static/animations/idleMale.glb');
      if (idleGltf.animations.length > 0) {
        idleClipRef.current = idleGltf.animations[0];
        idleClipRef.current.name = 'idle';
        console.log('✅ [VRMAvatar] Idle animation loaded successfully:', idleClipRef.current.name);
      } else {
        console.warn('⚠️ [VRMAvatar] No animations found in idle GLB file');
      }
      
      // Load talking animation
      console.log('🎬 [VRMAvatar] Loading talking animation...');
      try {
        const talkingGltf = await loader.loadAsync('/static/animations/Talking.glb');
        if (talkingGltf.animations.length > 0) {
          talkingClipRef.current = talkingGltf.animations[0];
          talkingClipRef.current.name = 'talking';
          console.log('✅ [VRMAvatar] Talking animation loaded successfully:', talkingClipRef.current.name);
        } else {
          console.warn('⚠️ [VRMAvatar] No animations found in Talking.glb file');
        }
      } catch (talkingError) {
        console.warn('⚠️ [VRMAvatar] Failed to load Talking.glb, trying waving.glb as fallback:', talkingError);
        
        // Load waving animation as alternative
        try {
          const wavingGltf = await loader.loadAsync('/static/animations/waving.glb');
          if (wavingGltf.animations.length > 0) {
            talkingClipRef.current = wavingGltf.animations[0];
            talkingClipRef.current.name = 'talking';
            console.log('✅ [VRMAvatar] Waving animation loaded as talking fallback:', talkingClipRef.current.name);
          } else {
            console.warn('⚠️ [VRMAvatar] No animations found in waving GLB file');
          }
        } catch (wavingError) {
          console.error('❌ [VRMAvatar] Failed to load waving animation as fallback:', wavingError);
          // Use idle animation as final fallback for talking
          if (idleClipRef.current) {
            talkingClipRef.current = idleClipRef.current.clone();
            talkingClipRef.current.name = 'talking';
            console.log('✅ [VRMAvatar] Using idle animation as talking fallback');
          }
        }
      }
      
      // Use idle as thinking for now
      thinkingClipRef.current = idleClipRef.current;
      
      // Log final animation status
      console.log('🎬 [VRMAvatar] Animation loading completed:', {
        idle: !!idleClipRef.current,
        talking: !!talkingClipRef.current,
        thinking: !!thinkingClipRef.current
      });
      
    } catch (error) {
      console.error('❌ [VRMAvatar] Critical error loading animations:', error);
      // Ensure we have at least some animation clips even if loading fails
      if (!idleClipRef.current && !talkingClipRef.current) {
        console.error('❌ [VRMAvatar] No animations available - avatar will not animate properly');
      }
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
      }
    });
    
    return new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode);
  };

  // Play animation
  const playAnimation = (clipName: 'idle' | 'talking' | 'thinking') => {
    console.log(`🎬 [VRMAvatar] playAnimation called with: "${clipName}"`);
    
    if (!mixerRef.current || !modelRef.current) {
      console.warn(`🎬 [VRMAvatar] Cannot play animation - mixer: ${!!mixerRef.current}, model: ${!!modelRef.current}`);
      return;
    }
    
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
    
    console.log(`🎬 [VRMAvatar] Animation clip "${clipName}" available: ${!!clip}`);
    
    if (!clip) {
      console.warn(`❌ [VRMAvatar] Animation clip "${clipName}" not available! Available clips:`, {
        idle: !!idleClipRef.current,
        talking: !!talkingClipRef.current,
        thinking: !!thinkingClipRef.current
      });
      
      // Try to use idle animation as fallback for talking/thinking
      if (clipName !== 'idle' && idleClipRef.current) {
        console.log(`🎬 [VRMAvatar] Using idle animation as fallback for "${clipName}"`);
        clip = idleClipRef.current;
      } else {
        return;
      }
    }
    
    try {
      // Stop current animation with fade
      if (currentActionRef.current) {
        console.log(`🎬 [VRMAvatar] Stopping current animation: ${currentActionRef.current.getClip().name}`);
        currentActionRef.current.fadeOut(0.5);
      }
      
      // Retarget animation for GLB models
      const targetClip = modelType === 'glb' ? retargetAnimation(clip, modelRef.current) : clip;
      console.log(`🎬 [VRMAvatar] Retargeted animation for ${modelType} model, tracks: ${targetClip.tracks.length}`);
      
      // Play new animation
      const action = mixerRef.current.clipAction(targetClip);
      action.reset();
      action.fadeIn(0.5);
      action.play();
      action.setLoop(THREE.LoopRepeat, Infinity); // Ensure the animation loops
      currentActionRef.current = action;
      
      console.log(`✅ [VRMAvatar] Successfully started "${clipName}" animation`);
      
    } catch (error) {
      console.error(`❌ [VRMAvatar] Error playing animation "${clipName}":`, error);
    }
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
        },
        (progress) => {
          // Loading progress
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
            gltf.animations.forEach((clip, index) => {
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
          
          // Check viseme availability
          const visemeCheck = debuggerRef.current.checkReadyPlayerMeVisemes();
          if (visemeCheck.missing.length > 0) {
            console.warn('[VRMAvatar] ⚠️ Missing Ready Player Me visemes. Lip sync may be imperfect.');
            console.warn('[VRMAvatar] Missing visemes:', visemeCheck.missing);
          }
          
          setIsLoading(false);
        },
        (progress) => {
          // Loading progress
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
      
      // 🎯 SMART SOLUTION: Apply Azure TTS visemes AFTER mixer update to override mouth keyframes
      // This allows body animations to continue while Azure TTS controls the mouth
      if (currentActiveVisemeRef.current && modelType === 'glb' && modelRef.current) {
        const activeViseme = currentActiveVisemeRef.current;
        const timeSinceLastViseme = Date.now() - activeViseme.timestamp;
        
        // Only re-apply if viseme is recent (within 500ms) and not a stale silence viseme
        if (timeSinceLastViseme < 500 && !(activeViseme.name === 'viseme_sil' && timeSinceLastViseme > 100)) {
          setMorphTargetDirect(activeViseme.name, activeViseme.intensity);
        } else if (timeSinceLastViseme >= 500) {
          // Clear stale viseme to stop repeated applications
          currentActiveVisemeRef.current = null;
        }
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
        console.log('🎬 [VRMAvatar] TTS audio started - triggering body animation');
        
        // 🎯 CRITICAL: Capture the exact moment TTS audio starts playing
        const audioStartTime = Date.now();
        audioStartTimeRef.current = audioStartTime;
        console.log(`🎬 [VRMAvatar] Audio start time recorded: ${audioStartTime}`);
        
        // Start body animation  
        console.log('🎬 [VRMAvatar] Starting talking animation for body movement');
        playAnimation('talking');
        
        // DO NOT call startSpeakingAnimation() or sealLipsForIdle() - Azure TTS timing system handles all lip sync
        console.log('🎬 [VRMAvatar] Body animation triggered, Azure TTS will handle lip sync');
      };
      
      console.log('🎬 [VRMAvatar] Registering GLB audio start callback for body animation');
      onGLBAudioStart(triggerAnimation);
      
      return () => {
        // Clean up callback
        console.log('🎬 [VRMAvatar] Cleaning up GLB audio start callback');
        onGLBAudioStart(() => {});
      };
    }
  }, [onGLBAudioStart, modelType]);

  // 🎯 CLEANUP: Cancel scheduled visemes on component unmount
  useEffect(() => {
    return () => {
      cancelAllScheduledVisemes();
    };
  }, [cancelAllScheduledVisemes]);

  // 🎯 STREAMLINED: Register direct viseme callback for timing-based application  
  useEffect(() => {
    if (onViseme && modelType === 'glb') {
      // Pass the timing-based handler
      onViseme(handleDirectViseme);
      
      return () => {
        // Clean up callback
        onViseme(() => {});
      };
    }
  }, [onViseme, modelType, handleDirectViseme]);
  
  // Sync animations with audio state  
  useEffect(() => {
    console.log(`🎬 [VRMAvatar] Animation sync triggered:`, {
      isAvatarTalking,
      isProcessingResponse,
      modelType,
      timestamp: new Date().toISOString()
    });
    
    if (isAvatarTalking) {
      console.log('🎬 [VRMAvatar] Avatar is talking - FORCING talking animation for GLB models');
      
      if (modelType === 'glb') {
        // 🎯 FORCE TALKING ANIMATION: Always trigger talking animation when isAvatarTalking is true
        console.log('🎬 [VRMAvatar] FORCING talking animation for GLB model');
        playAnimation('talking');
        
        // Set audio start time if not already set (for proper viseme timing)
        if (!audioStartTimeRef.current) {
          audioStartTimeRef.current = Date.now();
          console.log('🎬 [VRMAvatar] Setting audio start time for viseme synchronization');
        }
        
        // Check if Azure TTS visemes are already active
        const hasActiveVisemes = playedVisemesRef.current.length > 0 || currentActiveVisemeRef.current;
        
        console.log('🎬 [VRMAvatar] GLB model talking state:', {
          hasActiveVisemes,
          playedVisemesCount: playedVisemesRef.current.length,
          currentActiveViseme: !!currentActiveVisemeRef.current,
          talkingClipAvailable: !!talkingClipRef.current,
          mixerAvailable: !!mixerRef.current
        });
        
        if (!hasActiveVisemes) {
          console.log('🎬 [VRMAvatar] No active Azure TTS visemes - talking animation should still be visible for body movement');
        }
        
      } else if (modelType === 'vrm') {
        console.log('🎬 [VRMAvatar] VRM model - starting talking animation');
        // For VRM models, start animations immediately since they don't have the audio sync
        playAnimation('talking');
        startSpeakingAnimation();
      }
    } else if (isProcessingResponse) {
      console.log('🎬 [VRMAvatar] Processing response - starting thinking animation');
      playAnimation('thinking');
      
      // Stop speaking animation when thinking - smart stop won't interfere with active Azure TTS
      if (modelType === 'glb') {
        stopSpeakingAnimation(); // Smart stop - preserves Azure TTS state
      }
    } else {
      console.log('🎬 [VRMAvatar] Idle state - starting idle animation');
      playAnimation('idle');
      
      // Clear audio start time when going to idle
      audioStartTimeRef.current = null;
      
      // Stop speaking animation when idle - smart stop won't interfere with active Azure TTS
      if (modelType === 'glb') {
        stopSpeakingAnimation(); // Smart stop - preserves Azure TTS state
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