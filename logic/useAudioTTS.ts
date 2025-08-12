import { useRef, useCallback, useEffect } from "react";
import { useAudioSpeakingContext } from "./useAudioSpeakingContext";
import { deepgramTTS } from "../lib/api";

// Audio constants
const SAMPLE_RATE = 48000;
const BUFFER_DURATION_MS = 3000; // 3 seconds

// Streaming Audio Buffer Manager - Processes and plays audio in 3-second chunks
class StreamingAudioBufferManager {
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private isPlaying: boolean = false;
  private onComplete: ((duration: number) => void) | null = null;
  private completionCalled: boolean = false;
  
  // Add callback for when audio starts playing
  private onStartPlaying: (() => void) | null = null;
  
  // Buffer for collecting audio data in 3-second chunks
  private audioChunks: Uint8Array[] = [];
  private currentSource: AudioBufferSourceNode | null = null;
  private isStopped: boolean = false;
  private totalBytes: number = 0;
  private sequenceNumber: number = 0;
  private isProcessing: boolean = false;
  private totalDuration: number = 0;
  
  // Track if we've already notified about starting to play
  private hasNotifiedStart: boolean = false;
  
  // Queue for sequential playback
  private audioQueue: Uint8Array[] = [];
  private isPlayingFromQueue: boolean = false;

  // Audio properties from WAV file
  private actualSampleRate: number = SAMPLE_RATE; // Will be updated from WAV header
  private actualChannels: number = 1;
  private actualBitsPerSample: number = 16;

  constructor() {
    // Don't initialize AudioContext in constructor - wait for user interaction
    console.log('[StreamingAudioBufferManager] Constructor called - AudioContext will be initialized on first user interaction');
  }

  setOnComplete(callback: (duration: number) => void) {
    this.onComplete = callback;
  }

  // Add method to set callback for when audio starts playing
  setOnStartPlaying(callback: () => void) {
    this.onStartPlaying = callback;
  }

  // Ensure AudioContext is ready - call this after user interaction
  async ensureAudioContextReady(): Promise<boolean> {
    if (this.audioContext && this.audioContext.state === 'running') {
      console.log('[StreamingAudioBufferManager] AudioContext already ready');
      return true;
    }

    console.log('[StreamingAudioBufferManager] Initializing AudioContext after user interaction...');
    try {
      await this.initAudioContext();
      return this.audioContext?.state === 'running';
    } catch (error) {
      console.error('[StreamingAudioBufferManager] Failed to initialize AudioContext:', error);
      return false;
    }
  }

  private async initAudioContext() {
    try {
      console.log('[StreamingAudioBufferManager] Initializing AudioContext...');
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ 
        sampleRate: SAMPLE_RATE,
        latencyHint: 'interactive'
      });
      
      console.log('[StreamingAudioBufferManager] AudioContext created, state:', this.audioContext.state);
      
      if (this.audioContext.state === 'suspended') {
        console.log('[StreamingAudioBufferManager] AudioContext suspended, resuming...');
        await this.audioContext.resume();
        console.log('[StreamingAudioBufferManager] AudioContext resumed, state:', this.audioContext.state);
      }
      
      // Wait for context to be ready
      if (this.audioContext.state !== 'running') {
        console.log('[StreamingAudioBufferManager] Waiting for AudioContext to be running...');
        await new Promise<void>((resolve) => {
          const checkState = () => {
            if (this.audioContext?.state === 'running') {
              console.log('[StreamingAudioBufferManager] AudioContext is now running');
              resolve();
            } else {
              console.log('[StreamingAudioBufferManager] AudioContext state:', this.audioContext?.state);
              setTimeout(checkState, 100);
            }
          };
          checkState();
        });
      }
      
