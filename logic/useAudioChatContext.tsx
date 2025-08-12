import React, { createContext, useContext, useState, useRef, useEffect } from "react";
import { useStreamingAvatarContext } from "./context";

// Define the ConversationPair interface to match the video avatar
export interface ConversationPair {
  id: string;
  user: string;
  ai: string;
  timestamp: number;
}

// Create a separate context for audio mode that extends the existing context
const AudioChatContext = createContext<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

// Audio-only context provider that reuses existing logic
export const AudioChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Reuse the existing context structure but override avatar-specific methods
  const existingContext = useStreamingAvatarContext();
  
  // Create local state that mirrors the video avatar context
  const [conversationHistory, setConversationHistory] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [currentAiResponse, setCurrentAiResponse] = useState<string>('');
  const [isProcessingResponse, setIsProcessingResponse] = useState(false);
  const [isAvatarTalking, setIsAvatarTalking] = useState(false);
  const [isAvatarSessionActive, setIsAvatarSessionActive] = useState(false);
  
  // Use ref to store current AI response to avoid closure issues
  const currentAiResponseRef = useRef<string>('');
  
  // Update ref whenever state changes
  useEffect(() => {
    currentAiResponseRef.current = currentAiResponse;
  }, [currentAiResponse]);
  
  // Override avatar methods for audio-only mode
  const audioContextValue = {
    ...existingContext,
    avatarRef: { current: null }, // No avatar in audio mode
    // TTS functions will be provided by the TTS hook when it's used
    speakText: null, // Will be set by TTS hook
    stopSpeaking: null, // Will be set by TTS hook
    closeConnectionWhenComplete: null, // Will be set by TTS hook
    getBufferingState: () => ({ isBuffering: false, totalBufferedBytes: 0, minBufferBytes: 0, bufferProgress: 0 }), // Default
    isAvatarTalking,
    setIsAvatarTalking,
    isAvatarSessionActive,
    setIsAvatarSessionActive,
    // Override message functions to use local state
    conversationHistory,
    currentAiResponse,
    isProcessingResponse,
    addUserMessage: (text: string) => {
      console.log('[AudioChat] Adding user message:', text);
      const newPair = {
        id: Date.now().toString(),
        user: text,
        ai: '',
        timestamp: Date.now(),
      };
      setConversationHistory(prev => [...prev, newPair]);
      setCurrentAiResponse('');
      setIsProcessingResponse(true);
    },
    addAiMessage: (text: string) => {
      console.log('[AudioChat] Adding AI message:', text);
      setConversationHistory(prev => {
        if (prev.length > 0) {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            ai: text
          };
          return updated;
        }
        return prev;
      });
      setCurrentAiResponse('');
      setIsProcessingResponse(false);
    },
    appendToCurrentAiResponse: (chunk: string) => {
      console.log('[AudioChat] appendToCurrentAiResponse called with chunk length:', chunk.length);
      console.log('[AudioChat] appendToCurrentAiResponse - chunk preview:', chunk.substring(0, 100) + (chunk.length > 100 ? '...' : ''));
      setCurrentAiResponse(chunk);
      console.log('[AudioChat] appendToCurrentAiResponse - currentAiResponse updated to length:', chunk.length);
    },
    finalizeCurrentAiResponse: () => {
      // Use ref to get current AI response to avoid closure issues
      const currentResponse = currentAiResponseRef.current;
      console.log('[AudioChat] Finalizing AI response - currentAiResponse from ref:', currentResponse);
      
      setConversationHistory(prev => {
        console.log('[AudioChat] Finalizing AI response - conversationHistory length:', prev.length);
        
        if (currentResponse && prev.length > 0) {
          console.log('[AudioChat] Saving AI response to conversation history');
          const updated = [...prev];
          const lastIndex = updated.length - 1;
          console.log('[AudioChat] Updating conversation at index:', lastIndex);
          console.log('[AudioChat] Previous AI response:', updated[lastIndex]?.ai);
          updated[lastIndex] = {
            ...updated[lastIndex],
            ai: currentResponse
          };
          console.log('[AudioChat] New AI response:', updated[lastIndex]?.ai);
          console.log('[AudioChat] AI response finalized successfully');
          return updated;
        } else {
          console.log('[AudioChat] Cannot finalize - no current response or no conversation history');
          console.log('[AudioChat] currentResponse exists:', !!currentResponse);
          console.log('[AudioChat] conversationHistory length:', prev.length);
          return prev;
        }
      });
      setCurrentAiResponse('');
      setIsProcessingResponse(false);
    },
    setIsProcessingResponse: (processing: boolean) => {
      setIsProcessingResponse(processing);
    },
  };

  return (
    <AudioChatContext.Provider value={audioContextValue}>
      {children}
    </AudioChatContext.Provider>
  );
};

// Hook to use audio chat context
export const useAudioChatContext = () => {
  const context = useContext(AudioChatContext);
  if (!context) {
    throw new Error('useAudioChatContext must be used within AudioChatProvider');
  }
  return context;
}; 