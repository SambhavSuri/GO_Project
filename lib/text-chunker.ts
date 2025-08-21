export class TextChunker {
    private buffer: string = '';
    private queue: string[] = [];
    private processedLength: number = 0;
   
    /**
     * Add streaming text - only processes new text that hasn't been seen before
     */
    addText(fullText: string): void {
      // Only process new text that hasn't been processed yet
      const newText = fullText.slice(this.processedLength);
      if (!newText) return; // No new text to process
   
      console.log(`[TextChunker] Processing new text: "${newText}" (length: ${newText.length})`);
      console.log(`[TextChunker] Previous processed length: ${this.processedLength}`);
   
      // Add new text to buffer
      this.buffer += newText;
      
      // Extract complete sentences
      this.extractChunks();
      
      // Update processed length to the full text length
      this.processedLength = fullText.length;
      
      console.log(`[TextChunker] Updated processed length to: ${this.processedLength}`);
      console.log(`[TextChunker] Current queue length: ${this.queue.length}`);
    }
   
    /**
     * Extract complete sentences from buffer and add to queue
     */
    private extractChunks(): void {
      const newChunks: string[] = [];
      let remainingText = this.buffer;
   
      // Find sentence boundaries using smarter regex
      // Look for ! or ? (always sentence endings) or . followed by:
      // - whitespace and capital letter, OR
      // - newline, OR  
      // - end of text
      const sentenceRegex = /([.!?])((\s+(?=[A-Z]))|(\s*\n)|$)/g;
      let lastIndex = 0;
      let match;
   
      while ((match = sentenceRegex.exec(remainingText)) !== null) {
        const endIndex = match.index + match[1].length; // Include the punctuation
        const sentence = remainingText.slice(lastIndex, endIndex).trim();
        
        if (sentence) {
          newChunks.push(sentence);
          console.log(`[TextChunker] Extracted sentence: "${sentence}"`);
        }
        
        lastIndex = match.index + match[0].length; // Skip the whitespace
      }
   
      // Add complete sentences to queue
      if (newChunks.length > 0) {
        this.queue.push(...newChunks);
        console.log(`[TextChunker] Added ${newChunks.length} chunks to queue. Total: ${this.queue.length}`);
      }
   
      // Update buffer with remaining incomplete text
      this.buffer = remainingText.slice(lastIndex).trim();
      console.log(`[TextChunker] Remaining buffer: "${this.buffer}"`);
    }
   
    /**
     * Get the next chunk from the queue
     */
    getNextChunk(): string | null {
      return this.queue.shift() || null;
    }
   
    /**
     * Peek at the next chunk without removing it from the queue
     */
    peekNextChunk(): string | null {
      return this.queue.length > 0 ? this.queue[0] : null;
    }
   
    /**
     * Check if there are chunks available
     */
    hasChunks(): boolean {
      return this.queue.length > 0;
    }
   
    /**
     * Get the current queue length
     */
    getQueueLength(): number {
      return this.queue.length;
    }
   
    /**
     * Get a copy of the current queue
     */
    getQueue(): string[] {
      return [...this.queue];
    }
   
    /**
     * Get the current buffer content
     */
    getBuffer(): string {
      return this.buffer;
    }
   
    /**
     * Process any remaining buffer content as a final chunk
     */
    flush(): void {
      if (this.buffer.trim()) {
        console.log(`[TextChunker] Flushing remaining buffer: "${this.buffer.trim()}"`);
        this.queue.push(this.buffer.trim());
        this.buffer = '';
      }
    }
   
    /**
     * Clear all data and reset processed length
     */
    clear(): void {
      console.log(`[TextChunker] Clearing all data. Had ${this.queue.length} chunks in queue.`);
      this.buffer = '';
      this.queue = [];
      this.processedLength = 0;
    }
   
    /**
     * Get processed length for debugging
     */
    getProcessedLength(): number {
      return this.processedLength;
    }
  }
