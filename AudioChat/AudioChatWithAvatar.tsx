import React, { useState, useEffect, useRef } from "react";
import { useAudioVoiceChat } from "../logic/audio";
import { useAudioContext } from "../logic/AudioProvider";
import { Loader2 } from "lucide-react";
import { AudioAvatarControls } from "./AudioAvatarControls";
import { AudioMessageHistory } from "./AudioMessageHistory";
import { VRMAvatar } from "../components/VRMAvatar/VRMAvatar";

// Welcome message from the personal tutor
const WELCOME_MESSAGE = `Hello! I'm your personal Advocate and Assistant, and I'm excited to help you today. `;

export function AudioChatWithAvatar() {
  const [isStarted, setIsStarted] = useState(false);
  const [hasWelcomed, setHasWelcomed] = useState(false);
  const [isWelcomeSpeaking, setIsWelcomeSpeaking] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [selectedModel, setSelectedModel] = useState('/static/assets/6891a06aece5d61d2d726697.glb');
  const [showStartButton, setShowStartButton] = useState(true);
  const [lookingGlassEnabled, setLookingGlassEnabled] = useState(false);
  const welcomeMessageRef = useRef<string | null>(null);
  const hasSentWelcomeRef = useRef(false);
  const lookingGlassWindowRef = useRef<Window | null>(null);
  
  // Use refs to track current state for the callback
  const isWelcomeSpeakingRef = useRef(false);
  const hasWelcomedRef = useRef(false);
  const isAvatarTalkingRef = useRef(false);
  
  // Get context values with proper initialization check
  const context = useAudioContext();
  const { isRecording, showStartTalkingPrompt } = useAudioVoiceChat();
  
  // Only destructure context values after ensuring context is available
  const isProcessingResponse = context?.isProcessingResponse ?? false;
  const isAvatarTalking = context?.isAvatarTalking ?? false;
  const speakText = context?.speakText;
  const setIsAvatarSessionActive = context?.setIsAvatarSessionActive;
  const onAudioChunkFinished = context?.onAudioChunkFinished;
  const initializeAudioContext = context?.initializeAudioContext;  
  // Update refs when state changes - only if context values are available
  useEffect(() => {
    if (context) {
      isWelcomeSpeakingRef.current = isWelcomeSpeaking;
    }
  }, [isWelcomeSpeaking, context]);
  
  useEffect(() => {
    if (context) {
      hasWelcomedRef.current = hasWelcomed;
    }
  }, [hasWelcomed, context]);
  
  useEffect(() => {
    if (context) {
      isAvatarTalkingRef.current = isAvatarTalking;
    }
  }, [isAvatarTalking, context]);

  // Mirror speaking state to Looking Glass when it changes
  useEffect(() => {
    if (context) {
      mirrorToLookingGlass('speaking', { isSpeaking: isAvatarTalking });
    }
  }, [isAvatarTalking, context]);

  // Handle Looking Glass window
  const handleEnableLookingGlass = () => {
    if (!lookingGlassEnabled) {
      console.log('[AudioChatWithAvatar] Opening Looking Glass viewer...');
      const lookingGlassWindow = window.open(
        '/looking-glass-viewer.html',
        'lookingGlassViewer',
        'width=1200,height=800,resizable=yes,scrollbars=yes'
      );
      
      if (lookingGlassWindow) {
        lookingGlassWindowRef.current = lookingGlassWindow;
        setLookingGlassEnabled(true);
        
        // Listen for when the window is closed
        const checkClosed = setInterval(() => {
          if (lookingGlassWindow.closed) {
            console.log('[AudioChatWithAvatar] Looking Glass viewer closed');
            lookingGlassWindowRef.current = null;
            setLookingGlassEnabled(false);
            clearInterval(checkClosed);
          }
        }, 1000);
        
        console.log('[AudioChatWithAvatar] ✅ Looking Glass viewer opened');
      }
    } else {
      // Close the Looking Glass window
      if (lookingGlassWindowRef.current) {
        lookingGlassWindowRef.current.close();
        lookingGlassWindowRef.current = null;
        setLookingGlassEnabled(false);
        console.log('[AudioChatWithAvatar] Looking Glass viewer closed');
      }
    }
  };

  // Mirror animations to Looking Glass
  const mirrorToLookingGlass = (type: string, data: any) => {
    if (lookingGlassWindowRef.current && !lookingGlassWindowRef.current.closed) {
      try {
        lookingGlassWindowRef.current.postMessage({
          type: 'MIRROR_ANIMATION',
          animationType: type,
          data: data
        }, '*');
      } catch (error) {
        console.warn('[AudioChatWithAvatar] Failed to mirror to Looking Glass:', error);
      }
    }
  };

  // Handle start call button click
  const handleStartCall = async () => {
    console.log('[AudioChatWithAvatar] Start Call button clicked - initializing with user interaction');
    
    try {
      // Initialize audio context on user interaction
      if (initializeAudioContext) {
        console.log('[AudioChatWithAvatar] Initializing audio context...');
        await initializeAudioContext();
      }
      
      // Reset welcome message refs for clean state
      welcomeMessageRef.current = null;
      hasSentWelcomeRef.current = false;
      isWelcomeSpeakingRef.current = false;
      hasWelcomedRef.current = false;
      
      // Reset state for new session
      setHasWelcomed(false);
      setShowStartButton(false);
      
      // Start the session
      setIsInitializing(true);
      setIsWelcomeSpeaking(true);
      setIsStarted(true);
      
      console.log('[AudioChatWithAvatar] Session started successfully');
    } catch (error) {
      console.error('[AudioChatWithAvatar] Error starting session:', error);
      // Reset states on error
      setShowStartButton(true);
      setIsInitializing(false);
      setIsWelcomeSpeaking(false);
      setIsStarted(false);
    }
  };

  // Set up audio chunk finished callback once when component mounts
  useEffect(() => {
    if (!onAudioChunkFinished) return;
    
    const handleAudioChunkFinished = (duration: number) => {
      console.log('[AudioChatWithAvatar] Audio chunk finished, duration:', duration);
      
      // Enable buttons when welcome message audio chunks finish
      if (isWelcomeSpeakingRef.current && hasWelcomedRef.current) {
        console.log('[AudioChatWithAvatar] Welcome message complete - enabling all buttons');
        setIsWelcomeSpeaking(false);
        setIsInitializing(false);
        welcomeMessageRef.current = null;
        // Reset avatar session active state to hide stop button
        if (setIsAvatarSessionActive) {
          setIsAvatarSessionActive(false);
        }
      }
    };

    console.log('[AudioChatWithAvatar] Setting up audio chunk finished callback');
    
    // Set up the callback in the audio context
    onAudioChunkFinished(handleAudioChunkFinished);

    return () => {
      // Clean up callback when component unmounts
      onAudioChunkFinished(() => {});
    };
  }, [onAudioChunkFinished, setIsAvatarSessionActive]);

  // Enable buttons when avatar stops talking (main mechanism)
  useEffect(() => {
    if (!context) return;
    
    if (!isAvatarTalkingRef.current && isWelcomeSpeakingRef.current && hasWelcomedRef.current) {
      console.log('[AudioChatWithAvatar] Avatar stopped talking after welcome message - enabling all buttons');
      setIsWelcomeSpeaking(false);
      setIsInitializing(false);
      welcomeMessageRef.current = null;
      if (setIsAvatarSessionActive) {
        setIsAvatarSessionActive(false);
      }
    } else if (!isAvatarTalkingRef.current && !isWelcomeSpeakingRef.current && !isInitializing) {
      console.log('[AudioChatWithAvatar] Avatar stopped talking, regular audio session complete');
      // Regular audio finished, ensure session is inactive
      if (setIsAvatarSessionActive) {
        setIsAvatarSessionActive(false);
      }
    }
  }, [isAvatarTalking, isWelcomeSpeaking, hasWelcomed, isInitializing, setIsAvatarSessionActive, context]);

  // Send welcome message when session starts - use ref to prevent multiple calls
  useEffect(() => {
    if (!context || !speakText) return;
    
    if (isStarted && !hasWelcomed && speakText && !welcomeMessageRef.current && isInitializing && !hasSentWelcomeRef.current && !isAvatarTalkingRef.current) {
      const sendWelcomeMessage = async () => {
        try {
          console.log("[AudioChatWithAvatar] Sending welcome message");
          
          // Set the welcome message reference before speaking
          welcomeMessageRef.current = WELCOME_MESSAGE;
          hasSentWelcomeRef.current = true;
          
          // Speak the welcome message with isWelcome flag to prevent replay
          await speakText(WELCOME_MESSAGE, true);
          
          // Mark as welcomed (but keep speaking state until audio finishes)
          setHasWelcomed(true);
          console.log("[AudioChatWithAvatar] Welcome message sent, waiting for audio to finish");
        } catch (error) {
          console.error("[AudioChatWithAvatar] Error sending welcome message:", error);
          setIsWelcomeSpeaking(false);
          setIsInitializing(false);
          welcomeMessageRef.current = null;
          hasSentWelcomeRef.current = false;
        }
      };

      // Wait a moment for the session to be ready
      setTimeout(sendWelcomeMessage, 1000);
    }
  }, [isStarted, hasWelcomed, isInitializing]);

  // Cleanup effect to stop audio when component unmounts or page closes
  useEffect(() => {
    let isPageClosing = false;
    
    const handleBeforeUnload = () => {
      console.log('[AudioChatWithAvatar] Page closing - stopping all audio');
      isPageClosing = true;
      // Stop any ongoing speech synthesis
      if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
      }
      // Force stop any Deepgram audio
      if (context?.stopSpeaking) {
        context.stopSpeaking(true);
      }
    };
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        console.log('[AudioChatWithAvatar] Page hidden - stopping all audio');
        isPageClosing = true;
        // Stop any ongoing speech synthesis
        if ('speechSynthesis' in window) {
          speechSynthesis.cancel();
        }
        // Force stop any Deepgram audio
        if (context?.stopSpeaking) {
          context.stopSpeaking(true);
        }
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      console.log('[AudioChatWithAvatar] Component unmounting - stopping all audio');
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      // Only force stop if page is actually closing
      if (isPageClosing) {
        console.log('[AudioChatWithAvatar] Page is closing - force stopping audio');
        // Stop any ongoing speech synthesis
        if ('speechSynthesis' in window) {
          speechSynthesis.cancel();
        }
        // Force stop any Deepgram audio
        if (context?.stopSpeaking) {
          context.stopSpeaking(true);
        }
      }
    };
  }, [context]);

  // Determine if buttons should be disabled
  const shouldDisableButtons = isInitializing || isWelcomeSpeaking || isAvatarTalking;

  return (
    <div className="w-full flex flex-row gap-4 h-full">
      {/* Left side - Avatar and Controls */}
      <div className="flex flex-col rounded-xl bg-white border border-gray-200 overflow-hidden flex-1">
        <div className="relative w-full aspect-video flex flex-col items-center justify-center bg-gray-50 ">
          {showStartButton ? (
            <div className="w-full h-full flex flex-col items-center justify-center p-8 text-gray-600">
              <div className="flex flex-col items-center space-y-4">
                <h2 className="text-2xl font-bold text-gray-800">AI Avatar Assistant</h2>
                <p className="text-gray-600 text-center max-w-md">
                  Click the button below to start your audio session with the AI assistant
                </p>
                <button
                  onClick={handleStartCall}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center space-x-2"
                >
                  <span>📞</span>
                  <span>Start Call</span>
                </button>
              </div>
            </div>
          ) : !isStarted ? (
            <div className="w-full h-full flex flex-col items-center justify-center p-8 text-gray-600">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <span className="text-lg">Starting AI Avatar Assistant...</span>
              </div>
            </div>
          ) : (
            <div className="w-full h-full relative">
              {/* VRM Avatar Display */}
              <VRMAvatar 
                modelUrl={selectedModel}
                width={800}
                height={600}
                onVisemeMirror={(viseme) => {
                  // Mirror viseme to Looking Glass
                  mirrorToLookingGlass('viseme', viseme);
                }}
              />
              
              {/* Looking Glass Control Button */}
              <div className="absolute top-4 right-4 flex flex-col gap-2">
                <button
                  onClick={handleEnableLookingGlass}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 shadow-lg ${
                    lookingGlassEnabled 
                      ? 'bg-green-600 hover:bg-green-700 text-white' 
                      : 'bg-purple-600 hover:bg-purple-700 text-white'
                  }`}
                  disabled={shouldDisableButtons}
                >
                  <div className="flex items-center space-x-2">
                    <span>{lookingGlassEnabled ? '🔮' : '🔮'}</span>
                    <span>
                      {lookingGlassEnabled ? 'Close Looking Glass' : 'Enable Looking Glass'}
                    </span>
                  </div>
                </button>
                
                {lookingGlassEnabled && (
                  <div className="bg-green-100 border border-green-400 text-green-700 px-3 py-1 rounded text-xs text-center">
                    ✅ Syncing to Looking Glass
                  </div>
                )}
              </div>
              
              {/* Avatar Model Selector */}
              {/* <div className="absolute top-4 right-4 bg-white bg-opacity-90 rounded-lg p-2">
                <select 
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="text-sm px-2 py-1 border border-gray-300 rounded"
                  disabled={shouldDisableButtons}
                >
                  {availableModels.map((model) => (
                    <option key={model.path} value={model.path}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </div> */}
              
              {/* Status Overlay */}
              {/* <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-4 py-2 rounded-lg">
                <h3 className="text-sm font-semibold mb-1">
                  {isRecording ? "Listening..." : 
                   isWelcomeSpeaking ? "Initializing..." : 
                   isAvatarTalking ? "AI Speaking..." : 
                   isProcessingResponse ? "Processing..." :
                   "Ready"}
                </h3>
                {showStartTalkingPrompt && !shouldDisableButtons && (
                  <p className="text-green-400 text-xs">Start talking...</p>
                )}
              </div> */}
            </div>
          )}
        </div>
        
        <div className="flex flex-col gap-3 items-center justify-center p-4 border-t border-gray-200 w-full bg-white">
          {isStarted ? (
            <div className="w-full">
              <AudioAvatarControls />
            </div>
          ) : null}
        </div>
      </div>
      
      {/* Right side - Chat History */}
      <div className={`w-80 flex flex-col h-full ${isStarted ? '!min-h-[85vh] !max-h-[85vh]' : ''}`}>
        {isStarted ? (
          <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden !overflow-y-auto">
            <AudioMessageHistory />
          </div>
        ) : (
          <div className="flex-1 bg-white rounded-lg border border-gray-200 flex items-center justify-center">
            <p className="text-gray-500 text-sm">Chat will appear here once connected</p>
          </div>
        )}
      </div>
    </div>
  );
}