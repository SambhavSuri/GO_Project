// import React from "react";
import { useAudioContext } from "./AudioProvider";
import { useAudioSpeakingContext } from "./useAudioSpeakingContext";
import { useParams } from "next/navigation";
import { getToken, logout } from "../lib/auth";
import { API_ENDPOINTS } from '../lib/constants';
import { useWebSearch } from './WebSearchContext';
import { useRef, useEffect } from 'react';

// Simplified RAG integration for audio-only mode (gather full response first, then send to TTS)
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
    appendToCurrentAiResponse, 
    finalizeCurrentAiResponse, 
    setIsProcessingResponse, 
    speakText,
    addAiMessage 
  } = useAudioContext();
  const { isInterruptedRef, resetInterruptionState, requestAudioInterruption } = useAudioSpeakingContext();

  const fetchRagResponse = async (question: string) => {
    console.log('[AudioRAG] Processing question:', question);
    
    // Get the current web search state from the ref
    const currentWebSearchEnabled = webSearchEnabledRef.current;
    console.log('[AudioRAG] Current web search enabled state:', currentWebSearchEnabled);
    
    setIsProcessingResponse(true);
    resetInterruptionState();

    let accumulatedResponse = '';
    let isFirstChunk = true;
    
    
    try {
      const requestBody = { 
        query: question,
        n_results: 1
      };
      
      const ragAccessToken = process.env.RAG_ACCESS_TOKEN;

      if (!ragAccessToken) {
        console.error('RAG_ACCESS_TOKEN not configured');
        // return res.status(500).json({ message: 'RAG access token not configured' });
      }
      
      console.log('[AudioRAG] Sending request:', requestBody);

      const response = await fetch(`http://68.154.32.96:8000${API_ENDPOINTS.RAG_QUERY}`, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NTU1MTM4MzZ9.wrXagq0riz3X0fN4tvA1nE3gAiCXjZdXA3vCso1-4U8`,
        },
        body: JSON.stringify(requestBody)
      });

      // Handle non-streaming errors using axios error format
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AudioRAG] API error:', errorText);
        
        // Parse error response to match axios format
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
        
        const axiosError = {
          status: response.status,
          message: errorData.message || errorData.detail || `HTTP ${response.status}: ${errorText}`,
          code: response.status.toString(),
          details: errorData
        };
        
        throw axiosError;
      }

      // Parse the JSON response
      const data = await response.json();
      console.log('[AudioRAG] Received response:', data);
      
      // Extract the answer from the response
      if (data.answer) {
        accumulatedResponse = data.answer;
        console.log('[AudioRAG] Processing answer:', accumulatedResponse);
        
        // Update the UI with the response
        appendToCurrentAiResponse(accumulatedResponse);
        
        // Send the complete response to TTS
        if (accumulatedResponse.trim() && !isInterruptedRef.current) {
          console.log('[AudioRAG] Sending complete response to TTS:', accumulatedResponse);
          await speakText(accumulatedResponse);
        }
      } else {
        throw new Error('No answer in response');
      }

    } catch (error: unknown) {
      console.error("[AudioRAG] RAG integration error:", error);
      
      // Handle different error types and show them in chat
      let errorMessage = '';
      const err = error as { name?: string; message?: string; status?: number; code?: string };
      
      if (err.name === "AbortError") {
        console.warn('[AudioRAG] Request was aborted (likely due to timeout)');
        errorMessage = 'Request timed out. The AI is taking longer than expected to respond. This might be due to a complex question or server load. Please try again with a simpler question or wait a moment before retrying.';
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
      
      // Speak the error message for audio mode
      if (!isInterruptedRef.current) {
        await speakText(errorMessage);
      }
      
      // Re-throw the error for any additional handling
      throw error;
    } finally {
      console.log('[AudioRAG] Finalizing response');
      finalizeCurrentAiResponse();
      setIsProcessingResponse(false);
    }
  };

  return { fetchRagResponse, requestAudioInterruption };
}; 