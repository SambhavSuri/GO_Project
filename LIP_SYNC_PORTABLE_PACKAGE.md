# 🎭 Complete Lip Sync & Viseme Package for Ready Player Me Models

This package contains all the essential functions and utilities needed to implement lip syncing with visemes and morph targets in any 3D avatar project. Extracted from a production-ready implementation.

## 📦 Package Contents

### 1. Core Viseme System
- Complete Azure TTS to Ready Player Me viseme mapping
- Morph target manipulation functions (smooth & direct)
- Timing-based viseme scheduling system
- Comprehensive debugging tools

### 2. Testing Functions
- Window-exposed testing functions for development
- Automated viseme sequence testing
- Real-time viseme switching demonstrations

### 3. Audio Integration
- Azure Speech SDK integration with real-time visemes
- Audio timing synchronization
- Buffer management for streaming audio

---

## 🎯 Core Implementation Files

### A. Viseme Mapper (`visemeMapper.ts`)

```typescript
// Ready Player Me Viseme Mapper for Azure TTS
// Enhanced mapping with intensity and smoothFactor for professional lip sync

export interface VisemeMapping {
  morphTarget: string;
  intensity: number;
  smoothFactor: number;
}

export interface ReadyPlayerMeVisemeMap {
  [azureVisemeId: string]: VisemeMapping;
}

/**
 * 🎯 OFFICIAL AZURE MAPPING: Azure AI Speech Service to Ready Player Me viseme mapping
 * Based on official Azure viseme specification with IPA phonemes
 * Optimized for accurate real-time lip synchronization with Azure TTS
 */
export const READY_PLAYER_ME_VISEME_MAP: ReadyPlayerMeVisemeMap = {
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

/**
 * All possible Ready Player Me viseme names
 * Used for resetting visemes before applying new ones
 */
export const ALL_READY_PLAYER_ME_VISEMES = [
  "viseme_sil",
  "viseme_PP", 
  "viseme_FF",
  "viseme_TH",
  "viseme_DD",
  "viseme_kk", 
  "viseme_CH",
  "viseme_SS",
  "viseme_nn",
  "viseme_RR",
  "viseme_aa",
  "viseme_E",
  "viseme_I", 
  "viseme_O",
  "viseme_U"
];

/**
 * 🎯 OFFICIAL AZURE MAPPING: Maps Azure TTS viseme ID to Ready Player Me viseme data
 * Based on official Azure AI Speech Service viseme specification with IPA phonemes
 * @param azureVisemeId - Azure TTS viseme ID (0-21 official range)
 * @returns VisemeMapping with morphTarget, intensity, and smoothFactor
 */
export function mapAzureVisemeToReadyPlayerMe(azureVisemeId: number): VisemeMapping {
  const visemeMapping = READY_PLAYER_ME_VISEME_MAP[azureVisemeId.toString()];
  if (!visemeMapping) {
    console.warn(`[VisemeMapper] Unknown Azure viseme ID: ${azureVisemeId}, falling back to silence. Official Azure range: 0-21 with IPA phonemes`);
    return { "morphTarget": "viseme_sil", "intensity": 0.1, "smoothFactor": 0.2 };
  }
  return visemeMapping;
}

/**
 * 🎯 ENHANCED: Get intensity for a specific Azure viseme ID
 * Uses the enhanced mapping with precise intensity values
 * @param azureVisemeId - Azure TTS viseme ID
 * @returns Intensity value between 0.0 and 1.0
 */
export function getVisemeIntensity(azureVisemeId: number): number {
  const visemeMapping = mapAzureVisemeToReadyPlayerMe(azureVisemeId);
  return visemeMapping.intensity;
}

/**
 * 🎯 ENHANCED: Get smooth factor for a specific Azure viseme ID  
 * Uses the enhanced mapping with optimized transition values
 * @param azureVisemeId - Azure TTS viseme ID
 * @returns Smooth factor value for transitions
 */
export function getVisemeSmoothFactor(azureVisemeId: number): number {
  const visemeMapping = mapAzureVisemeToReadyPlayerMe(azureVisemeId);
  return visemeMapping.smoothFactor;
}

/**
 * 🎯 COMPATIBILITY: Get intensity by viseme name for backward compatibility
 * @param visemeName - Ready Player Me viseme name
 * @returns Intensity value from the enhanced mapping
 */
export function getVisemeIntensityByName(visemeName: string): number {
  // Find the Azure viseme ID that maps to this morph target
  for (const [azureId, mapping] of Object.entries(READY_PLAYER_ME_VISEME_MAP)) {
    if (mapping.morphTarget === visemeName) {
      return mapping.intensity;
    }
  }
  
  // Fallback intensity values for unknown visemes
  return 0.5;
}

/**
 * Get transition speed for smooth viseme changes
 * Some visemes need faster/slower transitions
 * @param fromViseme - Previous viseme name
 * @param toViseme - Target viseme name
 * @returns Transition speed (higher = faster)
 */
export function getVisemeTransitionSpeed(fromViseme: string, toViseme: string): number {
  // Faster transitions for consonants, slower for vowels
  const consonants = ["viseme_PP", "viseme_FF", "viseme_TH", "viseme_DD", "viseme_kk", "viseme_CH", "viseme_SS", "viseme_nn", "viseme_RR"];
  const vowels = ["viseme_aa", "viseme_E", "viseme_I", "viseme_O", "viseme_U"];
  
  const fromIsConsonant = consonants.includes(fromViseme);
  const toIsConsonant = consonants.includes(toViseme);
  
  if (fromIsConsonant && toIsConsonant) {
    return 0.4; // Fast consonant-to-consonant
  } else if (!fromIsConsonant && !toIsConsonant) {
    return 0.2; // Slow vowel-to-vowel
  } else {
    return 0.3; // Medium consonant-vowel or vowel-consonant
  }
}

/**
 * 🎯 ENHANCED: Ready Player Me viseme data with smooth factor
 */
export interface ReadyPlayerMeVisemeData {
  visemeName: string;
  intensity: number;
  duration: number;
  offset: number;
  smoothFactor: number;  // 🎯 NEW: Enhanced smooth factor from mapping
}

/**
 * 🎯 ENHANCED: Convert Azure TTS viseme data to Ready Player Me viseme data
 * Uses the new comprehensive mapping with intensity and smooth factor
 * @param azureViseme - Azure TTS viseme data
 * @param previousViseme - Previous viseme (optional, for compatibility)
 * @returns Ready Player Me viseme data with enhanced values
 */
export function convertAzureVisemeToReadyPlayerMe(
  azureViseme: { visemeId: number; offset: number; duration?: number },
  previousViseme?: string
): ReadyPlayerMeVisemeData {
  const visemeMapping = mapAzureVisemeToReadyPlayerMe(azureViseme.visemeId);
  
  return {
    visemeName: visemeMapping.morphTarget,
    intensity: visemeMapping.intensity,
    duration: azureViseme.duration || 100,  // Default duration
    offset: azureViseme.offset,
    smoothFactor: visemeMapping.smoothFactor  // 🎯 NEW: Use mapping smooth factor
  };
}

/**
 * 🎯 ENHANCED: Debug function to log comprehensive viseme mapping details
 */
export function logVisemeMapping(azureVisemeId: number): void {
  const visemeMapping = mapAzureVisemeToReadyPlayerMe(azureVisemeId);
  
  console.log(`[VisemeMapper] 🎯 Azure ${azureVisemeId} → ${visemeMapping.morphTarget} (intensity: ${visemeMapping.intensity}, smooth: ${visemeMapping.smoothFactor})`);
}
```

