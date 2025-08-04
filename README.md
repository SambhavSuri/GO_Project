# AI VRM Chat - Looking Glass Go

A full-fledged AI-powered holographic chat application that integrates with Looking Glass Go devices for immersive 3D conversations.

## Features

- 🤖 **AI-Powered Conversations**: External RAG (Retrieval-Augmented Generation) endpoint integration
- 🎤 **Speech-to-Text**: OpenAI Whisper integration for voice input
- 🔊 **Text-to-Speech**: Amazon Polly integration for natural voice output
- 🥽 **Looking Glass Go Support**: Native integration with Looking Glass Go holographic display
- 🎭 **VRM Model Animation**: Dynamic 3D character animations and expressions
- 💬 **Real-time Chat**: WebSocket-based real-time communication
- 🎨 **Modern UI**: Beautiful, responsive interface with glassmorphism design

## Technology Stack

### Backend
- **Python Flask**: Web framework for API and WebSocket handling
- **Flask-SocketIO**: Real-time WebSocket communication
- **OpenAI Whisper**: Speech-to-text conversion
- **Amazon Polly**: Text-to-speech synthesis
- **External RAG Endpoint**: Custom RAG pipeline integration

### Frontend
- **JavaScript (ES6+)**: Modern JavaScript with async/await
- **Three.js**: 3D graphics and VRM model rendering
- **Looking Glass Web API**: Native Looking Glass Go integration
- **Socket.IO Client**: Real-time communication
- **Web Audio API**: Audio recording and playback

## Prerequisites

- Python 3.8+
- Looking Glass Go device (optional, fallback 3D viewer available)
- OpenAI API key
- AWS account with Polly access (optional)
- **Your RAG endpoint URL and API key**

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ai-vrm-chat
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your API keys and RAG endpoint
   ```

5. **Create necessary directories**
   ```bash
   mkdir -p static/audio static/models static/animations data
   ```

## Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# Flask Configuration
FLASK_ENV=development
SECRET_KEY=your-secret-key-here
PORT=5000

# OpenAI API (for Whisper)
OPENAI_API_KEY=your-openai-api-key-here

# AWS Configuration (for Polly)
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AWS_REGION=us-east-1

# RAG Endpoint Configuration
RAG_ENDPOINT_URL=https://your-rag-endpoint.com/api/query
RAG_API_KEY=your-rag-api-key-here

# Looking Glass Configuration
LOOKING_GLASS_ENABLED=true
```

### API Keys Setup

