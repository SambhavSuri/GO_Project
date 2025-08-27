// Azure TTS API integration with Speech SDK for real-time visemes
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

export interface VisemeData {
  offset: number;
  duration: number;
  visemeId: number;
}

export interface AzureTTSResponse {
  audio: Uint8Array;
  visemes: VisemeData[];
}

// Azure TTS configuration (OpenAI-compatible endpoint for fallback)
const AZURE_TTS_CONFIG = {
  endpoint: process.env.NEXT_PUBLIC_AZURE_TTS_ENDPOINT || 'https://looking-glass.openai.azure.com/openai/deployments/tts/audio/speech',
  apiVersion: '2025-03-01-preview',
  voice: 'alloy', // Default voice
  responseFormat: 'mp3',
  speed: 1.0
};

// Speech SDK TTS with direct viseme application (STREAMLINED APPROACH)
export async function azureSpeechSDKTTS(
  text: string,
  onAudioChunk: (audioData: Uint8Array, isFirstChunk: boolean) => void,
  onDirectViseme?: (visemeId: number, offset: number) => void,  // 🎯 DIRECT CALLBACK
  onComplete?: () => void,
  onError?: (error: string) => void,
  signal?: AbortSignal,
  voice: string = 'en-US-DavisNeural',  // 🎤 MALE VOICE: Professional, clear male voice
  speed: number = 1.0
): Promise<void> {
  const speechKey = process.env.NEXT_PUBLIC_AZURE_SPEECH_KEY;
  const speechRegion = process.env.NEXT_PUBLIC_AZURE_SPEECH_REGION;
  
  if (!speechKey || !speechRegion) {
    const error = '[Speech SDK] Azure Speech credentials not found. Please set NEXT_PUBLIC_AZURE_SPEECH_KEY and NEXT_PUBLIC_AZURE_SPEECH_REGION';
    console.error(error);
    if (onError) onError(error);
    return;
  }

  console.log('[Speech SDK] 🎤 Initializing Azure Speech SDK TTS...');
  console.log('[Speech SDK] Voice:', voice, 'Speed:', speed, 'Region:', speechRegion);

  return new Promise((resolve, reject) => {
    let speechSynthesizer: sdk.SpeechSynthesizer | null = null;

    try {
      // Create speech config
      const speechConfig = sdk.SpeechConfig.fromSubscription(speechKey, speechRegion);
      speechConfig.speechSynthesisVoiceName = voice;
      speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3;

      // Create audio config (null for getting raw data)
      const audioConfig = null;

      // Create the synthesizer
      speechSynthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

      console.log('[Speech SDK] ✅ Speech synthesizer created');

      // Track viseme sequence for debugging
      let visemeSequence: Array<{id: number, offset: number}> = [];
      
      // Official Azure viseme ID reference with IPA phonemes
      const azureVisemeReference: {[key: number]: string} = {
        0: 'silence', 1: 'æ,ə,ʌ', 2: 'ɑ', 3: 'ɔ', 4: 'ɛ,ʊ', 5: 'ɝ', 
        6: 'j,i,ɪ', 7: 'w,u', 8: 'o', 9: 'aʊ', 10: 'ɔɪ', 11: 'aɪ', 
        12: 'h', 13: 'ɹ', 14: 'l', 15: 's,z', 16: 'ʃ,tʃ,dʒ,ʒ', 17: 'ð', 
        18: 'f,v', 19: 'd,t,n,θ', 20: 'k,g,ŋ', 21: 'p,b,m'
      };

      // 🎯 AZURE TTS INTEGRATION: Real-time viseme callback with perfect synchronization
      speechSynthesizer.visemeReceived = (sender, e) => {
        if (onDirectViseme) {
          // Convert audio offset from 100-nanosecond units to milliseconds
          const offsetMs = e.audioOffset / 10000;
          
          // Track viseme in sequence
          visemeSequence.push({id: e.visemeId, offset: offsetMs});
          
          // 🚨 DETAILED AZURE VISEME LOGGING
          const phoneme = azureVisemeReference[e.visemeId] || 'unknown';
          // console.log(`🔥 [Azure Speech SDK] VISEME RECEIVED: ID=${e.visemeId} (${phoneme}) at ${offsetMs.toFixed(1)}ms`);
          // console.log(`🎯 [Azure Speech SDK] Viseme Details: {id: ${e.visemeId}, phoneme: "${phoneme}", offset: ${offsetMs.toFixed(1)}ms, timestamp: ${Date.now()}}`);
          
          // 🚀 DIRECT: Pass viseme immediately for perfect sync
          onDirectViseme(e.visemeId, offsetMs);
        }
      };
      
      // Set up synthesis started handler
      speechSynthesizer.synthesisStarted = (sender, e) => {
        console.log('[Speech SDK] 🎵 Synthesis started - Azure viseme tracking begins');
        visemeSequence = []; // Reset sequence for new synthesis
      };

      // Set up synthesis completed handler
      speechSynthesizer.synthesisCompleted = (sender, e) => {
        console.log('[Speech SDK] ✅ Synthesis completed');
        
        if (e.result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          // Get the complete audio data
          const audioData = new Uint8Array(e.result.audioData);
          console.log('[Speech SDK] Audio data received:', audioData.length, 'bytes');
          
          // Send the complete audio
          if (onAudioChunk) {
            onAudioChunk(audioData, true);
          }
          
          // 🎯 AZURE TTS INTEGRATION: Send final silence viseme for natural lip closure
          if (onDirectViseme) {
            console.log('[Speech SDK] 🔒 Sending final silence viseme for natural lip closure');
            // Log complete viseme sequence for analysis
            //console.log(`📈 [Azure Speech SDK] COMPLETE VISEME SEQUENCE: ${visemeSequence.map(v => `${v.id}(${azureVisemeReference[v.id] || '?'})@${v.offset.toFixed(0)}ms`).join(', ')}`);
            //console.log(`📊 [Azure Speech SDK] Total visemes received: ${visemeSequence.length}`);
            
            // Send silence viseme with slight delay to ensure natural closure
            setTimeout(() => {
              onDirectViseme(0, 0); // Viseme ID 0 is silence
            }, 100);
          }
          
          if (onComplete) {
            onComplete();
          }
          
          resolve();
        } else if (e.result.reason === sdk.ResultReason.Canceled) {
          const cancellation = sdk.CancellationDetails.fromResult(e.result);
          const error = `[Speech SDK] Synthesis canceled: ${cancellation.reason} - ${cancellation.errorDetails}`;
          console.error(error);
          if (onError) onError(error);
          reject(new Error(error));
        } else {
          const error = `[Speech SDK] Synthesis failed: ${e.result.errorDetails}`;
          console.error(error);
          if (onError) onError(error);
          reject(new Error(error));
        }
      };

      // Handle abort signal
      if (signal) {
        signal.addEventListener('abort', () => {
          console.log('[Speech SDK] 🛑 Synthesis aborted by signal');
          if (speechSynthesizer) {
            speechSynthesizer.close();
            speechSynthesizer = null;
          }
          reject(new Error('Synthesis aborted'));
        });
      }

      // Create SSML with speed control
      const ssml = `
        <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
          <voice name="${voice}">
            <prosody rate="${speed}">
              ${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
            </prosody>
          </voice>
        </speak>
      `;

      console.log('[Speech SDK] 🚀 Starting synthesis with SSML...');
      
      // Start synthesis
      speechSynthesizer.speakSsmlAsync(
        ssml,
        (result) => {
          console.log('[Speech SDK] Synthesis result received:', result.reason);
          // Completion is handled in synthesisCompleted event
        },
        (error) => {
          const errorMsg = `[Speech SDK] Synthesis error: ${error}`;
          console.error(errorMsg);
          if (onError) onError(errorMsg);
          reject(new Error(errorMsg));
        }
      );

    } catch (error) {
      const errorMsg = `[Speech SDK] Failed to initialize: ${error}`;
      console.error(errorMsg);
      if (onError) onError(errorMsg);
      reject(new Error(errorMsg));
    }
  });
}