### B. Morph Target Controller (`morphTargetController.ts`)

```typescript
import * as THREE from 'three';

/**
 * 🎯 NATURAL: Smooth morph target lerping for gradual viseme transitions
 * @param model - The 3D model object
 * @param targetName - Viseme name (e.g. 'viseme_aa')
 * @param value - Target intensity (0.0 to 1.0)
 * @param speed - Transition speed (0.1 = slow, 0.5 = fast)
 */
export function lerpMorphTarget(model: THREE.Object3D, targetName: string, value: number, speed: number = 0.2): void {
  if (!model) {
    console.error(`🚨 [MorphTarget] lerpMorphTarget BLOCKED: model is null`);
    return;
  }
  
  let foundMeshes = 0;
  let appliedTargets = 0;
  
  // Apply to ALL SkinnedMesh objects that have the morph target
  model.traverse((child) => {
    if ((child as any).isSkinnedMesh && (child as any).morphTargetDictionary) {
      foundMeshes++;
      const skinnedMesh = child as THREE.SkinnedMesh;
      const index = skinnedMesh.morphTargetDictionary[targetName];
      
      if (index !== undefined && skinnedMesh.morphTargetInfluences) {
        const currentValue = skinnedMesh.morphTargetInfluences[index];
        const newValue = THREE.MathUtils.lerp(currentValue, value, speed);
        skinnedMesh.morphTargetInfluences[index] = newValue;
        appliedTargets++;
        
        // Only log significant viseme changes to reduce spam
        if (targetName.includes('viseme_') && Math.abs(currentValue - newValue) > 0.01) {
          console.log(`[MorphTarget] 👄 ${targetName}: ${currentValue.toFixed(3)} → ${newValue.toFixed(3)} (target: ${value})`);
        }
      } else if (targetName.includes('viseme_')) {
        console.warn(`🚨 [MorphTarget] VISEME NOT FOUND: ${targetName} in mesh with ${Object.keys(skinnedMesh.morphTargetDictionary).length} targets`);
      }
    }
  });
}

/**
 * ⚡ INSTANT: Direct morph target assignment with ZERO delay for precise timing
 * @param model - The 3D model object
 * @param targetName - Viseme name (e.g. 'viseme_aa')
 * @param value - Exact intensity (0.0 to 1.0)
 */
export function setMorphTargetDirect(model: THREE.Object3D, targetName: string, value: number): void {
  if (!model) {
    console.error(`❌ [setMorphTargetDirect] BLOCKED: ${targetName}=${value} - model is null`);
    return;
  }
  
  console.log(`🎯 [setMorphTargetDirect] STARTING: ${targetName} = ${value.toFixed(3)}`);
  
  // Apply to ALL SkinnedMesh objects for consistent application
  let appliedCount = 0;
  
  model.traverse((child) => {
    if ((child as any).isSkinnedMesh && (child as any).morphTargetDictionary) {
      const skinnedMesh = child as THREE.SkinnedMesh;
      const index = skinnedMesh.morphTargetDictionary[targetName];
      
      if (index !== undefined && skinnedMesh.morphTargetInfluences) {
        const previousValue = skinnedMesh.morphTargetInfluences[index];
        skinnedMesh.morphTargetInfluences[index] = value;
        appliedCount++;
        
        // Log significant changes
        if (Math.abs(previousValue - value) > 0.1) {
          console.log(`🚨 [DIRECT] Set ${targetName}[${index}]: ${previousValue.toFixed(2)} → ${value.toFixed(2)}`);
        }
      }
    }
  });
  
  if (appliedCount === 0 && targetName.includes('viseme_')) {
    console.warn(`⚠️ [DIRECT] ${targetName} not found in any mesh!`);
  }
  
  console.log(`✅ [setMorphTargetDirect] COMPLETED: ${targetName} = ${value.toFixed(3)} applied to ${appliedCount} meshes`);
}

/**
 * 🎯 ENHANCED: Smooth morph target transitions with professional smoothFactor
 * @param model - The 3D model object
 * @param targetName - Viseme name
 * @param targetValue - Target intensity
 * @param smoothFactor - Professional smooth factor from viseme mapping
 */
export function setMorphTargetSmooth(model: THREE.Object3D, targetName: string, targetValue: number, smoothFactor: number): void {
  if (!model) {
    return;
  }
  
  model.traverse((child) => {
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
          console.log(`[MorphTarget] 🎯 Smooth Applied '${targetName}': ${currentValue.toFixed(2)} → ${newValue.toFixed(2)} (smooth: ${smoothFactor})`);
        }
      }
    }
  });
}

/**
 * Reset all Ready Player Me visemes to neutral state
 * @param model - The 3D model object
 * @param neutralValue - Value to set for silence viseme (default 0.1)
 */
export function resetAllVisemes(model: THREE.Object3D, neutralValue: number = 0.1): void {
  const allVisemes = [
    'viseme_sil', 'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U',
    'viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD', 'viseme_kk',
    'viseme_CH', 'viseme_SS', 'viseme_nn', 'viseme_RR'
  ];
  
  allVisemes.forEach(viseme => {
    if (viseme === 'viseme_sil') {
      setMorphTargetDirect(model, viseme, neutralValue);
    } else {
      setMorphTargetDirect(model, viseme, 0.0);
    }
  });
}

/**
 * Get conflicting visemes to avoid mouth shape conflicts
 * @param visemeName - Current viseme name
 * @returns Array of conflicting viseme names
 */
export function getConflictingVisemes(visemeName: string): string[] {
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
}
```

