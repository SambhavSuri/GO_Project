from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import os
import json
import time
import logging
from datetime import datetime
from dotenv import load_dotenv
from services.deepgram_service import DeepgramService
from services.murf_service import MurfService
from services.rag_service import RAGService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key-here')
CORS(app, origins=["*"])
socketio = SocketIO(app, cors_allowed_origins="*")

# Initialize services
deepgram_service = DeepgramService()
murf_service = MurfService()
rag_service = RAGService()

class VRMData:
    def __init__(self, model_url="", animations=None, expressions=None, position=None, rotation=None, scale=None):
        self.model_url = model_url
        self.animations = animations or {}
        self.expressions = expressions or {}
        self.position = position or [0, 0, 0]
        self.rotation = rotation or [0, 0, 0]
        self.scale = scale or [1, 1, 1]
    
    def to_dict(self):
        return {
            "modelUrl": self.model_url,
            "animations": self.animations,
            "expressions": self.expressions,
            "position": self.position,
            "rotation": self.rotation,
            "scale": self.scale
        }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/testing')
def test():
    return render_template('test.html')

@app.route('/api/health')
def health():
    # Test RAG endpoint connectivity
    rag_status = "connected" if rag_service.test_rag_endpoint() else "disconnected"
    
    return jsonify({
        "status": "healthy",
        "message": "AI VRM Chat Server is running",
        "time": time.strftime("%Y-%m-%d %H:%M:%S"),
        "device": "Looking Glass Go compatible",
        "rag_endpoint": {
            "status": rag_status,
            "url": os.getenv('RAG_ENDPOINT_URL', 'Not configured')
        }
    })

