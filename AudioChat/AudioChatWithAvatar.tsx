import React, { useState, useEffect, useRef } from "react";
import { useAudioVoiceChat } from "../logic/audio";
import { useAudioContext } from "../logic/AudioProvider";
import { useVoice } from "../logic/VoiceContext";
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
  const { setIsSessionActive } = useVoice();
  
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
          <div className="flex-1 relative bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
            {showStartButton ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-8">
                <div className="max-w-lg mx-auto text-center">
                  {/* Professional Avatar Icon */}
                  <div className="relative mb-8">
                    <div className="w-32 h-32 mx-auto bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 rounded-3xl shadow-2xl flex items-center justify-center relative overflow-hidden group">
                      {/* Animated background pattern */}
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 via-transparent to-indigo-600/20 animate-pulse"></div>
                      
                      {/* Modern AI icon */}
                      <div className="relative z-10">
                        <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                        </svg>
                      </div>
                      
                      {/* Glowing border effect */}
                      <div className="absolute -inset-0.5 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-3xl opacity-75 group-hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
                    </div>
                    
                    {/* Floating particles effect */}
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-4">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                      </div>
                    </div>
                  </div>

                  {/* Professional Title */}
                  <div className="mb-6">
                    <h3 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent mb-3">
                      AI Legal Advocate
                    </h3>
                    <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full mx-auto"></div>
                  </div>

                  {/* Enhanced Description */}
                  <div className="mb-8 space-y-3">
                    <p className="text-lg text-gray-700 leading-relaxed font-medium">
                      Meet Peter, your personal AI legal advocate powered by advanced voice synthesis and 3D avatar technology.
                    </p>
                    <div className="flex items-center justify-center space-x-6 text-sm text-gray-600">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span>Real-time Voice</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <span>3D Avatar</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                        <span>Legal Expertise</span>
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Start Button */}
                  <div className="relative">
                    <button
                      onClick={handleStartCall}
                      className="group relative bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 hover:from-blue-700 hover:via-blue-800 hover:to-indigo-800 text-white font-bold py-5 px-10 rounded-2xl transition-all duration-300 flex items-center space-x-4 shadow-2xl hover:shadow-3xl transform hover:-translate-y-1 hover:scale-105 mx-auto overflow-hidden"
                    >
                      {/* Button background animation */}
                      <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                      
                      {/* Button content */}
                      <div className="relative z-10 flex items-center space-x-4">
                        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <span className="text-xl font-bold tracking-wide">Start Session</span>
                      </div>
                      
                      {/* Glowing border */}
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-400 to-indigo-600 rounded-2xl opacity-75 group-hover:opacity-100 transition-opacity duration-300 blur-sm -z-10"></div>
                    </button>

                    {/* Subtitle below button */}
                    <p className="text-sm text-gray-500 mt-4 font-medium">
                      Click to begin your conversation
                    </p>
                  </div>
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
                  width={856}
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