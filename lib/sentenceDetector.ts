// Utility for detecting complete sentences in streaming text
export class SentenceDetector {
  private buffer: string = '';
  private sentenceEndRegex = /[.!?]+\s+|[.!?]+$/;
  private minSentenceLength = 6; // Reduced for more responsive TTS
  
  // Add chunk to buffer and extract complete sentences
  addChunk(chunk: string): string[] {
    this.buffer += chunk;
    return this.extractCompleteSentences();
  }
  
  // Extract complete sentences from buffer
  private extractCompleteSentences(): string[] {
    const sentences: string[] = [];
    
    // Find all sentence boundaries
    const matches = Array.from(this.buffer.matchAll(/[.!?]+\s*/g));
    
    if (matches.length > 0) {
      let lastEndIndex = 0;
      
      for (const match of matches) {
        const endIndex = match.index! + match[0].length;
        const sentence = this.buffer.substring(lastEndIndex, endIndex).trim();
        
        // Only add if it's a meaningful sentence
        if (sentence.length >= this.minSentenceLength) {
          sentences.push(sentence);
          lastEndIndex = endIndex;
        }
      }
      
      // Keep the remaining text in buffer
      this.buffer = this.buffer.substring(lastEndIndex);
    }
    
    return sentences;
  }
  
  // Get any remaining text (call when streaming is complete)
  flush(): string | null {
    const remaining = this.buffer.trim();
    this.buffer = '';
    return remaining.length > 0 ? remaining : null;
  }
  
  // Reset the buffer
  reset(): void {
    this.buffer = '';
  }
  
  // Get current buffer content (for debugging)
  getBuffer(): string {
    return this.buffer;
  }
}

// Utility for managing TTS queue with sentence buffering and session management
export class TTSQueueManager {
  private ttsQueue: string[] = [];
  private audioQueue: ArrayBuffer[] = [];
  private isProcessing: boolean = false;
  private isPlayingAudio: boolean = false;
  private onSpeakCallback: ((text: string) => Promise<void>) | null = null;
  private abortController: AbortController | null = null;
  private onSessionStart: (() => void) | null = null;
  private onSessionEnd: (() => void) | null = null;
  private sessionActive: boolean = false;
  
  constructor(
    onSpeak: (text: string) => Promise<void>,
    onSessionStart?: () => void,
    onSessionEnd?: () => void
  ) {
    this.onSpeakCallback = onSpeak;
    this.onSessionStart = onSessionStart;
    this.onSessionEnd = onSessionEnd;
  }
  
  // Add sentence to queue
  addToQueue(sentence: string): void {
    if (sentence.trim()) {
      console.log('[TTSQueue] 📝 Adding sentence to queue:', sentence.substring(0, 50) + '...');
      
      // Start session if this is the first sentence
      if (!this.sessionActive && this.onSessionStart) {
        console.log('[TTSQueue] 🎬 Starting TTS session');
        this.sessionActive = true;
        this.onSessionStart();
      }
      
      this.ttsQueue.push(sentence);
      this.processQueue();
    }
  }
  
  // Process TTS queue with true sequential processing
  private async processQueue(): Promise<void> {
    if (this.isProcessing || !this.onSpeakCallback) {
      return;
    }
    
    this.isProcessing = true;
    
    // Process sentences one at a time completely
    while (this.ttsQueue.length > 0 && !this.abortController?.signal.aborted) {
      const sentence = this.ttsQueue.shift()!;
      
      try {
        console.log('[TTSQueue] 🎵 Starting sequential TTS for:', sentence.substring(0, 50) + '...');
        console.log('[TTSQueue] Queue status:', this.ttsQueue.length, 'remaining sentences');
        
        // Process this sentence completely before moving to the next
        await this.onSpeakCallback(sentence);
        console.log('[TTSQueue] ✅ Sentence completed, moving to next');
        
      } catch (error) {
        console.error('[TTSQueue] ❌ Error processing sentence:', error);
      }
    }
    
    this.isProcessing = false;
    
    // Check if we should end the session
    this.checkSessionEnd();
  }
  

  
  // Check if TTS session should end
  private checkSessionEnd(): void {
    if (this.sessionActive && this.ttsQueue.length === 0 && !this.isProcessing) {
      console.log('[TTSQueue] 🎬 Ending TTS session');
      this.sessionActive = false;
      if (this.onSessionEnd) {
        this.onSessionEnd();
      }
    }
  }
  
  // Stop all TTS and clear queue
  stop(): void {
    console.log('[TTSQueue] Stopping TTS queue');
    this.ttsQueue = [];
    this.isProcessing = false;
    
    // End session if active
    if (this.sessionActive && this.onSessionEnd) {
      console.log('[TTSQueue] 🎬 Ending TTS session (stopped)');
      this.sessionActive = false;
      this.onSessionEnd();
    }
    
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
  
  // Reset the queue
  reset(): void {
    this.ttsQueue = [];
    this.audioQueue = [];
    this.isProcessing = false;
    this.isPlayingAudio = false;
    this.sessionActive = false;
    this.abortController = new AbortController();
  }
  
  // Get queue status
  getStatus(): { queueLength: number; audioQueueLength: number; isProcessing: boolean; isPlayingAudio: boolean; sessionActive: boolean } {
    return {
      queueLength: this.ttsQueue.length,
      audioQueueLength: this.audioQueue.length,
      isProcessing: this.isProcessing,
      isPlayingAudio: this.isPlayingAudio,
      sessionActive: this.sessionActive
    };
  }
}
