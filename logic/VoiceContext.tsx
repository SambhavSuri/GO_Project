import React, { createContext, useContext, useState, useCallback } from 'react';

// Azure TTS Voice Options with categories
export const AZURE_VOICES = {
  hd_neural: {
    label: 'HD Neural Voices (Best Quality)',
    voices: [
      { value: 'en-US-AdamMultilingualNeural', label: 'Adam (US) - HD Neural' },
      { value: 'en-US-BrianMultilingualNeural', label: 'Brian (US) - HD Neural' },
      { value: 'en-US-DavisNeural', label: 'Davis (US) - HD Neural' },
      { value: 'en-US-SteffanNeural', label: 'Steffan (US) - HD Neural' }
    ]
  },
  standard_neural: {
    label: 'Standard Neural Voices',
    voices: [
      { value: 'en-US-GuyNeural', label: 'Guy (US) - Standard' },
      { value: 'en-US-DavisNeural', label: 'Davis (US) - Standard' }
    ]
  },
  uk_voices: {
    label: 'English (UK) Male Voices',
    voices: [
      { value: 'en-GB-RyanNeural', label: 'Ryan (UK)' }
    ]
  },
  au_voices: {
    label: 'English (Australia) Male Voices',
    voices: [
      { value: 'en-AU-WilliamNeural', label: 'William (AU)' }
    ]
  },
  in_voices: {
    label: 'English (India) Male Voice',
    voices: [
      { value: 'en-IN-PrabhatNeural', label: 'Prabhat (IN)' }
    ]
  }
};

// Flatten all voices for easy lookup
export const ALL_VOICES = Object.values(AZURE_VOICES).flatMap(category => category.voices);

// Default voice
const DEFAULT_VOICE = 'en-GB-RyanNeural';

interface VoiceContextType {
  selectedVoice: string;
  setSelectedVoice: (voice: string) => void;
  getVoiceLabel: (voice: string) => string;
  isSessionActive: boolean;
  setIsSessionActive: (active: boolean) => void;
}

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

export const VoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedVoice, setSelectedVoiceState] = useState<string>(DEFAULT_VOICE);
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);

  const setSelectedVoice = useCallback((voice: string) => {
    // Don't allow voice changes during active session
    if (isSessionActive) {
      console.log('[VoiceContext] ❌ Voice change blocked - session is active');
      return;
    }
    
    console.log('[VoiceContext] 🎤 Voice changed to:', voice);
    setSelectedVoiceState(voice);
  }, [isSessionActive]);

  const getVoiceLabel = useCallback((voice: string) => {
    const voiceObj = ALL_VOICES.find(v => v.value === voice);
    return voiceObj?.label || voice;
  }, []);

  return (
    <VoiceContext.Provider value={{
      selectedVoice,
      setSelectedVoice,
      getVoiceLabel,
      isSessionActive,
      setIsSessionActive
    }}>
      {children}
    </VoiceContext.Provider>
  );
};

export const useVoice = () => {
  const context = useContext(VoiceContext);
  if (context === undefined) {
    throw new Error('useVoice must be used within a VoiceProvider');
  }
  return context;
};
