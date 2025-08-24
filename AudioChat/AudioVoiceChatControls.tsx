import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAudioVoiceChat } from "../logic/useAudioVoiceChat";
import { useAudioContext } from "../logic/AudioProvider";
import { useAudioRagIntegration } from "../logic/useAudioRagIntegration";

interface IconSvgProps {
  size?: number;
  width?: number;
  height?: number;
  [key: string]: any;
}

export function MicIcon({ size = 24, width, height, ...props }: IconSvgProps) {
  return (
    <svg
      fill="none"
      height={size || height}
      viewBox="0 0 20 20"
      width={size || width}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <g clipPath="url(#clip0_9098_19437)">
        <g filter="url(#filter0_d_9098_19437)">
          <path
            clipRule="evenodd"
            d="M5.83341 5.00065C5.83341 2.69946 7.6989 0.833984 10.0001 0.833984C12.3013 0.833984 14.1667 2.69946 14.1667 5.00065L14.1667 8.33398C14.1667 10.6352 12.3013 12.5007 10.0001 12.5007C7.6989 12.5007 5.83341 10.6352 5.83341 8.33398L5.83341 5.00065ZM12.5001 5.00065L12.5001 8.33398C12.5001 9.7147 11.3808 10.834 10.0001 10.834C8.61937 10.834 7.50008 9.7147 7.50008 8.33398V5.00065C7.50008 3.61994 8.61937 2.50065 10.0001 2.50065C11.3808 2.50065 12.5001 3.61994 12.5001 5.00065Z"
            fill="white"
            fillRule="evenodd"
          />
          <path
            d="M5.66675 17.5007H9.16675V15.3688C5.64744 14.9564 2.91675 11.9641 2.91675 8.33398V8.16732C2.91675 7.93396 2.91675 7.81729 2.96216 7.72816C3.00211 7.64975 3.06585 7.58601 3.14425 7.54607C3.23338 7.50065 3.35006 7.50065 3.58341 7.50065H3.91675C4.1501 7.50065 4.26678 7.50065 4.35591 7.54607C4.43431 7.58601 4.49805 7.64975 4.538 7.72816C4.58341 7.81729 4.58341 7.93396 4.58341 8.16732V8.33398C4.58341 11.3255 7.00854 13.7507 10.0001 13.7507C12.9916 13.7507 15.4167 11.3255 15.4167 8.33398V8.16732C15.4167 7.93396 15.4167 7.81729 15.4622 7.72816C15.5021 7.64975 15.5659 7.58601 15.6443 7.54607C15.7334 7.50065 15.8501 7.50065 16.0834 7.50065H16.4167C16.6501 7.50065 16.7668 7.50065 16.8559 7.54607C16.9343 7.58601 16.9981 7.64975 17.038 7.72816C17.0834 7.81729 17.0834 7.93396 17.0834 8.16732V8.33398C17.0834 11.9641 14.3527 14.9564 10.8334 15.3688V17.5007L14.3334 17.5007C14.5668 17.5007 14.6834 17.5007 14.7726 17.5461C14.851 17.586 14.9147 17.6498 14.9547 17.7282C15.0001 17.8173 15.0001 17.934 15.0001 18.1673V18.5007C15.0001 18.734 15.0001 18.8507 14.9547 18.9398C14.9147 19.0182 14.851 19.082 14.7726 19.1219C14.6834 19.1673 14.5668 19.1673 14.3334 19.1673L5.66675 19.1673C5.43339 19.1673 5.31672 19.1673 5.22759 19.1219C5.14918 19.082 5.08544 19.0182 5.0455 18.9398C5.00008 18.8507 5.00008 18.734 5.00008 18.5007V18.1673C5.00008 17.934 5.00008 17.8173 5.0455 17.7282C5.08544 17.6498 5.14918 17.586 5.22759 17.5461C5.31672 17.5007 5.43339 17.5007 5.66675 17.5007Z"
            fill="white"
          />
        </g>
      </g>
      <defs>
        <filter
          colorInterpolationFilters="sRGB"
          filterUnits="userSpaceOnUse"
          height="22.334"
          id="filter0_d_9098_19437"
          width="18.1667"
          x="0.916748"
          y="-0.166016"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            result="hardAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          />
          <feOffset dy="1" />
          <feGaussianBlur stdDeviation="1" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.0627451 0 0 0 0 0.0941176 0 0 0 0 0.156863 0 0 0 0.05 0"
          />
          <feBlend
            in2="BackgroundImageFix"
            mode="normal"
            result="effect1_dropShadow_9098_19437"
          />
          <feBlend
            in="SourceGraphic"
            in2="effect1_dropShadow_9098_19437"
            mode="normal"
            result="shape"
          />
        </filter>
        <clipPath id="clip0_9098_19437">
          <rect fill="white" height="20" width="20" />
        </clipPath>
      </defs>
    </svg>
  );
}

