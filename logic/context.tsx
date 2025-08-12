import React, { createContext, useContext } from 'react';

// Stub context for compatibility with audio components
// This is a placeholder since we're using audio-only mode
const StreamingAvatarContext = createContext<any>(null);

export const StreamingAvatarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const contextValue = {
    // Placeholder values for compatibility
    avatarRef: { current: null },
    conversationHistory: [],
    currentAiResponse: '',
    isProcessingResponse: false,
    isAvatarTalking: false,
    isAvatarSessionActive: false,
    isVoiceChatActive: false,
    isMuted: false,
    error: null,
    setError: () => {},
    clearError: () => {},
  };

  return (
    <StreamingAvatarContext.Provider value={contextValue}>
      {children}
    </StreamingAvatarContext.Provider>
  );
};

export const useStreamingAvatarContext = () => {
  const context = useContext(StreamingAvatarContext);
  if (!context) {
    // Return a default context for audio-only mode
    return {
      avatarRef: { current: null },
      conversationHistory: [],
      currentAiResponse: '',
      isProcessingResponse: false,
      isAvatarTalking: false,
      isAvatarSessionActive: false,
      isVoiceChatActive: false,
      isMuted: false,
      error: null,
      setError: () => {},
      clearError: () => {},
    };
  }
  return context;
};