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
 * 🎯 ENHANCED: Complete Azure TTS to Ready Player Me viseme mapping
 * Professional mapping with precise intensity and smooth factor values
 * Optimized for high-quality real-time lip synchronization
 */
export const READY_PLAYER_ME_VISEME_MAP: ReadyPlayerMeVisemeMap = {
  "0": { "morphTarget": "viseme_sil", "intensity": 1.0, "smoothFactor": 0.2 },
  "1": { "morphTarget": "viseme_PP", "intensity": 0.9, "smoothFactor": 0.2 },
  "2": { "morphTarget": "viseme_FF", "intensity": 0.85, "smoothFactor": 0.2 },
  "3": { "morphTarget": "viseme_TH", "intensity": 0.85, "smoothFactor": 0.25 },
  "4": { "morphTarget": "viseme_DD", "intensity": 0.9, "smoothFactor": 0.25 },
  "5": { "morphTarget": "viseme_kk", "intensity": 0.85, "smoothFactor": 0.25 },
  "6": { "morphTarget": "viseme_CH", "intensity": 0.9, "smoothFactor": 0.25 },
  "7": { "morphTarget": "viseme_SS", "intensity": 0.8, "smoothFactor": 0.3 },
  "8": { "morphTarget": "viseme_nn", "intensity": 0.9, "smoothFactor": 0.25 },
  "9": { "morphTarget": "viseme_RR", "intensity": 0.85, "smoothFactor": 0.25 },
  "10": { "morphTarget": "viseme_aa", "intensity": 1.0, "smoothFactor": 0.2 },
  "11": { "morphTarget": "viseme_E", "intensity": 0.95, "smoothFactor": 0.2 },
  "12": { "morphTarget": "viseme_I", "intensity": 0.95, "smoothFactor": 0.2 },
  "13": { "morphTarget": "viseme_O", "intensity": 0.95, "smoothFactor": 0.2 },
  "14": { "morphTarget": "viseme_U", "intensity": 0.95, "smoothFactor": 0.2 },
  "15": { "morphTarget": "viseme_kk", "intensity": 0.85, "smoothFactor": 0.25 },
  "16": { "morphTarget": "viseme_CH", "intensity": 0.9, "smoothFactor": 0.25 },
  "17": { "morphTarget": "viseme_SS", "intensity": 0.8, "smoothFactor": 0.3 },
  "18": { "morphTarget": "viseme_RR", "intensity": 0.85, "smoothFactor": 0.25 },
  "19": { "morphTarget": "viseme_nn", "intensity": 0.9, "smoothFactor": 0.25 },
  "20": { "morphTarget": "viseme_PP", "intensity": 0.9, "smoothFactor": 0.2 }
};

/**
 * 🎯 ENHANCED: Maps Azure TTS viseme ID to Ready Player Me viseme data
 * @param azureVisemeId - Azure TTS viseme ID (0-20 enhanced range)
 * @returns VisemeMapping with morphTarget, intensity, and smoothFactor
 */
export function mapAzureVisemeToReadyPlayerMe(azureVisemeId: number): VisemeMapping {
  const visemeMapping = READY_PLAYER_ME_VISEME_MAP[azureVisemeId.toString()];
  if (!visemeMapping) {
    console.warn(`[VisemeMapper] Unknown Azure viseme ID: ${azureVisemeId}, falling back to silence. Supported range: 0-20`);
    return { "morphTarget": "viseme_sil", "intensity": 1.0, "smoothFactor": 0.2 };
  }
  return visemeMapping;
}

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
