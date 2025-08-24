import React, { createContext, useContext, useState, useRef, useCallback } from "react";

// Audio-only speaking context for interruption handling
const AudioSpeakingContext = createContext<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

export const AudioSpeakingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isCurrentlyInterrupted, setIsCurrentlyInterrupted] = useState(false);
  const canSpeakRef = useRef(true);
  const isInterruptedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const stopSpeakingRef = useRef<(() => void) | null>(null);

  // Sync refs with state
  React.useEffect(() => {
    isInterruptedRef.current = isCurrentlyInterrupted;
    canSpeakRef.current = !isCurrentlyInterrupted;
  }, [isCurrentlyInterrupted]);

  // Centralized interruption handler for audio mode
  const requestAudioInterruption = useCallback(() => {
    console.log('[AudioSpeaking] Requesting interruption');
    setIsCurrentlyInterrupted(true);
    
    // Don't abort the fetch request - let it continue (like video avatar)
    // Only stop the TTS using Deepgram Clear message
    if (stopSpeakingRef.current) {
      stopSpeakingRef.current();
    }
  }, []);

  // Reset interruption state for new requests
  const resetInterruptionState = useCallback(() => {
    console.log('[AudioSpeaking] Resetting interruption state');
    setIsCurrentlyInterrupted(false);
  }, []);

  // Force clear interruption state (for user-initiated actions like new conversation)
  const clearInterruption = useCallback(() => {
    console.log('[AudioSpeaking] 🔄 Force clearing interruption state for new user action');
    console.log('[AudioSpeaking] 🔍 Before clear: isCurrentlyInterrupted =', isCurrentlyInterrupted, ', isInterruptedRef.current =', isInterruptedRef.current);
    setIsCurrentlyInterrupted(false);
    console.log('[AudioSpeaking] ✅ Interruption state cleared');
  }, [isCurrentlyInterrupted]);

  // Function to register the stopSpeaking function
  const registerStopSpeaking = useCallback((stopFn: () => void) => {
    stopSpeakingRef.current = stopFn;
  }, []);

  const contextValue = {
    isCurrentlyInterrupted,
    canSpeakRef,
    isInterruptedRef,
    abortControllerRef,
    requestAudioInterruption,
    resetInterruptionState,
    clearInterruption,
    registerStopSpeaking,
  };

  return (
    <AudioSpeakingContext.Provider value={contextValue}>
      {children}
    </AudioSpeakingContext.Provider>
  );
};

export const useAudioSpeakingContext = () => {
  const context = useContext(AudioSpeakingContext);
  if (!context) {
    throw new Error('useAudioSpeakingContext must be used within AudioSpeakingProvider');
  }
  return context;
}; 