export function MicOffIcon({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) {
  return (
    <svg
      fill="none"
      height={size || height}
      viewBox="0 0 48 48"
      width={size || width}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M24 2c2.75 0 5.24 1.11 7.047 2.905l-2.864 2.793A6 6 0 0 0 18 12v5.633l-3.898 3.803A10.09 10.09 0 0 1 14 20v-8c0-5.523 4.477-10 10-10Z"
        data-follow-fill="white"
        fill="white"
      />
      <path
        clipRule="evenodd"
        d="m18.151 28.112-2.172 2.12A12.945 12.945 0 0 0 24 33c7.18 0 13-5.82 13-13v-1a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1c0 8.712-6.554 15.894-15 16.884V42h9a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H13a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1h9v-5.116a16.925 16.925 0 0 1-8.904-3.84l-6.185 6.033a1 1 0 0 1-1.414-.017l-1.292-1.324a1 1 0 0 1 .018-1.414l33.642-32.82a1 1 0 0 1 1.415.017l1.291 1.324a1 1 0 0 1-.017 1.414L34 12.651V20c0 5.523-4.477 10-10 10-2.184 0-4.204-.7-5.849-1.888ZM30 16.552l-8.912 8.695A6 6 0 0 0 30 20v-3.447Z"
        data-follow-fill="white"
        fill="white"
        fillRule="evenodd"
      />
      <path
        d="M11 20c0 1.353.207 2.658.59 3.885l-3.119 3.043A16.94 16.94 0 0 1 7 20v-1a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1Z"
        data-follow-fill="white"
        fill="white"
      />
    </svg>
  );
}

// Audio-specific voice chat controls - matching text bot design
export const AudioVoiceChatControls = () => {
  const { isAvatarSessionActive, stopSpeaking, isMuted, isVoiceChatActive, isAvatarTalking } = useAudioContext();
  const { muteInputAudio, unmuteInputAudio, startVoiceChat, isRecording, hasProcessedFinalTranscript, isDeepgramConnected } = useAudioVoiceChat();
  const { requestAudioInterruption } = useAudioRagIntegration();
  const [isStarting, setIsStarting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const isDeepgramConnectedRef = useRef(false);

  // Keep ref in sync with state for immediate access
  useEffect(() => {
    isDeepgramConnectedRef.current = isDeepgramConnected;
  }, [isDeepgramConnected]);

  // Update listening state based on recording status, mute state, final transcript processing, and avatar session
  useEffect(() => {
    const shouldShowListening = isRecording && 
                               !isMuted && 
                               !hasProcessedFinalTranscript && 
                               !isAvatarSessionActive;
    setIsListening(shouldShowListening);
  }, [isRecording, isMuted, hasProcessedFinalTranscript, isAvatarSessionActive]);

  const handleMuteToggle = async () => {
    if (isAvatarTalking) {
      return; // Disable mute toggle when avatar is talking
    }
    if (!isVoiceChatActive && !isStarting) {
      setIsStarting(true);
      try {
        await startVoiceChat();
        // Auto-unmute and create Deepgram connection immediately after starting (like video bot)
        await unmuteInputAudio();
        console.log('[AudioVoiceChat] Voice chat started and mic unmuted by default');
        
        // Wait for Deepgram connection to be established before removing "starting" state
        const waitForDeepgram = () => {
          return new Promise<void>((resolve) => {
            const checkConnection = () => {
              if (isDeepgramConnectedRef.current) {
                resolve();
              } else {
                setTimeout(checkConnection, 100); // Check every 100ms
              }
            };
            checkConnection();
          });
        };
        
        // Wait up to 5 seconds for Deepgram connection
        const timeoutPromise = new Promise<void>((resolve) => {
          setTimeout(() => {
            resolve();
          }, 5000);
        });
        await Promise.race([waitForDeepgram(), timeoutPromise]);
        
        // Start timer as soon as voice chat starts
        try { window.dispatchEvent(new CustomEvent('voice_chat_started')); } catch {}
      } catch (error) {
        console.error('[AudioVoiceChat] Error starting/unmuting voice chat:', error);
      } finally {
        setIsStarting(false);
      }
    } else if (isVoiceChatActive) {
      // Add protection: don't allow toggle if we're still connecting or if called too quickly
      if (isStarting || !isDeepgramConnectedRef.current) {
        return;
      }
      
      if (isMuted) {
        try {
          await unmuteInputAudio();
          // Resume timer when unmuting
          try { window.dispatchEvent(new CustomEvent('voice_chat_started')); } catch {}
        } catch (error) {
          console.error('[AudioVoiceChat] Error unmuting:', error);
        }
      } else {
        try {
          // Muting should NOT close Deepgram connection - just stop audio stream
          muteInputAudio();
          // Pause timer when muting
          try { window.dispatchEvent(new CustomEvent('voice_chat_paused')); } catch {}
        } catch (error) {
          console.error('[AudioVoiceChat] Error muting:', error);
        }
      }
    }
  };

  const handleInterrupt = useCallback(async () => {
    try {
      console.log('[AudioVoiceChatControls] 🛑 PETER STOP: Executing complete interruption');
      
      // 🎯 FIX: Stop the entire RAG stream, not just TTS
      // Dispatch event to stop all streaming responses
      window.dispatchEvent(new CustomEvent('stopAllStreaming', { 
        detail: { reason: 'peter_stop_command' }
      }));
      
      if (stopSpeaking) {
        stopSpeaking(true);
      }
      requestAudioInterruption();
    } catch (error) {
      console.error('[AudioVoiceChatControls] Error interrupting audio:', error);
    }
  }, [stopSpeaking, requestAudioInterruption]);

  // Add event listener for "peter stop" interrupt commands
  useEffect(() => {
    const handleAudioInterruptRequest = (event: any) => {
      const source = event.detail?.source;
      const timestamp = event.detail?.timestamp || new Date().toISOString();
      
      console.log(`🛑 [AUDIO INTERRUPT REQUEST] ${timestamp}: Received interrupt request from: ${source}`);
      
      if (source === 'peter_stop_command') {
        console.log(`⏹️ [PETER STOP EXECUTED] ${timestamp}: Executing interrupt due to voice command`);
        handleInterrupt();
      }
    };

    window.addEventListener('audioInterruptRequest', handleAudioInterruptRequest);
    
    return () => {
      window.removeEventListener('audioInterruptRequest', handleAudioInterruptRequest);
    };
  }, [handleInterrupt, stopSpeaking, requestAudioInterruption]);

  const getButtonText = () => {
    if (!isVoiceChatActive) {
      if (isStarting) {
        return "Connecting...";
      }
      return "Start Voice Chat"; // Show "Start Voice Chat" when not active
    }
    if (isStarting || !isDeepgramConnectedRef.current) {
      return "Connecting...";
    }
    return ""; // No text when Deepgram is connected, only show icon
  };

  const getButtonColor = () => {
    if (!isVoiceChatActive) {
      return isStarting ? "bg-gray-500" : "bg-black hover:bg-gray-800";
    }
    return "bg-black hover:bg-gray-800";
  };

  const getButtonIcon = () => {
    if (!isVoiceChatActive) {
      return null; // No icon when voice chat is not active
    }
    if (isStarting || !isDeepgramConnectedRef.current) {
      // Show loading spinner while starting or connecting to Deepgram
      return (
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
      );
    }
    // Show mic icon once Deepgram is connected
    return isMuted ? <MicOffIcon size={20} /> : <MicIcon size={20} />;
  };

  const Wave = () => (
    <div className="flex items-end gap-1 h-4">
      <style>{`
        @keyframes waveBar { 0%{height:20%} 50%{height:100%} 100%{height:20%} }
      `}</style>
      {[0,1,2,3,4].map((i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            width: '3px',
            backgroundColor: 'black',
            height: '20%',
            animation: 'waveBar 1s ease-in-out infinite',
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex justify-center gap-2">
        <button
          onClick={handleMuteToggle}
          disabled={isStarting || isAvatarTalking}
          className={`${getButtonColor()} text-white text-sm px-6 py-2 rounded-lg disabled:opacity-50 transition-colors h-fit flex items-center gap-2`}
          title={
            !isVoiceChatActive 
              ? "Start voice chat" 
              : isStarting || !isDeepgramConnectedRef.current
                ? "Connecting to voice chat..." 
                : isMuted 
                  ? "Unmute microphone" 
                  : "Mute microphone"
          }
        >
          {getButtonIcon()}
          {getButtonText()}
        </button>
        {isAvatarTalking && isAvatarSessionActive && (
          <button
            data-testid="stop-button"
            onClick={(e) => {
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
      {/* Voice chat status indicators - show wave when Deepgram connection is established */}
      {isVoiceChatActive && !isMuted && !isAvatarTalking && isDeepgramConnectedRef.current && !isStarting && (
        <div className="flex flex-col items-center gap-2 h-8"> {/* Fixed height container */}
          <div className={`flex items-center gap-2 text-black transition-opacity duration-200 ${isListening ? 'opacity-100' : 'opacity-0'}`}>
            <Wave />
          </div>
        </div>
      )}
    </div>
  );
}; 