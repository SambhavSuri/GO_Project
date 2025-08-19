import { useRef, useCallback, useState } from 'react';
import { ragClient } from '../lib/ragClient';

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface UseStreamingRAGReturn {
  sendMessage: (message: string, history?: ConversationMessage[]) => Promise<void>;
  stopStreaming: () => void;
  isStreaming: boolean;
  currentResponse: string;
  error: string | null;
}

export function useStreamingRAG(
  onResponseChunk?: (chunk: string) => void,
  onResponseComplete?: (fullResponse: string) => void,
  onError?: (error: string) => void
): UseStreamingRAGReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const onResponseChunkRef = useRef(onResponseChunk);
  const onResponseCompleteRef = useRef(onResponseComplete);
  const onErrorRef = useRef(onError);

  // Update refs when callbacks change
  onResponseChunkRef.current = onResponseChunk;
  onResponseCompleteRef.current = onResponseComplete;
  onErrorRef.current = onError;

  const sendMessage = useCallback(async (
    message: string, 
    history: ConversationMessage[] = []
  ): Promise<void> => {
    if (isStreaming) {
      console.warn('[RAG] Already streaming, stopping current request');
      ragClient.abort();
    }

    setIsStreaming(true);
    setCurrentResponse('');
    setError(null);

    console.log('[RAG] Sending message:', message);
    console.log('[RAG] With history:', history.length, 'messages');

    try {
      await ragClient.streamRAGResponse(
        message,
        history,
        (chunk: string) => {
          console.log('[RAG] Received chunk:', chunk.length, 'chars');
          setCurrentResponse(prev => prev + chunk);
          
          // Call external chunk handler
          if (onResponseChunkRef.current) {
            onResponseChunkRef.current(chunk);
          }
        },
        (fullResponse: string) => {
          console.log('[RAG] Response complete:', fullResponse.length, 'total chars');
          setIsStreaming(false);
          
          // Call external completion handler
          if (onResponseCompleteRef.current) {
            onResponseCompleteRef.current(fullResponse);
          }
        },
        (errorMessage: string) => {
          console.error('[RAG] Error:', errorMessage);
          setIsStreaming(false);
          setError(errorMessage);
          
          // Call external error handler
          if (onErrorRef.current) {
            onErrorRef.current(errorMessage);
          }
        }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown RAG error';
      console.error('[RAG] Send message error:', errorMessage);
      setIsStreaming(false);
      setError(errorMessage);
      
      if (onErrorRef.current) {
        onErrorRef.current(errorMessage);
      }
    }
  }, [isStreaming]);

  const stopStreaming = useCallback(() => {
    console.log('[RAG] Stopping streaming by user request');
    ragClient.abort();
    setIsStreaming(false);
  }, []);

  return {
    sendMessage,
    stopStreaming,
    isStreaming,
    currentResponse,
    error
  };
}