      console.log('[StreamingAudioBufferManager] Setting up audio chain...');
      this.setupAudioChain();
      console.log('[StreamingAudioBufferManager] AudioContext initialization complete');
    } catch (error) {
      console.error('[StreamingAudioBufferManager] Error initializing AudioContext:', error);
    }
  }

  private setupAudioChain() {
    if (!this.audioContext) return;

    // Create compressor for better audio quality
    this.compressorNode = this.audioContext.createDynamicsCompressor();
    this.compressorNode.threshold.value = -24;
    this.compressorNode.knee.value = 30;
    this.compressorNode.ratio.value = 12;
    this.compressorNode.attack.value = 0.003;
    this.compressorNode.release.value = 0.25;

    // Create gain node
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = 0.8;

    // Connect chain
    this.compressorNode.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);
  }

  // Add complete audio data (from REST API)
  addCompleteAudio(audioData: Uint8Array) {
    console.log('[StreamingAudioBufferManager] addCompleteAudio called with data size:', audioData.length, 'bytes');
    
    if (this.isStopped) {
      console.log('[StreamingAudioBufferManager] addCompleteAudio blocked - stopped');
      return;
    }

    if (!audioData || audioData.length === 0) {
      console.log('[StreamingAudioBufferManager] addCompleteAudio blocked - empty data');
      return;
    }

    // Parse WAV header if present
    let pcmData = audioData;
    
    if (audioData.length > 44) {
      // Check if this is a WAV file (RIFF header)
      const isWav = audioData[0] === 0x52 && audioData[1] === 0x49 && 
                   audioData[2] === 0x46 && audioData[3] === 0x46;
      
      if (isWav) {
        console.log('[StreamingAudioBufferManager] Detected WAV format, parsing header');

        // Parse WAV header to get sample rate
        const dataView = new DataView(audioData.buffer, audioData.byteOffset, audioData.length);
        
        // Sample rate is at offset 24 (little endian)
        this.actualSampleRate = dataView.getUint32(24, true);
        this.actualChannels = dataView.getUint16(22, true);
        this.actualBitsPerSample = dataView.getUint16(34, true);
        
        console.log('[StreamingAudioBufferManager] WAV header - Sample rate:', this.actualSampleRate, 'Hz, Channels:', this.actualChannels, 'Bits per sample:', this.actualBitsPerSample);
        
        // Extract PCM data after WAV header (typically 44 bytes)
        pcmData = audioData.slice(44);
        console.log('[StreamingAudioBufferManager] WAV header removed, PCM data size:', pcmData.length);
      } else {
        console.log('[StreamingAudioBufferManager] Not a WAV file, using raw data');
      }
    }

    this.totalBytes = pcmData.length;

    // Split the complete audio into 3-second chunks
    const actualBytesPerBuffer = (this.actualSampleRate * BUFFER_DURATION_MS * this.actualBitsPerSample / 8) / 1000;
    console.log('[StreamingAudioBufferManager] Splitting audio into chunks of', actualBytesPerBuffer, 'bytes each');
    
    let offset = 0;
    while (offset < pcmData.length) {
      const chunkSize = Math.min(actualBytesPerBuffer, pcmData.length - offset);
      const chunk = pcmData.slice(offset, offset + chunkSize);
      this.audioChunks.push(chunk);
      offset += chunkSize;
    }

    console.log('[StreamingAudioBufferManager] Split audio into', this.audioChunks.length, 'chunks');

    // Process all chunks immediately
    this.processAllChunks();
  }

  // Add streaming audio chunk (for streaming TTS)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  addStreamingChunk(audioData: Uint8Array, isFirstChunk: boolean) {
    // For now, just treat as a normal chunk
    if (this.isStopped) return;
    if (!audioData || audioData.length === 0) return;
    this.audioChunks.push(audioData);
    this.processAllChunks();
  }

  private processAllChunks(): void {
    console.log('[StreamingAudioBufferManager] Processing all chunks...');
    
    while (this.audioChunks.length > 0) {
      const chunk = this.audioChunks.shift()!;
      
      // Preprocess the audio chunk
      const processedBuffer = this.preprocessAudio(chunk);
      
      // Add to playback queue
      this.audioQueue.push(processedBuffer);
      this.sequenceNumber++;
    }

    // Start playing from queue if not already playing
    if (!this.isPlayingFromQueue) {
      this.playFromQueue();
    }
  }

  private async playFromQueue(): Promise<void> {
    if (this.isPlayingFromQueue || this.audioQueue.length === 0) {
      return;
    }

    this.isPlayingFromQueue = true;

    while (this.audioQueue.length > 0 && !this.isStopped) {
      const audioData = this.audioQueue.shift()!;
      
      // Calculate the actual duration of this audio buffer using actual sample rate
      const samples = audioData.length / 2; // 16-bit samples
      const actualDuration = samples / this.actualSampleRate; // Duration in seconds
      
      console.log('[StreamingAudioBufferManager] Playing audio buffer, duration:', actualDuration, 'seconds, queue length:', this.audioQueue.length);
      
      await this.playAudioBuffer(audioData, actualDuration);
      
      // Wait for current buffer to finish before playing next
      while (this.isPlaying && !this.isStopped) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    this.isPlayingFromQueue = false;
    
    // Only call completion when queue is empty AND we're not stopped
    // AND we're not currently playing (audio has actually finished)
    if (this.audioQueue.length === 0 && !this.isStopped && !this.isPlaying) {
      if (this.onComplete) {
        console.log('[StreamingAudioBufferManager] Audio queue empty and not playing, calling completion callback');
        this.onComplete(this.totalDuration);
      }
    }
  }

  private preprocessAudio(audioData: Uint8Array): Uint8Array {
    // Convert to Float32Array for processing
    const samples = audioData.length / 2;
    const floatSamples = new Float32Array(samples);
    const dataView = new DataView(audioData.buffer, audioData.byteOffset, audioData.length);

    // Convert to float32
    for (let i = 0; i < samples; i++) {
      const int16Sample = dataView.getInt16(i * 2, true);
      floatSamples[i] = int16Sample / 32767.0;
    }

    // Apply preprocessing effects
    this.applyAudioEffects(floatSamples);

    // Convert back to Int16Array
    const processedInt16 = new Int16Array(samples);
    for (let i = 0; i < samples; i++) {
      processedInt16[i] = Math.max(-32768, Math.min(32767, Math.round(floatSamples[i] * 32767)));
    }

    return new Uint8Array(processedInt16.buffer);
  }

  private applyAudioEffects(floatSamples: Float32Array): void {
    // Apply normalization
    let maxAmplitude = 0;
    for (let i = 0; i < floatSamples.length; i++) {
      maxAmplitude = Math.max(maxAmplitude, Math.abs(floatSamples[i]));
    }

    if (maxAmplitude > 0) {
      const normalizationFactor = Math.min(0.95 / maxAmplitude, 1.0);
      for (let i = 0; i < floatSamples.length; i++) {
        floatSamples[i] *= normalizationFactor;
      }
    }

    // Apply simple low-pass filter for noise reduction
    const alpha = 0.1;
    for (let i = 1; i < floatSamples.length; i++) {
      floatSamples[i] = alpha * floatSamples[i] + (1 - alpha) * floatSamples[i - 1];
    }
  }

  private async playAudioBuffer(audioData: Uint8Array, duration: number): Promise<void> {
    if (this.isStopped) {
      console.log('[StreamingAudioBufferManager] Audio buffer playback blocked - stopped');
      return;
    }

    // Ensure AudioContext is ready before playing
    const isReady = await this.ensureAudioContextReady();
    if (!isReady || !this.audioContext || !this.compressorNode) {
      console.error('[StreamingAudioBufferManager] AudioContext not ready or failed to initialize');
      return;
    }

    // Ensure audio context is running
    if (this.audioContext.state !== 'running') {
      console.log('[StreamingAudioBufferManager] AudioContext not running, attempting to resume...');
      try {
        await this.audioContext.resume();
        console.log('[StreamingAudioBufferManager] AudioContext resumed, state:', this.audioContext.state);
      } catch (error) {
        console.error('[StreamingAudioBufferManager] Failed to resume AudioContext:', error);
        return;
      }
    }

    try {
      console.log('[StreamingAudioBufferManager] Starting audio buffer playback, duration:', duration, 'seconds');
      
      // Convert Uint8Array to AudioBuffer
      const samples = audioData.length / 2;
      const floatSamples = new Float32Array(samples);
      const dataView = new DataView(audioData.buffer, audioData.byteOffset, audioData.length);
      
      for (let i = 0; i < samples; i++) {
        const int16Sample = dataView.getInt16(i * 2, true);
        floatSamples[i] = int16Sample / 32767.0;
      }

      // Create AudioBuffer with the actual sample rate from the WAV file
      const audioBuffer = this.audioContext.createBuffer(1, samples, this.actualSampleRate);
      const channelData = audioBuffer.getChannelData(0);
      channelData.set(floatSamples);

      console.log('[StreamingAudioBufferManager] Created AudioBuffer with', samples, 'samples at', this.actualSampleRate, 'Hz');

      // Create and play source
      this.currentSource = this.audioContext.createBufferSource();
      this.currentSource.buffer = audioBuffer;
      this.currentSource.connect(this.compressorNode);
      
      this.currentSource.onended = () => {
        console.log('[StreamingAudioBufferManager] Audio source ended');
        console.log('[StreamingAudioBufferManager] Audio finished playing - stop button should disappear');
        this.isPlaying = false;
        this.currentSource = null;
        this.totalDuration += duration;
      };
      
      this.currentSource.start();
      this.isPlaying = true;

    } catch (error) {
      console.error('[StreamingAudioBufferManager] Error playing audio buffer:', error);
      this.isPlaying = false;
    }
  }

  // Stop all audio playback
  stop(): void {
    console.log('[StreamingAudioBufferManager] Stop called - stopping all audio playback');
    this.isStopped = true;
    
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        console.log('[StreamingAudioBufferManager] Current audio source stopped');
      } catch (error) {
        console.log('[StreamingAudioBufferManager] Error stopping current source:', error);
      }
      this.currentSource = null;
    }
    
    this.isPlaying = false;
    this.isProcessing = false;
    this.isPlayingFromQueue = false;
    
    // Reset the notification flag when stopping
    this.hasNotifiedStart = false;
    
    // Clear buffers immediately to prevent queued audio from playing
    this.clearBuffers();
    
    // Call completion callback with total duration immediately
    if (this.onComplete) {
      console.log('[StreamingAudioBufferManager] Calling completion callback with duration:', this.totalDuration);
      this.onComplete(this.totalDuration);
    }
    
    console.log('[StreamingAudioBufferManager] Stop completed - all audio stopped and state reset');
  }

  // Force clear all audio (for interruptions)
  forceClear(): void {
    console.log('[StreamingAudioBufferManager] Force clear called - clearing all audio immediately');
    this.isStopped = true;
    this.isPlaying = false;
    this.isProcessing = false;
    this.isPlayingFromQueue = false;
    this.hasNotifiedStart = false;
    
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch (error) {
        console.log('[StreamingAudioBufferManager] Error stopping current source during force clear:', error);
      }
      this.currentSource = null;
    }
    
    // Clear all buffers immediately
    this.clearBuffers();
    
    console.log('[StreamingAudioBufferManager] Force clear completed');
  }

  // Clear all buffers
  clearBuffers(): void {
    this.audioChunks = [];
    this.audioQueue = [];
    this.totalBytes = 0;
    this.sequenceNumber = 0;
    this.totalDuration = 0;
    this.completionCalled = false;
  }

  // Get current buffer status
  getBufferStatus() {
    return {
      isPlaying: this.isPlaying,
      isStopped: this.isStopped,
      isProcessed: false, // Always false for streaming
      totalBytes: this.totalBytes,
      chunksCollected: this.audioChunks.length,
      sequenceNumber: this.sequenceNumber,
      totalDuration: this.totalDuration,
      queueLength: this.audioQueue.length
    };
  }

  // Check if audio is active
  isActive(): boolean {
    return this.isPlaying || this.audioChunks.length > 0 || this.audioQueue.length > 0;
  }

  // Reset for new session
  reset(): void {
    console.log('[StreamingAudioBufferManager] Resetting for new session');
    this.isStopped = false;
    this.clearBuffers();
  }
}

