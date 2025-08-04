import os
import requests
import tempfile
from openai import OpenAI

class WhisperService:
    def __init__(self):
        self.api_key = os.getenv('OPENAI_API_KEY')
        self.client = OpenAI(api_key=self.api_key) if self.api_key else None
    
    def transcribe_audio(self, audio_file_path):
        """
        Transcribe audio file using OpenAI Whisper API
        """
        if not self.client:
            return "Mock transcription: Please set OPENAI_API_KEY environment variable"
        
        try:
            with open(audio_file_path, "rb") as audio_file:
                transcript = self.client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file
                )
                return transcript.text
        except Exception as e:
            print(f"Error transcribing audio: {e}")
            return f"Error transcribing audio: {str(e)}"
    
    def transcribe_audio_bytes(self, audio_bytes):
        """
        Transcribe audio bytes using OpenAI Whisper API
        """
        if not self.client:
            return "Mock transcription: Please set OPENAI_API_KEY environment variable"
        
        try:
            # Create temporary file
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
                temp_file.write(audio_bytes)
                temp_file_path = temp_file.name
            
            # Transcribe
            result = self.transcribe_audio(temp_file_path)
            
            # Clean up
            os.unlink(temp_file_path)
            
            return result
        except Exception as e:
            print(f"Error transcribing audio bytes: {e}")
            return f"Error transcribing audio: {str(e)}" 