@app.route('/api/test-rag')
def test_rag():
    """Test RAG endpoint connectivity"""
    try:
        if not os.getenv('RAG_ENDPOINT_URL'):
            return jsonify({
                "status": "error",
                "message": "RAG_ENDPOINT_URL not configured"
            }), 400
        
        # Test with a simple query
        test_response = rag_service.process_query("Hello, this is a test query.")
        
        return jsonify({
            "status": "success",
            "message": "RAG endpoint is working",
            "test_response": test_response,
            "endpoint_url": os.getenv('RAG_ENDPOINT_URL')
        })
    
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"RAG endpoint test failed: {str(e)}"
        }), 500

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        message = data.get('message', '')
        
        if not message:
            return jsonify({"error": "No message provided"}), 400
        
        # Process through RAG pipeline
        response = rag_service.process_query(message)
        
        # Convert to speech
        audio_url = murf_service.synthesize_speech(response)
        
        # Generate VRM data
        vrm_data = generate_vrm_response(response)
        
        return jsonify({
            "text": response,
            "audio": audio_url,
            "status": "success",
            "vrm": vrm_data.to_dict()
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/speech-to-text', methods=['POST'])
def speech_to_text():
    start_time = time.time()
    
    try:
        logger.info("=" * 60)
        logger.info("🎤 SPEECH-TO-TEXT ENDPOINT CALLED")
        logger.info("=" * 60)
        logger.info(f"Timestamp: {datetime.now().isoformat()}")
        logger.info(f"Request Method: {request.method}")
        logger.info(f"Content Type: {request.content_type}")
        logger.info(f"Content Length: {request.content_length} bytes")
        
        if 'audio' not in request.files:
            logger.error("No audio file provided in request")
            return jsonify({"error": "No audio file provided"}), 400
        
        audio_file = request.files['audio']
        logger.info(f"Audio File Name: {audio_file.filename}")
        logger.info(f"Audio File Content Type: {audio_file.content_type}")
        
        # Read audio data first (before saving)
        audio_data = audio_file.read()
        logger.info(f"Audio data size: {len(audio_data)} bytes ({len(audio_data)/1024:.2f} KB)")
        
        # Check if audio data is not empty
        if len(audio_data) == 0:
            logger.error("Audio data is empty")
            return jsonify({"error": "Audio data is empty"}), 400
        
        # Save temporary file for backup
        temp_filename = f"temp_audio_{int(time.time())}.wav"
        with open(temp_filename, 'wb') as f:
            f.write(audio_data)
        logger.info(f"Saved temporary file: {temp_filename}")
        
        # Convert speech to text using Deepgram
        logger.info("Calling Deepgram service for transcription...")
        text = deepgram_service.transcribe_audio_bytes(audio_data)
        
        # Clean up
        os.remove(temp_filename)
        logger.info(f"Cleaned up temporary file: {temp_filename}")
        
        end_time = time.time()
        duration = end_time - start_time
        
        logger.info("=" * 60)
        logger.info("✅ SPEECH-TO-TEXT COMPLETED")
        logger.info("=" * 60)
        logger.info(f"Total Duration: {duration:.3f} seconds")
        logger.info(f"Transcription Result: '{text}'")
        logger.info("-" * 60)
        
        # Check if transcription is empty and provide helpful message
        if not text or text.strip() == "":
            logger.warning("Empty transcription received - this might indicate audio quality issues")
            text = "I couldn't hear anything clearly. Please try speaking again."
        
        return jsonify({
            "text": text,
            "status": "success"
        })
    
    except Exception as e:
        end_time = time.time()
        duration = end_time - start_time
        
        logger.error("=" * 60)
        logger.error("❌ SPEECH-TO-TEXT ERROR")
        logger.error("=" * 60)
        logger.error(f"Error Duration: {duration:.3f} seconds")
        logger.error(f"Error Type: {type(e).__name__}")
        logger.error(f"Error Message: {str(e)}")
        logger.error("-" * 60)
        
        return jsonify({"error": str(e)}), 500

@app.route('/api/text-to-speech', methods=['POST'])
def text_to_speech():
    try:
        data = request.get_json()
        text = data.get('text', '')
        voice_id = data.get('voiceId', 'Joanna')
        
        if not text:
            return jsonify({"error": "No text provided"}), 400
        
        # Convert text to speech
        audio_url = murf_service.synthesize_speech(text, voice_id)
        
        return jsonify({
            "audio": audio_url,
            "status": "success"
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/vrm-model')
def get_vrm_model():
    vrm_data = VRMData(
        model_url="/static/models/AvatarSample_C.vrm",
        animations={
            "idle": "/static/animations/idle.fbx",
            "talk": "/static/animations/talk.fbx",
            "listen": "/static/animations/listen.fbx"
        },
        expressions={
            "happy": "happy",
            "neutral": "neutral",
            "thinking": "thinking"
        }
    )
    
    return jsonify(vrm_data.to_dict())

@socketio.on('connect')
def handle_connect():
    logger.info(f"Client connected: {request.sid}")
    emit('status', {'message': 'Connected to AI VRM Chat Server'})

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"Client disconnected: {request.sid}")

@socketio.on('chat')
def handle_chat(data):
    try:
        message = data.get('content', '')
        source = data.get('source', 'text_input')
        
        if source == 'voice_transcription':
            logger.info(f"🎤 Voice transcription received: '{message}'")
            logger.info(f"📡 Sending to RAG pipeline...")
        else:
            logger.info(f"💬 Text chat message received: '{message}'")
        
        # Process through RAG pipeline
        response = rag_service.process_query(message)
        
        if source == 'voice_transcription':
            logger.info(f"🤖 RAG pipeline response for voice input: '{response}'")
        else:
            logger.info(f"🤖 RAG pipeline response for text input: '{response}'")
        
        # Convert to speech
        audio_url = murf_service.synthesize_speech(response)
        
        # Generate VRM data
        vrm_data = generate_vrm_response(response)
        
        # Emit response
        emit('response', {
            'type': 'response',
            'content': response,
            'audio': audio_url,
            'vrmData': vrm_data.to_dict(),
            'source': source
        })
    
    except Exception as e:
        logger.error(f"WebSocket chat error: {str(e)}")
        emit('error', {'message': str(e)})

@socketio.on('vrm_ready')
def handle_vrm_ready():
    logger.info("VRM model loaded on Looking Glass Go device")
    emit('status', {'message': 'VRM model ready'})

@socketio.on('speech_start')
def handle_speech_start():
    logger.info("User started speaking - updating VRM to listening state")
    # User started speaking - update VRM to listening state
    vrm_data = VRMData(
        animations={"current": "listen"},
        expressions={"current": "thinking"}
    )
    
    emit('vrm_listening', {
        'type': 'vrm_listening',
        'vrmData': vrm_data.to_dict()
    })

def generate_vrm_response(text):
    """Generate appropriate VRM animation and expression based on response"""
    # Simple logic to determine animation and expression based on text content
    text_lower = text.lower()
    
    if any(word in text_lower for word in ['happy', 'great', 'wonderful', 'excellent']):
        expression = "happy"
        animation = "talk"
    elif any(word in text_lower for word in ['sorry', 'unfortunately', 'cannot']):
        expression = "sad"
        animation = "talk"
    elif any(word in text_lower for word in ['thinking', 'let me', 'consider']):
        expression = "thinking"
        animation = "idle"
    else:
        expression = "neutral"
        animation = "talk"
    
    return VRMData(
        animations={"current": animation},
        expressions={"current": expression}
    )

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_ENV') == 'development'
    
    print(f"AI VRM Chat Server starting on port {port}")
    print(f"Looking Glass Go device can connect to: ws://localhost:{port}")
    
    # Print RAG endpoint status
    if os.getenv('RAG_ENDPOINT_URL'):
        print(f"✅ RAG endpoint configured: {os.getenv('RAG_ENDPOINT_URL')}")
        if rag_service.test_rag_endpoint():
            print("✅ RAG endpoint is accessible")
        else:
            print("⚠️  RAG endpoint is not accessible")
    else:
        print("⚠️  RAG_ENDPOINT_URL not configured - using fallback responses")
    
    socketio.run(app, host='0.0.0.0', port=port, debug=debug) 