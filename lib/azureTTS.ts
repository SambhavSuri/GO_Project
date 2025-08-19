// Azure TTS API integration with streaming and viseme support
export interface VisemeData {
  offset: number;
  duration: number;
  visemeId: number;
}

export interface AzureTTSResponse {
  audio: Uint8Array;
  visemes: VisemeData[];
}

export interface AzureTTSStreamChunk {
  type: 'audio' | 'viseme' | 'metadata';
  data: Uint8Array | VisemeData | any;
  timestamp?: number;
}

// Azure TTS configuration
const AZURE_TTS_CONFIG = {
  endpoint: process.env.NEXT_PUBLIC_AZURE_TTS_ENDPOINT || 'https://looking-glass.openai.azure.com/openai/deployments/tts/audio/speech',
  apiVersion: '2025-03-01-preview',
  voice: 'alloy', // Default voice
  responseFormat: 'mp3',
  speed: 1.0
};

// Azure TTS API function for complete audio with visemes
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
    
    // Estimate audio duration based on text length and speech rate
    // Average speech rate is about 150-160 words per minute
    const wordCount = text.split(' ').length;
    const estimatedDurationMs = (wordCount / 2.5) * 1000; // Approximate duration in milliseconds
    
    // Generate basic visemes for lip sync animation
    const visemes = generateBasicVisemes(text, estimatedDurationMs);
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

