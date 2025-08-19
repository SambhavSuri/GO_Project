// Streaming RAG Client for localhost:8000/chat
export interface RAGMessage {
  message: string;
  conversation_history: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp?: number;
  }>;
  stream: boolean;
}

export interface RAGResponse {
  content: string;
  isComplete: boolean;
}

export class StreamingRAGClient {
  private baseUrl: string;
  private abortController: AbortController | null = null;

  constructor(baseUrl: string = 'http://localhost:8000') {
    this.baseUrl = baseUrl;
  }

  // Stream RAG response from the API
  async streamRAGResponse(
    message: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string; timestamp?: number }> = [],
    onChunk: (chunk: string) => void,
    onComplete: (fullResponse: string) => void,
    onError: (error: string) => void
  ): Promise<void> {
    // Abort any existing request
    if (this.abortController) {
      this.abortController.abort();
    }

    this.abortController = new AbortController();

    try {
      console.log('[RAG] Starting streaming request to:', `${this.baseUrl}/chat`);
      console.log('[RAG] Message:', message);
      console.log('[RAG] History length:', conversationHistory.length);

      const requestBody: RAGMessage = {
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

      console.log('[RAG] Starting to read streaming response...');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('[RAG] Streaming completed');
            onComplete(fullResponse);
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          console.log('[RAG] Received chunk:', chunk.length, 'chars');
          
          // Handle potential JSON streaming format or plain text
          const cleanChunk = this.processStreamChunk(chunk);
          if (cleanChunk) {
            fullResponse += cleanChunk;
            onChunk(cleanChunk);
          }
        }
      } catch (streamError) {
        if (this.abortController?.signal.aborted) {
          console.log('[RAG] Stream aborted by user');
          onError('RAG streaming aborted');
        } else {
          console.error('[RAG] Stream reading error:', streamError);
          onError(`Stream reading error: ${streamError instanceof Error ? streamError.message : 'Unknown error'}`);
        }
      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      if (this.abortController?.signal.aborted) {
        console.log('[RAG] Request aborted');
        onError('RAG request aborted');
      } else {
        console.error('[RAG] Request error:', error);
        onError(`RAG error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  // Process individual stream chunks (handle different streaming formats)
  private processStreamChunk(chunk: string): string {
    try {
      // Split chunk by lines in case multiple data: entries are in one chunk
      const lines = chunk.split('\n');
      let contentParts: string[] = [];
      
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
            console.log('[RAG] Failed to parse JSON in line:', trimmedLine);
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
            console.log('[RAG] Failed to parse JSONL:', trimmedLine);
          }
        }
      }
      
      return contentParts.join('');

    } catch (parseError) {
      // If parsing fails, treat as plain text
      console.log('[RAG] Treating chunk as plain text:', chunk.substring(0, 50) + '...');
      return chunk;
    }
  }

  // Stop current streaming request
  abort(): void {
    if (this.abortController) {
      console.log('[RAG] Aborting current request');
      this.abortController.abort();
      this.abortController = null;
    }
  }

  // Check if RAG service is available
  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.warn('[RAG] Health check failed:', error);
      return false;
    }
  }
}

// Singleton instance
export const ragClient = new StreamingRAGClient();
