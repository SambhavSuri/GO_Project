# Azure Speech SDK Setup for Real-time TTS + Visemes

## 🎯 Overview

Your app now uses **Azure Speech SDK ONLY** for real-time TTS with genuine viseme events! This provides perfect lip synchronization with your Ready Player Me avatar.

## 🚀 Current Status

- ✅ **Azure Speech SDK installed** (`microsoft-cognitiveservices-speech-sdk`)
- ✅ **Clean Speech SDK-only implementation** (`azureSpeechSDKTTS` function)
- ✅ **Real-time viseme support** (synchronized with audio)
- ✅ **Automatic fallback** to Azure OpenAI TTS with synthetic visemes if Speech SDK credentials not provided
- ✅ **Removed WebSocket implementation** (cleaner, more maintainable code)

## 🔧 Setup Instructions

### 1. Get Azure Speech Services Credentials

1. Go to [Azure Portal](https://portal.azure.com)
2. Create a new **"Speech Services"** resource (not OpenAI)
3. Navigate to **Keys and Endpoint**
4. Copy:
   - **Subscription Key** (Key 1 or Key 2)
   - **Region** (e.g., `eastus`, `westus2`, `westeurope`)

### 2. Add Environment Variables

Create or update your `.env.local` file:

```bash
# Azure Speech SDK (for real-time visemes)
NEXT_PUBLIC_AZURE_SPEECH_KEY=your_azure_speech_subscription_key_here
NEXT_PUBLIC_AZURE_SPEECH_REGION=your_azure_region_here

# Azure OpenAI TTS (fallback - keep your existing key)
NEXT_PUBLIC_AZURE_TTS_API_KEY=your_existing_azure_openai_tts_key_here
```

### 3. Restart Your App

```bash
npm run dev
```

## 🎭 How It Works

### With Speech SDK Credentials (Recommended)
- **Real-time visemes** from Azure Speech Services
- **Perfect lip sync** timing
- **High-quality audio** with genuine viseme events
- **Console logs**: `[Speech SDK] 🎤 Initializing...`

### Without Speech SDK Credentials (Fallback)
- **Synthetic visemes** generated programmatically
- **Azure OpenAI TTS** audio (still high quality)
- **Good lip sync** but not as precise
- **Console logs**: `[AzureTTS] Using fallback TTS...`

## 🔍 Testing

1. **Check Console**: Look for `[Speech SDK]` logs when speaking
2. **Viseme Events**: You'll see `👄 Viseme event: ID=X at Yms` 
3. **Avatar Lips**: Should move in perfect sync with audio
4. **Looking Glass**: Both models will have synchronized visemes

## 🆚 Comparison

| Feature | Azure Speech SDK | Azure OpenAI TTS |
|---------|------------------|-------------------|
| **Audio Quality** | High | High |
| **Viseme Accuracy** | Perfect (real-time) | Good (synthetic) |
| **Lip Sync Timing** | Millisecond precision | Estimated timing |
| **Setup Complexity** | Need Speech Services | Already working |
| **Cost** | Speech Services pricing | OpenAI pricing |

## 🎬 Ready for Action!

Your app is now Speech SDK-ready! Just add your Azure Speech credentials and enjoy perfect real-time lip synchronization! 🚀
