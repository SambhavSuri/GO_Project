# 🎤 Deepgram Speech-to-Text Setup Guide

## ✅ **Import Issue Fixed**

I've fixed the import issue in your Deepgram service:
- ❌ **Before**: `from deepgram import Deepgram` (wrong)
- ✅ **After**: `from deepgram import DeepgramClient` (correct)

## 🔑 **Set Up Your API Key**

### **Step 1: Get Deepgram API Key**
1. Go to [Deepgram Console](https://console.deepgram.com/)
2. Sign up/login to your account
3. Navigate to "API Keys" section
4. Create a new API key or copy existing one

### **Step 2: Add to Environment Variables**

#### **Option A: Add to `.env` file (Recommended)**
Create/edit `.env` file in your project root:
```bash
# Add this line to your .env file
DEEPGRAM_API_KEY=your_actual_api_key_here
```

#### **Option B: Set Environment Variable (Terminal)**
```bash
# Mac/Linux
export DEEPGRAM_API_KEY="your_actual_api_key_here"

# Windows
set DEEPGRAM_API_KEY=your_actual_api_key_here
```

### **Step 3: Restart Your Server**
After setting the API key, restart your Flask server:
```bash
python3 app.py
```

## ✅ **How to Verify It's Working**

### **Check Server Startup Logs**
You should see:
```
✅ Deepgram service initialized successfully
```

Instead of:
```
⚠️ Deepgram service not configured - using mock responses
```

### **Test Speech-to-Text**
1. Open your app: `http://localhost:5000/`
2. Click the microphone button
3. Speak clearly
4. Check server logs for:
```
✅ Transcription completed successfully: 'your spoken text'
```

Instead of:
```
Mock transcription: Please set DEEPGRAM_API_KEY environment variable
```

## 🐛 **Troubleshooting**

### **Still Getting Mock Responses?**
- ✅ Check your `.env` file has the correct key
- ✅ Restart the server after adding the key
- ✅ Make sure there are no quotes around the key in `.env`

### **Import Errors?**
Make sure you have the Deepgram SDK installed:
```bash
pip install deepgram-sdk
```

### **API Errors?**
- ✅ Verify your API key is valid at Deepgram Console
- ✅ Check you have credits/quota remaining
- ✅ Ensure your key has speech-to-text permissions

## 🎯 **Expected Behavior After Setup**

1. **Voice Input**: Record your voice → Real transcription (not mock)
2. **Chat Response**: Transcribed text → RAG processing → AI response
3. **Avatar Animation**: Thinking → Talking → Idle (synchronized with real speech)

Your speech-to-text will now work with real transcription instead of mock responses!