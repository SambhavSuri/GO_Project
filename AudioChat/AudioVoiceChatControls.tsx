import React, { useState, useEffect } from "react";
import { useAudioVoiceChat } from "../logic/audio";
import { useAudioContext } from "../logic/AudioProvider";
import { useAudioRagIntegration } from "../logic/useAudioRagIntegration";
import { MicIcon, MicOffIcon } from "../components/Icons";

// Audio-specific voice chat controls - matching text bot design
export const AudioVoiceChatControls = () => {
  const { isAvatarSessionActive, stopSpeaking, isMuted, isVoiceChatActive, isAvatarTalking, initializeAudioContext } = useAudioContext();
  const { muteInputAudio, unmuteInputAudio, startVoiceChat, isRecording, hasProcessedFinalTranscript } = useAudioVoiceChat();
  const { requestAudioInterruption } = useAudioRagIntegration();
  const [isStarting, setIsStarting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  // Update listening state based on recording status, mute state, final transcript processing, and avatar session
  // Remove listening indicator after final transcript is processed or when avatar is talking
  useEffect(() => {
    // Show listening indicator only when:
    // 1. Recording is active
    // 2. Not muted
    // 3. Haven't processed final transcript yet
    // 4. Avatar session is not active (no stop button visible)
    // Note: We keep listening visible even when avatar is talking to show that we're still listening
    // The listening will only disappear after final transcript is processed (2 seconds after silence)
    const shouldShowListening = isRecording && 
                               !isMuted && 
                               !hasProcessedFinalTranscript && 
                               !isAvatarSessionActive;
    
    setIsListening(shouldShowListening);
  }, [isRecording, isMuted, hasProcessedFinalTranscript, isAvatarSessionActive]);

  // Track if voice chat has been started
  useEffect(() => {
    if (isVoiceChatActive) {
      setHasStarted(true);
    }
  }, [isVoiceChatActive]);

  // Debug stop button visibility
  useEffect(() => {
    console.log('[AudioVoiceChatControls] isAvatarSessionActive changed to:', isAvatarSessionActive);
    console.log('[AudioVoiceChatControls] isAvatarTalking changed to:', isAvatarTalking);
  }, [isAvatarSessionActive, isAvatarTalking]);

  const handleMuteToggle = async () => {
    if (isAvatarTalking) {
      return; // Disable mute toggle when avatar is talking
    }
    if (!isVoiceChatActive && !isStarting) {
      setIsStarting(true);
      try {
        // Initialize audio context on first user interaction
        console.log('[AudioVoiceChatControls] Initializing audio context on user interaction...');
        await initializeAudioContext();
        
        await startVoiceChat();
        // Voice chat starts in muted state - user must manually unmute
      } catch (error) {
        console.error('[AudioVoiceChat] Error starting voice chat:', error);
      } finally {
        setIsStarting(false);
      }
    } else if (isVoiceChatActive) {
      if (isMuted) {
        try {
          await unmuteInputAudio();
        } catch (error) {
          console.error('[AudioVoiceChat] Error unmuting audio:', error);
          alert('Unable to access microphone. Please check your browser permissions and try again.');
        }
      } else {
        muteInputAudio();
      }
    }
  };

  const handleInterrupt = async () => {
    console.log('[AudioVoiceChatControls] Stop button pressed - interrupting audio immediately');
    console.log('[AudioVoiceChatControls] Current state - isAvatarSessionActive:', isAvatarSessionActive);
    try {
      if (stopSpeaking) {
        console.log('[AudioVoiceChatControls] Calling stopSpeaking...');
        stopSpeaking(true); // Use forceStop to immediately clear all queued audio
      }
      console.log('[AudioVoiceChatControls] Requesting audio interruption...');
      requestAudioInterruption();
      console.log('[AudioVoiceChatControls] Audio interrupted and RAG processing stopped');
    } catch (error) {
      console.error('[AudioVoiceChatControls] Error interrupting audio:', error);
    }
  };

  const getButtonText = () => {
    if (!isVoiceChatActive && !hasStarted) {
      return "Start Voice Chat";
    }
    if (isStarting) {
      return "Starting...";
    }
    if (!isVoiceChatActive) {
      return "Reconnect";
    }
    return ""; // Empty text for icon-only buttons
  };

  const getButtonColor = () => {
    if (!isVoiceChatActive && !hasStarted) {
      return "bg-black hover:bg-gray-800";
    }
    if (isStarting) {
      return "bg-gray-500";
    }
    if (!isVoiceChatActive) {
      return "bg-black hover:bg-gray-800";
    }
    // Always show black button when voice chat is active (after any toggle)
    return "bg-black hover:bg-gray-800";
  };

  const getButtonIcon = () => {
    if (!isVoiceChatActive && !hasStarted) {
      return null; // No icon for start button
    }
    if (isStarting) {
      return null; // No icon for loading state
    }
    if (!isVoiceChatActive) {
      return null; // No icon for reconnect button
    }
    return isMuted ? <MicOffIcon size={20} /> : <MicIcon size={20} />;
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex justify-center gap-2">
        <button
          onClick={handleMuteToggle}
          disabled={isStarting || isAvatarTalking}
          className={`${getButtonColor()} text-white text-sm px-6 py-2 rounded-lg disabled:opacity-50 transition-colors h-fit flex items-center gap-2`}
          title={isMuted ? "Unmute microphone" : "Mute microphone"}
        >
          {getButtonIcon()}
          {getButtonText()}
        </button>
        {isAvatarTalking && isAvatarSessionActive && (
          <button
            data-testid="stop-button"
            onClick={(e) => {
              console.log('[AudioVoiceChatControls] Stop button clicked!');
              e.preventDefault();
              e.stopPropagation();
              handleInterrupt();
            }}
            className="!bg-red-600 !opacity-100 text-white text-sm px-6 py-2 rounded-lg hover:!bg-red-700 transition-colors font-medium shadow-sm border border-red-500 h-fit cursor-pointer"
            title="Stop audio playback"
          >
            Stop
          </button>
        )}
      </div>
      {/* Voice chat status indicators */}
      {isVoiceChatActive && !isMuted && !isAvatarTalking && (
        <div className="flex flex-col items-center gap-2">
          {isListening && (
            <div className="flex items-center gap-2 text-black">
              <div className="w-2 h-2 rounded-full bg-black animate-pulse" />
              <span className="text-sm">Listening...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 