# 🎯 Lip Sync Debugging Guide

Your lip sync might not be perfect due to several possible issues. Let's diagnose this systematically.

## 🔍 **Step 1: Automatic Diagnosis**

When your GLB model loads, the debugger automatically runs and logs a detailed report. Check your browser console for:

```
=== READY PLAYER ME LIP SYNC DIAGNOSTIC REPORT ===

🎯 MODEL ANALYSIS:
   Total morph targets found: 52
   Ready Player Me visemes found: 12/14
   Completion rate: 86%

❌ MISSING VISEMES:
   - viseme_TH
   - viseme_kk

✅ FOUND VISEMES:
   - viseme_sil
   - viseme_PP
   - viseme_FF
   ...

💡 POSSIBLE ALTERNATIVES:
   viseme_TH → mouth_th, dental_th
   viseme_kk → mouth_k, velar_k

🔍 ALL AVAILABLE MORPH TARGETS:
   - Blink_L
   - Blink_R
   - mouth_a
   - mouth_e
   ...
```

## 🧪 **Step 2: Manual Testing**

A **"🧪 Test Lip Sync"** button appears on your avatar. Use it to:

1. **Test Individual Visemes**: Click each viseme to see if it works
2. **Run Full Sequence**: Test all visemes automatically  
3. **Adjust Intensity**: Change how strong the viseme appears
4. **Reset**: Clear all visemes

## 🚨 **Common Issues & Solutions**

### **Issue 1: Missing Morph Targets**
**Symptoms**: Console shows "Missing visemes" or morph target warnings
**Solution**: Your Ready Player Me model might not have all required visemes

```bash
# Check if your model was exported with lip sync enabled
Missing visemes: viseme_TH, viseme_kk
```

**Fix**: Re-export your Ready Player Me avatar with lip sync enabled

### **Issue 2: Wrong Morph Target Names**
**Symptoms**: Visemes exist but have different names
**Solution**: Look for alternatives in the diagnostic report

```bash
# Your model might use different naming
💡 POSSIBLE ALTERNATIVES:
   viseme_AA → mouth_a, jaw_open
   viseme_PP → mouth_p, lips_together
```

### **Issue 3: Weak Viseme Intensity**
**Symptoms**: Mouth moves but barely visible
**Solution**: Increase viseme intensity values

```typescript
// In visemeMapper.ts, increase intensity values:
"viseme_AA": 1.5,  // Increase from 1.0 to 1.5
"viseme_PP": 1.2,  // Increase for more visible lip closure
```

### **Issue 4: Timing Problems**
**Symptoms**: Mouth movements don't match audio timing
**Solution**: This indicates estimated viseme timing vs real Azure TTS timing

```bash
# Look for these logs:
[azureTTS] Generated 25 Ready Player Me compatible visemes
# vs
[AzureSpeech] Retrieved 45 real visemes from Azure Speech Services
```

### **Issue 5: Animation Conflicts**
**Symptoms**: Lip sync works during manual testing but not during speech
**Solution**: Other animations might be overriding lip movements

```bash
# Check for conflicting animations:
🎬 Playing animation: talking (synchronized with audio)
👄 Applied 'viseme_AA': 0.00 → 1.00 (but then reset by talking animation)
```

## 🔧 **Step 3: Advanced Debugging**

### **Check Your Model Export Settings**
Your Ready Player Me model must be exported with:
- ✅ **Lip Sync enabled** 
- ✅ **Morph targets included**
- ✅ **GLB format** (not GLTF+BIN)

### **Custom Viseme Mapping**
If your model uses different names, update the mapper:

```typescript
// In lib/visemeMapper.ts, add custom mappings:
export const CUSTOM_VISEME_MAP = {
  "viseme_AA": "mouth_a",      // If your model uses 'mouth_a' instead
  "viseme_PP": "lips_closed",  // If your model uses 'lips_closed'
  // ... add your specific mappings
};
```

### **Real Azure Speech Services**
For perfect timing, set up real Azure Speech Services:

```bash
# Add to .env.local for real viseme timing:
NEXT_PUBLIC_AZURE_SPEECH_KEY=your_speech_key
NEXT_PUBLIC_AZURE_SPEECH_REGION=eastus
```

## ✅ **Step 4: Verification Checklist**

- [ ] **Model Check**: All required visemes found (14/14)
- [ ] **Manual Test**: Visemes work when tested individually  
- [ ] **Intensity**: Visemes are visible (not too weak)
- [ ] **Timing**: Visemes trigger during speech
- [ ] **No Conflicts**: No other animations interfering

## 🎬 **Expected Results**

**✅ Perfect Lip Sync:**
```bash
[VRMAvatar] ✅ All Ready Player Me visemes found on model
👄 Applied 'viseme_AA': 0.00 → 1.00 (speed: 0.2)
👄 Applied 'viseme_PP': 1.00 → 0.00 (speed: 0.3)
```

**❌ Imperfect Lip Sync:**
```bash
[VRMAvatar] ⚠️ Missing Ready Player Me visemes. Lip sync may be imperfect.
[VRMAvatar] Missing visemes: ['viseme_TH', 'viseme_kk']
[VRMAvatar] Morph target 'viseme_AA' not found
```

## 🆘 **Still Having Issues?**

1. **Check Console Logs**: Look for the diagnostic report
2. **Test Manual Visemes**: Use the test panel to verify individual visemes work
3. **Re-export Model**: Ensure your Ready Player Me model has lip sync enabled
4. **Alternative Names**: Look for alternative morph target names in the diagnostic report

The issue is likely either:
- **Model**: Missing morph targets (re-export needed)
- **Naming**: Different morph target names (mapping needed)  
- **Intensity**: Visemes too weak (increase values)
- **Timing**: Estimated vs real Azure Speech timing

Run the diagnostic and manual tests to determine which!
