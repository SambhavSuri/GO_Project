#!/usr/bin/env python3
"""
Test script to demonstrate Deepgram logging functionality
"""

import os
import sys
import tempfile
import wave
import numpy as np
from services.deepgram_service import DeepgramService

def create_test_audio(duration=3, sample_rate=16000):
    """Create a simple test audio file"""
    # Generate a simple sine wave
    t = np.linspace(0, duration, int(sample_rate * duration), False)
    # Generate a 440 Hz sine wave
    audio_data = np.sin(2 * np.pi * 440 * t) * 0.3
    
    # Convert to 16-bit PCM
    audio_data = (audio_data * 32767).astype(np.int16)
    
    return audio_data, sample_rate

def create_wav_file(audio_data, sample_rate, filename):
    """Create a WAV file from audio data"""
    with wave.open(filename, 'wb') as wav_file:
        wav_file.setnchannels(1)  # Mono
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(audio_data.tobytes())

def test_deepgram_logging():
    """Test the Deepgram logging functionality"""
    print("🧪 Testing Deepgram Logging Functionality")
    print("=" * 60)
    
    # Initialize Deepgram service
    deepgram_service = DeepgramService()
    
    # Check if Deepgram is configured
    if not deepgram_service.is_configured():
        print("⚠️  Deepgram not configured - will show mock response logging")
        print("   Set DEEPGRAM_API_KEY in your .env file to test with real API")
    else:
        print("✅ Deepgram configured - will test with real API")
    
    print("\n📝 Creating test audio file...")
    print("⚠️  Note: This test uses a sine wave tone (not speech)")
    print("   Deepgram will return empty transcription for non-speech audio")
    print("   To test with real speech, use the web interface or record audio")
    
    # Create test audio
    audio_data, sample_rate = create_test_audio(duration=2)
    
    # Create temporary WAV file
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
        create_wav_file(audio_data, sample_rate, temp_file.name)
        test_file_path = temp_file.name
    
    print(f"✅ Created test audio file: {test_file_path}")
    print(f"   Duration: 2 seconds")
    print(f"   Sample Rate: {sample_rate} Hz")
    print(f"   File Size: {os.path.getsize(test_file_path)} bytes")
    
    print("\n🎤 Testing Deepgram transcription with logging...")
    print("-" * 60)
    
    try:
        # Test transcription
        import asyncio
        
        # Run async transcription
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(deepgram_service.transcribe_audio_file(test_file_path))
        loop.close()
        
        print(f"\n✅ Transcription completed!")
        print(f"   Result: '{result}'")
        
        if result == "":
            print("   ⚠️  Empty result is expected for sine wave tone")
            print("   💡 Try recording real speech through the web interface")
        
    except Exception as e:
        print(f"\n❌ Transcription failed: {e}")
    
    finally:
        # Clean up
        if os.path.exists(test_file_path):
            os.unlink(test_file_path)
            print(f"🧹 Cleaned up test file: {test_file_path}")
    
    print("\n📊 Log Summary:")
    print("   - Check the console output above for detailed logging")
    print("   - Look for '🎤 DEEPGRAM API REQUEST' sections")
    print("   - Look for '🎵 DEEPGRAM API RESPONSE' sections")
    print("   - Look for '❌ DEEPGRAM API ERROR' sections (if any errors)")
    
    print("\n🔍 What the logs show:")
    print("   ✅ Input details (file size, format, options)")
    print("   ✅ API request parameters")
    print("   ✅ Response details (transcription, confidence, timing)")
    print("   ✅ Error details (if any occur)")
    print("   ✅ Performance metrics (response time)")
    
    print("\n🎯 To test with real speech:")
    print("   1. Start the Flask app: python3 app.py")
    print("   2. Open http://localhost:5000 in your browser")
    print("   3. Use the microphone button to record speech")
    print("   4. Check the console for detailed logs")

if __name__ == "__main__":
    test_deepgram_logging() 