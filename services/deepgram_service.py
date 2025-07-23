import os
import asyncio
import json
import logging
import time
import ssl
import certifi
from datetime import datetime
from dotenv import load_dotenv
from deepgram import Deepgram

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DeepgramService:
    def __init__(self):
        self.api_key = os.getenv('DEEPGRAM_API_KEY')
        
        # Setup SSL context for certificate verification
        try:
            ssl_context = ssl.create_default_context(cafile=certifi.where())
            os.environ['SSL_CERT_FILE'] = certifi.where()
            os.environ['REQUESTS_CA_BUNDLE'] = certifi.where()
            os.environ['CURL_CA_BUNDLE'] = certifi.where()
            logger.info(f"SSL context configured with certifi bundle: {certifi.where()}")
        except Exception as e:
            logger.warning(f"SSL context setup failed: {e}")
        
        self.deepgram = Deepgram(self.api_key) if self.api_key else None
        
        # Log initialization
        if self.is_configured():
            logger.info("✅ Deepgram service initialized successfully")
        else:
            logger.warning("⚠️  Deepgram service not configured - using mock responses")
        
    def is_configured(self):
        """Check if Deepgram is properly configured"""
        return self.api_key is not None and self.api_key != 'your_deepgram_api_key_here' and self.deepgram is not None
    
    def _log_request_details(self, audio_file_path=None, audio_bytes=None, options=None):
        """Log request details for Deepgram API call"""
        logger.info("=" * 60)
        logger.info("🎤 DEEPGRAM API REQUEST")
        logger.info("=" * 60)
        logger.info(f"Timestamp: {datetime.now().isoformat()}")
        
        if audio_file_path:
            file_size = os.path.getsize(audio_file_path) if os.path.exists(audio_file_path) else 0
            logger.info(f"Input Type: Audio File")
            logger.info(f"File Path: {audio_file_path}")
            logger.info(f"File Size: {file_size} bytes ({file_size/1024:.2f} KB)")
        elif audio_bytes:
            logger.info(f"Input Type: Audio Bytes")
            logger.info(f"Data Size: {len(audio_bytes)} bytes ({len(audio_bytes)/1024:.2f} KB)")
        
        logger.info(f"API Key Configured: {self.is_configured()}")
        if options:
            logger.info(f"Request Options: {json.dumps(options, indent=2)}")
        logger.info("-" * 60)
    
    def _log_response_details(self, response, start_time):
        """Log response details from Deepgram API"""
        end_time = time.time()
        duration = end_time - start_time
        
        logger.info("=" * 60)
        logger.info("🎵 DEEPGRAM API RESPONSE")
        logger.info("=" * 60)
        logger.info(f"Response Time: {duration:.3f} seconds")
        logger.info(f"Response Type: {type(response).__name__}")
        
        # Handle None response
        if response is None:
            logger.error("Response is None - API call may have failed")
            logger.info("-" * 60)
            return
        
        if isinstance(response, dict):
            # Log key response details
            if 'results' in response:
                results = response['results']
                logger.info(f"Results Available: {len(results) if results else 0}")
                
                if 'channels' in results and len(results['channels']) > 0:
                    channel = results['channels'][0]
                    logger.info(f"Channels: {len(results['channels'])}")
                    
                    if 'alternatives' in channel and len(channel['alternatives']) > 0:
                        alternative = channel['alternatives'][0]
                        transcript = alternative.get('transcript', '')
                        confidence = alternative.get('confidence', 0)
                        
                        logger.info(f"Transcription: '{transcript}'")
                        logger.info(f"Confidence: {confidence:.3f}")
                        logger.info(f"Word Count: {len(transcript.split()) if transcript else 0}")
                        
                        # Log detailed response structure
                        logger.info("Full Response Structure:")
                        logger.info(json.dumps(response, indent=2, default=str))
                    else:
                        logger.warning("No alternatives found in response")
                else:
                    logger.warning("No channels found in response")
            else:
                logger.warning("No results found in response")
                logger.info(f"Response Content: {json.dumps(response, indent=2, default=str)}")
        else:
            logger.info(f"Response Content: {response}")
        
        logger.info("-" * 60)
    
    def _log_error_details(self, error, start_time):
        """Log error details from Deepgram API"""
        end_time = time.time()
        duration = end_time - start_time
        
        logger.error("=" * 60)
        logger.error("❌ DEEPGRAM API ERROR")
        logger.error("=" * 60)
        logger.error(f"Error Time: {datetime.now().isoformat()}")
        logger.error(f"Duration: {duration:.3f} seconds")
        logger.error(f"Error Type: {type(error).__name__}")
        logger.error(f"Error Message: {str(error)}")
        
        # Log additional error details if available
        if hasattr(error, 'status_code'):
            logger.error(f"HTTP Status Code: {error.status_code}")
        if hasattr(error, 'response'):
            logger.error(f"Error Response: {error.response}")
        
        logger.error("-" * 60)
    
    async def transcribe_audio_file(self, audio_file_path):
        """
        Transcribe audio file using Deepgram API
        """
        start_time = time.time()
        
        if not self.is_configured():
            logger.warning("Deepgram not configured - returning mock response")
            return "Mock transcription: Please set DEEPGRAM_API_KEY environment variable"
        
        # Log request details
        options = {
            'smart_format': True,
            'punctuate': True,
            'diarize': False,
            'model': 'nova-2',  # Use the latest model
            'language': 'en-US',
            'filler_words': False,
            'profanity_filter': False
        }
        self._log_request_details(audio_file_path=audio_file_path, options=options)
        
        try:
            with open(audio_file_path, "rb") as audio:
                source = {'buffer': audio, 'mimetype': 'audio/wav'}
                
                logger.info("Sending request to Deepgram API...")
                response = await self.deepgram.transcription.prerecorded(source, options)
                
                # Log response details
                self._log_response_details(response, start_time)
                
                # Check if response is None or empty
                if response is None:
                    logger.error("Deepgram API returned None response")
                    return "Error: No response from Deepgram API"
                
                # Check if response has the expected structure
                if not isinstance(response, dict) or 'results' not in response:
                    logger.error(f"Unexpected response format: {type(response)}")
                    return "Error: Unexpected response format from Deepgram API"
                
                # Check if results exist and have channels
                results = response.get('results', {})
                if not results or 'channels' not in results or not results['channels']:
                    logger.error("No channels found in Deepgram response")
                    return "Error: No audio channels found in response"
                
                # Check if alternatives exist
                channel = results['channels'][0]
                if 'alternatives' not in channel or not channel['alternatives']:
                    logger.error("No alternatives found in Deepgram response")
                    return "Error: No transcription alternatives found"
                
                # Extract transcript
                alternative = channel['alternatives'][0]
                transcript = alternative.get('transcript', '')
                
                # Handle empty transcript
                if not transcript or transcript.strip() == '':
                    logger.warning("Empty transcript received from Deepgram")
                    return "I couldn't hear anything clearly. Please try speaking again."
                
                logger.info(f"✅ Transcription completed successfully: '{transcript}'")
                return transcript
                
        except Exception as e:
            self._log_error_details(e, start_time)
            logger.error(f"Error transcribing audio with Deepgram: {e}")
            return f"Error transcribing audio: {str(e)}"
    
    async def transcribe_audio_live(self, audio_bytes):
        """
        Transcribe audio using Deepgram Live API (/listen endpoint)
        """
        start_time = time.time()
        
        if not self.is_configured():
            logger.warning("Deepgram not configured - returning mock response")
            return "Mock transcription: Please set DEEPGRAM_API_KEY environment variable"
        
        # Log request details
        options = {
            'smart_format': True,
            'punctuate': True,
            'diarize': False,
            'interim_results': True,
            'endpointing': 200,
            'utterance_end_ms': 2000
        }
        self._log_request_details(audio_bytes=audio_bytes, options=options)
        
        try:
            # Create temporary file for live streaming
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
                temp_file.write(audio_bytes)
                temp_file_path = temp_file.name
            
            logger.info(f"Created temporary file for live streaming: {temp_file_path}")
            
            # Use live streaming API - Deepgram v2 uses different method
            with open(temp_file_path, "rb") as audio:
                source = {'buffer': audio, 'mimetype': 'audio/wav'}
                
                logger.info("Sending request to Deepgram Live API (/listen)...")
                # For live streaming, we need to use the streaming API
                # This is a simplified approach - in production you'd want WebSocket streaming
                response = await self.deepgram.transcription.prerecorded(source, options)
                
                # Log response details
                self._log_response_details(response, start_time)
                
                # Extract transcript from response
                if response is None:
                    logger.error("Deepgram Live API returned None response")
                    # Clean up
                    os.unlink(temp_file_path)
                    logger.info(f"Cleaned up temporary file: {temp_file_path}")
                    return "Error: No response from Deepgram Live API"
                
                if not isinstance(response, dict) or 'results' not in response:
                    logger.error(f"Unexpected live response format: {type(response)}")
                    # Clean up
                    os.unlink(temp_file_path)
                    logger.info(f"Cleaned up temporary file: {temp_file_path}")
                    return "Error: Unexpected response format from Deepgram Live API"
                
                # Check if results exist and have channels
                results = response.get('results', {})
                if not results or 'channels' not in results or not results['channels']:
                    logger.error("No channels found in Deepgram Live response")
                    # Clean up
                    os.unlink(temp_file_path)
                    logger.info(f"Cleaned up temporary file: {temp_file_path}")
                    return "Error: No audio channels found in live response"
                
                # Check if alternatives exist
                channel = results['channels'][0]
                if 'alternatives' not in channel or not channel['alternatives']:
                    logger.error("No alternatives found in Deepgram Live response")
                    # Clean up
                    os.unlink(temp_file_path)
                    logger.info(f"Cleaned up temporary file: {temp_file_path}")
                    return "Error: No transcription alternatives found"
                
                # Extract transcript
                alternative = channel['alternatives'][0]
                transcript = alternative.get('transcript', '')
                
                # Handle empty transcript
                if not transcript or transcript.strip() == '':
                    logger.warning("Empty transcript received from Deepgram Live API")
                    # Clean up
                    os.unlink(temp_file_path)
                    logger.info(f"Cleaned up temporary file: {temp_file_path}")
                    return "I couldn't hear anything clearly. Please try speaking again."
                
                logger.info(f"✅ Live transcription completed successfully: '{transcript}'")
                
                # Clean up
                os.unlink(temp_file_path)
                logger.info(f"Cleaned up temporary file: {temp_file_path}")
                
                return transcript
                    
        except Exception as e:
            self._log_error_details(e, start_time)
            logger.error(f"Error transcribing audio with Deepgram Live API: {e}")
            return f"Error transcribing audio: {str(e)}"
    
    def transcribe_audio_bytes(self, audio_bytes):
        """
        Transcribe audio bytes using Deepgram API (synchronous wrapper)
        """
        start_time = time.time()
        
        if not self.is_configured():
            logger.warning("Deepgram not configured - returning mock response")
            return "Mock transcription: Please set DEEPGRAM_API_KEY environment variable"
        
        # Log request details
        options = {
            'smart_format': True,
            'punctuate': True,
            'diarize': False,
            'model': 'nova-2',  # Use the latest model
            'language': 'en-US',
            'filler_words': False,
            'profanity_filter': False
        }
        self._log_request_details(audio_bytes=audio_bytes, options=options)
        
        try:
            # Create temporary file
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
                temp_file.write(audio_bytes)
                temp_file_path = temp_file.name
            
            logger.info(f"Created temporary file: {temp_file_path}")
            
            # Transcribe using asyncio
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(self.transcribe_audio_file(temp_file_path))
            loop.close()
            
            # Clean up
            os.unlink(temp_file_path)
            logger.info(f"Cleaned up temporary file: {temp_file_path}")
            
            return result
        except Exception as e:
            self._log_error_details(e, start_time)
            logger.error(f"Error transcribing audio bytes with Deepgram: {e}")
            return f"Error transcribing audio: {str(e)}"
    
    def get_live_transcription_config(self):
        """
        Get configuration for live transcription
        """
        config = {
            'punctuate': True,
            'smart_format': True,
            'interim_results': True,
            'endpointing': 200,  # End of speech detection (ms)
            'utterance_end_ms': 2000,  # 2 seconds of silence to end utterance
            'vad_turnoff': 500  # Voice activity detection turnoff
        }
        
        logger.info("Live transcription config requested:")
        logger.info(json.dumps(config, indent=2))
        
        return config 