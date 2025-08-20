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

    console.log('[LipSyncDebugger] 🔍 Scanning model for morph targets...');
    this.foundMorphTargets.clear();

    this.model.traverse((child) => {
      if ((child as any).isSkinnedMesh && (child as any).morphTargetDictionary) {
        const skinnedMesh = child as THREE.SkinnedMesh;
        const morphTargets = skinnedMesh.morphTargetDictionary;
        
        console.log(`[LipSyncDebugger] Found mesh with morph targets: ${child.name}`);
        console.log('[LipSyncDebugger] Available morph targets:', Object.keys(morphTargets));

        // Store all found morph targets
        Object.entries(morphTargets).forEach(([name, index]) => {
          this.foundMorphTargets.set(name, { index: index as number, mesh: skinnedMesh });
        });
      }
    });

    console.log(`[LipSyncDebugger] Total morph targets found: ${this.foundMorphTargets.size}`);
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

    console.log('[LipSyncDebugger] ✅ Ready Player Me Viseme Check Results:');
    console.log(`[LipSyncDebugger] Found: ${found.length}/${requiredVisemes.length} visemes`);
    console.log('[LipSyncDebugger] Missing visemes:', missing);
    console.log('[LipSyncDebugger] Found visemes:', found);

    return { missing, found, total: requiredVisemes.length };
  }

  // Test a specific viseme by setting it to max value
  testViseme(visemeName: string, intensity: number = 1.0): boolean {
    const target = this.foundMorphTargets.get(visemeName);
    if (!target) {
      console.error(`[LipSyncDebugger] ❌ Viseme '${visemeName}' not found on model`);
      return false;
    }

    const { mesh, index } = target;
    if (mesh.morphTargetInfluences && mesh.morphTargetInfluences[index] !== undefined) {
      // Reset all other visemes to 0 first
      this.resetAllVisemes();
      
      // Set the target viseme
      mesh.morphTargetInfluences[index] = intensity;
      console.log(`[LipSyncDebugger] ✅ Testing '${visemeName}' at intensity ${intensity}`);
      return true;
    }

    console.error(`[LipSyncDebugger] ❌ Could not apply '${visemeName}' - morph target influences not available`);
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

  // Check for alternative viseme naming patterns
  findAlternativeVisemes(): { alternatives: string[], suggestions: Map<string, string[]> } {
    const allMorphTargets = Array.from(this.foundMorphTargets.keys());
    const alternatives: string[] = [];
    const suggestions = new Map<string, string[]>();

    // Common alternative naming patterns
    const patterns = [
      // Mouth-related patterns
      /mouth/i, /lip/i, /jaw/i, /chin/i,
      // Phoneme patterns  
      /aa|ah|a_/i, /ee|eh|e_/i, /ii|ih|i_/i, /oo|oh|o_/i, /uu|uh|u_/i,
      /pp|p_|bilabial/i, /ff|f_|labiodental/i, /dd|d_|t_|dental|alveolar/i,
      /ss|s_|sibilant/i, /rr|r_|liquid/i, /kk|k_|g_|velar/i,
      /ch|sh|palatal/i, /th|dental/i, /sil|silence|closed/i
    ];

    allMorphTargets.forEach(target => {
      patterns.forEach(pattern => {
        if (pattern.test(target)) {
          alternatives.push(target);
        }
      });
    });

    // Create suggestions for missing Ready Player Me visemes
    const missingVisemes = this.checkReadyPlayerMeVisemes().missing;
    missingVisemes.forEach(missing => {
      const possibleMatches = allMorphTargets.filter(target => 
        target.toLowerCase().includes(missing.replace('viseme_', '')) ||
        this.getPhoneticSimilarity(missing, target) > 0.5
      );
      if (possibleMatches.length > 0) {
        suggestions.set(missing, possibleMatches);
      }
    });

    console.log('[LipSyncDebugger] 🔍 Alternative viseme patterns found:', alternatives);
    console.log('[LipSyncDebugger] 💡 Suggestions for missing visemes:', Object.fromEntries(suggestions));

    return { alternatives, suggestions };
  }

  // Simple phonetic similarity check
  private getPhoneticSimilarity(viseme: string, target: string): number {
    const visemeKey = viseme.replace('viseme_', '').toLowerCase();
    const targetLower = target.toLowerCase();
    
    // Check for direct substring match
    if (targetLower.includes(visemeKey)) return 1.0;
    
    // Check for phonetic patterns
    const phoneticMap: { [key: string]: string[] } = {
      'aa': ['a', 'ah', 'mouth_a'],
      'e': ['eh', 'e', 'mouth_e'],  
      'i': ['ih', 'ee', 'i', 'mouth_i'],
      'o': ['oh', 'ow', 'o', 'mouth_o'],
      'u': ['oo', 'uh', 'u', 'mouth_u'],
      'pp': ['p', 'b', 'm', 'bilabial'],
      'ff': ['f', 'v', 'labiodental'],
      'dd': ['d', 't', 'n', 'l', 'dental', 'alveolar'],
      'ss': ['s', 'z', 'sibilant'],
      'rr': ['r', 'liquid'],
      'kk': ['k', 'g', 'velar'],
      'ch': ['ch', 'sh', 'j', 'palatal'],
      'th': ['th', 'dental'],
      'sil': ['sil', 'silence', 'closed', 'rest']
    };

    const patterns = phoneticMap[visemeKey] || [];
    return patterns.some(pattern => targetLower.includes(pattern)) ? 0.7 : 0.0;
  }

  // Generate a comprehensive report
  generateReport(): string {
    const visemeCheck = this.checkReadyPlayerMeVisemes();
    const alternatives = this.findAlternativeVisemes();
    
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
    
    if (alternatives.suggestions.size > 0) {
      report += `💡 POSSIBLE ALTERNATIVES:\n`;
      alternatives.suggestions.forEach((suggestions, missing) => {
        report += `   ${missing} → ${suggestions.join(', ')}\n`;
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
