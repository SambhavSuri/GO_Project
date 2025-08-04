# Avatar Animation Debug Guide

## ✅ **Implementation Complete!**

I've implemented a complete synchronized avatar animation system with extensive debugging capabilities. Here's how to test and debug it:

## 🔍 **Debugging Features Added**

### 1. **Test Buttons** (in the VRM controls section)
- **Test Thinking** - Manually trigger thinking animation
- **Test Talking** - Manually trigger talking animation + expressions  
- **Test Idle** - Return to idle animation

### 2. **Real-time Status Display**
- Green status bar shows: VRM ✅ | Mixer ✅ | Expressions ✅ | Speaking ❌
- Updates every second with current system state

### 3. **Console Debugging**
- Detailed logs for every animation function call
- WebSocket event debugging
- Function availability checking

## 🧪 **Testing Steps**

### **Step 1: Check System Status**
1. Load the page and wait for VRM to load
2. Look at the green debug status bar
3. Open browser console (F12)
4. Should see: "Running initial animation system debug..."

### **Step 2: Test Manual Animations**
1. Click **"Test Thinking"** button
   - Console should show: "🤔 switchToThinking() called"
   - Avatar should switch to Thinking.fbx animation
2. Click **"Test Talking"** button  
   - Console should show: "🎬🎤 startSynchronizedSpeaking() called"
   - Avatar should start talking.fbx with mouth movements
3. Click **"Test Idle"** button
   - Console should show: "🔇 stopSpeaking() called"
   - Avatar should return to idleMale.fbx

### **Step 3: Test Chat Integration**
1. Send a chat message (type "hello" and hit enter)
2. Watch the console logs:
   ```
   AI started thinking: {...}
   🤔 switchToThinking() called
   🧠 Processing completed, generating speech...
   🎬🎤 startSynchronizedSpeaking() called
   TTS ended, stopping speaking animation: {...}
   🔇 stopSpeaking() called
   ```

## 🐛 **Troubleshooting**

### **If animations don't work:**

#### Check 1: VRM Status
```javascript
// In browser console:
window.debugAnimationSystem()
```
Should show all functions as "function" type.

#### Check 2: Animation Files
Console should show successful animation loading:
```
✅ Animation playing: /static/animations/Thinking.fbx
✅ Animation playing: /static/animations/talking.fbx
✅ Animation playing: /static/animations/idleMale.fbx
```

#### Check 3: WebSocket Events
Console should show these when you send a chat:
```
AI started thinking: {...}
Available animation functions: { startSynchronizedSpeaking: "function", ... }
TTS started, switching to talking animation: {...}
TTS ended, stopping speaking animation: {...}
```

### **Common Issues & Solutions:**

#### ❌ **"switchToThinking not available"**
- **Problem**: VRM functions not loaded
- **Solution**: Wait longer for main.js to load, check network tab for errors

#### ❌ **"No VRM available"** 
- **Problem**: VRM model not loaded
- **Solution**: Check network tab for AvatarSample_C.vrm loading errors

#### ❌ **Animations load but don't play**
- **Problem**: Animation mixer not working
- **Solution**: Check console for FBX loading errors

#### ❌ **No WebSocket events**
- **Problem**: Frontend/backend connection issue  
- **Solution**: Check if backend is emitting events in terminal logs

## 📊 **Expected Flow**

1. **User sends chat** → Thinking animation (Thinking.fbx)
2. **RAG processing** → Still thinking  
3. **TTS ready** → Switch to talking (talking.fbx + face expressions)
4. **TTS playing** → Mouth movements, blinking, hand gestures
5. **TTS ends** → Return to idle (idleMale.fbx)

## 🎯 **Key Console Commands**

```javascript
// Check system status
window.debugAnimationSystem()

// Test individual animations
window.switchToThinking()
window.startSynchronizedSpeaking()  
window.stopSpeaking()

// Check available expressions
window.listExpressions()

// Test specific expression
window.testExpression('aa', 1.0)  // Open mouth
```

## ⚡ **Quick Fix Checklist**

- [ ] VRM model loads successfully (green status)
- [ ] Animation files load without 404 errors
- [ ] Test buttons work manually
- [ ] WebSocket events appear in console during chat
- [ ] Animation functions are available in window object
- [ ] Terminal shows backend events being emitted

## 🚀 **Next Steps**

If manual test buttons work but chat integration doesn't:
1. Check that WebSocket events are being emitted from backend
2. Verify the events reach the frontend
3. Ensure timing between events is correct

The system is now fully instrumented for debugging. Every step of the animation flow will be logged and visible!