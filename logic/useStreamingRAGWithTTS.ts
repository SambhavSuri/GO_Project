import { useCallback, useRef, useState, useEffect } from 'react';
import { useStreamingRAG } from './useStreamingRAG';
import { useAudioContext } from './AudioProvider';
import { useAudioSpeakingContext } from './useAudioSpeakingContext';

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
  
  // Get audio speaking context for interruption management
  const { clearInterruption } = useAudioSpeakingContext();
  
  const isFirstChunkRef = useRef(true);
  const wasInterruptedRef = useRef(false);
  
  // Handle RAG response chunks
  const handleResponseChunk = useCallback((chunk: string) => {
    console.log('[StreamingRAGWithTTS] Received chunk:', chunk);
    
    // Append to current AI response in UI
    appendToCurrentAiResponse(chunk);
    
    // Accumulate the full response text
    setFullResponseText(prev => prev + chunk);
    
    // Update speaking state
    if (!isSpeaking) {
      setIsSpeaking(true);
    }
  }, [appendToCurrentAiResponse, isSpeaking]);
  
  // Handle TTS in useEffect to avoid setState during render
  useEffect(() => {
    // 🎯 FIX: Don't start TTS if response was interrupted by user
    if (fullResponseText.length > 0 && !wasInterruptedRef.current) {
      // Pass the accumulated text to the streaming TTS
      // The TTS will handle chunking and only process new text
      speakStreamingText(fullResponseText);
    } else if (wasInterruptedRef.current) {
      console.log('[StreamingRAGWithTTS] Skipping TTS - response was interrupted');
    }
  }, [fullResponseText, speakStreamingText]);
  
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
    
    // 🎯 FIX: Clear interruption state for new queries (fixes TTS not working after peter stop)
    console.log('[StreamingRAGWithTTS] 🔄 NEW QUERY: Clearing interruption state to allow TTS');
    clearInterruption();
    
    // Stop any previous TTS to ensure clean state for new message
    stopSpeaking();
    
    // Reset state for new message
    setFullResponseText('');
    isFirstChunkRef.current = true;
    wasInterruptedRef.current = false; // Reset our local interrupt flag
    
    // Set processing state
    setIsProcessingResponse(true);
    
    // Send message to RAG
    await sendRAGMessage(message, history);
  }, [sendRAGMessage, setIsProcessingResponse, stopSpeaking, clearInterruption]);
  
  // Enhanced stop function
  const stopStreaming = useCallback(() => {
    console.log('[StreamingRAGWithTTS] Stopping streaming and TTS');
    
    // Mark as interrupted to prevent further TTS processing
    wasInterruptedRef.current = true;
    
    // Stop RAG streaming
    stopRAGStreaming();
    
    // Stop TTS
    stopSpeaking();
    
    // Reset state
    setFullResponseText('');
    
    setIsSpeaking(false);
    setIsProcessingResponse(false);
  }, [stopRAGStreaming, stopSpeaking, setIsProcessingResponse]);

  // 🎯 FIX: Listen for "peter stop" command to completely stop RAG streaming
  useEffect(() => {
    const handleStopAllStreaming = (event: any) => {
      const reason = event.detail?.reason;
      console.log('[StreamingRAGWithTTS] 🛑 Stop all streaming event received:', reason);
      
      if (reason === 'peter_stop_command') {
        console.log('[StreamingRAGWithTTS] 🛑 PETER STOP: Completely stopping RAG stream and TTS');
        stopStreaming();
      }
    };

    window.addEventListener('stopAllStreaming', handleStopAllStreaming);
    
    return () => {
      window.removeEventListener('stopAllStreaming', handleStopAllStreaming);
    };
  }, [stopStreaming]);
  
  return {
    sendMessage,
    stopStreaming,
    isStreaming,
    currentResponse,
    error,
    isSpeaking
  };
}