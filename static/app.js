// Global variables
let socket;
let lookingGlass;
let vrmModel;
let currentAnimation = 'idle';
let isRecording = false;
let mediaRecorder;
let audioChunks = [];
let silenceTimer = null;
let currentTranscription = '';
let isListening = false;
let isConversationMode = false;
let aiSpeaking = false;
let conversationAudio = null;

// DOM elements
const connectionStatus = document.getElementById('connection-status');
const vrmStatus = document.getElementById('vrm-status');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const voiceBtn = document.getElementById('voice-btn');
const voiceStatus = document.getElementById('voice-status');
const lookingGlassDisplay = document.getElementById('looking-glass-display');
const loadingOverlay = document.getElementById('loading-overlay');
const settingsPanel = document.getElementById('settings-panel');
const toggleSettingsBtn = document.getElementById('toggle-settings');

// Quick action buttons
const testRagBtn = document.getElementById('test-rag-btn');
const healthCheckBtn = document.getElementById('health-check-btn');
const clearChatBtn = document.getElementById('clear-chat-btn');

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    initializeSocket();
    initializeLookingGlass();
    initializeVoiceRecognition();
    initializeEventListeners();
    initializeParticleEffects();
    hideLoadingOverlay();
});

// Initialize particle effects
function initializeParticleEffects() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;
    
    // Create floating particles
    for (let i = 0; i < 20; i++) {
        createParticle(particlesContainer);
    }
}

function createParticle(container) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDelay = Math.random() * 3 + 's';
    particle.style.animationDuration = (Math.random() * 3 + 2) + 's';
    container.appendChild(particle);
    
    // Remove particle after animation
    setTimeout(() => {
        if (particle.parentNode) {
            particle.parentNode.removeChild(particle);
            createParticle(container);
        }
    }, 5000);
}

// Socket.IO initialization
function initializeSocket() {
    socket = io();
    
    socket.on('connect', () => {
        console.log('Connected to server');
        updateConnectionStatus('online');
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        updateConnectionStatus('offline');
    });
    
    socket.on('status', (data) => {
        console.log('Status:', data.message);
        addSystemMessage(data.message);
    });
    
    socket.on('response', (data) => {
        console.log('Received response:', data);
        handleAIResponse(data);
    });
    
    socket.on('vrm_listening', (data) => {
        console.log('VRM listening state:', data);
        updateVRMState(data.vrmData);
    });
    
    socket.on('error', (data) => {
        console.error('Error:', data.message);
        addSystemMessage(`Error: ${data.message}`);
    });
}

// Looking Glass initialization
async function initializeLookingGlass() {
    try {
        // Check if Looking Glass Web API is available
        if (typeof LookingGlassWeb !== 'undefined') {
            lookingGlass = new LookingGlassWeb();
            
            // Initialize Looking Glass display
            await lookingGlass.init();
            
            // Load VRM model
            await loadVRMModel();
            
            updateVRMStatus('online');
            socket.emit('vrm_ready');
            
        } else {
            console.warn('Looking Glass Web API not available, using fallback 3D viewer');
            initializeFallback3DViewer();
        }
    } catch (error) {
        console.error('Error initializing Looking Glass:', error);
        initializeFallback3DViewer();
    }
}

// Load VRM model
async function loadVRMModel() {
    try {
        // Check if Three.js and loaders are available
        if (typeof THREE === 'undefined') {
            throw new Error('Three.js not loaded');
        }
        
        if (typeof THREE.GLTFLoader === 'undefined') {
            throw new Error('GLTFLoader not available');
        }
        
        const response = await fetch('/api/vrm-model');
        const vrmData = await response.json();
        
        // Initialize Three.js scene
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.getElementById('looking-glass-display').appendChild(renderer.domElement);
        
        // Load VRM model
        const loader = new THREE.GLTFLoader();
        loader.load(vrmData.modelUrl, (gltf) => {
            vrmModel = gltf.scene;
            scene.add(vrmModel);
            
            // Setup animations
            if (gltf.animations.length > 0) {
                setupVRMAnimations(gltf.animations);
            }
            
            // Position camera
            camera.position.z = 5;
            
            // Animation loop
            function animate() {
                requestAnimationFrame(animate);
                renderer.render(scene, camera);
            }
            animate();
            
        }, undefined, (error) => {
            console.error('Error loading VRM model:', error);
            // Fallback to placeholder model
            createPlaceholderModel(scene);
        });
        
    } catch (error) {
        console.error('Error loading VRM model:', error);
        // Fallback to placeholder model
        initializeFallback3DViewer();
    }
}

