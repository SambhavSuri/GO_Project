// Streaming RAG client for the HTML frontend
class StreamingRAGClient {
    constructor(baseUrl = 'http://localhost:8000') {
        this.baseUrl = baseUrl;
        this.abortController = null;
    }

    // Stream RAG response from the API
    async streamRAGResponse(message, conversationHistory, onChunk, onComplete, onError) {
        // Abort any existing request
        if (this.abortController) {
            this.abortController.abort();
        }

        this.abortController = new AbortController();

        try {
            console.log('[StreamingRAG] Starting streaming request to:', `${this.baseUrl}/chat`);
            console.log('[StreamingRAG] Message:', message);
            console.log('[StreamingRAG] History length:', conversationHistory.length);

            const requestBody = {
                message,
                conversation_history: conversationHistory,
                stream: true
            };

            const response = await fetch(`${this.baseUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal: this.abortController.signal,
            });

            if (!response.ok) {
                throw new Error(`RAG API error: ${response.status} ${response.statusText}`);
            }

            if (!response.body) {
                throw new Error('No response body available for streaming');
            }

            console.log('[StreamingRAG] Starting to read streaming response...');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    
                    if (done) {
                        console.log('[StreamingRAG] Streaming completed');
                        onComplete(fullResponse);
                        break;
                    }

                    const chunk = decoder.decode(value, { stream: true });
                    console.log('[StreamingRAG] Received chunk:', chunk.length, 'chars');
                    
                    // Handle potential JSON streaming format or plain text
                    const cleanChunk = this.processStreamChunk(chunk);
                    if (cleanChunk) {
                        fullResponse += cleanChunk;
                        onChunk(cleanChunk);
                    }
                }
            } catch (streamError) {
                if (this.abortController?.signal.aborted) {
                    console.log('[StreamingRAG] Stream aborted by user');
                    onError('RAG streaming aborted');
                } else {
                    console.error('[StreamingRAG] Stream reading error:', streamError);
                    onError(`Stream reading error: ${streamError.message || 'Unknown error'}`);
                }
            } finally {
                reader.releaseLock();
            }

        } catch (error) {
            if (this.abortController?.signal.aborted) {
                console.log('[StreamingRAG] Request aborted');
                onError('RAG request aborted');
            } else {
                console.error('[StreamingRAG] Request error:', error);
                onError(`RAG error: ${error.message || 'Unknown error'}`);
            }
        }
    }

    // Process individual stream chunks (handle different streaming formats)
    processStreamChunk(chunk) {
        try {
            // Split chunk by lines in case multiple data: entries are in one chunk
            const lines = chunk.split('\n');
            let contentParts = [];
            
            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine) continue;
                
                // Handle Server-Sent Events format (data: {...})
                if (trimmedLine.startsWith('data: ')) {
                    const jsonStr = trimmedLine.slice(6).trim();
                    if (jsonStr === '[DONE]') {
                        continue;
                    }
                    
                    try {
                        const parsed = JSON.parse(jsonStr);
                        // Only extract content field, ignore sources and other metadata
                        if (parsed.content && typeof parsed.content === 'string') {
                            contentParts.push(parsed.content);
                        }
                    } catch (parseError) {
                        console.log('[StreamingRAG] Failed to parse JSON in line:', trimmedLine);
                    }
                }
                // Handle JSONL format (one JSON per line)
                else if (trimmedLine.startsWith('{') && trimmedLine.endsWith('}')) {
                    try {
                        const parsed = JSON.parse(trimmedLine);
                        if (parsed.content && typeof parsed.content === 'string') {
                            contentParts.push(parsed.content);
                        }
                    } catch (parseError) {
                        console.log('[StreamingRAG] Failed to parse JSONL:', trimmedLine);
                    }
                }
            }
            
            return contentParts.join('');

        } catch (parseError) {
            // If parsing fails, treat as plain text
            console.log('[StreamingRAG] Treating chunk as plain text:', chunk.substring(0, 50) + '...');
            return chunk;
        }
    }

    // Stop current streaming request
    abort() {
        if (this.abortController) {
            console.log('[StreamingRAG] Aborting current request');
            this.abortController.abort();
            this.abortController = null;
        }
    }
}

// Sentence detector for buffering TTS requests
class SentenceDetector {
    constructor() {
        this.buffer = '';
        this.minSentenceLength = 10;
    }

    // Add chunk to buffer and extract complete sentences
    addChunk(chunk) {
        this.buffer += chunk;
        return this.extractCompleteSentences();
    }

    // Extract complete sentences from buffer
    extractCompleteSentences() {
        const sentences = [];
        
        // Find all sentence boundaries
        const matches = Array.from(this.buffer.matchAll(/[.!?]+\s*/g));
        
        if (matches.length > 0) {
            let lastEndIndex = 0;
            
            for (const match of matches) {
                const endIndex = match.index + match[0].length;
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
    flush() {
        const remaining = this.buffer.trim();
        this.buffer = '';
        return remaining.length > 0 ? remaining : null;
    }

    // Reset the buffer
    reset() {
        this.buffer = '';
    }
}

// TTS Queue Manager
class TTSQueueManager {
    constructor(onSpeak) {
        this.ttsQueue = [];
        this.isProcessing = false;
        this.onSpeakCallback = onSpeak;
        this.abortController = null;
    }

    // Add sentence to queue
    addToQueue(sentence) {
        if (sentence.trim()) {
            this.ttsQueue.push(sentence);
            this.processQueue();
        }
    }

    // Process TTS queue
    async processQueue() {
        if (this.isProcessing || this.ttsQueue.length === 0 || !this.onSpeakCallback) {
            return;
        }

        this.isProcessing = true;

        while (this.ttsQueue.length > 0 && !this.abortController?.signal.aborted) {
            const sentence = this.ttsQueue.shift();

            try {
                console.log('[TTSQueue] Speaking sentence:', sentence);
                await this.onSpeakCallback(sentence);
            } catch (error) {
                console.error('[TTSQueue] Error speaking sentence:', error);
                // Continue with next sentence even if one fails
            }
        }

        this.isProcessing = false;
    }

    // Stop all TTS and clear queue
    stop() {
        console.log('[TTSQueue] Stopping TTS queue');
        this.ttsQueue = [];
        this.isProcessing = false;
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
    }

    // Reset the queue
    reset() {
        this.ttsQueue = [];
        this.isProcessing = false;
        this.abortController = new AbortController();
    }
}

// Global instances
window.streamingRAGClient = new StreamingRAGClient();
window.sentenceDetector = new SentenceDetector();
window.ttsQueueManager = new TTSQueueManager(async (sentence) => {
    // Use the existing TTS function
    if (window.speakText) {
        await window.speakText(sentence);
    }
});
