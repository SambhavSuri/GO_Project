import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';

export interface VisemeData {
  audioOffset: number;
  visemeId: number;
}

export interface SpeechConfig {
  speechKey: string;
  speechRegion: string;
  voice?: string;
}

export class AzureSpeechService {
  private speechConfig: SpeechSDK.SpeechConfig;
  private synthesizer: SpeechSDK.SpeechSynthesizer | null = null;

  constructor(config: SpeechConfig) {
    this.speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
      config.speechKey,
      config.speechRegion
    );
    
    // Set the voice name (you can change this to any supported voice)
    this.speechConfig.speechSynthesisVoiceName = config.voice || 'en-US-DavisNeural';
    
    // Enable viseme events
    this.speechConfig.setProperty(
      SpeechSDK.PropertyId.SpeechServiceResponse_RequestWordLevelTimestamps,
      'true'
    );
  }

  async speakText(
    text: string,
    onViseme?: (viseme: VisemeData) => void,
    onAudioData?: (audioData: ArrayBuffer) => void,
    onSpeechEnd?: () => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create audio config for browser audio output
        const audioConfig = SpeechSDK.AudioConfig.fromDefaultSpeakerOutput();
        
        // Create synthesizer
        this.synthesizer = new SpeechSDK.SpeechSynthesizer(
          this.speechConfig,
          audioConfig
        );

        // Set up viseme event handler
        if (onViseme) {
          this.synthesizer.visemeReceived = (sender, event) => {
            onViseme({
              audioOffset: event.audioOffset,
              visemeId: event.visemeId
            });
          };
        }

        // Set up word boundary event handler for additional timing info
        this.synthesizer.wordBoundary = (sender, event) => {
          console.log(`Word: ${event.text}, Offset: ${event.audioOffset}`);
        };

        // Synthesize speech
        this.synthesizer.speakTextAsync(
          text,
          (result) => {
            if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
              console.log('Speech synthesis completed');
              if (onAudioData && result.audioData) {
                onAudioData(result.audioData);
              }
              if (onSpeechEnd) {
                onSpeechEnd();
              }
              resolve();
            } else {
              console.error('Speech synthesis failed:', result.errorDetails);
              reject(new Error(result.errorDetails));
            }
            
            // Clean up
            this.synthesizer?.close();
            this.synthesizer = null;
          },
          (error) => {
            console.error('Speech synthesis error:', error);
            this.synthesizer?.close();
            this.synthesizer = null;
            reject(error);
          }
        );
      } catch (error) {
        console.error('Error setting up speech synthesis:', error);
        reject(error);
      }
    });
  }

  async stopSpeaking(): Promise<void> {
    if (this.synthesizer) {
      this.synthesizer.close();
      this.synthesizer = null;
    }
  }

  // Synthesize audio and return the audio data (no direct playback)
  async synthesizeAudioData(
    text: string,
    onViseme?: (viseme: VisemeData) => void,
    onWordBoundary?: (word: string, audioOffset: number) => void
  ): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      try {
        // Create synthesizer with stream output to disable direct speaker playback
        const audioStream = SpeechSDK.AudioOutputStream.createPullStream();
        const audioConfig = SpeechSDK.AudioConfig.fromStreamOutput(audioStream);
        this.synthesizer = new SpeechSDK.SpeechSynthesizer(this.speechConfig, audioConfig);

        // Set up viseme event handler
        if (onViseme) {
          this.synthesizer.visemeReceived = (sender, event) => {
            onViseme({
              audioOffset: event.audioOffset,
              visemeId: event.visemeId
            });
          };
        }

        // Set up word boundary event handler
        if (onWordBoundary) {
          this.synthesizer.wordBoundary = (sender, event) => {
            onWordBoundary(event.text, event.audioOffset);
          };
        }

        // Synthesize speech and get audio data
        this.synthesizer.speakTextAsync(
          text,
          (result) => {
            if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
              console.log('[AzureSDK] Audio synthesis completed, returning data');
              if (result.audioData) {
                resolve(result.audioData);
              } else {
                reject(new Error('No audio data received'));
              }
            } else {
              console.error('[AzureSDK] Audio synthesis failed:', result.errorDetails);
              reject(new Error(result.errorDetails));
            }
            
            // Clean up
            this.synthesizer?.close();
            this.synthesizer = null;
          },
          (error) => {
            console.error('[AzureSDK] Audio synthesis error:', error);
            this.synthesizer?.close();
            this.synthesizer = null;
            reject(error);
          }
        );
      } catch (error) {
        console.error('[AzureSDK] Error setting up audio synthesis:', error);
        reject(error);
      }
    });
  }

  // Get available voices
  async getAvailableVoices(): Promise<SpeechSDK.VoiceInfo[]> {
    return new Promise((resolve, reject) => {
      const synthesizer = new SpeechSDK.SpeechSynthesizer(this.speechConfig);
      
      try {
        const result = synthesizer.getVoicesAsync();
        synthesizer.close();
        resolve([]);
      } catch (error) {
        synthesizer.close();
        reject(error);
      }
    });
  }
}

// Helper function to create speech service instance
export function createSpeechService(speechKey: string, speechRegion: string, voice?: string): AzureSpeechService {
  return new AzureSpeechService({
    speechKey,
    speechRegion,
    voice
  });
}