// Updated TTS hook using REST API
export const useDeepgramTTS = (
  setIsAvatarTalking?: (talking: boolean) => void,
  setIsAvatarSessionActive?: (active: boolean) => void,
  onAudioChunkFinished?: (duration: number) => void
) => {
  const { canSpeakRef, isInterruptedRef, registerStopSpeaking } = useAudioSpeakingContext();
  const audioBufferManagerRef = useRef<StreamingAudioBufferManager | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isSpeakingRef = useRef<boolean>(false);
  const speechTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const stopSpeakingRef = useRef<(() => void) | null>(null);
  
  // Add missing refs
  const isWelcomeMessageRef = useRef<boolean>(false);
  const onAudioChunkFinishedRef = useRef<((duration: number) => void) | null>(null);

  // Initialize audio buffer manager
  const initAudioBufferManager = useCallback(() => {
    console.log('[TTS] initAudioBufferManager called');
    if (!audioBufferManagerRef.current) {
      console.log('[TTS] Creating new StreamingAudioBufferManager');
      audioBufferManagerRef.current = new StreamingAudioBufferManager();
      if (onAudioChunkFinished) {
        audioBufferManagerRef.current.setOnComplete((duration: number) => {
          if (onAudioChunkFinishedRef.current) {
            onAudioChunkFinishedRef.current(duration);
          }
          
          // Reset avatar state
          if (setIsAvatarTalking) {
            setIsAvatarTalking(false);
          }
          
          // Only reset isAvatarSessionActive for non-welcome messages
          if (!isWelcomeMessageRef.current && setIsAvatarSessionActive) {
            setIsAvatarSessionActive(false);
          }
          
          // Reset welcome message flag
          isWelcomeMessageRef.current = false;
          
          // Ensure buffer manager is completely cleared after audio finishes
          if (audioBufferManagerRef.current) {
            console.log('[TTS] Audio finished, clearing buffer manager');
            audioBufferManagerRef.current.forceClear();
          }
        });
      }
    } else {
      console.log('[TTS] Resetting existing StreamingAudioBufferManager');
      console.log('[TTS] Buffer manager state before reset:', audioBufferManagerRef.current.getBufferStatus());
      audioBufferManagerRef.current.reset();
      console.log('[TTS] Buffer manager state after reset:', audioBufferManagerRef.current.getBufferStatus());
    }
  }, [onAudioChunkFinished, setIsAvatarTalking, setIsAvatarSessionActive]);

  // Main TTS function using Deepgram REST API
  const speakText = useCallback(async (text: string, isWelcome: boolean = false) => {
    // Initialize audio buffer manager if not already done
    initAudioBufferManager();
    
    // Reset the audio buffer manager if it's in a stopped state
    if (audioBufferManagerRef.current) {
      const bufferStatus = audioBufferManagerRef.current.getBufferStatus();
      if (bufferStatus.isStopped) {
        console.log('[DeepgramTTS] Buffer manager is stopped, resetting for new message');
        audioBufferManagerRef.current.reset();
      }
      // Force clear any remaining audio from previous session
      if (bufferStatus.queueLength > 0 || bufferStatus.chunksCollected > 0) {
        console.log('[DeepgramTTS] Clearing remaining audio from previous session');
        audioBufferManagerRef.current.forceClear();
        // Wait a moment to ensure audio is fully cleared
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    if (!text.trim() || !canSpeakRef.current || isInterruptedRef.current) {
      return;
    }

    try {
      // Set welcome message flag
      isWelcomeMessageRef.current = isWelcome;
      
      // Set isAvatarTalking to true immediately since we'll start playing soon
      if (setIsAvatarTalking) {
        setIsAvatarTalking(true);
      }
      
      // Only set isAvatarSessionActive for non-welcome messages
      if (!isWelcome && setIsAvatarSessionActive) {
        setIsAvatarSessionActive(true);
      }

      console.log('[DeepgramTTS] Calling REST API for text:', text);
      
      // Call the REST API to get audio data
      const audioData = await deepgramTTS(text);
      
      if (!audioData) {
        console.error('[DeepgramTTS] Failed to get audio data from REST API');
        if (setIsAvatarTalking) setIsAvatarTalking(false);
        if (setIsAvatarSessionActive) setIsAvatarSessionActive(false);
        return;
      }

      console.log('[DeepgramTTS] Received audio data, size:', audioData.length, 'bytes');

      // Add the complete audio to the buffer manager
      if (audioBufferManagerRef.current) {
        console.log('[DeepgramTTS] Adding audio to buffer manager');
        // Ensure AudioContext is ready before adding audio
        const isReady = await audioBufferManagerRef.current.ensureAudioContextReady();
        if (isReady) {
          audioBufferManagerRef.current.addCompleteAudio(audioData);
        } else {
          console.error('[DeepgramTTS] Failed to initialize AudioContext - cannot play audio');
          if (setIsAvatarTalking) setIsAvatarTalking(false);
          if (setIsAvatarSessionActive) setIsAvatarSessionActive(false);
        }
      } else {
        console.error('[DeepgramTTS] Audio buffer manager is null!');
      }

    } catch (error) {
      console.error('[DeepgramTTS] Error in speakText:', error);
      if (setIsAvatarTalking) setIsAvatarTalking(false);
      if (setIsAvatarSessionActive) setIsAvatarSessionActive(false);
    }
  }, [initAudioBufferManager, setIsAvatarTalking, setIsAvatarSessionActive]);

  // Stop speaking function
  const stopSpeaking = useCallback((forceStop: boolean = false) => {
    console.log('[TTS] stopSpeaking called with forceStop:', forceStop);
    
    // Stop browser speech synthesis
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
      console.log('[TTS] Browser speech synthesis cancelled');
    }
    
    // Clear speech synthesis state
    isSpeakingRef.current = false;
    currentUtteranceRef.current = null;
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
      console.log('[TTS] Speech timeout cleared');
    }
    
    // Stop Deepgram audio buffer manager
    if (audioBufferManagerRef.current) {
      console.log('[TTS] Stopping Deepgram audio buffer manager');
      if (forceStop) {
        // Use force clear for interruptions to immediately clear all queued audio
        audioBufferManagerRef.current.forceClear();
      } else {
        // Use normal stop for graceful stopping
        audioBufferManagerRef.current.stop();
      }
      console.log('[TTS] Deepgram audio buffer manager stopped');
    } else {
      console.log('[TTS] No audio buffer manager to stop');
    }
    
    // Immediately update state
    if (setIsAvatarTalking) {
      console.log('[TTS] Setting isAvatarTalking to false');
      setIsAvatarTalking(false);
      console.log('[TTS] isAvatarTalking set to false');
    }
    if (setIsAvatarSessionActive) {
      console.log('[TTS] Setting isAvatarSessionActive to false');
      setIsAvatarSessionActive(false);
      console.log('[TTS] isAvatarSessionActive set to false');
    }
    
    console.log('[TTS] stopSpeaking completed - all speech stopped');
  }, [setIsAvatarTalking, setIsAvatarSessionActive]);

  // Store the current stopSpeaking function in the ref
  useEffect(() => {
    stopSpeakingRef.current = stopSpeaking;
  }, [stopSpeaking]);

  // Register the stopSpeaking function with the AudioSpeakingContext
  useEffect(() => {
    registerStopSpeaking(stopSpeaking);
  }, [registerStopSpeaking, stopSpeaking]);

  // Listen for force stop audio events (when modal is closed)
  useEffect(() => {
    const handleForceStopAudio = () => {
      console.log('[DeepgramTTS] Force stop audio event received - stopping all audio');
      if (audioBufferManagerRef.current) {
        audioBufferManagerRef.current.forceClear();
      }
      if (setIsAvatarTalking) {
        setIsAvatarTalking(false);
      }
      if (setIsAvatarSessionActive) {
        setIsAvatarSessionActive(false);
      }
    };

    window.addEventListener('forceStopAudio', handleForceStopAudio);
    
    return () => {
      window.removeEventListener('forceStopAudio', handleForceStopAudio);
    };
  }, [setIsAvatarTalking, setIsAvatarSessionActive]);

  const getBufferingState = useCallback(() => {
    if (!audioBufferManagerRef.current) return { isBuffering: false, totalBufferedBytes: 0, minBufferBytes: 0, bufferProgress: 0 };
    const status = audioBufferManagerRef.current.getBufferStatus();
    return {
      isBuffering: status.isPlaying || isSpeakingRef.current,
      totalBufferedBytes: status.totalBytes,
      minBufferBytes: 1000,
      bufferProgress: status.isProcessed ? 100 : Math.min((status.totalBytes / 10000) * 100, 99)
    };
  }, []);

  return { 
    speakText, 
    stopSpeaking, 
    getBufferingState
  };
}; 

