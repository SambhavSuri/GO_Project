import { useAudioContext } from "./AudioProvider";
import { useAudioSpeakingContext } from "./useAudioSpeakingContext";
import { useParams } from "next/navigation";
import { getToken, logout } from "../lib/auth";
import { useWebSearch } from './WebSearchContext';
import { useRef, useEffect, useCallback } from 'react';
import { useStreamingRAGWithTTS } from './useStreamingRAGWithTTS';
import { ConversationMessage } from './useStreamingRAG';

// Streaming RAG integration for audio mode with sentence-based TTS
export const useAudioRagIntegration = () => {
  const params = useParams();
  const { webSearchEnabled } = useWebSearch();
  const webSearchEnabledRef = useRef(webSearchEnabled);
  
  // Keep the ref updated with the current state
  useEffect(() => {
    webSearchEnabledRef.current = webSearchEnabled;
    console.log('[AudioRAG] Web search state updated to:', webSearchEnabled);
  }, [webSearchEnabled]);
  
  const { 
    addUserMessage,
    addAiMessage,
    conversationHistory,
    clearCurrentAiResponse
  } = useAudioContext();
  
  const { isInterruptedRef, requestAudioInterruption } = useAudioSpeakingContext();
  
  // Use the streaming RAG with TTS hook
  const {
    sendMessage,
    stopStreaming,
    isStreaming,
    currentResponse,
    error,
    isSpeaking
  } = useStreamingRAGWithTTS();

  const fetchRagResponse = useCallback(async (question: string) => {
    console.log('[AudioRAG] Processing question:', question);
    
    // Clear any previous response
    clearCurrentAiResponse();
    
    // Get the current web search state from the ref
    const currentWebSearchEnabled = webSearchEnabledRef.current;
    console.log('[AudioRAG] Current web search enabled state:', currentWebSearchEnabled);
    
    // Convert conversation history to the format expected by the streaming RAG
    const formattedHistory: ConversationMessage[] = conversationHistory.map(pair => [
      { role: 'user' as const, content: pair.user, timestamp: pair.timestamp },
      ...(pair.ai ? [{ role: 'assistant' as const, content: pair.ai, timestamp: pair.timestamp }] : [])
    ]).flat();
    
    try {
      // Send message with streaming RAG and TTS
      await sendMessage(question, formattedHistory);
      
      console.log('[AudioRAG] Streaming RAG response initiated');
      
    } catch (error) {
      console.error("[AudioRAG] RAG integration error:", error);
      
      // Handle different error types and show them in chat
      let errorMessage = '';
      const err = error as { name?: string; message?: string; status?: number; code?: string };
      
      if (err.name === "AbortError") {
        console.warn('[AudioRAG] Request was aborted');
        errorMessage = 'Request was cancelled.';
      } else if (err.message && err.message.includes('Deadline Exceeded')) {
        console.error('[AudioRAG] gRPC deadline exceeded');
        errorMessage = 'The AI service is experiencing high load. Please try again in a moment or rephrase your question to be more specific.';
      } else if (err.status === 401) {
        // Handle 401 authentication error
        errorMessage = err.message || 'Authentication failed. You will be logged out in 2 seconds.';
        
        // Add error message to chat
        addAiMessage(errorMessage);
        
        // Logout user after 2 seconds
        setTimeout(() => {
          logout();
        }, 2000);
        
        // Early return to prevent further processing
        return;
      } else if (err.status === 400) {
        errorMessage = err.message || 'Bad request. Please check your input and try again.';
      } else if (err.status === 403) {
        errorMessage = err.message || 'Access denied. You don\'t have permission to perform this action.';
      } else if (err.status === 404) {
        errorMessage = err.message || 'Resource not found. Please try again.';
      } else if (err.status === 422) {
        errorMessage = err.message || 'Validation error. Please check your input and try again.';
      } else if (err.status === 429) {
        errorMessage = err.message || 'Too many requests. Please wait a moment and try again.';
      } else if (err.status === 500) {
        errorMessage = err.message || 'Internal server error. Please try again later.';
      } else if (err.status === 502) {
        errorMessage = err.message || 'Service temporarily unavailable. Please try again later.';
      } else if (err.status === 503) {
        errorMessage = err.message || 'Service maintenance in progress. Please try again later.';
      } else if (err.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout. Please check your connection and try again.';
      } else if (err.code === 'NETWORK_ERROR') {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else {
        // Generic error handling
        errorMessage = err.message || 'An unexpected error occurred. Please try again.';
      }
      
      // Add error message to chat
      addAiMessage(errorMessage);
    }
  }, [sendMessage, conversationHistory, addAiMessage, clearCurrentAiResponse]);

  return { 
    fetchRagResponse, 
    requestAudioInterruption,
    stopStreaming,
    isStreaming,
    isSpeaking 
  };
};