### C. Timing-Based Viseme Scheduler (`visemeScheduler.ts`)

```typescript
/**
 * Professional timing-based viseme scheduler for synchronized lip sync
 * Handles Azure TTS offset timing for perfect synchronization
 */

export interface ScheduledViseme {
  id: number;
  visemeName: string;
  intensity: number;
  offset: number;
  timeout: NodeJS.Timeout;
}

export class VisemeScheduler {
  private audioStartTime: number | null = null;
  private scheduledVisemes: Map<number, NodeJS.Timeout> = new Map();
  private activeViseme: { name: string; intensity: number; timestamp: number } | null = null;
  private playedVisemes: Array<{
    azureId: number;
    readyPlayerMe: string;
    intensity: number;
    timestamp: number;
    offset: number;
  }> = [];

  /**
   * Set the audio start time for timing calculations
   * @param startTime - Timestamp when audio actually starts playing
   */
  setAudioStartTime(startTime: number): void {
    this.audioStartTime = startTime;
    console.log(`⏰ [VisemeScheduler] Audio start time set: ${startTime}`);
  }

  /**
   * Schedule a viseme to be applied at the correct time based on audio offset
   * @param visemeId - Azure viseme ID
   * @param offset - Offset in milliseconds from audio start
   * @param applyVisemeCallback - Function to actually apply the viseme
   */
  scheduleViseme(
    visemeId: number,
    offset: number,
    applyVisemeCallback: (visemeId: number, offset: number) => void
  ): void {
    console.log(`⏰ [VisemeScheduler] Scheduling viseme ${visemeId} for ${offset}ms after audio start`);

    const scheduleApplication = () => {
      const now = Date.now();
      
      // If audio hasn't started yet, wait for it
      if (!this.audioStartTime) {
        console.log(`⏰ [VisemeScheduler] Audio not started yet - waiting for audio start`);
        
        // Check every 50ms for audio start
        const waitForAudio = setInterval(() => {
          if (this.audioStartTime) {
            clearInterval(waitForAudio);
            const delayMs = Math.max(0, (this.audioStartTime + offset) - Date.now());
            console.log(`⏰ [VisemeScheduler] Audio started! Scheduling viseme ${visemeId} in ${delayMs}ms`);
            
            const timeout = setTimeout(() => {
              applyVisemeCallback(visemeId, offset);
            }, delayMs);
            
            this.scheduledVisemes.set(visemeId, timeout);
          }
        }, 50);
        
        return;
      }
      
      // Audio already started - calculate delay from now
      const delayMs = Math.max(0, (this.audioStartTime + offset) - now);
      console.log(`⏰ [VisemeScheduler] Scheduling viseme ${visemeId} in ${delayMs}ms`);
      
      const timeout = setTimeout(() => {
        applyVisemeCallback(visemeId, offset);
      }, delayMs);
      
      this.scheduledVisemes.set(visemeId, timeout);
    };

    scheduleApplication();
  }

  /**
   * Cancel all scheduled visemes (for TTS stop/restart)
   */
  cancelAllScheduledVisemes(): void {
    console.log(`🚫 [VisemeScheduler] Cancelling ${this.scheduledVisemes.size} scheduled visemes`);
    this.scheduledVisemes.forEach((timeout) => {
      clearTimeout(timeout);
    });
    this.scheduledVisemes.clear();
    this.audioStartTime = null;
  }

  /**
   * Track a played viseme for summary logging
   */
  trackPlayedViseme(azureId: number, readyPlayerMe: string, intensity: number, offset: number): void {
    this.playedVisemes.push({
      azureId,
      readyPlayerMe,
      intensity,
      timestamp: Date.now(),
      offset
    });
  }

  /**
   * Display complete played viseme sequence when TTS completes
   */
  displayVisemeSummary(): void {
    if (this.playedVisemes.length === 0) {
      console.log('📊 [VisemeScheduler] No visemes were played in this TTS session');
      return;
    }

    console.log(`🎭 [VisemeScheduler] ====== TTS VISEME SUMMARY ======`);
    console.log(`📊 [VisemeScheduler] Total visemes played: ${this.playedVisemes.length}`);
    console.log(`⏱️  [VisemeScheduler] Session duration: ${this.playedVisemes[this.playedVisemes.length - 1].offset - this.playedVisemes[0].offset}ms`);
    
    // Create summary table
    console.log(`🗺️  [VisemeScheduler] COMPLETE VISEME MAPPING SEQUENCE:`);
    this.playedVisemes.forEach((viseme, index) => {
      const phonemeMap: {[key: number]: string} = {
        0: 'silence', 1: 'æ,ə,ʌ', 2: 'ɑ', 3: 'ɔ', 4: 'ɛ,ʊ', 5: 'ɝ', 
        6: 'j,i,ɪ', 7: 'w,u', 8: 'o', 9: 'aʊ', 10: 'ɔɪ', 11: 'aɪ', 
        12: 'h', 13: 'ɹ', 14: 'l', 15: 's,z', 16: 'ʃ,tʃ,dʒ,ʒ', 17: 'ð', 
        18: 'f,v', 19: 'd,t,n,θ', 20: 'k,g,ŋ', 21: 'p,b,m'
      };
      const phoneme = phonemeMap[viseme.azureId] || 'unknown';
      console.log(`   ${index + 1}. Azure ID ${viseme.azureId} (${phoneme}) → "${viseme.readyPlayerMe}" (${(viseme.intensity * 100).toFixed(0)}%) @ ${viseme.offset.toFixed(0)}ms`);
    });
    
    // Summary statistics
    const uniqueVisemes = Array.from(new Set(this.playedVisemes.map(v => v.readyPlayerMe)));
    console.log(`🎯 [VisemeScheduler] Unique Ready Player Me visemes used: ${uniqueVisemes.join(', ')}`);
    console.log(`🎭 [VisemeScheduler] ====== END VISEME SUMMARY ======`);
  }

  /**
   * Clear played visemes history
   */
  clearHistory(): void {
    this.playedVisemes = [];
  }

  /**
   * Get current scheduler state for debugging
   */
  getDebugInfo(): object {
    return {
      audioStartTime: this.audioStartTime,
      scheduledCount: this.scheduledVisemes.size,
      playedCount: this.playedVisemes.length,
      activeViseme: this.activeViseme
    };
  }
}
```

