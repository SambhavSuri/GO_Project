# Avatar Animation Synchronization System

## Overview

This document describes the complete avatar animation synchronization system that coordinates avatar animations with chat query processing, RAG output, and TTS playback.

## Animation Flow

The system implements the following synchronized animation states:

### 1. **Thinking Animation** 🤔
- **Trigger**: When a chat query is received and RAG processing starts
- **Animation**: `Thinking.fbx`
- **Expression**: "thinking"
- **Duration**: Until RAG processing completes

### 2. **Talking Animation** 🎤
- **Trigger**: When TTS starts playing
- **Animation**: `talking.fbx` with synchronized face expressions
- **Expression**: Dynamic based on text content (happy, sad, neutral)
- **Features**: 
  - Mouth movements (aa, ee expressions)
  - Blinking every 2 seconds
  - Hand movements from talking.fbx
- **Duration**: Until TTS playback ends

### 3. **Idle Animation** 😴
- **Trigger**: When TTS ends or no activity
- **Animation**: `idleMale.fbx`
- **Expression**: "neutral"
- **Duration**: Until next interaction

## Technical Implementation

### Backend (app.py)

#### WebSocket Events Emitted:
```python
# 1. When RAG processing starts
emit('thinking_started', {
    'type': 'thinking_started',
    'vrmData': VRMData(animations={"current": "thinking"})
})

# 2. When RAG completes, before TTS
emit('rag_completed', {
    'type': 'rag_completed',
    'content': response
})

# 3. When TTS starts
emit('tts_started', {
    'type': 'tts_started',
    'vrmData': VRMData(animations={"current": "talking", "type": "speaking"})
})

# 4. When TTS ends (triggered by frontend)
emit('tts_ended', {
    'type': 'tts_ended',
    'vrmData': VRMData(animations={"current": "idle"})
})
```

#### WebSocket Events Received:
```python
@socketio.on('tts_finished')
def handle_tts_finished():
    # Triggered when frontend audio playback ends
    emit('tts_ended', {...})
```

### Frontend (app.js)

#### WebSocket Event Handlers:
```javascript
socket.on('thinking_started', (data) => {
    window.switchToThinking();  // Start thinking animation
});

socket.on('tts_started', (data) => {
    window.startSynchronizedSpeaking();  // Start talking + expressions
});

socket.on('tts_ended', (data) => {
    window.stopSpeaking();  // Return to idle
});
```

#### Audio Synchronization:
```javascript
conversationAudio.onended = () => {
    socket.emit('tts_finished');  // Notify server when audio ends
};
```

### VRM System (main.js)

#### Animation Functions:

```javascript
// Thinking animation
function switchToThinking() {
    playAnimation('/static/animations/Thinking.fbx');
}

// Synchronized speaking (animation + expressions)
function startSynchronizedSpeaking() {
    switchToTalking();  // talking.fbx animation
    startSpeaking();    // Face expressions
}

// Face expressions with mouth/blink sync
function updateSpeakingAnimation(deltaTime) {
    // Mouth movements: aa (open) / ee (closed)
    // Blinking every 2 seconds
    // Continuous during TTS playback
}

// Return to idle
function stopSpeaking() {
    currentVrm.expressionManager.resetValues();
    playAnimation('/static/animations/idleMale.fbx');
}
```

## Animation Files Required

- `/static/animations/Thinking.fbx` - Thinking pose/animation
- `/static/animations/talking.fbx` - Hand movements and body animation for speaking
- `/static/animations/idleMale.fbx` - Idle/neutral pose

## Expression Mappings

The system uses VRM expressions:
- `aa` - Mouth open (for speech)
- `ee` - Mouth closed
- `blink` - Eye blinking
- `happy` - Happy expression
- `sad` - Sad expression
- `thinking` - Contemplative expression

## Complete Flow Example

1. **User sends message** → Avatar continues current animation
2. **RAG processing starts** → `switchToThinking()` → Thinking.fbx
3. **RAG completes** → Prepare for TTS
4. **TTS starts** → `startSynchronizedSpeaking()` → talking.fbx + face expressions
5. **During TTS** → Mouth movements, blinking, hand gestures
6. **TTS ends** → `stopSpeaking()` → Return to idleMale.fbx

## Key Features

✅ **State-based Animation**: Different animations for thinking, speaking, and idle
✅ **TTS Synchronization**: Animations start/stop with actual audio playback
✅ **Face Expressions**: Dynamic mouth movements and blinking during speech
✅ **Hand Movements**: Realistic gestures from talking.fbx during speech
✅ **Emotion-based Expressions**: Happy, sad, neutral based on text content
✅ **Seamless Transitions**: Smooth animation changes between states

## Testing the System

1. Send a chat message
2. Observe: Avatar switches to thinking animation
3. When response arrives: Avatar starts talking animation with face expressions
4. During TTS: Watch mouth movements and hand gestures
5. When audio ends: Avatar returns to idle animation

## Debugging

Use browser console commands:
```javascript
// Test individual animations
window.switchToThinking();
window.startSynchronizedSpeaking();
window.stopSpeaking();

// Test expressions
window.testExpression('aa', 1.0);  // Open mouth
window.listExpressions();         // See available expressions
```

## Dependencies

- Three.js with VRM support
- WebSocket connection (Socket.IO)
- VRM model with expression support
- Animation files (FBX format)
- TTS audio playback capability