// Azure TTS API function for fallback (using OpenAI-compatible endpoint with synthetic visemes)
export async function azureTTS(
  text: string,
  voice: string = AZURE_TTS_CONFIG.voice,
  speed: number = AZURE_TTS_CONFIG.speed
): Promise<AzureTTSResponse | null> {
  const apiKey = process.env.NEXT_PUBLIC_AZURE_TTS_API_KEY;
  
  if (!apiKey) {
    console.error('[azureTTS] No Azure TTS API key found');
    return null;
  }

  try {
    console.log('[azureTTS] Requesting TTS with voice:', voice, 'speed:', speed);
    
    // Use the endpoint as-is if it already contains api-version, otherwise add it
    const url = AZURE_TTS_CONFIG.endpoint.includes('api-version') 
      ? AZURE_TTS_CONFIG.endpoint 
      : `${AZURE_TTS_CONFIG.endpoint}?api-version=${AZURE_TTS_CONFIG.apiVersion}`;
    
    console.log('[azureTTS] Using URL:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1-hd',
        input: text,
        voice: voice,
        response_format: 'mp3',
        speed: speed
      }),
    });

    if (!response.ok) {
      console.error('[azureTTS] API error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('[azureTTS] Error details:', errorText);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioData = new Uint8Array(arrayBuffer);
    
    console.log('[azureTTS] Received audio data:', audioData.length, 'bytes');
    
    // Check if Azure Speech Services credentials are available for real visemes
    const speechKey = process.env.NEXT_PUBLIC_AZURE_SPEECH_KEY;
    const speechRegion = process.env.NEXT_PUBLIC_AZURE_SPEECH_REGION;
    
    let visemes: VisemeData[] = [];
    
    if (speechKey && speechRegion) {
      console.log('[azureTTS] Azure Speech credentials found - will use Speech SDK for real-time visemes');
      // Return special marker to indicate Speech SDK mode should be used
      visemes = [{ visemeId: -1, offset: 0, duration: 0 }]; // Marker for Speech SDK real-time mode
    } else {
      console.log('[azureTTS] No Azure Speech credentials - OpenAI TTS only (no visemes)');
      // No visemes for OpenAI TTS fallback - Speech SDK is required for lip sync
      visemes = [];
    }
    
    console.log('[azureTTS] Generated', visemes.length, 'visemes for lip sync');
    
    return {
      audio: audioData,
      visemes: visemes
    };
  } catch (error) {
    console.error('[azureTTS] Error:', error);
    return null;
  }
}