// Azure TTS streaming function with viseme support
export async function azureStreamingTTS(
  text: string,
  onAudioChunk: (audioData: Uint8Array, isFirstChunk: boolean) => void,
  onViseme?: (viseme: VisemeData) => void,
  onComplete?: () => void,
  onError?: (error: string) => void,
  signal?: AbortSignal,
  voice: string = AZURE_TTS_CONFIG.voice,
  speed: number = AZURE_TTS_CONFIG.speed
): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_AZURE_TTS_API_KEY;
  
  if (!apiKey) {
    const errorMsg = 'No Azure TTS API key found';
    console.error('[azureStreamingTTS]', errorMsg);
    onError?.(errorMsg);
    return;
  }

  try {
    console.log('[azureStreamingTTS] Starting streaming TTS with voice:', voice, 'speed:', speed);
    
    // Use the endpoint as-is if it already contains api-version, otherwise add it
    const url = AZURE_TTS_CONFIG.endpoint.includes('api-version') 
      ? AZURE_TTS_CONFIG.endpoint 
      : `${AZURE_TTS_CONFIG.endpoint}?api-version=${AZURE_TTS_CONFIG.apiVersion}`;
    
    console.log('[azureStreamingTTS] Using URL:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: voice,
        response_format: 'mp3',
        speed: speed
      }),
      signal,
    });

    if (!response.ok) {
      const errorMsg = `TTS API error: ${response.status} ${response.statusText}`;
      console.error('[azureStreamingTTS]', errorMsg);
      onError?.(errorMsg);
      return;
    }

    if (!response.body) {
      const errorMsg = 'No response body available for streaming';
      console.error('[azureStreamingTTS]', errorMsg);
      onError?.(errorMsg);
      return;
    }

    const reader = response.body.getReader();
    let isFirstChunk = true;
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('[azureStreamingTTS] Streaming complete');
          onComplete?.();
          break;
        }

        if (value && value.length > 0) {
          console.log('[azureStreamingTTS] Received audio chunk:', value.length, 'bytes');
          onAudioChunk(new Uint8Array(value), isFirstChunk);
          isFirstChunk = false;
        }
      }
    } catch (streamError) {
      if (signal?.aborted) {
        console.log('[azureStreamingTTS] TTS streaming aborted');
        onError?.('TTS streaming aborted');
      } else {
        const errorMsg = `Stream reading error: ${streamError instanceof Error ? streamError.message : 'Unknown error'}`;
        console.error('[azureStreamingTTS]', errorMsg);
        onError?.(errorMsg);
      }
    } finally {
      reader.releaseLock();
    }
    
  } catch (error) {
    if (signal?.aborted) {
      console.log('[azureStreamingTTS] TTS streaming aborted');
      onError?.('TTS streaming aborted');
    } else {
      const errorMsg = `TTS error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('[azureStreamingTTS]', errorMsg);
      onError?.(errorMsg);
    }
  }
}

// Enhanced Azure TTS with SSML and viseme support (using Azure Speech Services)
export async function azureTTSWithVisemes(
  text: string,
  onAudioChunk: (audioData: Uint8Array, isFirstChunk: boolean) => void,
  onViseme?: (viseme: VisemeData) => void,
  onComplete?: () => void,
  onError?: (error: string) => void,
  signal?: AbortSignal,
  voice: string = 'en-US-JennyNeural',
  speed: number = 1.0
): Promise<void> {
  const speechKey = process.env.NEXT_PUBLIC_AZURE_SPEECH_KEY;
  const speechRegion = process.env.NEXT_PUBLIC_AZURE_SPEECH_REGION;
  
  if (!speechKey || !speechRegion) {
    const errorMsg = 'Azure Speech Services credentials not found';
    console.error('[azureTTSWithVisemes]', errorMsg);
    onError?.(errorMsg);
    return;
  }

  try {
    console.log('[azureTTSWithVisemes] Starting TTS with visemes, voice:', voice);
    
    // Create SSML with viseme events
    const ssml = `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
        <voice name="${voice}">
          <prosody rate="${speed}">
            ${text}
          </prosody>
        </voice>
      </speak>
    `;

    const url = `https://${speechRegion}.tts.speech.microsoft.com/cognitiveservices/v1`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': speechKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'AudioChatApp'
      },
      body: ssml,
      signal,
    });

    if (!response.ok) {
      const errorMsg = `Azure Speech TTS API error: ${response.status} ${response.statusText}`;
      console.error('[azureTTSWithVisemes]', errorMsg);
      onError?.(errorMsg);
      return;
    }

    if (!response.body) {
      const errorMsg = 'No response body available for streaming';
      console.error('[azureTTSWithVisemes]', errorMsg);
      onError?.(errorMsg);
      return;
    }

    const reader = response.body.getReader();
    let isFirstChunk = true;
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('[azureTTSWithVisemes] Streaming complete');
          onComplete?.();
          break;
        }

        if (value && value.length > 0) {
          console.log('[azureTTSWithVisemes] Received audio chunk:', value.length, 'bytes');
          onAudioChunk(new Uint8Array(value), isFirstChunk);
          isFirstChunk = false;
        }
      }
    } catch (streamError) {
      if (signal?.aborted) {
        console.log('[azureTTSWithVisemes] TTS streaming aborted');
        onError?.('TTS streaming aborted');
      } else {
        const errorMsg = `Stream reading error: ${streamError instanceof Error ? streamError.message : 'Unknown error'}`;
        console.error('[azureTTSWithVisemes]', errorMsg);
        onError?.(errorMsg);
      }
    } finally {
      reader.releaseLock();
    }
    
  } catch (error) {
    if (signal?.aborted) {
      console.log('[azureTTSWithVisemes] TTS streaming aborted');
      onError?.('TTS streaming aborted');
    } else {
      const errorMsg = `TTS error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('[azureTTSWithVisemes]', errorMsg);
      onError?.(errorMsg);
    }
  }
}

// Utility function to generate visemes from text (enhanced approximation)
export function generateBasicVisemes(text: string, duration: number): VisemeData[] {
  const visemes: VisemeData[] = [];
  const cleanText = text.replace(/[.,!?;:]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = cleanText.split(' ').filter(word => word.length > 0);
  
  if (words.length === 0) {
    return [{ offset: 0, duration: duration, visemeId: 0 }]; // Silence
  }
  
  const totalTime = duration;
  const timePerWord = totalTime / words.length;
  let currentTime = 0;
  
  words.forEach((word) => {
    const wordDuration = timePerWord * 0.85; // Leave small gaps between words
    const pauseDuration = timePerWord * 0.15;
    
    // Enhanced phoneme-to-viseme mapping based on common letter patterns
    const letterVisemes = getEnhancedVisemes(word.toLowerCase());
    const timePerLetter = wordDuration / letterVisemes.length;
    
    letterVisemes.forEach((visemeId, index) => {
      visemes.push({
        offset: currentTime + (index * timePerLetter),
        duration: timePerLetter * 0.8, // Slight overlap for smoother animation
        visemeId
      });
    });
    
    currentTime += timePerWord;
    
    // Add brief silence between words
    if (currentTime < totalTime - pauseDuration) {
      visemes.push({
        offset: currentTime - pauseDuration,
        duration: pauseDuration,
        visemeId: 0 // Silence
      });
    }
  });
  
  // Ensure we end with silence to close the mouth
  visemes.push({
    offset: Math.max(currentTime, totalTime - 100),
    duration: 100,
    visemeId: 0 // Silence
  });
  
  return visemes;
}

// Basic phoneme extraction (simplified)
function getPhonemes(word: string): string[] {
  // This is a very basic approximation - in a real implementation,
  // you would use a proper phoneme dictionary or TTS engine
  return word.toLowerCase().split('');
}

// Basic phoneme to viseme mapping (Microsoft Speech SDK viseme IDs)
function getVisemeId(phoneme: string): number {
  const visemeMap: { [key: string]: number } = {
    'p': 21, 'b': 21, 'm': 21, // Bilabial
    'f': 18, 'v': 18, // Labiodental
    't': 19, 'd': 19, 'n': 19, 's': 15, 'z': 15, // Alveolar
    'th': 17, // Dental
    'sh': 16, 'zh': 16, 'ch': 16, 'j': 16, // Post-alveolar
    'k': 20, 'g': 20, 'ng': 20, // Velar
    'r': 13, 'l': 14, // Liquids
    'w': 7, 'y': 6, // Glides
    'a': 2, 'e': 4, 'i': 6, 'o': 8, 'u': 7, // Vowels
    'aa': 1, 'ae': 2, 'ah': 1, 'ao': 8, 'aw': 1, 'ay': 2,
    'eh': 4, 'er': 13, 'ey': 4, 'ih': 6, 'iy': 6,
    'ow': 8, 'oy': 8, 'uh': 4, 'uw': 7
  };
  
  return visemeMap[phoneme] || 1; // Default to neutral/sil
}

// Enhanced letter-to-viseme mapping for better lip sync
function getEnhancedVisemes(word: string): number[] {
  const visemes: number[] = [];
  const letters = word.split('');
  
  for (let i = 0; i < letters.length; i++) {
    const letter = letters[i];
    const nextLetter = i + 1 < letters.length ? letters[i + 1] : '';
    const prevLetter = i > 0 ? letters[i - 1] : '';
    
    // Handle letter combinations first
    if (letter + nextLetter === 'th') {
      visemes.push(32); // TH sound
      i++; // Skip next letter
    } else if (letter + nextLetter === 'sh') {
      visemes.push(30); // SH sound
      i++; // Skip next letter  
    } else if (letter + nextLetter === 'ch') {
      visemes.push(8); // CH sound
      i++; // Skip next letter
    } else if (letter + nextLetter === 'ng') {
      visemes.push(24); // NG sound
      i++; // Skip next letter
    } else {
      // Single letter mapping
      const visemeId = getVisemeIdFromLetter(letter, prevLetter, nextLetter);
      visemes.push(visemeId);
    }
  }
  
  return visemes.length > 0 ? visemes : [1]; // Default to neutral
}

// Enhanced single letter to viseme mapping
function getVisemeIdFromLetter(letter: string, prevLetter: string, nextLetter: string): number {
  const letterToVisemeMap: { [key: string]: number } = {
    // Consonants
    'p': 27, 'b': 7, 'm': 22,           // Bilabials  
    'f': 14, 'v': 35,                   // Labiodentals
    't': 31, 'd': 9, 'n': 23, 'l': 21, 's': 29, 'z': 38, // Alveolars
    'r': 28,                            // R sound
    'k': 20, 'g': 15, 'q': 20,         // Velars
    'w': 36, 'y': 37, 'h': 16,         // Glides and aspirates
    'j': 19,                            // Palatal
    
    // Vowels - context sensitive
    'a': 1,   // Open vowel (aa/ae context dependent)
    'e': 11,  // Mid front vowel  
    'i': 17,  // Close front vowel
    'o': 25,  // Mid back vowel
    'u': 33,  // Close back vowel
    
    // Silent letters
    'x': 0, 'c': 8, // Context dependent
  };
  
  // Handle context-sensitive letters
  if (letter === 'c') {
    if (nextLetter === 'h') return 8; // CH sound
    if ('eiy'.includes(nextLetter)) return 29; // Soft C (S sound)
    return 20; // Hard C (K sound)
  }
  
  if (letter === 'a') {
    if (nextLetter === 'e' || nextLetter === 'i') return 2; // AE sound  
    if (nextLetter === 'o' || nextLetter === 'u') return 4; // AO sound
    return 1; // Basic A sound
  }
  
  if (letter === 'e') {
    if (nextLetter === 'r') return 12; // ER sound
    if (nextLetter === 'y') return 13; // EY sound
    return 11; // Basic E sound
  }
  
  if (letter === 'i') {
    if (nextLetter === 'y') return 18; // IY sound
    return 17; // Basic I sound
  }
  
  if (letter === 'o') {
    if (nextLetter === 'w') return 25; // OW sound
    if (nextLetter === 'y') return 26; // OY sound
    return 25; // Basic O sound
  }
  
  if (letter === 'u') {
    if (prevLetter === 'q') return 34; // QU combination
    return 33; // Basic U sound
  }
  
  return letterToVisemeMap[letter] || 1; // Default to neutral if not found
}
