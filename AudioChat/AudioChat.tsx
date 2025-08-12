import React, { useState, useEffect, useRef } from "react";
import { useAudioVoiceChat } from "../logic/audio";
import { useAudioContext } from "../logic/AudioProvider";
import { Loader2 } from "lucide-react";
import { AudioAvatarControls } from "./AudioAvatarControls";
import { AudioMessageHistory } from "./AudioMessageHistory";

// Welcome message from the personal tutor
const WELCOME_MESSAGE = `Hello! I'm your personal Advocate and Assistant, and I'm excited to help you today. `;

export function AudioChat() {
  const [isStarted, setIsStarted] = useState(false);
  const [hasWelcomed, setHasWelcomed] = useState(false);
  const [isWelcomeSpeaking, setIsWelcomeSpeaking] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [showStartButton, setShowStartButton] = useState(true);
  const welcomeMessageRef = useRef<string | null>(null);
  const hasSentWelcomeRef = useRef(false);
  
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

  // Handle start call button click
  const handleStartCall = async () => {
    console.log('[AudioChat] Start Call button clicked - initializing with user interaction');
    
    try {
      // Initialize audio context on user interaction
      if (initializeAudioContext) {
        console.log('[AudioChat] Initializing audio context...');
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
      
      console.log('[AudioChat] Session started successfully');
    } catch (error) {
      console.error('[AudioChat] Error starting session:', error);
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
      console.log('[AudioChat] Audio chunk finished, duration:', duration);
      console.log('[AudioChat] Current state - isWelcomeSpeaking:', isWelcomeSpeakingRef.current, 'isAvatarTalking:', isAvatarTalkingRef.current, 'hasWelcomed:', hasWelcomedRef.current);
      
      // Enable buttons when welcome message audio chunks finish
      if (isWelcomeSpeakingRef.current && hasWelcomedRef.current) {
        console.log('[AudioChat] Welcome message complete - enabling all buttons');
        setIsWelcomeSpeaking(false);
        setIsInitializing(false);
        welcomeMessageRef.current = null;
        // Reset avatar session active state to hide stop button
        if (setIsAvatarSessionActive) {
          setIsAvatarSessionActive(false);
        }
      }
    };

    console.log('[AudioChat] Setting up audio chunk finished callback');
    
    // Set up the callback in the audio context
      onAudioChunkFinished(handleAudioChunkFinished);

    return () => {
      // Clean up callback when component unmounts
        onAudioChunkFinished(() => {});
    };
  }, [onAudioChunkFinished, setIsAvatarSessionActive]); // Remove refs from dependencies

  // Enable buttons when avatar stops talking (main mechanism)
  useEffect(() => {
    if (!context) return;
    
    if (!isAvatarTalkingRef.current && isWelcomeSpeakingRef.current && hasWelcomedRef.current) {
      console.log('[AudioChat] Avatar stopped talking after welcome message - enabling all buttons');
      setIsWelcomeSpeaking(false);
      setIsInitializing(false);
      welcomeMessageRef.current = null;
      if (setIsAvatarSessionActive) {
        setIsAvatarSessionActive(false);
      }
    } else if (!isAvatarTalkingRef.current && !isWelcomeSpeakingRef.current && !isInitializing) {
      console.log('[AudioChat] Avatar stopped talking, regular audio session complete');
      // Regular audio finished, ensure session is inactive
      if (setIsAvatarSessionActive) {
        setIsAvatarSessionActive(false);
      }
    }
  }, [isAvatarTalking, isWelcomeSpeaking, hasWelcomed, isInitializing, setIsAvatarSessionActive, context]); // Use actual state for dependencies

  // Send welcome message when session starts - use ref to prevent multiple calls
  useEffect(() => {
    if (!context || !speakText) return;
    
    console.log('[AudioChat] Welcome message effect - isStarted:', isStarted, 'hasWelcomed:', hasWelcomed, 'speakText exists:', !!speakText, 'welcomeMessageRef:', welcomeMessageRef.current, 'isInitializing:', isInitializing, 'hasSentWelcomeRef:', hasSentWelcomeRef.current);
    
    // Only send welcome message if:
    // 1. Session is started
    // 2. Haven't welcomed yet
    // 3. speakText function exists
    // 4. No welcome message ref set
    // 5. Currently initializing
    // 6. Haven't already sent welcome message
    // 7. Not already speaking
    if (isStarted && !hasWelcomed && speakText && !welcomeMessageRef.current && isInitializing && !hasSentWelcomeRef.current && !isAvatarTalkingRef.current) {
      const sendWelcomeMessage = async () => {
        try {
          console.log("[AudioChat] Sending welcome message");
          
          // Set the welcome message reference before speaking
          welcomeMessageRef.current = WELCOME_MESSAGE;
          hasSentWelcomeRef.current = true;
          console.log("[AudioChat] Welcome message ref set to:", WELCOME_MESSAGE);
          
          // Speak the welcome message with isWelcome flag to prevent replay
          await speakText(WELCOME_MESSAGE, true);
          
          // Mark as welcomed (but keep speaking state until audio finishes)
          setHasWelcomed(true);
          console.log("[AudioChat] Welcome message sent, waiting for audio to finish");
        } catch (error) {
          console.error("[AudioChat] Error sending welcome message:", error);
          setIsWelcomeSpeaking(false);
          setIsInitializing(false);
          welcomeMessageRef.current = null;
          hasSentWelcomeRef.current = false;
        }
      };

      // Wait a moment for the session to be ready
      setTimeout(sendWelcomeMessage, 1000);
    } else {
      console.log('[AudioChat] Welcome message effect conditions not met - skipping');
      console.log('[AudioChat] Conditions check: isStarted=', isStarted, '!hasWelcomed=', !hasWelcomed, 'speakText exists=', !!speakText, '!welcomeMessageRef.current=', !welcomeMessageRef.current, 'isInitializing=', isInitializing, '!hasSentWelcomeRef.current=', !hasSentWelcomeRef.current, '!isAvatarTalking=', !isAvatarTalkingRef.current);
    }
  }, [isStarted, hasWelcomed, isInitializing]); // Remove speakText and context from dependencies to prevent re-runs

  // Cleanup effect to stop audio when component unmounts or page closes
  useEffect(() => {
    let isPageClosing = false;
    
    const handleBeforeUnload = () => {
      console.log('[AudioChat] Page closing - stopping all audio');
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
        console.log('[AudioChat] Page hidden - stopping all audio');
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
      console.log('[AudioChat] Component unmounting - stopping all audio');
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      // Only force stop if page is actually closing
      if (isPageClosing) {
        console.log('[AudioChat] Page is closing - force stopping audio');
        // Stop any ongoing speech synthesis
        if ('speechSynthesis' in window) {
          speechSynthesis.cancel();
        }
        // Force stop any Deepgram audio
        if (context?.stopSpeaking) {
          context.stopSpeaking(true);
        }
      } else {
        console.log('[AudioChat] Normal component unmount - not force stopping audio');
        // Don't force stop during normal unmount to allow welcome message to work
      }
    };
  }, [context]);

  // Determine if buttons should be disabled
  // Buttons are disabled during initialization, welcome speaking, or regular avatar talking
  const shouldDisableButtons = isInitializing || isWelcomeSpeaking || isAvatarTalking;

  return (
    <div className="w-full flex flex-row gap-4 h-full max-h-[70vh]">
      {/* Left side - Avatar and Controls */}
      <div className="flex flex-col rounded-xl bg-white border border-gray-200 overflow-hidden flex-1 max-h-[70vh]">
        <div className="relative w-full aspect-video overflow-hidden flex flex-col items-center justify-center bg-gray-50">
          {showStartButton ? (
            <div className="w-full h-full flex flex-col items-center justify-center p-8 text-gray-600">
              <div className="flex flex-col items-center space-y-4">
                <h2 className="text-2xl font-bold text-gray-800">AI Audio Assistant</h2>
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
                <span className="text-lg">Starting AI Audio Assistant...</span>
              </div>
            </div>
          ) : (
            <div className="text-gray-600 text-center p-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                {isRecording ? (
                  <div className="w-8 h-8 bg-red-500 rounded-full animate-pulse"></div>
                ) : isAvatarTalking || isWelcomeSpeaking ? (
                  <div className="w-8 h-8 bg-blue-500 rounded-full animate-pulse"></div>
                ) : (
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                )}
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                {isRecording ? "Listening..." : 
                 isWelcomeSpeaking ? "Initializing..." : 
                 isAvatarTalking ? "AI Speaking..." : 
                 "Audio Chat Active"}
              </h3>
              {showStartTalkingPrompt && !shouldDisableButtons && (
                <p className="text-green-600 font-medium">Start talking...</p>
              )}
              {isProcessingResponse && (
                <p className="text-blue-600 font-medium">Processing response...</p>
              )}
              {isInitializing && !isWelcomeSpeaking && (
                <p className="text-yellow-600 font-medium">Setting up session...</p>
              )}
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
      <div className="w-80 flex flex-col h-full max-h-[70vh]">
        {isStarted ? (
          <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden overflow-y-auto">
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