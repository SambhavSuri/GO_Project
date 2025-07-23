#!/usr/bin/env python3
"""
Generate mock audio file for testing
"""

import wave
import numpy as np
import os

def create_mock_audio():
    """Create a mock MP3-like audio file"""
    
    # Create a simple sine wave
    sample_rate = 22050
    duration = 2  # seconds
    frequency = 440  # Hz (A note)
    
    # Generate audio data
    t = np.linspace(0, duration, int(sample_rate * duration), False)
    audio_data = np.sin(2 * np.pi * frequency * t) * 0.3
    
    # Convert to 16-bit PCM
    audio_data = (audio_data * 32767).astype(np.int16)
    
    # Create WAV file
    filename = "static/audio/mock_audio.wav"
    with wave.open(filename, 'wb') as wav_file:
        wav_file.setnchannels(1)  # Mono
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(audio_data.tobytes())
    
    print(f"Created mock audio file: {filename}")
    return filename

if __name__ == "__main__":
    create_mock_audio() 