### D. Lip Sync Debugger (`lipSyncDebugger.ts`)

```typescript
// Ready Player Me Lip Sync Debugger
// This tool helps diagnose lip sync issues
import * as THREE from 'three';

export class LipSyncDebugger {
  private model: THREE.Object3D | null = null;
  private foundMorphTargets: Map<string, { index: number; mesh: THREE.SkinnedMesh }> = new Map();

  constructor(model: THREE.Object3D | null) {
    this.model = model;
    this.scanForMorphTargets();
  }

  // Scan the model for all available morph targets
  scanForMorphTargets() {
    if (!this.model) {
      console.error('[LipSyncDebugger] No model provided');
      return;
    }

    //console.log('[LipSyncDebugger] 🔍 Scanning model for morph targets...');
    this.foundMorphTargets.clear();

    this.model.traverse((child) => {
      if ((child as any).isSkinnedMesh && (child as any).morphTargetDictionary) {
        const skinnedMesh = child as THREE.SkinnedMesh;
        const morphTargets = skinnedMesh.morphTargetDictionary;
        
        // console.log(`[LipSyncDebugger] Found mesh with morph targets: ${child.name}`);
        // console.log('[LipSyncDebugger] Available morph targets:', Object.keys(morphTargets));

        // Store all found morph targets
        Object.entries(morphTargets).forEach(([name, index]) => {
          this.foundMorphTargets.set(name, { index: index as number, mesh: skinnedMesh });
        });
      }
    });

    //console.log(`[LipSyncDebugger] Total morph targets found: ${this.foundMorphTargets.size}`);
  }

  // Check if Ready Player Me visemes exist on the model
  checkReadyPlayerMeVisemes(): { missing: string[], found: string[], total: number } {
    const requiredVisemes = [
      "viseme_sil", "viseme_PP", "viseme_FF", "viseme_TH", "viseme_DD", 
      "viseme_kk", "viseme_CH", "viseme_SS", "viseme_nn", "viseme_RR", "viseme_aa",
      "viseme_E", "viseme_I", "viseme_O", "viseme_U"
    ];

    const found: string[] = [];
    const missing: string[] = [];

    requiredVisemes.forEach(viseme => {
      if (this.foundMorphTargets.has(viseme)) {
        found.push(viseme);
      } else {
        missing.push(viseme);
      }
    });

    // console.log('[LipSyncDebugger] ✅ Ready Player Me Viseme Check Results:');
    // console.log(`[LipSyncDebugger] Found: ${found.length}/${requiredVisemes.length} visemes`);
    // console.log('[LipSyncDebugger] Missing visemes:', missing);
    // console.log('[LipSyncDebugger] Found visemes:', found);

    return { missing, found, total: requiredVisemes.length };
  }

  // Test a specific viseme by setting it to max value
  testViseme(visemeName: string, intensity: number = 1.0): boolean {
    const target = this.foundMorphTargets.get(visemeName);
    if (!target) {
      //console.error(`[LipSyncDebugger] ❌ Viseme '${visemeName}' not found on model`);
      return false;
    }

    const { mesh, index } = target;
    if (mesh.morphTargetInfluences && mesh.morphTargetInfluences[index] !== undefined) {
      // Reset all other visemes to 0 first
      this.resetAllVisemes();
      
      // Set the target viseme
      mesh.morphTargetInfluences[index] = intensity;
      //console.log(`[LipSyncDebugger] ✅ Testing '${visemeName}' at intensity ${intensity}`);
      return true;
    }

    //console.error(`[LipSyncDebugger] ❌ Could not apply '${visemeName}' - morph target influences not available`);
    return false;
  }

  // Reset all visemes to 0
  resetAllVisemes() {
    this.foundMorphTargets.forEach((target, visemeName) => {
      const { mesh, index } = target;
      if (mesh.morphTargetInfluences && mesh.morphTargetInfluences[index] !== undefined) {
        mesh.morphTargetInfluences[index] = 0.0;
      }
    });
  }

  // Run a sequence of viseme tests
  async runVisemeSequence(): Promise<void> {
    const testVisemes = [
      { name: "viseme_sil", intensity: 0.0, delay: 1000 },
      { name: "viseme_aa", intensity: 1.0, delay: 1000 },
      { name: "viseme_E", intensity: 0.8, delay: 1000 },
      { name: "viseme_I", intensity: 0.6, delay: 1000 },
      { name: "viseme_O", intensity: 0.9, delay: 1000 },
      { name: "viseme_U", intensity: 0.8, delay: 1000 },
      { name: "viseme_PP", intensity: 1.0, delay: 1000 },
      { name: "viseme_sil", intensity: 0.0, delay: 500 }
    ];

    console.log('[LipSyncDebugger] 🎬 Starting viseme sequence test...');
    
    for (const test of testVisemes) {
      this.testViseme(test.name, test.intensity);
      await new Promise(resolve => setTimeout(resolve, test.delay));
    }
    
    console.log('[LipSyncDebugger] ✅ Viseme sequence test completed');
  }

  // Generate a comprehensive report
  generateReport(): string {
    const visemeCheck = this.checkReadyPlayerMeVisemes();
    
    let report = '\n=== READY PLAYER ME LIP SYNC DIAGNOSTIC REPORT ===\n\n';
    
    report += `🎯 MODEL ANALYSIS:\n`;
    report += `   Total morph targets found: ${this.foundMorphTargets.size}\n`;
    report += `   Ready Player Me visemes found: ${visemeCheck.found.length}/${visemeCheck.total}\n`;
    report += `   Completion rate: ${Math.round((visemeCheck.found.length / visemeCheck.total) * 100)}%\n\n`;
    
    if (visemeCheck.missing.length > 0) {
      report += `❌ MISSING VISEMES:\n`;
      visemeCheck.missing.forEach(missing => {
        report += `   - ${missing}\n`;
      });
      report += '\n';
    }
    
    if (visemeCheck.found.length > 0) {
      report += `✅ FOUND VISEMES:\n`;
      visemeCheck.found.forEach(found => {
        report += `   - ${found}\n`;
      });
      report += '\n';
    }
    
    report += `🔍 ALL AVAILABLE MORPH TARGETS:\n`;
    Array.from(this.foundMorphTargets.keys()).sort().forEach(target => {
      report += `   - ${target}\n`;
    });
    
    return report;
  }
}

// Export the debugger for easy import
export default LipSyncDebugger;
```

