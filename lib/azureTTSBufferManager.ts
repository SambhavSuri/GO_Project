import { VisemeData } from './azureTTS';

// Audio constants
const SAMPLE_RATE = 48000;
const BUFFER_DURATION_MS = 800; // Reduced to 800ms for more fluent TTS

// Azure TTS Audio Buffer Manager with Viseme Support
export class AzureTTSBufferManager {
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private isPlaying: boolean = false;
  private onComplete: ((duration: number) => void) | null = null;
  private onStartPlaying: (() => void) | null = null;
  private onViseme: ((viseme: VisemeData) => void) | null = null;
  
  // Audio buffer management
  private audioChunks: Uint8Array[] = [];
  private currentSource: AudioBufferSourceNode | null = null;
  private isStopped: boolean = false;
  private totalBytes: number = 0;
  private sequenceNumber: number = 0;
  private isProcessing: boolean = false;
  private totalDuration: number = 0;
  private hasNotifiedStart: boolean = false;
  
  // Queue for sequential playback
  private audioQueue: Uint8Array[] = [];
  private isPlayingFromQueue: boolean = false;
  
  // Viseme management
  private visemes: VisemeData[] = [];
  private visemeTimeouts: NodeJS.Timeout[] = [];
  private audioStartTime: number = 0;
  private completionCalled: boolean = false;
  private currentAudioElement: HTMLAudioElement | null = null;
  
  // Audio properties
  private actualSampleRate: number = SAMPLE_RATE;
  private actualChannels: number = 1;
  private actualBitsPerSample: number = 16;
  
  constructor() {
    console.log('[AzureTTSBufferManager] Constructor called');
  }
  
  setOnComplete(callback: (duration: number) => void) {
    this.onComplete = callback;
  }
  
  setOnStartPlaying(callback: () => void) {
    this.onStartPlaying = callback;
  }
  
  setOnViseme(callback: (viseme: VisemeData) => void) {
    this.onViseme = callback;
  }
  
  // Ensure AudioContext is ready
  async ensureAudioContextReady(): Promise<boolean> {
    if (this.audioContext && this.audioContext.state === 'running') {
      console.log('[AzureTTSBufferManager] AudioContext already ready');
      return true;
    }
    
    console.log('[AzureTTSBufferManager] Initializing AudioContext...');
    try {
      await this.initAudioContext();
      return this.audioContext?.state === 'running';
    } catch (error) {
      console.error('[AzureTTSBufferManager] Failed to initialize AudioContext:', error);
      return false;
    }
  }
  
  private async initAudioContext() {
    try {
      console.log('[AzureTTSBufferManager] Creating AudioContext...');
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: SAMPLE_RATE,
        latencyHint: 'interactive'
      });
      
      console.log('[AzureTTSBufferManager] AudioContext created, state:', this.audioContext.state);
      
      if (this.audioContext.state === 'suspended') {
        console.log('[AzureTTSBufferManager] AudioContext suspended, resuming...');
        await this.audioContext.resume();
        console.log('[AzureTTSBufferManager] AudioContext resumed, state:', this.audioContext.state);
      }
      
      // Wait for context to be ready
      if (this.audioContext.state !== 'running') {
        console.log('[AzureTTSBufferManager] Waiting for AudioContext to be running...');
        await new Promise<void>((resolve) => {
          const checkState = () => {
            if (this.audioContext?.state === 'running') {
              console.log('[AzureTTSBufferManager] AudioContext is now running');
              resolve();
            } else {
              console.log('[AzureTTSBufferManager] AudioContext state:', this.audioContext?.state);
              setTimeout(checkState, 100);
            }
          };
          checkState();
        });
      }
      