// Setup VRM animations
function setupVRMAnimations(animations) {
    if (!vrmModel) return;
    
    const mixer = new THREE.AnimationMixer(vrmModel);
    vrmModel.userData.mixer = mixer;
    
    animations.forEach((clip) => {
        const action = mixer.clipAction(clip);
        if (clip.name === 'idle') {
            action.play();
            currentAnimation = 'idle';
        }
    });
    
    // Animation loop
    function animate() {
        requestAnimationFrame(animate);
        if (mixer) {
            mixer.update(0.016);
        }
    }
    animate();
}

// Update VRM state
function updateVRMState(vrmData) {
    if (!vrmModel) return;
    
    // Update animation
    if (vrmData.animations && vrmData.animations.current) {
        const mixer = vrmModel.userData.mixer;
        if (mixer) {
            mixer.stopAllAction();
            const action = mixer.clipAction(vrmData.animations.current);
            action.play();
            currentAnimation = vrmData.animations.current;
        }
    }
    
    // Update expression
    if (vrmData.expressions && vrmData.expressions.current) {
        updateVRMExpression(vrmData.expressions.current);
    }
}

// Update VRM expression
function updateVRMExpression(expression) {
    if (!vrmModel) return;
    
    // Apply expression to VRM model
    console.log('Updating VRM expression:', expression);
}

// Initialize fallback 3D viewer
function initializeFallback3DViewer() {
    console.log('Initializing fallback 3D viewer');
    
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('looking-glass-display').appendChild(renderer.domElement);
    
    // Create placeholder model
    createPlaceholderModel(scene);
    
    camera.position.z = 5;
    
    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }
    animate();
}

// Create placeholder model
function createPlaceholderModel(scene) {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);
    
    // Animate cube
    function animate() {
        requestAnimationFrame(animate);
        cube.rotation.x += 0.01;
        cube.rotation.y += 0.01;
    }
    animate();
}

// Initialize voice recognition
function initializeVoiceRecognition() {
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            setupMediaRecorder(stream);
        })
        .catch(error => {
            console.error('Error accessing microphone:', error);
            addSystemMessage('Error: Could not access microphone');
        });
}

