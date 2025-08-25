// Utility for detecting complete paragraphs in streaming text
export class SentenceDetector {
  private buffer: string = '';
  private paragraphEndRegex = /\n\s*\n/; // Paragraph ends with double newline
  private minParagraphLength = 10; // Minimum length for a paragraph
  
  // Add chunk to buffer and extract complete paragraphs
  addChunk(chunk: string): string[] {
    this.buffer += chunk;
    return this.extractCompleteParagraphs();
  }
  
  // Extract complete paragraphs from buffer
  private extractCompleteParagraphs(): string[] {
    const paragraphs: string[] = [];
    
    // Split by double newlines to find paragraph boundaries
    const parts = this.buffer.split(/\n\s*\n/);
    
    if (parts.length > 1) {
      // All parts except the last one are complete paragraphs
      for (let i = 0; i < parts.length - 1; i++) {
        const paragraph = parts[i].trim();
        
        // Only add if it's a meaningful paragraph
        if (paragraph.length >= this.minParagraphLength) {
          paragraphs.push(paragraph);
        }
      }
      
      // Keep the last part (incomplete paragraph) in buffer
      this.buffer = parts[parts.length - 1];
    }
    
    return paragraphs;
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

// Utility for managing TTS queue with paragraph buffering and session management
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
  
  // Add paragraph to queue
  addToQueue(paragraph: string): void {
    if (paragraph.trim()) {
      console.log('[TTSQueue] 📝 Adding paragraph to queue:', paragraph.substring(0, 50) + '...');
      
      // Start session if this is the first paragraph
      if (!this.sessionActive && this.onSessionStart) {
        console.log('[TTSQueue] 🎬 Starting TTS session');
        this.sessionActive = true;
        this.onSessionStart();
      }
      
      this.ttsQueue.push(paragraph);
      this.processQueue();
    }
  }
  
  // Process TTS queue with true sequential processing
  private async processQueue(): Promise<void> {
    if (this.isProcessing || !this.onSpeakCallback) {
      return;
    }
    
    this.isProcessing = true;
    
    // Process paragraphs one at a time completely
    while (this.ttsQueue.length > 0 && !this.abortController?.signal.aborted) {
      const paragraph = this.ttsQueue.shift()!;
      
      try {
        console.log('[TTSQueue] 🎵 Starting sequential TTS for paragraph:', paragraph.substring(0, 50) + '...');
        console.log('[TTSQueue] Queue status:', this.ttsQueue.length, 'remaining paragraphs');
        
        // Process this paragraph completely before moving to the next
        await this.onSpeakCallback(paragraph);
        console.log('[TTSQueue] ✅ Paragraph completed, moving to next');
        
      } catch (error) {
        console.error('[TTSQueue] ❌ Error processing paragraph:', error);
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