      console.log('[AzureTTSBufferManager] Setting up audio chain...');
      this.setupAudioChain();
      console.log('[AzureTTSBufferManager] AudioContext initialization complete');
    } catch (error) {
      console.error('[AzureTTSBufferManager] Error initializing AudioContext:', error);
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
  
  // Add complete audio data with optional visemes
  async addCompleteAudio(audioData: Uint8Array, visemes?: VisemeData[], allowSequential: boolean = false) {
    console.log('[AzureTTSBufferManager] addCompleteAudio called with data size:', audioData.length, 'bytes', 'allowSequential:', allowSequential);
    
    if (this.isStopped) {
      console.log('[AzureTTSBufferManager] addCompleteAudio was blocked - stopped, but resetting for new audio');
      this.isStopped = false; // Reset stopped state for new audio
      this.completionCalled = false; // Reset completion flag
    }
    
    if (!audioData || audioData.length === 0) {
      console.log('[AzureTTSBufferManager] addCompleteAudio blocked - empty data');
      return;
    }
    
    // Only stop previous audio if NOT part of a sequential session
    if (!allowSequential && (this.isPlaying || this.isPlayingFromQueue || this.currentAudioElement)) {
      console.log('[AzureTTSBufferManager] 🛑 PREVENTING AUDIO OVERLAP - Stopping previous audio before playing new audio');
      console.log('[AzureTTSBufferManager] Previous state - isPlaying:', this.isPlaying, 'isPlayingFromQueue:', this.isPlayingFromQueue, 'hasAudioElement:', !!this.currentAudioElement);
      console.log('[AzureTTSBufferManager] New audio text preview:', audioData.length, 'bytes');
      
      // Stop everything immediately to prevent overlap
      this.forceClear();
      
      // Reset completion flag for new audio
      this.completionCalled = false;
      this.isStopped = false; // Re-enable for new audio
      console.log('[AzureTTSBufferManager] ✅ Previous audio cleared, ready for new audio');
      
      // Wait longer for cleanup to complete and browser to finish pause operations
      await new Promise(resolve => setTimeout(resolve, 150));
    } else if (allowSequential && (this.isPlaying || this.currentAudioElement)) {
      console.log('[AzureTTSBufferManager] 🔄 Sequential audio - waiting for current audio to finish before playing next');
      // For sequential audio, wait for current audio to finish instead of forcefully stopping
      return new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.isPlaying && !this.currentAudioElement) {
            clearInterval(checkInterval);
            console.log('[AzureTTSBufferManager] ✅ Previous audio finished, ready for next sequential audio');
            // Recursively call with the same parameters
            this.addCompleteAudio(audioData, visemes, allowSequential).then(resolve);
          }
        }, 50);
        
        // Timeout after 10 seconds to prevent infinite waiting
        setTimeout(() => {
          clearInterval(checkInterval);
          console.warn('[AzureTTSBufferManager] ⚠️ Timeout waiting for previous audio to finish, proceeding anyway');
          this.addCompleteAudio(audioData, visemes, false).then(resolve); // Force stop on timeout
        }, 10000);
      });
    }
    
    // Store visemes for synchronized playback
    if (visemes && visemes.length > 0) {
      this.visemes = [...visemes];
      console.log('[AzureTTSBufferManager] Stored', this.visemes.length, 'visemes');
    }
    
    // Parse audio format and split into chunks
    let pcmData = audioData;
    let isMP3Format = false;
    let isWavFormat = false;
    
    // Check audio format
    if (audioData.length > 44) {
      // Check if this is MP3 (Azure TTS typically returns MP3)
      const isMP3 = (audioData[0] === 0xFF && (audioData[1] & 0xE0) === 0xE0) || // MP3 sync
                   (audioData[0] === 0x49 && audioData[1] === 0x44 && audioData[2] === 0x33); // ID3
      
      // Check if this is WAV (in case Azure returns WAV sometimes)
      const isWav = audioData[0] === 0x52 && audioData[1] === 0x49 && 
                   audioData[2] === 0x46 && audioData[3] === 0x46;
      
      if (isMP3) {
        console.log('[AzureTTSBufferManager] Detected MP3 format - will decode in playback');
        isMP3Format = true;
        pcmData = audioData;
      } else if (isWav) {
        console.log('[AzureTTSBufferManager] Detected WAV format, parsing header');
        isWavFormat = true;
        
        // Parse WAV header to get sample rate and audio properties
        const dataView = new DataView(audioData.buffer, audioData.byteOffset, audioData.length);
        
        // Sample rate is at offset 24 (little endian)
        this.actualSampleRate = dataView.getUint32(24, true);
        this.actualChannels = dataView.getUint16(22, true);
        this.actualBitsPerSample = dataView.getUint16(34, true);
        
        console.log('[AzureTTSBufferManager] WAV header - Sample rate:', this.actualSampleRate, 'Hz, Channels:', this.actualChannels, 'Bits per sample:', this.actualBitsPerSample);
        
        // Extract PCM data after WAV header (typically 44 bytes)
        pcmData = audioData.slice(44);
        console.log('[AzureTTSBufferManager] WAV header removed, PCM data size:', pcmData.length);
      } else {
        console.log('[AzureTTSBufferManager] Using raw audio data');
      }
    }
    
    this.totalBytes = pcmData.length;
    
    // For WAV/PCM data, split into larger chunks and preprocess
    // For MP3 data, use smaller chunks without preprocessing
    if (isWavFormat && pcmData.length > 0) {
      // Split WAV PCM data into larger chunks based on actual sample rate
      const actualBytesPerBuffer = (this.actualSampleRate * BUFFER_DURATION_MS * this.actualBitsPerSample / 8 * this.actualChannels) / 1000;
      console.log('[AzureTTSBufferManager] Using WAV chunking - chunks of', actualBytesPerBuffer, 'bytes each');
      
      let offset = 0;
      while (offset < pcmData.length) {
        const chunkSize = Math.min(actualBytesPerBuffer, pcmData.length - offset);
        const chunk = pcmData.slice(offset, offset + chunkSize);
        
        // Preprocess PCM audio for better quality
        const processedChunk = this.preprocessAudio(chunk);
        this.audioChunks.push(processedChunk);
        offset += chunkSize;
      }
    } else {
      // For MP3 or unknown formats, use smaller chunks without preprocessing
      const chunkSize = Math.min(8192, pcmData.length);
      let offset = 0;
      while (offset < pcmData.length) {
        const actualChunkSize = Math.min(chunkSize, pcmData.length - offset);
        const chunk = pcmData.slice(offset, offset + actualChunkSize);
        this.audioChunks.push(chunk);
        offset += actualChunkSize;
      }
    }
    
    console.log('[AzureTTSBufferManager] Split audio into', this.audioChunks.length, 'chunks');
    
    // Process all chunks
    this.processAllChunks();
  }
  
  // Add streaming audio chunk
  addStreamingChunk(audioData: Uint8Array, isFirstChunk: boolean) {
    if (this.isStopped) return;
    if (!audioData || audioData.length === 0) return;
    
    console.log('[AzureTTSBufferManager] Adding streaming chunk:', audioData.length, 'bytes, first:', isFirstChunk);
    
    this.audioChunks.push(audioData);
    this.processAllChunks();
  }
  
  // Add viseme data
  addVisemes(visemes: VisemeData[]) {
    if (this.isStopped) return;
    
    console.log('[AzureTTSBufferManager] Adding visemes:', visemes.length);
    this.visemes = [...this.visemes, ...visemes];
  }
  
  // Audio preprocessing methods from Deepgram version for better quality
  private preprocessAudio(audioData: Uint8Array): Uint8Array {
    // Convert to Float32Array for processing
    const samples = audioData.length / 2; // Assuming 16-bit samples
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

  private processAllChunks(): void {
    console.log('[AzureTTSBufferManager] Processing all chunks...');
    
    while (this.audioChunks.length > 0) {
      const chunk = this.audioChunks.shift()!;
      
      // Add to playback queue (preprocessing already done for PCM data)
      this.audioQueue.push(chunk);
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
    
    // Start viseme playback when audio starts
    if (this.visemes.length > 0) {
      this.scheduleVisemes();
    }
    
    // Combine all chunks for playback
    const allAudioData = this.combineAudioChunks();
    
    if (allAudioData.length > 0) {
      // Always use MP3 audio playback since Azure TTS returns MP3 format
      await this.playMP3Audio(allAudioData);
    }
    
    this.isPlayingFromQueue = false;
    
    // Only call completion when queue is empty AND we're not stopped
    // AND we're not currently playing (audio has actually finished)
    if (this.audioQueue.length === 0 && !this.isStopped && !this.isPlaying && !this.completionCalled) {
      if (this.onComplete) {
        console.log('[AzureTTSBufferManager] Audio queue empty and not playing, calling completion callback');
        this.completionCalled = true;
        this.onComplete(this.totalDuration);
      }
    } else if (this.isStopped && this.audioQueue.length === 0) {
      console.log('[AzureTTSBufferManager] ✅ Audio queue finished but was FORCE STOPPED - animations should already be stopped');
    }
  }
  
  private combineAudioChunks(): Uint8Array {
    const totalLength = this.audioQueue.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    
    let offset = 0;
    for (const chunk of this.audioQueue) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    
    return combined;
  }
  
  private async playMP3Audio(audioData: Uint8Array): Promise<void> {
    if (this.isStopped) {
      console.log('[AzureTTSBufferManager] ✅ playMP3Audio blocked - already force stopped');
      return;
    }
    
    // Ensure AudioContext is ready
    const isReady = await this.ensureAudioContextReady();
    if (!isReady || !this.audioContext || this.isStopped) {
      console.error('[AzureTTSBufferManager] AudioContext not ready or force stopped during initialization');
      return;
    }
    
    try {
      console.log('[AzureTTSBufferManager] Playing MP3 audio:', audioData.length, 'bytes');
      
      // Create blob and object URL for MP3 data
      // Ensure we have a proper Uint8Array for Blob constructor
      const uint8Array = new Uint8Array(audioData);
      const audioBlob = new Blob([uint8Array], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Create audio element
      const audio = new Audio(audioUrl);
      this.currentAudioElement = audio;
      
      // Set up event listeners
      audio.addEventListener('loadstart', () => {
        console.log('[AzureTTSBufferManager] Audio loading started');
      });
      
      audio.addEventListener('canplay', () => {
        console.log('[AzureTTSBufferManager] Audio can start playing');
        this.isPlaying = true;
        
        // Notify that audio has started playing (for GLB animation)
        if (this.onStartPlaying && !this.hasNotifiedStart) {
          console.log('[AzureTTSBufferManager] Audio started playing - triggering GLB animation');
          this.onStartPlaying();
          this.hasNotifiedStart = true;
        }
        
        // Record start time for viseme synchronization
        this.audioStartTime = performance.now();
      });
      
      audio.addEventListener('ended', () => {
        console.log('[AzureTTSBufferManager] Audio playback ended');
        
        // Check if we've been force stopped during playback - if so, ignore this callback
        if (this.isStopped) {
          console.log('[AzureTTSBufferManager] Audio ended but was force stopped - ignoring callback');
          return;
        }
        
        this.isPlaying = false;
        this.totalDuration = audio.duration || 0;
        
        // Clean up
        URL.revokeObjectURL(audioUrl);
        this.clearVisemeTimeouts();
        this.currentAudioElement = null; // Clear reference
        
        // Call completion callback to stop avatar speaking animation (only if not force stopped)
        if (this.onComplete && !this.isStopped && !this.completionCalled) {
          console.log('[AzureTTSBufferManager] Audio ended naturally - calling completion callback to stop speaking animation');
          this.completionCalled = true;
          this.onComplete(this.totalDuration);
        }
      });
      
      audio.addEventListener('error', (e) => {
        console.error('[AzureTTSBufferManager] Audio playback error:', e);
        
        // Check if we've been force stopped during playback - if so, ignore this callback
        if (this.isStopped) {
          console.log('[AzureTTSBufferManager] Audio error but was force stopped - ignoring callback');
          return;
        }
        
        this.isPlaying = false;
        URL.revokeObjectURL(audioUrl);
        this.currentAudioElement = null; // Clear reference
        
        // Call completion callback even on error to stop speaking animation (only if not force stopped)
        if (this.onComplete && !this.isStopped && !this.completionCalled) {
          console.log('[AzureTTSBufferManager] Audio error - calling completion callback to stop speaking animation');
          this.completionCalled = true;
          this.onComplete(0); // Duration 0 for error case
        }
      });
      
      // Start playback with retry logic for AbortError
      const maxRetries = 3;
      let retryCount = 0;
      let playSuccessful = false;
      
      while (retryCount < maxRetries && !playSuccessful && !this.isStopped) {
        try {
          // Check if force stopped before each retry attempt
          if (this.isStopped) {
            console.log('[AzureTTSBufferManager] ✅ Force stopped during retry - aborting playback attempts');
            break;
          }
          
          // Ensure we're using the same audio element for retries
          if (this.currentAudioElement !== audio) {
            console.log('[AzureTTSBufferManager] Audio element changed during retry, aborting');
            break;
          }
          
          await audio.play();
          playSuccessful = true;
          console.log('[AzureTTSBufferManager] ✅ Audio playback started successfully');
        } catch (playError) {
          retryCount++;
          console.warn(`[AzureTTSBufferManager] Audio play attempt ${retryCount} failed:`, playError);
          
          // If it's an AbortError and we have retries left, wait and try again
          if (playError instanceof Error && playError.name === 'AbortError' && retryCount < maxRetries && !this.isStopped) {
            console.log(`[AzureTTSBufferManager] Retrying audio playback in 200ms (attempt ${retryCount + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Check if we should still retry (audio element might have been cleared)
            if (this.currentAudioElement !== audio || this.isStopped) {
              console.log('[AzureTTSBufferManager] Audio state changed during retry, aborting');
              break;
            }
          } else {
            // If max retries reached or different error, handle it
            console.error('[AzureTTSBufferManager] Failed to start audio playback after retries:', playError);
            this.isPlaying = false;
            URL.revokeObjectURL(audioUrl);
            this.currentAudioElement = null; // Clear reference
            
            // Call completion callback even on play error to stop speaking animation
            if (this.onComplete && !this.isStopped && !this.completionCalled) {
              console.log('[AzureTTSBufferManager] Audio play error - calling completion callback to stop speaking animation');
              this.completionCalled = true;
              this.onComplete(0); // Duration 0 for error case
            }
            break;
          }
        }
      }
      
    } catch (error) {
      console.error('[AzureTTSBufferManager] Error playing MP3 audio:', error);
      this.isPlaying = false;
      this.currentAudioElement = null; // Clear reference
      
      // Call completion callback even on general error to stop speaking animation
      if (this.onComplete && !this.isStopped && !this.completionCalled) {
        console.log('[AzureTTSBufferManager] General error - calling completion callback to stop speaking animation');
        this.completionCalled = true;
        this.onComplete(0); // Duration 0 for error case
      }
    }
  }
  
  private scheduleVisemes() {
    if (!this.onViseme || this.visemes.length === 0 || this.isStopped) return;
    
    console.log('[AzureTTSBufferManager] Scheduling', this.visemes.length, 'visemes');
    
    this.visemes.forEach((viseme, index) => {
      const timeout = setTimeout(() => {
        // Double-check we haven't been force stopped before triggering viseme
        if (!this.isStopped && this.onViseme && !this.completionCalled) {
          console.log('[AzureTTSBufferManager] Triggering viseme:', viseme.visemeId, 'at offset:', viseme.offset);
          this.onViseme(viseme);
        } else if (this.isStopped) {
          console.log('[AzureTTSBufferManager] ✅ Viseme blocked - system was force stopped');
        }
      }, viseme.offset);
      
      this.visemeTimeouts.push(timeout);
    });
  }
  
  private clearVisemeTimeouts() {
    this.visemeTimeouts.forEach(timeout => clearTimeout(timeout));
    this.visemeTimeouts = [];
  }
  
  // Stop all audio playback
  stop(): void {
    console.log('[AzureTTSBufferManager] Stop called');
    this.isStopped = true;
    
    // Stop any playing audio
    this.isPlaying = false;
    this.isProcessing = false;
    this.isPlayingFromQueue = false;
    this.hasNotifiedStart = false;
    
    // Stop current audio element
    if (this.currentAudioElement) {
      console.log('[AzureTTSBufferManager] Stopping current audio element in stop()');
      try {
        this.currentAudioElement.pause();
        this.currentAudioElement.currentTime = 0;
        this.currentAudioElement = null;
      } catch (error) {
        console.log('[AzureTTSBufferManager] Error stopping audio element in stop():', error);
        this.currentAudioElement = null;
      }
    }
    
    // Clear viseme timeouts
    this.clearVisemeTimeouts();
    
    // Clear buffers
    this.clearBuffers();
    
    // Call completion callback
    if (this.onComplete && !this.completionCalled) {
      console.log('[AzureTTSBufferManager] Calling completion callback');
      this.completionCalled = true;
      this.onComplete(this.totalDuration);
    }
    
    console.log('[AzureTTSBufferManager] Stop completed');
  }
  
  // Force clear all audio
  forceClear(): void {
    console.log('[AzureTTSBufferManager] Force clear called - IMMEDIATE INTERRUPTION');
    this.isStopped = true;
    this.isPlaying = false;
    this.isProcessing = false;
    this.isPlayingFromQueue = false;
    this.hasNotifiedStart = false;
    this.completionCalled = true; // Prevent completion callbacks from firing
    
    // Stop current audio element immediately and wait for it to fully stop
    if (this.currentAudioElement) {
      console.log('[AzureTTSBufferManager] FORCE STOPPING current audio element');
      try {
        // Remove ALL event listeners to prevent unwanted callbacks during interruption
        this.currentAudioElement.onended = null;
        this.currentAudioElement.onerror = null;
        this.currentAudioElement.oncanplay = null;
        this.currentAudioElement.onloadstart = null;
        this.currentAudioElement.ontimeupdate = null;
        
        // Pause and reset the audio element immediately
        this.currentAudioElement.pause();
        this.currentAudioElement.currentTime = 0;
        this.currentAudioElement.src = ''; // Clear source to stop any loading
        
        // Clear the reference immediately
        this.currentAudioElement = null;
        console.log('[AzureTTSBufferManager] ✅ Audio element FORCE STOPPED and cleared');
      } catch (error) {
        console.log('[AzureTTSBufferManager] Error force stopping audio element:', error);
        this.currentAudioElement = null;
      }
    }
    
    // Clear viseme timeouts immediately
    this.clearVisemeTimeouts();
    
    // Clear all buffers immediately
    this.clearBuffers();
    
    console.log('[AzureTTSBufferManager] ✅ FORCE CLEAR COMPLETED - All audio and animations stopped');
  }
  
  // Clear all buffers
  clearBuffers(): void {
    this.audioChunks = [];
    this.audioQueue = [];
    this.visemes = [];
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
      isProcessed: false,
      totalBytes: this.totalBytes,
      chunksCollected: this.audioChunks.length,
      sequenceNumber: this.sequenceNumber,
      totalDuration: this.totalDuration,
      queueLength: this.audioQueue.length,
      visemeCount: this.visemes.length
    };
  }
  
  // Check if audio is active
  isActive(): boolean {
    return this.isPlaying || this.audioChunks.length > 0 || this.audioQueue.length > 0;
  }
  
  // Reset for new session
  reset(): void {
    console.log('[AzureTTSBufferManager] 🔄 Resetting for new session - clearing all state');
    this.isStopped = false;
    this.isPlaying = false;
    this.isProcessing = false;
    this.isPlayingFromQueue = false;
    this.hasNotifiedStart = false;
    this.completionCalled = false; // CRITICAL: Allow new completion callbacks
    this.currentAudioElement = null; // Clear any stale audio reference
    this.clearBuffers();
    this.clearVisemeTimeouts();
    console.log('[AzureTTSBufferManager] ✅ Reset completed - ready for new TTS');
  }
}