---

## 🧪 Testing Functions Package

### Window-Exposed Test Functions

```typescript
/**
 * Global window testing functions for development and debugging
 * Add these to your window object for easy testing
 */

// Basic viseme testing
export function setupWindowTestFunctions(
  model: THREE.Object3D,
  setMorphTargetDirect: (name: string, value: number) => void,
  scheduler: VisemeScheduler
) {
  if (typeof window !== 'undefined') {
    // Basic viseme tests
    (window as any).testViseme = (visemeName: string = 'viseme_aa', intensity: number = 1.0) => {
      console.log(`🚨 [TEST] Testing ${visemeName} with intensity ${intensity}`);
      setMorphTargetDirect(visemeName, intensity);
    };

    (window as any).testMouthOpen = () => setMorphTargetDirect('viseme_aa', 1.0);
    (window as any).testMouthClosed = () => setMorphTargetDirect('viseme_sil', 1.0);
    (window as any).testMouthPP = () => setMorphTargetDirect('viseme_PP', 1.0);

    // Advanced viseme switching test
    (window as any).testVisemeSwitch = () => {
      console.log('🚨 [TEST] Testing viseme switching: PP ↔ I');
      let isI = false;
      const switchInterval = setInterval(() => {
        if (isI) {
          setMorphTargetDirect('viseme_I', 0.0);
          setMorphTargetDirect('viseme_PP', 0.8);
          console.log('🚨 [TEST] Switched to viseme_PP (closed bilabial)');
        } else {
          setMorphTargetDirect('viseme_PP', 0.0);
          setMorphTargetDirect('viseme_I', 0.7);
          console.log('🚨 [TEST] Switched to viseme_I (high front vowel)');
        }
        isI = !isI;
      }, 500);
      
      // Stop after 10 seconds
      setTimeout(() => {
        clearInterval(switchInterval);
        setMorphTargetDirect('viseme_PP', 0.0);
        setMorphTargetDirect('viseme_I', 0.0);
        setMorphTargetDirect('viseme_sil', 0.1);
        console.log('🚨 [TEST] Viseme switching test completed');
      }, 10000);
    };

    // Test all visemes sequentially
    (window as any).testAllVisemes = () => {
      console.log('🧪 Testing all visemes...');
      
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
          visemes.forEach(v => setMorphTargetDirect(v, 0.0));
          
          // Apply current viseme with MAXIMUM intensity
          setMorphTargetDirect(viseme, 1.0);
          
          currentIndex++;
          setTimeout(testNextViseme, 1500); // 1.5 seconds per viseme
        } else {
          console.log('✅ All visemes tested! Resetting to silence...');
          visemes.forEach(v => setMorphTargetDirect(v, 0.0));
          setMorphTargetDirect('viseme_sil', 0.3);
        }
      }
      
      testNextViseme();
    };

    // Scheduler debugging
    (window as any).showVisemeSummary = () => {
      scheduler.displayVisemeSummary();
      scheduler.clearHistory();
    };

    (window as any).cancelScheduledVisemes = () => {
      scheduler.cancelAllScheduledVisemes();
      console.log('🚫 [DEBUG] Manually cancelled all scheduled visemes');
    };

    (window as any).showSchedulerInfo = () => {
      console.log('⏰ [SCHEDULER DEBUG]', scheduler.getDebugInfo());
    };

    // Mouth movement simulation
    (window as any).testMouthMovement = () => {
      console.log('🧪 Starting realistic speech mouth movement loop');
      
      const speechShapes = [
        { name: 'H', viseme: 'viseme_aa', intensity: 0.9, duration: 300 },
        { name: 'E', viseme: 'viseme_E', intensity: 0.9, duration: 200 },
        { name: 'L', viseme: 'viseme_DD', intensity: 0.8, duration: 150 },
        { name: 'L', viseme: 'viseme_DD', intensity: 0.8, duration: 150 },
        { name: 'O', viseme: 'viseme_O', intensity: 1.0, duration: 300 },
        { name: 'pause', viseme: 'viseme_sil', intensity: 0.3, duration: 200 },
        { name: 'W', viseme: 'viseme_U', intensity: 0.9, duration: 200 },
        { name: 'OR', viseme: 'viseme_aa', intensity: 0.9, duration: 200 },
        { name: 'L', viseme: 'viseme_DD', intensity: 0.8, duration: 150 },
        { name: 'D', viseme: 'viseme_DD', intensity: 0.8, duration: 150 }
      ];
      
      let currentIndex = 0;
      
      function playNextShape() {
        if (currentIndex < speechShapes.length) {
          const shape = speechShapes[currentIndex];
          console.log(`👄 Speaking: ${shape.name} (${shape.viseme}) - ${shape.intensity}`);
          
          // Reset all visemes first
          const allVisemes = ['viseme_sil', 'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U', 'viseme_PP', 'viseme_DD'];
          allVisemes.forEach(v => setMorphTargetDirect(v, 0.0));
          
          // Apply current mouth shape
          setMorphTargetDirect(shape.viseme, shape.intensity);
          
          currentIndex++;
          setTimeout(playNextShape, shape.duration);
        } else {
          console.log('✅ Speech simulation completed');
          setMorphTargetDirect('viseme_sil', 0.3);
        }
      }
      
      playNextShape();
    };

    console.log('🚨 [TESTING] MANUAL TESTS AVAILABLE:');
    console.log('  window.testMouthOpen() - Test mouth opening');
    console.log('  window.testMouthClosed() - Test mouth closing'); 
    console.log('  window.testMouthPP() - Test P/B/M sounds');
    console.log('  window.testViseme("viseme_name", intensity) - Test any viseme');
    console.log('  window.testVisemeSwitch() - Test PP ↔ I switching');
    console.log('  window.testAllVisemes() - Test all visemes sequentially');
    console.log('  window.testMouthMovement() - Test realistic speech simulation');
    console.log('  window.showVisemeSummary() - Show TTS viseme summary');
    console.log('  window.showSchedulerInfo() - Show scheduler debug info');
    console.log('  window.cancelScheduledVisemes() - Cancel all scheduled visemes');
  }
}
```