// Setup media recorder
function setupMediaRecorder(stream) {
    // Try to use WAV format for better Deepgram compatibility
    const options = {
        mimeType: 'audio/wav'
    };
    
    // Fallback to webm if wav is not supported
    if (!MediaRecorder.isTypeSupported('audio/wav')) {
        options.mimeType = 'audio/webm;codecs=opus';
        console.log('WAV format not supported, using WebM with Opus codec');
    } else {
        console.log('Using WAV format for better Deepgram compatibility');
    }
    
    console.log('MediaRecorder options:', options);
    
    mediaRecorder = new MediaRecorder(stream, options);
    
    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            audioChunks.push(event.data);
            console.log(`Audio chunk collected: ${event.data.size} bytes`);
        }
    };
    
    mediaRecorder.onstop = () => {
        if (audioChunks.length > 0) {
            const audioBlob = new Blob(audioChunks, { type: options.mimeType });
            console.log(`Recording complete: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
            sendAudioToServer(audioBlob);
            audioChunks = [];
        }
    };
}

// Toggle voice recording
function toggleVoiceRecording() {
    if (isListening) {
        stopVoiceRecording();
    } else {
        startVoiceRecording();
    }
}

// Start voice recording
function startVoiceRecording() {
    if (!mediaRecorder || isListening) return;
    
    isListening = true;
    isRecording = true;
    currentTranscription = '';
    audioChunks = []; // Clear any previous audio chunks
    
    // Stop any playing AI audio
    if (conversationAudio) {
        conversationAudio.pause();
        conversationAudio = null;
        aiSpeaking = false;
    }
    
    // Update UI
    voiceBtn.classList.add('recording');
    voiceBtn.classList.add('listening');
    voiceStatus.textContent = 'Recording... Click to stop and transcribe';
    
    // Update button text
    const micText = voiceBtn.querySelector('.mic-text');
    const micIcon = voiceBtn.querySelector('.mic-icon i');
    micText.textContent = 'Stop Recording';
    micIcon.className = 'fas fa-stop';
    
    // Notify server
    socket.emit('speech_start');
    
    // Start continuous recording (no time slicing)
    mediaRecorder.start();
    
    console.log('Started continuous voice recording');
}

// Stop voice recording
function stopVoiceRecording() {
    if (!mediaRecorder || !isListening) return;
    
    isListening = false;
    isRecording = false;
    
    // Clear silence timer (if any)
    if (silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
    }
    
    // Update UI to show processing
    voiceBtn.classList.remove('recording');
    voiceBtn.classList.remove('listening');
    voiceBtn.classList.add('processing');
    voiceStatus.textContent = 'Processing audio... Please wait';
    
    // Update button text to show processing
    const micText = voiceBtn.querySelector('.mic-text');
    const micIcon = voiceBtn.querySelector('.mic-icon i');
    micText.textContent = 'Processing...';
    micIcon.className = 'fas fa-spinner fa-spin';
    
    // Disable button during processing
    voiceBtn.disabled = true;
    
    // Stop recording (this will trigger onstop event and send audio for transcription)
    mediaRecorder.stop();
    
    console.log('Stopped voice recording, processing audio...');
}

// Start silence detection (deprecated - kept for compatibility)
function startSilenceDetection() {
    // This function is no longer used in continuous recording mode
    // but kept for compatibility with other parts of the code
    console.log('Silence detection not used in continuous recording mode');
}

// Send audio to server for transcription
async function sendAudioToServer(audioBlob) {
    try {
        const formData = new FormData();
        
        // Determine the correct filename based on the actual audio format
        const isWav = audioBlob.type === 'audio/wav';
        const filename = isWav ? 'recording.wav' : 'recording.webm';
        
        formData.append('audio', audioBlob, filename);
        
        const response = await fetch('/api/speech-to-text', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        // Reset UI after processing
        resetVoiceUI();
        
        if (result.status === 'success') {
            currentTranscription = result.text;
            
            if (currentTranscription && currentTranscription.trim() && 
                !currentTranscription.includes('Error:') && 
                !currentTranscription.includes("couldn't hear anything")) {
                
                // Show transcription result
                addSystemMessage(`🎤 Transcribed: "${currentTranscription}"`);
                addSystemMessage(`🤖 Sending to RAG pipeline...`);
                
                // Send directly to RAG pipeline via chat socket
                sendTranscriptionToRAG(currentTranscription);
                
            } else {
                addSystemMessage('🎤 No speech detected or transcription failed. Please try again.');
            }
        } else {
            addSystemMessage(`🎤 Speech recognition error: ${result.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error sending audio:', error);
        addSystemMessage('🎤 Error processing speech input');
        resetVoiceUI();
    }
}

// Reset voice UI to default state
function resetVoiceUI() {
    // Remove all voice-related classes
    voiceBtn.classList.remove('recording', 'listening', 'processing', 'ai-speaking');
    
    // Reset status
    voiceStatus.textContent = '';
    
    // Reset button text
    const micText = voiceBtn.querySelector('.mic-text');
    const micIcon = voiceBtn.querySelector('.mic-icon i');
    micText.textContent = 'Click to Ask';
    micIcon.className = 'fas fa-question';
    
    // Re-enable button
    voiceBtn.disabled = false;
}

// Initialize event listeners
function initializeEventListeners() {
    // Send button
    sendBtn.addEventListener('click', sendMessage);
    
    // Enter key in input
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Voice button - Click to Ask functionality
    voiceBtn.addEventListener('click', toggleVoiceRecording);
    
    // VRM controls
    document.getElementById('reset-camera').addEventListener('click', resetCamera);
    document.getElementById('toggle-animation').addEventListener('click', toggleAnimation);
    document.getElementById('change-expression').addEventListener('click', changeExpression);
    
    // Settings toggle
    toggleSettingsBtn.addEventListener('click', toggleSettings);
    
    // Quick action buttons
    testRagBtn.addEventListener('click', testRagEndpoint);
    healthCheckBtn.addEventListener('click', performHealthCheck);
    clearChatBtn.addEventListener('click', clearChat);
}

// Quick action functions
async function testRagEndpoint() {
    try {
        const response = await fetch('/api/test-rag');
        const result = await response.json();
        
        if (result.status === 'success') {
            addSystemMessage(`✅ RAG endpoint test successful: ${result.message}`);
        } else {
            addSystemMessage(`❌ RAG endpoint test failed: ${result.message}`);
        }
    } catch (error) {
        addSystemMessage(`❌ Error testing RAG endpoint: ${error.message}`);
    }
}

async function performHealthCheck() {
    try {
        const response = await fetch('/api/health');
        const result = await response.json();
        
        let statusMessage = `🏥 Health Check:\n`;
        statusMessage += `• Server: ${result.status}\n`;
        statusMessage += `• Device: ${result.device}\n`;
        
        if (result.rag_endpoint) {
            statusMessage += `• RAG Endpoint: ${result.rag_endpoint.status}\n`;
            statusMessage += `• RAG URL: ${result.rag_endpoint.url}`;
        }
        
        addSystemMessage(statusMessage);
    } catch (error) {
        addSystemMessage(`❌ Health check failed: ${error.message}`);
    }
}

function clearChat() {
    // Keep only the welcome message
    const welcomeMessage = chatMessages.querySelector('.message.system');
    chatMessages.innerHTML = '';
    if (welcomeMessage) {
        chatMessages.appendChild(welcomeMessage);
    }
    addSystemMessage('🗑️ Chat history cleared');
}

// Send message
function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
    
    // Add user message to chat
    addUserMessage(message);
    
    // Clear input
    chatInput.value = '';
    
    // Send to server
    socket.emit('chat', { content: message });
}

// Send transcription directly to RAG pipeline
function sendTranscriptionToRAG(transcription) {
    // Add user message to chat to show what was transcribed
    addUserMessage(transcription);
    
    // Send directly to RAG pipeline via chat socket
    socket.emit('chat', { content: transcription, source: 'voice_transcription' });
}

// Handle AI response
function handleAIResponse(data) {
    // Show source-specific message
    if (data.source === 'voice_transcription') {
        addSystemMessage('🤖 RAG pipeline response received');
    }
    
    // Add AI message to chat
    addAIMessage(data.content);
    
    // Update VRM state
    if (data.vrmData) {
        updateVRMState(data.vrmData);
    }
    
    // Play audio if available
    if (data.audio) {
        playAudio(data.audio);
    }
}

// Add user message to chat
function addUserMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    messageDiv.innerHTML = `<div class="message-content"><i class="fas fa-user"></i> ${escapeHtml(message)}</div>`;
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

// Add AI message to chat
function addAIMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai';
    messageDiv.innerHTML = `<div class="message-content"><i class="fas fa-robot"></i> ${escapeHtml(message)}</div>`;
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

// Add system message to chat
function addSystemMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system';
    messageDiv.innerHTML = `<div class="message-content"><i class="fas fa-info-circle"></i> ${escapeHtml(message)}</div>`;
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

// Play audio with interruption capability
function playAudio(audioUrl) {
    // Stop any previous audio
    if (conversationAudio) {
        conversationAudio.pause();
        conversationAudio = null;
    }
    
    conversationAudio = new Audio(audioUrl);
    conversationAudio.volume = document.getElementById('volume').value;
    
    // Set speaking state
    aiSpeaking = true;
    
    // Update UI to show AI is speaking
    voiceStatus.textContent = 'AI Speaking... Click to interrupt';
    voiceBtn.classList.add('ai-speaking');
    
    conversationAudio.play().then(() => {
        console.log('AI audio started playing');
    }).catch(error => {
        console.error('Error playing audio:', error);
        aiSpeaking = false;
        resetVoiceUI();
    });
    
    // Listen for audio end
    conversationAudio.onended = () => {
        aiSpeaking = false;
        resetVoiceUI();
        conversationAudio = null;
    };
    
    // Listen for audio pause (interruption)
    conversationAudio.onpause = () => {
        aiSpeaking = false;
        resetVoiceUI();
    };
}

// VRM control functions
function resetCamera() {
    if (lookingGlass && lookingGlass.camera) {
        lookingGlass.camera.position.set(0, 0, 5);
        lookingGlass.camera.lookAt(0, 0, 0);
    }
}

function toggleAnimation() {
    window.open ('http://localhost:5000/testing',"_blank");
    // if (!vrmModel || !vrmModel.userData.mixer) return;
    
    // const mixer = vrmModel.userData.mixer;
    // const actions = mixer._actions;
    
    // if (currentAnimation === 'idle') {
    //     actions.forEach(action => {
    //         if (action._clip.name === 'talk') {
    //             action.play();
    //             currentAnimation = 'talk';
    //         }
    //     });
    // } else {
    //     actions.forEach(action => {
    //         if (action._clip.name === 'idle') {
    //             action.play();
    //             currentAnimation = 'idle';
    //         }
    //     });
    // }
}

function changeExpression() {
    const expressions = ['happy', 'neutral', 'thinking', 'sad'];
    const currentIndex = expressions.indexOf(currentExpression || 'neutral');
    const nextIndex = (currentIndex + 1) % expressions.length;
    currentExpression = expressions[nextIndex];
    
    updateVRMExpression(currentExpression);
}

function updateConnectionStatus(status) {
    const statusElement = document.getElementById('connection-status');
    statusElement.className = `status ${status}`;
    statusElement.innerHTML = `<i class="fas fa-wifi"></i> ${status.charAt(0).toUpperCase() + status.slice(1)}`;
}

function updateVRMStatus(status) {
    const statusElement = document.getElementById('vrm-status');
    statusElement.className = `status ${status}`;
    statusElement.innerHTML = `<i class="fas fa-cube"></i> ${status.charAt(0).toUpperCase() + status.slice(1)}`;
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 500);
    }
}

function toggleSettings() {
    const panel = document.getElementById('settings-panel');
    panel.classList.toggle('open');
} 