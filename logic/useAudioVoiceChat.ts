import { useState, useRef, useCallback, useEffect } from "react";
import { useAudioContext } from "./AudioProvider";
import { useAudioRagIntegration } from "./useAudioRagIntegration";

// Custom voice chat for audio mode that reuses existing logic
export const useAudioVoiceChat = () => {
  const { setIsMuted, setIsVoiceChatActive, addUserMessage, isAvatarSessionActive, isVoiceChatActive, isMuted } = useAudioContext();
  const { fetchRagResponse } = useAudioRagIntegration();
  const deepgramRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const connectionRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const keepAliveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [, setCurrentTranscript] = useState("");
  const [hasProcessedFinalTranscript, setHasProcessedFinalTranscript] = useState(false);
  const silenceThresholdRef = useRef<number>(2000);
  const hasContentRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);
  const finalTranscriptRef = useRef<string>("");
  const audioStreamRef = useRef<MediaStream | null>(null);
  const [showStartTalkingPrompt, setShowStartTalkingPrompt] = useState(false);
  
  // Add refs to track state like video bot
  const isAvatarSessionActiveRef = useRef<boolean>(false);
  const hasFinalTranscriptRef = useRef<boolean>(false);

  // Track when stop button is pressed (same logic as video bot)
  useEffect(() => {
    // Update the ref to track stop button state
    isAvatarSessionActiveRef.current = isAvatarSessionActive;
    
    // If isAvatarSessionActive changes from true to false, it might be due to stop button being pressed
    if (!isAvatarSessionActive) {
      // Reset the final transcript flag when stop button disappears
      hasFinalTranscriptRef.current = false;
      setHasProcessedFinalTranscript(false);
    }
  }, [isAvatarSessionActive]);

  // Reset final transcript flag when processing completes (ready for next conversation)
  useEffect(() => {
    // When isProcessingRef becomes false, it means we've finished processing a transcript
    // This is a good time to reset the final transcript flag for the next conversation
    if (!isProcessingRef.current && hasFinalTranscriptRef.current) {
      console.log('[AudioVoiceChat] Processing completed - resetting final transcript flag for next conversation');
      hasFinalTranscriptRef.current = false;
    }
  }, [isProcessingRef.current]);

  const cleanup = useCallback(() => {
    console.log('[AudioVoiceChat] Cleaning up connection and resources...');
    
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    
    if (keepAliveTimerRef.current) {
      clearInterval(keepAliveTimerRef.current);
      keepAliveTimerRef.current = null;
    }
    
    if (connectionRef.current) {
      console.log('[AudioVoiceChat] Closing connection...');
      try {
        connectionRef.current.finish();
      } catch (error) {
        console.log('[AudioVoiceChat] Error finishing connection:', error);
        try {
          connectionRef.current.close();
        } catch (closeError) {
          console.log('[AudioVoiceChat] Error closing connection:', closeError);
        }
      }
      connectionRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    
    setIsRecording(false);
    setCurrentTranscript("");
    setHasProcessedFinalTranscript(false);
    hasContentRef.current = false;
    isProcessingRef.current = false;
    finalTranscriptRef.current = "";
    setShowStartTalkingPrompt(false);
    hasFinalTranscriptRef.current = false; // Reset for next conversation
    console.log('[AudioVoiceChat] Cleanup completed');
  }, []);

  const handleSilence = useCallback(async () => {
    if (!hasContentRef.current || isProcessingRef.current || isAvatarSessionActiveRef.current) {
      return;
    }

    if (!finalTranscriptRef.current.trim()) {
      return;
    }

    console.log('[AudioVoiceChat] Processing transcript:', finalTranscriptRef.current);
    
    // SET BLOCKING FLAG IMMEDIATELY when we start processing
    hasFinalTranscriptRef.current = true;
    setHasProcessedFinalTranscript(true);
    console.log('[AudioVoiceChat] BLOCKING ALL TRANSCRIPTS IMMEDIATELY - starting to process final message');
    
    try {
      isProcessingRef.current = true;
      
      const transcriptToProcess = finalTranscriptRef.current;
      finalTranscriptRef.current = "";
      hasContentRef.current = false;
      
      addUserMessage(transcriptToProcess);
      await fetchRagResponse(transcriptToProcess);
      
      console.log('[AudioVoiceChat] Complete transcript processed successfully, blocking subsequent transcripts');
      
    } catch (error) {
      console.error('Error in audio RAG integration:', error);
    } finally {
      isProcessingRef.current = false;
    }
  }, [fetchRagResponse, addUserMessage]);

  const setupDeepgram = useCallback(() => {
    console.log('[AudioVoiceChat] Setting up Deepgram connection...');
    if (connectionRef.current) {
      console.log('[AudioVoiceChat] Connection already exists, skipping setup');
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
    if (!apiKey) {
      console.error('[AudioVoiceChat] Deepgram API key not found');
      return;
    }

    try {
      import("@deepgram/sdk").then(({ createClient, LiveTranscriptionEvents }) => {
        console.log('[AudioVoiceChat] Creating Deepgram client...');
        deepgramRef.current = createClient(apiKey);
        
        console.log('[AudioVoiceChat] Creating live transcription connection...');
        connectionRef.current = deepgramRef.current.listen.live({
          model: "nova-3",
          language: "en-US",
          smart_format: true,
          punctuate: true,
          interim_results: true,
          encoding: 'linear16',
          sample_rate: 16000,
          channels: 1
        });

        connectionRef.current.on(LiveTranscriptionEvents.Open, () => {
          console.log('[AudioVoiceChat] Deepgram connection established successfully');
          setShowStartTalkingPrompt(true);
          keepAliveTimerRef.current = setInterval(() => {
            if (connectionRef.current) {
              try {
                console.log('[AudioVoiceChat] Sending keep-alive ping...');
                connectionRef.current.keepAlive();
              } catch (error) {
                console.error('[AudioVoiceChat] Error sending keep-alive ping:', error);
                // If keep-alive fails, the connection might be broken
                if (connectionRef.current) {
                  console.log('[AudioVoiceChat] Keep-alive failed, closing connection');
                  connectionRef.current.finish();
                }
              }
            }
          }, 3000);
        });

        connectionRef.current.on(LiveTranscriptionEvents.Close, (event: { code?: number; reason?: string; wasClean?: boolean }) => {
          console.log('[Deepgram] Streaming connection CLOSED');
          console.log('[AudioVoiceChat] Deepgram connection closed', event);
          console.log('[AudioVoiceChat] Close event details:', {
            code: event?.code,
            reason: event?.reason,
            wasClean: event?.wasClean
          });
          
          if (keepAliveTimerRef.current) {
            clearInterval(keepAliveTimerRef.current);
            keepAliveTimerRef.current = null;
          }
          
          // Only attempt to reconnect if voice chat is still active and not muted
          if (isVoiceChatActive && !isMuted) {
            console.log('[AudioVoiceChat] Connection closed but voice chat still active, will attempt reconnect...');
            // Small delay before attempting reconnect
            setTimeout(() => {
              if (isVoiceChatActive && !isMuted && !connectionRef.current) {
                console.log('[AudioVoiceChat] Attempting to reconnect...');
                setupDeepgram();
              }
            }, 1000);
          }
        });

        connectionRef.current.on(LiveTranscriptionEvents.Transcript, (data: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          const transcript = data.channel?.alternatives?.[0]?.transcript || "";
          const isFinal = data.is_final;
          
          if (transcript.trim()) {
            setShowStartTalkingPrompt(false);
          }
          
          // BLOCK ALL TRANSCRIPTS after final message is processed until audio stops
          if (hasFinalTranscriptRef.current) {
            console.log('[AudioVoiceChat] BLOCKING ALL TRANSCRIPTS - final message already processed, waiting for audio to stop');
            return;
          }
          
          if (isFinal && transcript.trim()) {
            // Combine final transcripts into a complete sentence
            finalTranscriptRef.current += (finalTranscriptRef.current ? ' ' : '') + transcript;
            hasContentRef.current = true;
            setCurrentTranscript("");
            
            console.log('[AudioVoiceChat] Combined final transcript so far:', finalTranscriptRef.current);
            
            // Reset silence timer for each final transcript
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
            }
            silenceTimerRef.current = setTimeout(handleSilence, silenceThresholdRef.current);
          } else if (transcript.trim()) {
            // Only show interim transcripts if we haven't processed a final transcript yet
            if (!hasFinalTranscriptRef.current) {
              setCurrentTranscript(transcript);
            }
          }
        });

        connectionRef.current.on(LiveTranscriptionEvents.Error, (error: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          console.error('[AudioVoiceChat] Deepgram error:', error);
          console.error('[AudioVoiceChat] Error details:', {
            message: error?.message,
            code: error?.code,
            name: error?.name
          });
          
          // Handle specific error types
          if (error?.message?.includes('rate limit')) {
            console.log('[AudioVoiceChat] Rate limit detected, will retry after delay');
          } else if (error?.code === 'NETWORK_ERROR') {
            console.log('[AudioVoiceChat] Network error detected');
          }
        });

        connectionRef.current.on(LiveTranscriptionEvents.Metadata, (data: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          console.log('[AudioVoiceChat] Deepgram metadata:', data);
        });
      });
    } catch (error) {
      console.error('[AudioVoiceChat] Error setting up Deepgram:', error);
      cleanup();
    }
  }, [fetchRagResponse, cleanup, handleSilence, isVoiceChatActive, isMuted]);

  const startVoiceChat = useCallback(async () => {
    console.log('[AudioVoiceChat] Starting voice chat...');
    cleanup();
    
    try {
      // Set voice chat as active first
      setIsVoiceChatActive(true);
      setIsRecording(true);
      // Start voice chat in muted state - user must manually unmute
      setIsMuted(true);
      
      // Start persistent ping timer to keep voice chat active (like useVoiceChat)
      keepAliveTimerRef.current = setInterval(() => {
        if (isVoiceChatActive && !isMuted && !connectionRef.current) {
          console.log('[AudioVoiceChat] Persistent ping - setting up Deepgram connection');
          setupDeepgram();
        }
      }, 10000); // Check every 10 seconds
      
      // Don't immediately call setupDeepgram - let the persistent ping timer handle it
      // This prevents immediate connection closure issues
      
    } catch (error) {
      console.error('[AudioVoiceChat] Error starting voice chat:', error);
      cleanup();
      setIsVoiceChatActive(false);
    }
  }, [cleanup, setupDeepgram, setIsVoiceChatActive, setIsMuted, isVoiceChatActive, isMuted]);

  const stopVoiceChat = useCallback(() => {
    console.log('[AudioVoiceChat] Stopping voice chat...');
    cleanup();
    setIsVoiceChatActive(false);
    setIsMuted(true);
    setIsRecording(false);
  }, [cleanup, setIsMuted, setIsVoiceChatActive]);

  const muteInputAudio = useCallback(() => {
    console.log('[AudioVoiceChat] Muting input audio...');
    setIsMuted(true);
    cleanup();
  }, [setIsMuted, cleanup]);

  const unmuteInputAudio = useCallback(async () => {
    console.log('[AudioVoiceChat] Unmuting input audio...');
    setIsMuted(false);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      await audioContextRef.current.audioWorklet.addModule(
        URL.createObjectURL(new Blob([`
          class AudioProcessor extends AudioWorkletProcessor {
            constructor() {
              super();
            }
            process(inputs, outputs, parameters) {
              const input = inputs[0];
              if (input && input[0] && input[0].length > 0) {
                const hasAudio = input[0].some(sample => sample !== 0);
                if (hasAudio) {
                  this.port.postMessage({
                    type: 'audio',
                    data: Array.from(input[0]),
                    timestamp: Date.now()
                  });
                }
              }
              return true;
            }
          }
          registerProcessor('audio-processor', AudioProcessor);
        `], { type: 'application/javascript' }))
      );
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      workletNodeRef.current = new AudioWorkletNode(audioContextRef.current, 'audio-processor');
      
      workletNodeRef.current.port.onmessage = (event) => {
        // Check if we should send audio data to Deepgram
        const shouldSendAudio = event.data.type === 'audio' && 
                               connectionRef.current && 
                               !hasFinalTranscriptRef.current && 
                               !isAvatarSessionActiveRef.current;
        
        if (shouldSendAudio) {
          const audioData = new Float32Array(event.data.data);
          const int16Data = new Int16Array(audioData.length);
          for (let i = 0; i < audioData.length; i++) {
            int16Data[i] = Math.max(-32768, Math.min(32767, audioData[i] * 32768));
          }
          connectionRef.current.send(int16Data.buffer);
        }
      };
      
      source.connect(workletNodeRef.current);
      workletNodeRef.current.connect(audioContextRef.current.destination);
      
      // Set up Deepgram connection after audio stream is ready
      setupDeepgram();
      
    } catch (error) {
      console.error('[AudioVoiceChat] Error unmuting input audio:', error);
      cleanup();
    }
  }, [setIsMuted, setupDeepgram, cleanup]);

  // Note: Cleanup is handled by AudioProvider to avoid redundant calls
  // The AudioProvider will handle cleanup when the component unmounts or when the page is hidden

  // Add cleanup handlers for application close and page visibility changes
  useEffect(() => {
    let isPageClosing = false;
    
    const handleBeforeUnload = () => {
      console.log('[AudioVoiceChat] Page closing - cleaning up voice chat');
      isPageClosing = true;
    cleanup();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        console.log('[AudioVoiceChat] Page hidden - cleaning up voice chat');
        isPageClosing = true;
    cleanup();
      }
    };
    
    const handleForceStopVoiceChat = () => {
      console.log('[AudioVoiceChat] Force stop voice chat event received - stopping all backend connections');
      cleanup();
      setIsVoiceChatActive(false);
      setIsMuted(true);
      setIsRecording(false);
    };

    const handleForceStopConnections = () => {
      console.log('[AudioVoiceChat] Force stop connections event received - closing Deepgram connection');
      if (connectionRef.current) {
        try {
          console.log('[AudioVoiceChat] Closing Deepgram connection...');
          connectionRef.current.finish();
          connectionRef.current = null;
        } catch (error) {
          console.log('[AudioVoiceChat] Error closing Deepgram connection:', error);
        }
      }
      if (keepAliveTimerRef.current) {
        clearInterval(keepAliveTimerRef.current);
        keepAliveTimerRef.current = null;
      }
      cleanup();
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('forceStopVoiceChat', handleForceStopVoiceChat);
    window.addEventListener('forceStopConnections', handleForceStopConnections);
    
    return () => {
      console.log('[AudioVoiceChat] Component unmounting - cleaning up voice chat');
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('forceStopVoiceChat', handleForceStopVoiceChat);
      window.removeEventListener('forceStopConnections', handleForceStopConnections);
      
      // Only force cleanup if page is actually closing
      if (isPageClosing) {
        console.log('[AudioVoiceChat] Page is closing - force cleaning up voice chat');
        cleanup();
      } else {
        console.log('[AudioVoiceChat] Normal component unmount - not force cleaning up voice chat');
        // Don't force cleanup during normal unmount to allow welcome message to work
      }
    };
  }, [cleanup]);

  return {
    muteInputAudio,
    unmuteInputAudio,
    startVoiceChat,
    stopVoiceChat,
    isVoiceChatLoading: false,
    isRecording,
    showStartTalkingPrompt,
    hasProcessedFinalTranscript,
  };
}; 