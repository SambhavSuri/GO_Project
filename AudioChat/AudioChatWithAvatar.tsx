import React, { useState, useEffect, useRef } from "react";
import { useAudioVoiceChat } from "../logic/audio";
import { useAudioContext } from "../logic/AudioProvider";
import { useAudioSpeakingContext } from "../logic/useAudioSpeakingContext";
import { Loader2 } from "lucide-react";
import { AudioAvatarControls } from "./AudioAvatarControls";
import { AudioMessageHistory } from "./AudioMessageHistory";
import { VRMAvatar } from "../components/VRMAvatar/VRMAvatar";

// Welcome message from the personal tutor
//const WELCOME_MESSAGE = `P P P P P P P P P P P`;
const WELCOME_MESSAGE = `Hello! I'm Peter, your personal advocate, and I'm here to help you with your legal needs.`;

export function AudioChatWithAvatar() {
  const [isStarted, setIsStarted] = useState(false);
  const [hasWelcomed, setHasWelcomed] = useState(false);
  const [isWelcomeSpeaking, setIsWelcomeSpeaking] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [selectedModel, setSelectedModel] = useState('/static/assets/6891a06aece5d61d2d726697.glb');
  const [showStartButton, setShowStartButton] = useState(true);
  const [lookingGlassEnabled, setLookingGlassEnabled] = useState(false);
  const [isChatVisible, setIsChatVisible] = useState(true);
  const welcomeMessageRef = useRef<string | null>(null);
  const hasSentWelcomeRef = useRef(false);
  const lookingGlassWindowRef = useRef<Window | null>(null);
  
  // Use refs to track current state for the callback
  const isWelcomeSpeakingRef = useRef(false);
  const hasWelcomedRef = useRef(false);
  const isAvatarTalkingRef = useRef(false);
  const stopSpeakingRef = useRef<((force?: boolean) => void) | null>(null);
  
  // Get context values with proper initialization check
  const context = useAudioContext();
  const { isRecording, showStartTalkingPrompt } = useAudioVoiceChat();
  const { clearInterruption } = useAudioSpeakingContext();
  
  // Only destructure context values after ensuring context is available
  const isProcessingResponse = context?.isProcessingResponse ?? false;
  const isAvatarTalking = context?.isAvatarTalking ?? false;
  const speakText = context?.speakText;
  const setIsAvatarSessionActive = context?.setIsAvatarSessionActive;
  const onAudioChunkFinished = context?.onAudioChunkFinished;
  const onGLBAudioStart = context?.onGLBAudioStart;
  const onViseme = context?.onViseme;
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
      stopSpeakingRef.current = context.stopSpeaking;
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
    console.log('[AudioChatWithAvatar] Pre-start state:', {
      context: !!context,
      speakText: !!speakText,
      initializeAudioContext: !!initializeAudioContext
    });
    
    try {
      // Initialize audio context on user interaction
      if (initializeAudioContext) {
        console.log('[AudioChatWithAvatar] Initializing audio context...');
        await initializeAudioContext();
        console.log('[AudioChatWithAvatar] Audio context initialized successfully');
      } else {
        console.log('[AudioChatWithAvatar] No initializeAudioContext function available');
      }
      
      // Reset welcome message refs for clean state
      console.log('[AudioChatWithAvatar] Resetting welcome message state');
      welcomeMessageRef.current = null;
      hasSentWelcomeRef.current = false;
      isWelcomeSpeakingRef.current = false;
      hasWelcomedRef.current = false;
      
      // 🎯 FIX: Clear interruption state for new session
      console.log('[AudioChatWithAvatar] Clearing interruption state for new session');
      clearInterruption();
      
      // Reset state for new session
      console.log('[AudioChatWithAvatar] Setting session states');
      setHasWelcomed(false);
      setShowStartButton(false);
      
      // Start the session
      setIsInitializing(true);
      setIsWelcomeSpeaking(true);
      setIsStarted(true);
      
      console.log('[AudioChatWithAvatar] Session started successfully - states set:', {
        isInitializing: true,
        isWelcomeSpeaking: true,
        isStarted: true,
        hasWelcomed: false
      });
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
    console.log("[AudioChatWithAvatar] Welcome message useEffect triggered");
    console.log("[AudioChatWithAvatar] Conditions:", {
      context: !!context,
      speakText: !!speakText,
      isStarted,
      hasWelcomed,
      welcomeMessageRef: welcomeMessageRef.current,
      isInitializing,
      hasSentWelcomeRef: hasSentWelcomeRef.current,
      isAvatarTalkingRef: isAvatarTalkingRef.current,
      WELCOME_MESSAGE: WELCOME_MESSAGE
    });
    
    if (!context || !speakText) {
      console.log("[AudioChatWithAvatar] Missing context or speakText");
      return;
    }
    
    // Note: Page visibility is handled by Deepgram connection management
    // Welcome message should only play once per session, not be affected by tab switches
    
    if (isStarted && !hasWelcomed && speakText && !welcomeMessageRef.current && isInitializing && !hasSentWelcomeRef.current && !isAvatarTalkingRef.current) {
      console.log("[AudioChatWithAvatar] All conditions met - scheduling welcome message");
      
      const sendWelcomeMessage = async () => {
        try {
          console.log("[AudioChatWithAvatar] Sending welcome message:", WELCOME_MESSAGE);
          
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
    } else {
      console.log("[AudioChatWithAvatar] Welcome message conditions not met");
    }
  }, [isStarted, hasWelcomed, isInitializing, context, speakText]);

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
      if (stopSpeakingRef.current) {
        stopSpeakingRef.current(true);
      }
    };
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        console.log('[AudioChatWithAvatar] 🔄 TAB SWITCH: Page hidden - pausing audio (not stopping)');
        // 🎯 FIX: Don't stop TTS completely on tab switch - just pause to allow resume
        // The Azure TTS buffer manager will handle pause/resume internally
        // Don't set isPageClosing = true for tab switches
        
        // Note: Deepgram connection management is handled in useAudioVoiceChat
        // We don't need to interrupt audio here for tab switches
      } else if (document.visibilityState === 'visible') {
        console.log('[AudioChatWithAvatar] 🔄 TAB SWITCH: Page visible - resuming audio context if needed');
        // Audio will resume automatically through the buffer manager
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
  }, []); // FIXED: Removed context dependency to prevent constant remounts

  // Determine if buttons should be disabled
  const shouldDisableButtons = isInitializing || isWelcomeSpeaking || isAvatarTalking;

  return (
    <div className="h-full flex flex-col lg:flex-row gap-2 p-2">
      {/* Desktop Layout */}
      <div className="hidden lg:flex w-full gap-4 h-full">
        {/* Model Viewer - 70% width */}
        <div className="w-[70%] flex flex-col bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="relative flex-1 bg-gradient-to-br from-gray-50 to-gray-100">
            {showStartButton ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-8">
                <div className="flex flex-col items-center space-y-6 max-w-md text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-3xl shadow-lg">
                    🤖
                  </div>
                  <h2 className="text-3xl font-bold text-gray-800">AI Avatar Assistant</h2>
                  <p className="text-gray-600 leading-relaxed">
                    Experience next-generation AI interaction with our photorealistic avatar. 
                    Click the button below to begin your conversation.
                  </p>
                  <button
                    onClick={handleStartCall}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-200 flex items-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <span>📞</span>
                    <span>Start Session</span>
                  </button>
                </div>
              </div>
            ) : !isStarted ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-8">
                <div className="flex items-center space-x-3">
                  <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                  <span className="text-xl text-gray-700">Initializing Avatar...</span>
                </div>
              </div>
            ) : (
              <div className="w-full h-full relative">
                {/* VRM Avatar Display */}
                <VRMAvatar 
                  modelUrl={selectedModel}
                  width={1200}
                  height={800}
                  onVisemeMirror={(viseme) => {
                    mirrorToLookingGlass('viseme', viseme);
                  }}
                />
                
                {/* Enhanced Control Panel */}
                <div className="absolute top-6 right-6 flex flex-col gap-3">
                  <button
                    onClick={handleEnableLookingGlass}
                    className={`px-5 py-3 rounded-xl font-medium text-sm transition-all duration-300 shadow-lg backdrop-blur-sm ${
                      lookingGlassEnabled 
                        ? 'bg-green-500 hover:bg-green-600 text-white shadow-green-500/30' 
                        : 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/30'
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
                    <div className="bg-green-100 border border-green-300 text-green-800 px-4 py-2 rounded-lg text-sm font-medium backdrop-blur-sm">
                      ✅ Syncing Active
                    </div>
                  )}
                </div>
                
                {/* Status Indicator */}
                <div className="absolute bottom-6 left-6 bg-black/70 backdrop-blur-md text-white px-5 py-3 rounded-xl text-sm font-medium">
                  {isRecording ? "🎤 Listening..." : 
                   isWelcomeSpeaking ? "🤖 Initializing..." : 
                   isAvatarTalking ? "💬 AI Speaking..." : 
                   isProcessingResponse ? "🧠 Processing..." :
                   "✅ Ready to chat"}
                  {showStartTalkingPrompt && !shouldDisableButtons && (
                    <div className="text-green-400 text-xs mt-1">Start talking...</div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Enhanced Controls Panel */}
          {isStarted && (
            <div className="bg-white border-t border-gray-200 p-6">
              <AudioAvatarControls />
            </div>
          )}
        </div>
        
        {/* Chat Panel - 30% width */}
        <div className="w-[30%] flex flex-col bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          {/* Chat Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                💬
              </div>
              <h3 className="font-semibold text-lg">Assistant</h3>
            </div>
            <div className="text-white/80 text-sm">
              {isStarted && (
                <span className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span>Active</span>
                </span>
              )}
            </div>
          </div>
          
          {/* Chat Content */}
          <div className="flex-1 overflow-hidden">
            {isStarted ? (
              <AudioMessageHistory />
            ) : (
              <div className="h-full flex items-center justify-center p-8">
                <div className="text-center text-gray-500">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    💭
                  </div>
                  <p className="font-medium">Ready to Chat</p>
                  <p className="text-sm mt-2">Start a session to begin your conversation</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden flex flex-col h-full">
        {/* Mobile Model Viewer */}
        <div className="flex-1 bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-4">
          <div className="relative w-full h-full bg-gradient-to-br from-gray-50 to-gray-100">
            {showStartButton ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-6">
                <div className="flex flex-col items-center space-y-4 text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl shadow-lg">
                    🤖
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800">AI Avatar</h2>
                  <p className="text-gray-600 text-sm">
                    Start your AI conversation
                  </p>
                  <button
                    onClick={handleStartCall}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 flex items-center space-x-2 shadow-lg"
                  >
                    <span>📞</span>
                    <span>Start Session</span>
                  </button>
                </div>
              </div>
            ) : !isStarted ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-6">
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  <span className="text-lg text-gray-700">Starting...</span>
                </div>
              </div>
            ) : (
              <div className="w-full h-full relative">
                <VRMAvatar 
                  modelUrl={selectedModel}
                  width={800}
                  height={600}
                  onVisemeMirror={(viseme) => {
                    mirrorToLookingGlass('viseme', viseme);
                  }}
                />
                
                {/* Mobile Controls */}
                <div className="absolute top-4 right-4 flex flex-col gap-2">
                  <button
                    onClick={handleEnableLookingGlass}
                    className={`px-3 py-2 rounded-lg font-medium text-xs transition-all duration-300 shadow-lg backdrop-blur-sm ${
                      lookingGlassEnabled 
                        ? 'bg-green-500 hover:bg-green-600 text-white' 
                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                    }`}
                    disabled={shouldDisableButtons}
                  >
                    🔮
                  </button>
                  
                  <button
                    onClick={() => setIsChatVisible(!isChatVisible)}
                    className="px-3 py-2 rounded-lg font-medium text-xs transition-all duration-300 shadow-lg backdrop-blur-sm bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    💬
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Mobile Controls */}
          {isStarted && (
            <div className="bg-white border-t border-gray-200 p-4">
              <AudioAvatarControls />
            </div>
          )}
        </div>

        {/* Mobile Chat Panel (Collapsible) */}
        {isChatVisible && (
          <div className="h-80 bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
            {/* Mobile Chat Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-sm">
                  💬
                </div>
                <h3 className="font-medium">Assistant</h3>
              </div>
              <button
                onClick={() => setIsChatVisible(false)}
                className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                ×
              </button>
            </div>
            
            {/* Mobile Chat Content */}
            <div className="h-[calc(100%-3rem)] overflow-hidden">
              {isStarted ? (
                <AudioMessageHistory />
              ) : (
                <div className="h-full flex items-center justify-center p-4">
                  <div className="text-center text-gray-500">
                    <p className="text-sm">Chat will appear once session starts</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mobile Chat Toggle Button (when collapsed) */}
        {!isChatVisible && isStarted && (
          <button
            onClick={() => setIsChatVisible(true)}
            className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center text-xl z-50"
          >
            💬
          </button>
        )}
      </div>
    </div>
  );
}