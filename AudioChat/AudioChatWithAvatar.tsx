import React, { useState, useEffect, useRef } from "react";
import { useAudioVoiceChat } from "../logic/audio";
import { useAudioContext } from "../logic/AudioProvider";
import { Loader2, MessageSquare, X } from "lucide-react";
import { AudioAvatarControls } from "./AudioAvatarControls";
import { AudioMessageHistory } from "./AudioMessageHistory";
import { VRMAvatar } from "../components/VRMAvatar/VRMAvatar";

// Welcome message from the personal tutor
//const WELCOME_MESSAGE = `P P P P P P P P P P P`;
const WELCOME_MESSAGE = `hello, Im Peter your personal advocate, I'm here to help you with your legal needs`;

export function AudioChatWithAvatar() {
  const [isStarted, setIsStarted] = useState(false);
  const [hasWelcomed, setHasWelcomed] = useState(false);
  const [isWelcomeSpeaking, setIsWelcomeSpeaking] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [selectedModel, setSelectedModel] = useState('/static/assets/6891a06aece5d61d2d726697.glb');
  const [showStartButton, setShowStartButton] = useState(true);
  const [lookingGlassEnabled, setLookingGlassEnabled] = useState(false);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
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
    

    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      console.log('[AudioChatWithAvatar] Component unmounting - stopping all audio');
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
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
    <div className="h-full flex flex-col lg:flex-row gap-6 relative">
      {/* Main Content Area - 3D Model Viewer */}
      <div className="flex-1 lg:w-3/4 flex flex-col">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden h-full flex flex-col">
          {/* Model Viewer Header */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">3D Avatar Viewer</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {isRecording ? "🎤 Listening..." : 
                   isWelcomeSpeaking ? "🚀 Initializing..." : 
                   isAvatarTalking ? "🗣️ AI Speaking..." : 
                   isProcessingResponse ? "⚙️ Processing..." :
                   isStarted ? "✅ Ready" : "⏸️ Offline"}
                </p>
              </div>
              
              {/* Mobile Chat Toggle Button */}
              <div className="lg:hidden">
                <button
                  onClick={() => setIsChatExpanded(!isChatExpanded)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 shadow-sm"
                >
                  {isChatExpanded ? <X size={20} /> : <MessageSquare size={20} />}
                  <span className="text-sm font-medium">
                    {isChatExpanded ? 'Close Chat' : 'Open Chat'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* 3D Model Display Area */}
          <div className="flex-1 relative bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
            {showStartButton ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 text-gray-600">
                <div className="flex flex-col items-center space-y-6 max-w-md">
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-3xl">🤖</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 text-center">AI Avatar Assistant</h3>
                  <p className="text-gray-600 text-center text-lg leading-relaxed">
                    Start your interactive session with our AI-powered avatar. Experience natural conversation with voice and chat capabilities.
                  </p>
                  <button
                    onClick={handleStartCall}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-200 flex items-center space-x-3 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    <span className="text-xl">📞</span>
                    <span className="text-lg">Start Session</span>
                  </button>
                </div>
              </div>
            ) : !isStarted ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 text-gray-600">
                <div className="flex items-center space-x-3">
                  <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                  <span className="text-xl font-medium">Initializing Avatar...</span>
                </div>
                <p className="text-gray-500 mt-4 text-center">Setting up your AI assistant experience</p>
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
                <div className="absolute top-6 right-6 flex flex-col gap-3">
                  <button
                    onClick={handleEnableLookingGlass}
                    className={`px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-200 shadow-lg backdrop-blur-sm ${
                      lookingGlassEnabled 
                        ? 'bg-green-600/90 hover:bg-green-700/90 text-white border border-green-500' 
                        : 'bg-purple-600/90 hover:bg-purple-700/90 text-white border border-purple-500'
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
                    <div className="bg-green-100/90 backdrop-blur-sm border border-green-400 text-green-700 px-3 py-2 rounded-lg text-xs text-center font-medium">
                      ✅ Syncing to Looking Glass
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Controls Area */}
          <div className="bg-white border-t border-gray-200 px-6 py-4">
            {isStarted && (
              <div className="flex justify-center">
                <AudioAvatarControls />
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Chat Panel - Desktop: Side Panel, Mobile: Expandable Overlay */}
      <div className={`
        lg:w-1/4 lg:min-w-[320px] lg:max-w-[400px] 
        ${isChatExpanded ? 'block' : 'hidden lg:block'}
        ${isChatExpanded ? 'fixed inset-x-4 top-20 bottom-4 z-50 lg:relative lg:inset-auto lg:top-auto lg:bottom-auto lg:z-auto' : ''}
      `}>
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden h-full flex flex-col">
          {/* Chat Header */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Assistant</h3>
                <p className="text-sm text-gray-600">Chat History</p>
              </div>
              {/* Mobile close button */}
              <div className="lg:hidden">
                <button
                  onClick={() => setIsChatExpanded(false)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Chat Content */}
          <div className="flex-1 min-h-0">
            {isStarted ? (
              <AudioMessageHistory />
            ) : (
              <div className="h-full flex items-center justify-center p-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageSquare size={24} className="text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-sm">Chat will appear here once you start a session</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Chat Overlay Background */}
      {isChatExpanded && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsChatExpanded(false)}
        />
      )}
    </div>
  );
}