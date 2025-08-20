import React, { createContext, useContext, useState, useRef, useEffect, useMemo, useCallback } from "react";
// import { useStreamingAvatarContext } from "./context";
import { useDeepgramTTS } from "./useAudioTTS";
import { VisemeData } from "../lib/azureTTS";
// import { useAudioSpeakingContext } from "./useAudioSpeakingContext";

// Define the ConversationPair interface to match the video avatar
export interface ConversationPair {
  id: string;
  user: string;
  ai: string;
  timestamp: number;
}

// Create a combined audio context
const AudioContext = createContext<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

// Combined audio provider that includes both chat and TTS functionality
export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Reuse the existing context structure but override avatar-specific methods
  // const existingContext = useStreamingAvatarContext(); // Unused for now
  
  // Create local state that mirrors the video avatar context
  const [conversationHistory, setConversationHistory] = useState<ConversationPair[]>([]);
  const [currentAiResponse, setCurrentAiResponse] = useState<string>('');
  const [isProcessingResponse, setIsProcessingResponse] = useState(false);
  const [isAvatarTalking, setIsAvatarTalking] = useState(false);
  const [isAvatarSessionActive, setIsAvatarSessionActive] = useState(false);
  const [isVoiceChatActive, setIsVoiceChatActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  // Error state management
  const [error, setError] = useState<string | null>(null);
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  // Use ref to store current AI response to avoid closure issues
  const currentAiResponseRef = useRef<string>('');
  
  // Track if this is a welcome message to prevent replay
  const isWelcomeMessageRef = useRef<boolean>(false);
  
  // Track current pair ID like video avatar
  const [currentPairId, setCurrentPairId] = useState<string | null>(null);
  const currentPairIdRef = useRef<string | null>(null);
  
  // Store stopSpeaking function in a ref to avoid dependency issues
  const stopSpeakingRef = useRef<(() => void) | null>(null);
  
  // Update ref whenever state changes
  useEffect(() => {
    currentAiResponseRef.current = currentAiResponse;
  }, [currentAiResponse]);
  
  // Keep refs in sync with state
  useEffect(() => {
    currentPairIdRef.current = currentPairId;
  }, [currentPairId]);

  // Log when isAvatarTalking changes
  useEffect(() => {
    console.log('[AudioProvider] isAvatarTalking state changed to:', isAvatarTalking);
  }, [isAvatarTalking]);

  // Callback for when audio chunks finish
  const onAudioChunkFinishedRef = useRef<((duration: number) => void) | null>(null);

  // Callback for triggering GLB speaking animation when audio actually starts
  const onGLBAudioStartRef = useRef<(() => void) | null>(null);

  // 🎯 STREAMLINED: Direct viseme callback - no wrapper objects
  const onVisemeRef = useRef<((visemeId: number, offset: number) => void) | null>(null);

  // Get TTS functions - this will work now because we're not in a circular dependency
  const ttsFunctions = useDeepgramTTS(
    (talking: boolean) => {
      console.log('[AudioProvider] setIsAvatarTalking called with:', talking, 'at:', new Date().toISOString());
      setIsAvatarTalking(talking);
    }, 
    (active: boolean) => {
      console.log('[AudioProvider] setIsAvatarSessionActive called with:', active, 'at:', new Date().toISOString());
      setIsAvatarSessionActive(active);
    },
    (duration: number) => {
      console.log('[AudioProvider] Audio chunk finished, duration:', duration);
      // Call the callback if it exists
      if (onAudioChunkFinishedRef.current) {
        onAudioChunkFinishedRef.current(duration);
      }
    },
    () => {
      console.log('[AudioProvider] Audio started playing - triggering GLB animation');
      // Call the GLB animation callback if it exists
      if (onGLBAudioStartRef.current) {
        onGLBAudioStartRef.current();
      }
    },
    // 🎯 STREAMLINED: Direct viseme forwarding - no object creation
    (visemeId: number, offset: number) => {
      console.log('[AudioProvider] 🚀 Direct viseme received:', visemeId, 'at offset:', offset + 'ms');
      // Call the direct viseme callback if it exists
      if (onVisemeRef.current) {
        console.log('[AudioProvider] 🎯 Passing direct viseme to avatar:', visemeId);
        onVisemeRef.current(visemeId, offset);
      } else {
        console.log('[AudioProvider] No direct viseme callback registered');
      }
    }
  );

  // Store the stopSpeaking function in a ref - moved after ttsFunctions initialization
  useEffect(() => {
    stopSpeakingRef.current = ttsFunctions.stopSpeaking;
  }, [ttsFunctions.stopSpeaking]);

  // Function to initialize audio context on user interaction
  const initializeAudioContext = useCallback(async () => {
    console.log('[AudioProvider] Initializing audio context after user interaction...');
    try {
      // Create a simple AudioContext to activate audio after user interaction
      const tempAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (tempAudioContext.state === 'suspended') {
        await tempAudioContext.resume();
      }
      await tempAudioContext.close();
      console.log('[AudioProvider] Audio context initialization completed');
      return true;
    } catch (error) {
      console.error('[AudioProvider] Failed to initialize audio context:', error);
      return false;
    }
  }, []);

  // Function to append to current AI response (for streaming)
  const appendToCurrentAiResponse = useCallback((text: string) => {
    setCurrentAiResponse(prev => prev + text);
    currentAiResponseRef.current = currentAiResponseRef.current + text;
  }, []);

  // Function to finalize current AI response and add to conversation history
  const finalizeCurrentAiResponse = useCallback(() => {
    console.log('[AudioProvider] finalizeCurrentAiResponse called');
    console.log('[AudioProvider] currentAiResponse length:', currentAiResponse.length);
    console.log('[AudioProvider] currentAiResponseRef.current length:', currentAiResponseRef.current.length);
    console.log('[AudioProvider] currentAiResponse content:', currentAiResponse.substring(0, 100) + '...');
    console.log('[AudioProvider] currentAiResponseRef.current content:', currentAiResponseRef.current.substring(0, 100) + '...');
    console.log('[AudioProvider] currentAiResponse trimmed length:', currentAiResponse.trim().length);
    console.log('[AudioProvider] currentAiResponseRef.current trimmed length:', currentAiResponseRef.current.trim().length);
    console.log('[AudioProvider] currentPairId:', currentPairIdRef.current);
    
    // Use the ref value which is always up-to-date
    const responseToFinalize = currentAiResponseRef.current;
    const pairId = currentPairIdRef.current;
    
    if (responseToFinalize.trim() && pairId) {
      console.log('[AudioProvider] Finalizing AI response:', responseToFinalize.substring(0, 50) + '...');
      console.log('[AudioProvider] Updating pair with ID:', pairId);
      
      // Update the existing conversation pair with the AI response
      setConversationHistory(prev => {
        const pairIndex = prev.findIndex(pair => pair.id === pairId);
        if (pairIndex === -1) {
          console.log('[AudioProvider] Pair not found, returning unchanged history');
          return prev;
        }
        
        const updated = [...prev];
        updated[pairIndex] = {
          ...updated[pairIndex],
          ai: responseToFinalize
        };
        
        console.log('[AudioProvider] Updated pair at index:', pairIndex);
        console.log('[AudioProvider] Updated pair:', updated[pairIndex]);
        return updated;
      });
      
      // Clear the current pair ID like video avatar
      setCurrentPairId(null);
      currentPairIdRef.current = null;
      
      // DO NOT clear the current response - keep it visible during audio playback
      // It will be cleared when a new user message is added
      console.log('[AudioProvider] AI response finalized and added to history, keeping current response visible');
    } else {
      console.log('[AudioProvider] No current AI response to finalize or no current pair ID');
    }
  }, [currentAiResponse]); // Include currentAiResponse dependency

  // Enhanced speakText function that prevents welcome message replay
  const speakText = useCallback(async (text: string, isWelcome: boolean = false) => {
    if (isWelcome) {
      isWelcomeMessageRef.current = true;
      console.log('[AudioProvider] Speaking welcome message');
    } else {
      // For non-welcome messages, don't finalize here - let RAG integration handle it
      // The RAG integration will call finalizeCurrentAiResponse before calling speakText
      isWelcomeMessageRef.current = false;
      console.log('[AudioProvider] Speaking regular message (finalization handled by RAG)');
    }
    
    await ttsFunctions.speakText(text);
  }, [ttsFunctions]); // Include ttsFunctions dependency
  
  // Function to clear current AI response (for new messages)
  const clearCurrentAiResponse = useCallback(() => {
    setCurrentAiResponse('');
    currentAiResponseRef.current = '';
  }, []);
  
  const contextValue = useMemo(() => ({
    // Avatar state
    conversationHistory,
    currentAiResponse,
    isProcessingResponse,
    isAvatarTalking,
    isAvatarSessionActive,
    isVoiceChatActive,
    isMuted,
    error,
    
    // Avatar actions
    addAiMessage: (message: string) => {
      const pairId = currentPairIdRef.current;
      if (pairId) {
        setConversationHistory(prev => {
          const pairIndex = prev.findIndex(pair => pair.id === pairId);
          if (pairIndex === -1) {
            return prev;
          }
          const updated = [...prev];
          updated[pairIndex] = {
            ...updated[pairIndex],
            ai: message
          };
          return updated;
        });
        setCurrentPairId(null);
        currentPairIdRef.current = null;
      }
    },
    addUserMessage: (message: string) => {
      // Clear current AI response when adding a new user message
      setCurrentAiResponse('');
      currentAiResponseRef.current = '';
      
      const newPairId = `user-${Date.now()}`;
      const newPair = {
        id: newPairId,
        user: message,
        ai: '',
        timestamp: Date.now()
      };
      
      setConversationHistory(prev => [...prev, newPair]);
      setCurrentPairId(newPairId);
      currentPairIdRef.current = newPairId;
    },
    setCurrentAiResponse,
    setIsProcessingResponse,
    setIsAvatarTalking,
    setIsAvatarSessionActive,
    setIsVoiceChatActive,
    setIsMuted,
    setError,
    clearError,
    
    // RAG integration functions
    appendToCurrentAiResponse,
    finalizeCurrentAiResponse,
    clearCurrentAiResponse,
    
    // TTS functions
    speakText,
    stopSpeaking: ttsFunctions.stopSpeaking,
    
    // Audio chunk finished callback - stable function that doesn't change
    onAudioChunkFinished: (callback: (duration: number) => void) => {
      onAudioChunkFinishedRef.current = callback;
    },
    
    // GLB animation callback for when audio actually starts playing
    onGLBAudioStart: (callback: () => void) => {
      onGLBAudioStartRef.current = callback;
    },
    
    // 🎯 STREAMLINED: Direct viseme callback for immediate lip sync
    onViseme: (callback: (visemeId: number, offset: number) => void) => {
      onVisemeRef.current = callback;
    },
    
    // Override avatar methods for audio-only mode
    startAvatarSession: () => {
      console.log('[AudioProvider] startAvatarSession called - no-op for audio mode');
    },
    stopAvatarSession: () => {
      console.log('[AudioProvider] stopAvatarSession called - no-op for audio mode');
    },
    sendAvatarMessage: async (message: string) => {
      console.log('[AudioProvider] sendAvatarMessage called - redirecting to TTS');
      await speakText(message);
    },
    
    // Audio context initialization
    initializeAudioContext
  }), [
    conversationHistory, 
    currentAiResponse, 
    isProcessingResponse, 
    isAvatarTalking, 
    isAvatarSessionActive,
    isVoiceChatActive,
    isMuted,
    error,
    setError,
    clearError,
    appendToCurrentAiResponse,
    finalizeCurrentAiResponse,
    clearCurrentAiResponse,
    speakText,
    ttsFunctions.stopSpeaking,
    initializeAudioContext
    // Note: onAudioChunkFinished is not in dependencies as it's a stable function
  ]);

  return (
    <AudioContext.Provider value={contextValue}>
      {children}
    </AudioContext.Provider>
  );
};

// Hook to use audio context
export const useAudioContext = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudioContext must be used within AudioProvider');
  }
  return context;
}; 