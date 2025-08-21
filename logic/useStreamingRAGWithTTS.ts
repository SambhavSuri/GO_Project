import { useCallback, useRef, useState } from 'react';
import { useStreamingRAG } from './useStreamingRAG';
import { useAudioContext } from './AudioProvider';

export interface UseStreamingRAGWithTTSReturn {
  sendMessage: (message: string, history?: any[]) => Promise<void>;
  stopStreaming: () => void;
  isStreaming: boolean;
  currentResponse: string;
  error: string | null;
  isSpeaking: boolean;
}

export function useStreamingRAGWithTTS(): UseStreamingRAGWithTTSReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [fullResponseText, setFullResponseText] = useState('');
  
  // Get audio context functions
  const { 
    appendToCurrentAiResponse,
    finalizeCurrentAiResponse,
    setIsProcessingResponse,
    speakStreamingText,
    stopSpeaking,
    onViseme
  } = useAudioContext();
  
  const isFirstChunkRef = useRef(true);
  
  // Handle RAG response chunks
  const handleResponseChunk = useCallback((chunk: string) => {
    console.log('[StreamingRAGWithTTS] Received chunk:', chunk);
    
    // Append to current AI response in UI
    appendToCurrentAiResponse(chunk);
    
    // Accumulate the full response text
    setFullResponseText(prev => {
      const newText = prev + chunk;
      
      // Pass the accumulated text to the streaming TTS
      // The TTS will handle chunking and only process new text
      speakStreamingText(newText);
      
      return newText;
    });
    
    // Update speaking state
    if (!isSpeaking) {
      setIsSpeaking(true);
    }
  }, [appendToCurrentAiResponse, speakStreamingText, isSpeaking]);
  
  // Handle response completion
  const handleResponseComplete = useCallback((fullResponse: string) => {
    console.log('[StreamingRAGWithTTS] Response complete');
    
    // Pass the final complete text with completion flag to flush remaining buffer
    speakStreamingText(fullResponseText, undefined, true);
    
    // Finalize the response in the UI
    finalizeCurrentAiResponse();
    setIsProcessingResponse(false);
    
    // The speaking state will be handled by the TTS hook
    // It will set to false when all chunks are done
  }, [fullResponseText, speakStreamingText, finalizeCurrentAiResponse, setIsProcessingResponse]);
  
  // Handle errors
  const handleError = useCallback((error: string) => {
    console.error('[StreamingRAGWithTTS] Error:', error);
    
    // Stop TTS
    stopSpeaking();
    
    // Reset text accumulator
    setFullResponseText('');
    
    setIsProcessingResponse(false);
    setIsSpeaking(false);
  }, [stopSpeaking, setIsProcessingResponse]);
  
  // Use the streaming RAG hook with our handlers
  const {
    sendMessage: sendRAGMessage,
    stopStreaming: stopRAGStreaming,
    isStreaming,
    currentResponse,
    error
  } = useStreamingRAG(
    handleResponseChunk,
    handleResponseComplete,
    handleError
  );
  
  // Enhanced send message function
  const sendMessage = useCallback(async (message: string, history?: any[]) => {
    console.log('[StreamingRAGWithTTS] Sending message:', message);
    
    // Stop any previous TTS to ensure clean state for new message
    stopSpeaking();
    
    // Reset state for new message
    setFullResponseText('');
    isFirstChunkRef.current = true;
    
    // Set processing state
    setIsProcessingResponse(true);
    
    // Send message to RAG
    await sendRAGMessage(message, history);
  }, [sendRAGMessage, setIsProcessingResponse, stopSpeaking]);
  
  // Enhanced stop function
  const stopStreaming = useCallback(() => {
    console.log('[StreamingRAGWithTTS] Stopping streaming and TTS');
    
    // Stop RAG streaming
    stopRAGStreaming();
    
    // Stop TTS
    stopSpeaking();
    
    // Reset state
    setFullResponseText('');
    
    setIsSpeaking(false);
    setIsProcessingResponse(false);
  }, [stopRAGStreaming, stopSpeaking, setIsProcessingResponse]);
  
  return {
    sendMessage,
    stopStreaming,
    isStreaming,
    currentResponse,
    error,
    isSpeaking
  };
}