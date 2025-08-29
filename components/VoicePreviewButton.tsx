import React, { useState, useEffect } from 'react';
import { useVoice } from '../logic/VoiceContext';

// Welcome message (same as in AudioChatWithAvatar)
const WELCOME_MESSAGE = `hello, Im Peter your personal advocate, I'm here to help you with your legal needs`;

// Global state for preview button
let globalPreviewHandler: ((voice: string) => Promise<void>) | null = null;
let globalPreviewResetHandler: (() => void) | null = null;

export const registerPreviewHandler = (handler: (voice: string) => Promise<void>) => {
  globalPreviewHandler = handler;
};

export const registerPreviewResetHandler = (resetHandler: () => void) => {
  globalPreviewResetHandler = resetHandler;
};

export const resetPreviewButton = () => {
  if (globalPreviewResetHandler) {
    globalPreviewResetHandler();
  }
};

const VoicePreviewButton: React.FC = () => {
  const { selectedVoice, getVoiceLabel, isSessionActive } = useVoice();
  const [isPlaying, setIsPlaying] = useState(false);

  // Register the reset handler when component mounts
  useEffect(() => {
    const resetHandler = () => {
      console.log('[VoicePreviewButton] 🛑 Resetting preview button state');
      setIsPlaying(false);
    };

    registerPreviewResetHandler(resetHandler);

    return () => {
      registerPreviewResetHandler(() => {});
    };
  }, []);

  const handlePreviewClick = async () => {
    if (isPlaying || !globalPreviewHandler || isSessionActive) return; // Prevent clicks during playback or session

    console.log('[VoicePreviewButton] 🎤 Preview voice:', selectedVoice);
    setIsPlaying(true);

    try {
      await globalPreviewHandler(selectedVoice);
      console.log('[VoicePreviewButton] ✅ Voice preview completed');
    } catch (error) {
      console.error('[VoicePreviewButton] ❌ Error during voice preview:', error);
    } finally {
      setIsPlaying(false);
    }
  };

  return (
    <button
      onClick={handlePreviewClick}
      disabled={isPlaying || isSessionActive}
      className={`flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm transition-colors duration-200 ${
        isPlaying || isSessionActive 
          ? 'opacity-60 cursor-not-allowed bg-gray-100' 
          : 'hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
      }`}
      title={isSessionActive ? 'Preview disabled during voice chat' : `Preview ${getVoiceLabel(selectedVoice)}`}
    >
      <svg 
        className={`w-4 h-4 text-gray-600 ${isPlaying ? 'animate-pulse' : ''}`} 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293H15a2 2 0 002-2V9a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293L10.293 4.293A1 1 0 009.586 4H8a2 2 0 00-2 2v8a2 2 0 002 2z" 
        />
      </svg>
      <span className="text-sm font-medium text-gray-900">
        {isSessionActive ? 'Voice Chat Active' : isPlaying ? 'Playing...' : 'Preview Voice'}
      </span>
    </button>
  );
};

export default VoicePreviewButton;
