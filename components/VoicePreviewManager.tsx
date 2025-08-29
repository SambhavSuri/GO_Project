import React, { useEffect } from 'react';
import { registerPreviewHandler } from './VoicePreviewButton';
import { useAudioContext } from '../logic/AudioProvider';

// Welcome message (same as in AudioChatWithAvatar)
const WELCOME_MESSAGE = `hello, Im Peter your personal advocate, I'm here to help you with your legal needs`;

interface VoicePreviewManagerProps {
  children: React.ReactNode;
}

/**
 * Component that manages voice preview functionality
 * Must be inside AudioProvider to access speakText function
 */
export const VoicePreviewManager: React.FC<VoicePreviewManagerProps> = ({ children }) => {
  const audioContext = useAudioContext();

  useEffect(() => {
    const previewHandler = async (voiceId: string) => {
      console.log('[VoicePreviewManager] 🎤 Playing preview for voice:', voiceId);
      
      try {
        // Stop any current TTS first
        if (audioContext?.stopSpeaking) {
          audioContext.stopSpeaking(true); // Force stop current audio
        }

        // Wait a moment for cleanup
        await new Promise(resolve => setTimeout(resolve, 200));

        // Play the welcome message with the specified voice (full TTS process)
        if (audioContext?.speakText) {
          console.log('[VoicePreviewManager] 🎭 Playing welcome message with voice:', voiceId);
          await audioContext.speakText(WELCOME_MESSAGE, true); // true indicates this is a welcome message
        }

        console.log('[VoicePreviewManager] ✅ Voice preview completed');
      } catch (error) {
        console.error('[VoicePreviewManager] ❌ Error during voice preview:', error);
        throw error; // Re-throw so the button can handle it
      }
    };

    // Register the preview handler
    registerPreviewHandler(previewHandler);

    // Cleanup on unmount
    return () => {
      registerPreviewHandler(async () => {});
    };
  }, [audioContext]);

  return <>{children}</>;
};
