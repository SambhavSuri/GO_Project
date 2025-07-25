import os
import time
import requests
from murf import Murf

class MurfService:
    def __init__(self):
        # The murf SDK will automatically use the MURF_API_KEY environment variable
        self.client = Murf()

    def synthesize_speech(self, text, voice_id="en-US-terrell"):
        """
        Convert text to speech using Murf AI SDK
        """
        try:
            audio_res = self.client.text_to_speech.generate(
                text=text,
                voice_id=voice_id
            )
            audio_url = audio_res.audio_file  # This is a URL to the audio file
            # Download the audio file
            response = requests.get(audio_url)
            response.raise_for_status()
            # Save the audio file to static/audio
            filename = f"static/audio/speech_{int(time.time())}.mp3"
            os.makedirs(os.path.dirname(filename), exist_ok=True)
            with open(filename, "wb") as f:
                f.write(response.content)
            return filename
        except Exception as e:
            print(f"Unexpected error in MURF speech synthesis: {e}")
            return None

    def get_available_voices(self):
        """
        Get list of available voices from Murf AI SDK
        """
        try:
            voices = self.client.text_to_speech.voices()
            return [voice['id'] for voice in voices]
        except Exception as e:
            print(f"Error getting voices: {e}")
            return ["en-US-terrell"]

    def get_voice_info(self, voice_id):
        """
        Get information about a specific voice from Murf AI SDK
        """
        try:
            voices = self.client.text_to_speech.voices()
            for voice in voices:
                if voice['id'] == voice_id:
                    return voice
            return None
        except Exception as e:
            print(f"Error getting voice info: {e}")
            return None 