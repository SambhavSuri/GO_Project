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
  "0": { "morphTarget": "viseme_sil", "intensity": 0.2, "smoothFactor": 0.3 },      // Silence
  "1": { "morphTarget": "viseme_aa", "intensity": 0.7, "smoothFactor": 0.4 },      // æ, ə, ʌ (TRAP, schwa, STRUT vowels)
  "2": { "morphTarget": "viseme_aa", "intensity": 0.8, "smoothFactor": 0.3 },      // ɑ (PALM vowel - open back "ah")
  "3": { "morphTarget": "viseme_O", "intensity": 0.7, "smoothFactor": 0.3 },       // ɔ (THOUGHT vowel - "aw")
  "4": { "morphTarget": "viseme_E", "intensity": 0.6, "smoothFactor": 0.3 },       // ɛ, ʊ (DRESS, FOOT vowels)
  "5": { "morphTarget": "viseme_RR", "intensity": 0.5, "smoothFactor": 0.4 },      // ɝ (R-colored vowel)
  "6": { "morphTarget": "viseme_I", "intensity": 0.6, "smoothFactor": 0.3 },       // j, i, ɪ (y-sound, FLEECE, KIT vowels)
  "7": { "morphTarget": "viseme_U", "intensity": 0.7, "smoothFactor": 0.4 },       // w, u (w-sound, GOOSE vowel)
  "8": { "morphTarget": "viseme_O", "intensity": 0.6, "smoothFactor": 0.3 },       // o (close-mid back rounded)
  "9": { "morphTarget": "viseme_aa", "intensity": 0.6, "smoothFactor": 0.3 },      // aʊ (MOUTH diphthong)
  "10": { "morphTarget": "viseme_O", "intensity": 0.6, "smoothFactor": 0.3 },      // ɔɪ (CHOICE diphthong)
  "11": { "morphTarget": "viseme_aa", "intensity": 0.7, "smoothFactor": 0.3 },     // aɪ (PRICE diphthong)
  "12": { "morphTarget": "viseme_sil", "intensity": 0.1, "smoothFactor": 0.6 },    // h (aspiration - minimal mouth)
  "13": { "morphTarget": "viseme_RR", "intensity": 0.5, "smoothFactor": 0.5 },     // ɹ (R sound)
  "14": { "morphTarget": "viseme_DD", "intensity": 0.4, "smoothFactor": 0.6 },     // l (L sound - alveolar lateral)
  "15": { "morphTarget": "viseme_SS", "intensity": 0.5, "smoothFactor": 0.6 },     // s, z (voiceless/voiced sibilants)
  "16": { "morphTarget": "viseme_CH", "intensity": 0.6, "smoothFactor": 0.6 },     // ʃ, tʃ, dʒ, ʒ (SH, CH, J, ZH sounds)
  "17": { "morphTarget": "viseme_TH", "intensity": 0.4, "smoothFactor": 0.5 },     // ð (voiced TH as in "the")
  "18": { "morphTarget": "viseme_FF", "intensity": 0.5, "smoothFactor": 0.7 },     // f, v (labiodental fricatives)
  "19": { "morphTarget": "viseme_DD", "intensity": 0.6, "smoothFactor": 0.8 },     // d, t, n, θ (alveolar stops, nasal, voiceless TH)
  "20": { "morphTarget": "viseme_kk", "intensity": 0.5, "smoothFactor": 0.7 },     // k, g, ŋ (velar stops, NG)
  "21": { "morphTarget": "viseme_PP", "intensity": 0.7, "smoothFactor": 0.8 }      // p, b, m (bilabial sounds)
};

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