---

## 🎧 Azure TTS Integration

### Azure Speech SDK TTS with Real-Time Visemes

```typescript
// Azure TTS API integration with Speech SDK for real-time visemes
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

export interface VisemeData {
  offset: number;
  duration: number;
  visemeId: number;
}

// Speech SDK TTS with direct viseme application
export async function azureSpeechSDKTTS(
  text: string,
  onAudioChunk: (audioData: Uint8Array, isFirstChunk: boolean) => void,
  onDirectViseme?: (visemeId: number, offset: number) => void,
  onComplete?: () => void,
  onError?: (error: string) => void,
  signal?: AbortSignal,
  voice: string = 'en-US-DavisNeural',
  speed: number = 1.0
): Promise<void> {
  const speechKey = process.env.NEXT_PUBLIC_AZURE_SPEECH_KEY;
  const speechRegion = process.env.NEXT_PUBLIC_AZURE_SPEECH_REGION;
  
  if (!speechKey || !speechRegion) {
    const error = '[Speech SDK] Azure Speech credentials not found';
    console.error(error);
    if (onError) onError(error);
    return;
  }

  console.log('[Speech SDK] 🎤 Initializing Azure Speech SDK TTS...');

  return new Promise((resolve, reject) => {
    let speechSynthesizer: sdk.SpeechSynthesizer | null = null;

    try {
      // Create speech config
      const speechConfig = sdk.SpeechConfig.fromSubscription(speechKey, speechRegion);
      speechConfig.speechSynthesisVoiceName = voice;
      speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3;

      // Create the synthesizer
      speechSynthesizer = new sdk.SpeechSynthesizer(speechConfig, null);

      // Track viseme sequence for debugging
      let visemeSequence: Array<{id: number, offset: number}> = [];
      
      // Official Azure viseme ID reference with IPA phonemes
      const azureVisemeReference: {[key: number]: string} = {
        0: 'silence', 1: 'æ,ə,ʌ', 2: 'ɑ', 3: 'ɔ', 4: 'ɛ,ʊ', 5: 'ɝ', 
        6: 'j,i,ɪ', 7: 'w,u', 8: 'o', 9: 'aʊ', 10: 'ɔɪ', 11: 'aɪ', 
        12: 'h', 13: 'ɹ', 14: 'l', 15: 's,z', 16: 'ʃ,tʃ,dʒ,ʒ', 17: 'ð', 
        18: 'f,v', 19: 'd,t,n,θ', 20: 'k,g,ŋ', 21: 'p,b,m'
      };

      // 🎯 AZURE TTS INTEGRATION: Real-time viseme callback
      speechSynthesizer.visemeReceived = (sender, e) => {
        if (onDirectViseme) {
          // Convert audio offset from 100-nanosecond units to milliseconds
          const offsetMs = e.audioOffset / 10000;
          
          // Track viseme in sequence
          visemeSequence.push({id: e.visemeId, offset: offsetMs});
          
          // 🚨 DETAILED AZURE VISEME LOGGING
          const phoneme = azureVisemeReference[e.visemeId] || 'unknown';
          console.log(`🔥 [Azure Speech SDK] VISEME: ID=${e.visemeId} (${phoneme}) at ${offsetMs.toFixed(1)}ms`);
          
          // 🚀 DIRECT: Pass viseme immediately for perfect sync
          onDirectViseme(e.visemeId, offsetMs);
        }
      };

      // Set up synthesis completed handler
      speechSynthesizer.synthesisCompleted = (sender, e) => {
        console.log('[Speech SDK] ✅ Synthesis completed');
        
        if (e.result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          // Get the complete audio data
          const audioData = new Uint8Array(e.result.audioData);
          console.log('[Speech SDK] Audio data received:', audioData.length, 'bytes');
          
          // Send the complete audio
          if (onAudioChunk) {
            onAudioChunk(audioData, true);
          }
          
          // Send final silence viseme for natural lip closure
          if (onDirectViseme) {
            console.log('[Speech SDK] 🔒 Sending final silence viseme');
            setTimeout(() => {
              onDirectViseme(0, 0); // Viseme ID 0 is silence
            }, 100);
          }
          
          if (onComplete) {
            onComplete();
          }
          
          resolve();
        }
      };

      // Handle abort signal
      if (signal) {
        signal.addEventListener('abort', () => {
          if (speechSynthesizer) {
            speechSynthesizer.close();
            speechSynthesizer = null;
          }
          reject(new Error('Synthesis aborted'));
        });
      }

      // Create SSML with speed control
      const ssml = `
        <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
          <voice name="${voice}">
            <prosody rate="${speed}">
              ${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
            </prosody>
          </voice>
        </speak>
      `;

      console.log('[Speech SDK] 🚀 Starting synthesis...');
      
      // Start synthesis
      speechSynthesizer.speakSsmlAsync(
        ssml,
        (result) => {
          console.log('[Speech SDK] Synthesis result received');
        },
        (error) => {
          const errorMsg = `[Speech SDK] Synthesis error: ${error}`;
          console.error(errorMsg);
          if (onError) onError(errorMsg);
          reject(new Error(errorMsg));
        }
      );

    } catch (error) {
      const errorMsg = `[Speech SDK] Failed to initialize: ${error}`;
      console.error(errorMsg);
      if (onError) onError(errorMsg);
      reject(new Error(errorMsg));
    }
  });
}
```

---

## 🚀 Usage Examples

### Basic Usage

```typescript
import { 
  lerpMorphTarget, 
  setMorphTargetDirect, 
  resetAllVisemes,
  mapAzureVisemeToReadyPlayerMe,
  convertAzureVisemeToReadyPlayerMe,
  VisemeScheduler,
  LipSyncDebugger,
  setupWindowTestFunctions
} from './lip-sync-package';

// Initialize the system
const scheduler = new VisemeScheduler();
const debugger = new LipSyncDebugger(your3DModel);

// Setup testing functions
setupWindowTestFunctions(your3DModel, 
  (name, value) => setMorphTargetDirect(your3DModel, name, value),
  scheduler
);

// Handle Azure TTS visemes
function handleAzureViseme(visemeId: number, offset: number) {
  const visemeData = mapAzureVisemeToReadyPlayerMe(visemeId);
  
  // Schedule the viseme for perfect timing
  scheduler.scheduleViseme(visemeId, offset, (id, offset) => {
    // Clear conflicting visemes
    resetAllVisemes(your3DModel, 0.0);
    
    // Apply the new viseme
    setMorphTargetDirect(your3DModel, visemeData.morphTarget, visemeData.intensity);
    
    // Track for summary
    scheduler.trackPlayedViseme(id, visemeData.morphTarget, visemeData.intensity, offset);
  });
}

// Start TTS with visemes
azureSpeechSDKTTS(
  "Hello world!",
  (audioData) => { /* play audio */ },
  handleAzureViseme,
  () => { scheduler.displayVisemeSummary(); }
);
```

### Manual Testing

```javascript
// In browser console:
window.testMouthOpen();           // Test mouth opening
window.testAllVisemes();          // Test all visemes sequentially  
window.testVisemeSwitch();        // Test PP ↔ I switching
window.testMouthMovement();       // Test realistic speech simulation
window.showVisemeSummary();       // Show TTS summary
```

---

## 📋 Dependencies

### Required Dependencies

```json
{
  "three": "^0.160.0",
  "microsoft-cognitiveservices-speech-sdk": "^1.33.0"
}
```

### Environment Variables

```env
NEXT_PUBLIC_AZURE_SPEECH_KEY=your_azure_speech_key
NEXT_PUBLIC_AZURE_SPEECH_REGION=your_azure_region
```

---

## 🎯 Ready Player Me Viseme Reference

| Azure ID | IPA Phonemes | Ready Player Me | Description |
|----------|--------------|-----------------|-------------|
| 0 | silence | viseme_sil | Neutral/silence |
| 1 | æ,ə,ʌ | viseme_aa | TRAP, schwa, STRUT vowels |
| 2 | ɑ | viseme_aa | PALM vowel - open back "ah" |
| 3 | ɔ | viseme_O | THOUGHT vowel - "aw" |
| 4 | ɛ,ʊ | viseme_E | DRESS, FOOT vowels |
| 5 | ɝ | viseme_RR | R-colored vowel |
| 6 | j,i,ɪ | viseme_I | y-sound, FLEECE, KIT vowels |
| 7 | w,u | viseme_U | w-sound, GOOSE vowel |
| 8 | o | viseme_O | close-mid back rounded |
| 9 | aʊ | viseme_aa | MOUTH diphthong |
| 10 | ɔɪ | viseme_O | CHOICE diphthong |
| 11 | aɪ | viseme_aa | PRICE diphthong |
| 12 | h | viseme_sil | aspiration - minimal mouth |
| 13 | ɹ | viseme_RR | R sound |
| 14 | l | viseme_DD | L sound - alveolar lateral |
| 15 | s,z | viseme_SS | voiceless/voiced sibilants |
| 16 | ʃ,tʃ,dʒ,ʒ | viseme_CH | SH, CH, J, ZH sounds |
| 17 | ð | viseme_TH | voiced TH as in "the" |
| 18 | f,v | viseme_FF | labiodental fricatives |
| 19 | d,t,n,θ | viseme_DD | alveolar stops, nasal, voiceless TH |
| 20 | k,g,ŋ | viseme_kk | velar stops, NG |
| 21 | p,b,m | viseme_PP | bilabial sounds |

---

## 🔧 Advanced Features

- **Perfect Timing Synchronization**: Uses Azure TTS audio offsets for frame-perfect lip sync
- **Spam Prevention**: Prevents redundant viseme applications within 50ms windows
- **Smooth Transitions**: Professional smooth factors for natural mouth movements
- **Comprehensive Debugging**: Full diagnostics and testing suite
- **Conflict Resolution**: Automatic handling of conflicting mouth shapes
- **Real-time Monitoring**: Live viseme tracking and summary reporting

This package provides everything needed to implement professional-grade lip syncing in any 3D avatar project using Ready Player Me models and Azure TTS.
