# Deepgram Voice Chat Integration - Setup Instructions

## Quick Start

### 1. Install Node.js Dependencies
First, make sure you have Node.js 18+ installed, then run:

```bash
npm install
```

### 2. Set Up Environment Variables
Create a `.env.local` file in the root directory:

```bash
# Copy the example file
cp env.local.example .env.local

# Edit the file and add your Deepgram API key
# You can get a free API key from https://console.deepgram.com/
```

Required environment variables:
```
NEXT_PUBLIC_DEEPGRAM_API_KEY=your_deepgram_api_key_here
RAG_ENDPOINT_URL=http://your-rag-service-url/api/query (optional)
```

### 3. Run the Development Server
```bash
npm run dev
```

### 4. Open the Application
Navigate to: http://localhost:3000

## What's Been Implemented

✅ **Complete Deepgram Integration**
- Speech-to-Text (STT) using Deepgram Nova 3 model
- Text-to-Speech (TTS) using Deepgram Aura voices
- Real-time streaming for both STT and TTS

✅ **Next.js Migration**
- Removed Flask backend
- All functionality now in TypeScript/JavaScript
- API routes in Next.js format
- Proper TypeScript types

✅ **Audio Features**
- Voice chat with live transcription
- Text chat with character limits
- Audio interruption handling
- Welcome message on session start
- Message history display
- Web search toggle (optional)

✅ **UI Components**
- Modern, responsive design with Tailwind CSS
- Tab switching between text and voice chat
- Visual indicators for recording/speaking states
- Stop button for audio interruption

## File Structure

```
Your project now has:
- /lib - API utilities and helpers
- /logic - React hooks and contexts for audio
- /AudioChat - UI components for the chat
- /components - Reusable UI components
- /pages - Next.js pages and API routes
- /styles - Global CSS styles
```

## Important Notes

1. **Browser Requirements**: Use Chrome or Edge for best audio performance
2. **Microphone Access**: The app will request microphone permissions for voice chat
3. **API Key Security**: Keep your Deepgram API key secure and never commit it to version control

## Testing the Integration

1. **Test Text Chat**:
   - Type a message in the text input
   - Press Send or hit Enter
   - The AI will respond with synthesized speech

2. **Test Voice Chat**:
   - Click "Start Voice Chat"
   - Click the microphone button to unmute
   - Speak your message
   - Wait for 2 seconds of silence for automatic send
   - The AI will respond with synthesized speech

3. **Test Audio Interruption**:
   - While the AI is speaking, click the "Stop" button
   - Or type a new message to interrupt

## Troubleshooting

If you encounter issues:

1. **Dependencies not found**: Run `npm install` again
2. **Audio not working**: Check browser console for errors and ensure microphone permissions
3. **API errors**: Verify your Deepgram API key is correct
4. **Build errors**: Try deleting `node_modules` and `.next` folders, then reinstall

## Next Steps

You can now:
- Customize the UI in the AudioChat components
- Modify the audio settings in `logic/useAudioTTS.ts`
- Add additional API endpoints in `pages/api/`
- Integrate with your existing RAG service

## Support

For Deepgram API documentation: https://developers.deepgram.com/
For Next.js documentation: https://nextjs.org/docs