// Streaming TTS hook using Deepgram's streaming API with stop support
export const useStreamingDeepgramTTS = (
  setIsAvatarTalking?: (talking: boolean) => void,
  setIsAvatarSessionActive?: (active: boolean) => void,
  onAudioChunkFinished?: (duration: number) => void
) => {
  const { canSpeakRef, isInterruptedRef, registerStopSpeaking } = useAudioSpeakingContext();
  const audioBufferManagerRef = useRef<StreamingAudioBufferManager | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isWelcomeMessageRef = useRef<boolean>(false);
  const onAudioChunkFinishedRef = useRef<((duration: number) => void) | null>(null);

  useEffect(() => { onAudioChunkFinishedRef.current = onAudioChunkFinished ?? null; }, [onAudioChunkFinished]);

  // Initialize audio buffer manager
  const initAudioBufferManager = useCallback(() => {
    if (!audioBufferManagerRef.current) {
      audioBufferManagerRef.current = new StreamingAudioBufferManager();
      if (onAudioChunkFinished) {
        audioBufferManagerRef.current.setOnComplete((duration: number) => {
          if (onAudioChunkFinishedRef.current) {
            onAudioChunkFinishedRef.current(duration);
          }
          if (setIsAvatarTalking) setIsAvatarTalking(false);
          if (!isWelcomeMessageRef.current && setIsAvatarSessionActive) setIsAvatarSessionActive(false);
          isWelcomeMessageRef.current = false;
          if (audioBufferManagerRef.current) audioBufferManagerRef.current.forceClear();
        });
      }
    } else {
      audioBufferManagerRef.current.reset();
    }
  }, [onAudioChunkFinished, setIsAvatarTalking, setIsAvatarSessionActive]);

  // Main streaming TTS function
  const speakTextStreaming = useCallback(async (text: string, isWelcome: boolean = false) => {
    initAudioBufferManager();
    if (audioBufferManagerRef.current) {
      const bufferStatus = audioBufferManagerRef.current.getBufferStatus();
      if (bufferStatus.isStopped) audioBufferManagerRef.current.reset();
      if (bufferStatus.queueLength > 0 || bufferStatus.totalBytes > 0) {
        audioBufferManagerRef.current.forceClear();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    if (!text.trim() || !canSpeakRef.current || isInterruptedRef.current) return;
    try {
      isWelcomeMessageRef.current = isWelcome;
      if (setIsAvatarTalking) setIsAvatarTalking(true);
      if (!isWelcome && setIsAvatarSessionActive) setIsAvatarSessionActive(true);
      // Abort previous fetch if any
      if (abortControllerRef.current) abortControllerRef.current.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      await deepgramStreamingTTS(
        text,
        async (audioData: Uint8Array, isFirstChunk: boolean) => {
          if (audioBufferManagerRef.current) {
            // Ensure AudioContext is ready before adding streaming chunk
            const isReady = await audioBufferManagerRef.current.ensureAudioContextReady();
            if (isReady) {
              audioBufferManagerRef.current.addStreamingChunk(audioData, isFirstChunk);
            }
          }
        },
        () => {},
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        (error: string) => {
          if (setIsAvatarTalking) setIsAvatarTalking(false);
          if (setIsAvatarSessionActive) setIsAvatarSessionActive(false);
        },
        abortController.signal
      );
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      if (setIsAvatarTalking) setIsAvatarTalking(false);
      if (setIsAvatarSessionActive) setIsAvatarSessionActive(false);
    }
  }, [initAudioBufferManager, setIsAvatarTalking, setIsAvatarSessionActive]);

  // Stop speaking function
  const stopSpeaking = useCallback((forceStop: boolean = false) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    if (audioBufferManagerRef.current) {
      if (forceStop) audioBufferManagerRef.current.forceClear();
      else audioBufferManagerRef.current.stop();
    }
    if (setIsAvatarTalking) setIsAvatarTalking(false);
    if (setIsAvatarSessionActive) setIsAvatarSessionActive(false);
  }, [setIsAvatarTalking, setIsAvatarSessionActive]);

  useEffect(() => { registerStopSpeaking(stopSpeaking); }, [registerStopSpeaking, stopSpeaking]);
  useEffect(() => {
    const handleForceStopAudio = () => {
      if (audioBufferManagerRef.current) audioBufferManagerRef.current.forceClear();
      if (setIsAvatarTalking) setIsAvatarTalking(false);
      if (setIsAvatarSessionActive) setIsAvatarSessionActive(false);
    };
    window.addEventListener('forceStopAudio', handleForceStopAudio);
    return () => { window.removeEventListener('forceStopAudio', handleForceStopAudio); };
  }, [setIsAvatarTalking, setIsAvatarSessionActive]);

  return { speakTextStreaming, stopSpeaking };
};

// Streaming TTS function using Deepgram's streaming API with abort support
async function deepgramStreamingTTS(
  text: string,
  onAudioChunk: (audioData: Uint8Array, isFirstChunk: boolean) => void,
  onComplete: () => void,
  onError: (error: string) => void,
  signal: AbortSignal
): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
  if (!apiKey) { onError('No Deepgram API key found'); return; }
  try {
    console.log('[StreamingTTS] Using male voice: aura-2-apollo-en');
    const url = 'https://api.deepgram.com/v1/speak?model=aura-2-apollo-en&encoding=linear16&container=wav&voice=apollo';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
      signal,
    });
    if (!response.ok) { onError(`TTS API error: ${response.status} ${response.statusText}`); return; }
    if (!response.body) { onError('No response body available for streaming'); return; }
    const reader = response.body.getReader();
    let isFirstChunk = true;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) { onComplete(); break; }
        onAudioChunk(new Uint8Array(value), isFirstChunk);
        isFirstChunk = false;
      }
    } catch (streamError) {
      if (signal.aborted) { onError('TTS streaming aborted'); } else { onError(`Stream reading error: ${streamError instanceof Error ? streamError.message : 'Unknown error'}`); }
    } finally { reader.releaseLock(); }
  } catch (error) { if (signal.aborted) { onError('TTS streaming aborted'); } else { onError(`TTS error: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
} 