1. **OpenAI API Key**
   - Sign up at [OpenAI](https://openai.com)
   - Get your API key from the dashboard
   - Add to `.env` file

2. **AWS Credentials**
   - Create AWS account
   - Create IAM user with Polly permissions
   - Get access key and secret
   - Add to `.env` file

3. **RAG Endpoint Configuration**
   - **RAG_ENDPOINT_URL**: Your RAG endpoint URL (e.g., `https://your-rag-service.com/api/query`)
   - **RAG_API_KEY**: Your RAG endpoint API key (if required)

### RAG Endpoint Integration

The application expects your RAG endpoint to accept POST requests with the following payload:

```json
{
  "query": "User's question",
  "conversation_history": [
    {"role": "user", "content": "Previous message", "timestamp": 1234567890},
    {"role": "assistant", "content": "Previous response", "timestamp": 1234567890}
  ],
  "max_tokens": 500,
  "temperature": 0.7
}
```

And return responses in one of these formats:

```json
{
  "response": "AI response text"
}
```

OR

```json
{
  "answer": "AI response text"
}
```

OR

```json
{
  "text": "AI response text"
}
```

OR

```json
{
  "content": "AI response text"
}
```

OR

```json
{
  "message": "AI response text"
}
```

## Usage

### Starting the Server

```bash
python app.py
```

The server will start on `http://localhost:5000`

### Testing RAG Endpoint

Test your RAG endpoint connectivity:

```bash
# Test via API
curl http://localhost:5000/api/test-rag

# Test health endpoint (includes RAG status)
curl http://localhost:5000/api/health
```

### Looking Glass Go Setup

1. **Connect Looking Glass Go device**
2. **Open the application in your browser**
3. **Allow microphone permissions for voice input**
4. **Start chatting!**

### Features

#### Voice Input
- Click and hold the microphone button to record
- Release to send your voice message
- The AI will transcribe and respond

#### Text Input
- Type your message in the chat input
- Press Enter or click Send
- Get AI response with VRM animation

#### VRM Controls
- **Reset Camera**: Reset the 3D view
- **Toggle Animation**: Switch between idle and talking animations
- **Change Expression**: Cycle through different expressions

#### Settings
- **AI Voice**: Choose different Polly voices
- **Animation Speed**: Adjust VRM animation speed
- **Volume**: Control audio playback volume

## Project Structure

```
ai-vrm-chat/
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── env.example           # Environment variables template
├── README.md            # This file
├── services/            # AI services
│   ├── whisper_service.py    # OpenAI Whisper integration
│   ├── polly_service.py      # Amazon Polly integration
│   └── rag_service.py        # External RAG endpoint integration
├── templates/           # HTML templates
│   └── index.html      # Main application page
├── static/             # Static assets
│   ├── app.js         # Main JavaScript application
│   ├── styles.css     # CSS styles
│   ├── audio/         # Generated audio files
│   ├── models/        # VRM model files
│   └── animations/    # Animation files
└── data/              # Data storage
    └── knowledge_base.json  # RAG knowledge base
```

## API Endpoints

### REST API
- `GET /` - Main application page
- `GET /api/health` - Health check (includes RAG endpoint status)
- `GET /api/test-rag` - Test RAG endpoint connectivity
- `POST /api/chat` - Send chat message
- `POST /api/speech-to-text` - Convert audio to text
- `POST /api/text-to-speech` - Convert text to speech
- `GET /api/vrm-model` - Get VRM model configuration

### WebSocket Events
- `connect` - Client connection
- `chat` - Send chat message
- `vrm_ready` - VRM model loaded
- `speech_start` - User started speaking

## Customization

### Adding VRM Models

1. Place your VRM model in `static/models/`
2. Update the model URL in `app.py`:
   ```python
   vrm_data = VRMData(
       model_url="/static/models/your-model.vrm",
       # ... other configuration
   )
   ```

### Customizing RAG Integration

1. **Modify RAG Service**: Edit `services/rag_service.py` to match your endpoint's API format
2. **Add Custom Headers**: Modify the headers in `_call_rag_endpoint()` method
3. **Change Payload Format**: Update the payload structure in `_call_rag_endpoint()` method
4. **Handle Different Response Formats**: Add new response field mappings

### Adding New Voices

1. Update the voice options in `templates/index.html`
2. The voices will be automatically available in the settings

## VRM Animation Controls

The application includes comprehensive VRM model animation controls that can be accessed through the browser console for testing and debugging purposes.

### Console Commands

#### **Expression Controls**
```javascript
// Test a specific expression
testExpression('aa', 1.0);      // Mouth open
testExpression('ee', 1.0);      // Mouth closed
testExpression('happy', 1.0);   // Happy face
testExpression('sad', 1.0);     // Sad face
testExpression('angry', 1.0);   // Angry face
testExpression('blink', 1.0);   // Blink

// List all available expressions
listExpressions();

// Reset all expressions
currentVrm.expressionManager.resetValues();
```

#### **Animation Switching**
```javascript
// Switch to talking animation (talking.fbx)
switchToTalking();

// Switch to idle animation (idleMale.fbx)
switchToIdle();

// Toggle between talking and idle animations
toggleAnimation();
```

#### **Speaking Animation System**
```javascript
// Start speaking animation (idleMale + mouth movements + blinking)
startSpeaking();

// Stop speaking animation
stopSpeaking();

// Toggle speaking on/off
toggleSpeaking();

// Check if currently speaking
console.log('Is speaking:', isSpeaking);
```

### Animation States

- **`switchToTalking()`**: Pure talking.fbx animation (no facial expressions)
- **`switchToIdle()`**: Pure idleMale.fbx animation (no facial expressions)  
- **`startSpeaking()`**: idleMale.fbx + mouth movements + blinking
- **`stopSpeaking()`**: Stops speaking and resets expressions

### Speaking Animation Features

The speaking animation system includes:
- **Mouth Movements**: Opens and closes mouth in a realistic speaking pattern
- **Eye Blinking**: Natural blinking every 2 seconds
- **Base Animation**: Uses idleMale.fbx for body movement
- **Smooth Transitions**: Mouth opens for 0.3s, closes for 0.2s

### Customization

You can adjust the speaking animation timing by modifying these variables in `main.js`:
```javascript
const mouthOpenTime = 0.3;    // How long mouth stays open
const mouthCloseTime = 0.2;   // How long mouth stays closed
const blinkInterval = 2.0;     // How often to blink
```

### Usage Examples

```javascript
// Start with idle animation
switchToIdle();

// Switch to talking animation
switchToTalking();

// Start speaking with facial expressions
startSpeaking();

// Stop speaking but keep talking animation
stopSpeaking();

// Toggle between animations
toggleAnimation();
```

### Troubleshooting Animation Issues

1. **Expressions not working**
   - Check browser console for errors
   - Verify VRM model has expression support
   - Use `listExpressions()` to see available expressions

2. **Animation not switching**
   - Ensure animation files exist in `/static/animations/`
   - Check file names match: `talking.fbx`, `idleMale.fbx`
   - Verify VRM model is loaded before calling functions

3. **Speaking animation issues**
   - Check if `currentVrm` and `expressionManager` exist
   - Verify expressions like 'aa', 'ee', 'blink' are available
   - Use `listExpressions()` to see what's available

## Troubleshooting

### Common Issues

1. **RAG endpoint not accessible**
   - Check `RAG_ENDPOINT_URL` in `.env` file
   - Verify your RAG endpoint is running and accessible
   - Check API key if required
   - Test with: `curl http://localhost:5000/api/test-rag`

2. **Looking Glass Go not detected**
   - Ensure Looking Glass Go is connected and drivers are installed
   - Check browser console for errors
   - Fallback 3D viewer will be used automatically

3. **Microphone not working**
   - Check browser permissions
   - Ensure HTTPS is used (required for microphone access)
   - Try refreshing the page

4. **API errors**
   - Verify API keys in `.env` file
   - Check API quotas and billing
   - Review server logs for detailed error messages

5. **VRM model not loading**
   - Check file paths in `static/models/`
   - Ensure VRM file is valid
   - Check browser console for loading errors

### Debug Mode

Run with debug mode for detailed logs:

```bash
FLASK_ENV=development python app.py
```

### Testing Setup

Run the comprehensive test suite:

```bash
python test_setup.py
```

## Development

### Adding New Features

1. **New AI Services**: Add to `services/` directory
2. **Frontend Features**: Modify `static/app.js`
3. **UI Changes**: Update `static/styles.css`
4. **API Endpoints**: Add to `app.py`

### Testing

```bash
# Run basic health check
curl http://localhost:5000/api/health

# Test chat endpoint
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, AI!"}'

# Test RAG endpoint
curl http://localhost:5000/api/test-rag
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Looking Glass Factory](https://lookingglassfactory.com/) for the Looking Glass Go technology
- [OpenAI](https://openai.com/) for Whisper API
- [Amazon Web Services](https://aws.amazon.com/) for Polly service
- [Three.js](https://threejs.org/) for 3D graphics
- [Flask](https://flask.palletsprojects.com/) for the web framework

## Support

For issues and questions:
- Check the troubleshooting section
- Review server logs
- Open an issue on GitHub
- Contact the development team

---

**Happy Holographic Chatting! 🥽🤖** 