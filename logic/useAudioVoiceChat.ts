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
  const [isDeepgramConnected, setIsDeepgramConnected] = useState(false);
  const silenceThresholdRef = useRef<number>(2000);
  const hasContentRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);
  const finalTranscriptRef = useRef<string>("");
  const audioStreamRef = useRef<MediaStream | null>(null);
  const [showStartTalkingPrompt, setShowStartTalkingPrompt] = useState(false);
  
  // Add refs to track state like video bot
  const isAvatarSessionActiveRef = useRef<boolean>(false);
  const hasFinalTranscriptRef = useRef<boolean>(false);
  
  // Add refs for robust stop command detection during avatar speech
  const stopCommandBufferRef = useRef<string>("");
  const stopCommandTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Connection health monitoring for tab switching
  const connectionHealthRef = useRef<{
    lastKeepAlive: number;
    consecutiveFailures: number;
  }>({
    lastKeepAlive: Date.now(),
    consecutiveFailures: 0
  });
  
  // Function to check if connection is healthy
  const isConnectionHealthy = useCallback(() => {
    if (!connectionRef.current || !isDeepgramConnected) {
      return false;
    }
    
    // Check if it's been too long since last successful keep-alive
    const timeSinceLastKeepAlive = Date.now() - connectionHealthRef.current.lastKeepAlive;
    const maxAllowedDelay = 30000; // 30 seconds
    
    if (timeSinceLastKeepAlive > maxAllowedDelay) {
      console.log(`[AudioVoiceChat] Connection might be stale - ${timeSinceLastKeepAlive}ms since last keep-alive`);
      return false;
    }
    
    return true;
  }, [isDeepgramConnected]);
  


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
    
    if (stopCommandTimerRef.current) {
      clearTimeout(stopCommandTimerRef.current);
      stopCommandTimerRef.current = null;
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
    setIsDeepgramConnected(false);
    hasContentRef.current = false;
    isProcessingRef.current = false;
    finalTranscriptRef.current = "";
    stopCommandBufferRef.current = "";
    setShowStartTalkingPrompt(false);
    hasFinalTranscriptRef.current = false; // Reset for next conversation
    console.log('[AudioVoiceChat] Cleanup completed');
  }, []);

  const handleSilence = useCallback(async () => {
    const timestamp = new Date().toISOString();
    
    console.log(`🔇 [SILENCE DETECTED] ${timestamp}:`, {
      hasContent: hasContentRef.current,
      isProcessing: isProcessingRef.current,
      isAvatarActive: isAvatarSessionActiveRef.current,
      finalTranscript: finalTranscriptRef.current,
      transcriptLength: finalTranscriptRef.current.length
    });

    if (!hasContentRef.current || isProcessingRef.current || isAvatarSessionActiveRef.current) {
      console.log(`🚫 [SILENCE IGNORED] ${timestamp}:`, {
        reason: !hasContentRef.current ? 'No content' : 
                isProcessingRef.current ? 'Already processing' : 
                'Avatar session active'
      });
      return;
    }

    if (!finalTranscriptRef.current.trim()) {
      console.log(`📭 [SILENCE IGNORED] ${timestamp}: Final transcript is empty`);
      return;
    }

    // Check for "Hey Peter" wake word with flexible matching
    const transcript = finalTranscriptRef.current.trim();
    const transcriptLower = transcript.toLowerCase();
    
    // Remove all punctuation for wake word detection
    const cleanTranscript = transcriptLower.replace(/[.,!?;:]/g, '').replace(/\s+/g, ' ').trim();
    
    // Check for various wake word patterns
    const wakeWordPatterns = [
      "hello peter",
      "hii peter", 
      "hi peter",
      "hey peter",
      "peter"  // Accept just "Peter" in case greeting is dropped
    ];
    
    let matchedPattern = null;
    let matchedLength = 0;
    
    for (const pattern of wakeWordPatterns) {
      if (cleanTranscript.startsWith(pattern)) {
        matchedPattern = pattern;
        // Find the actual length in the original transcript to extract the question
        const originalPattern = transcriptLower.substring(0, transcriptLower.indexOf(pattern.split(' ').pop()) + pattern.split(' ').pop().length);
        matchedLength = originalPattern.length;
        break;
      }
    }
    
    console.log(`🎤 [WAKE WORD CHECK] ${timestamp}:`, {
      originalTranscript: transcript,
      transcriptLower: transcriptLower,
      cleanTranscript: cleanTranscript,
      wakeWordPatterns: wakeWordPatterns,
      matchedPattern: matchedPattern,
      matchedLength: matchedLength,
      hasWakeWord: !!matchedPattern
    });

    if (!matchedPattern) {
      console.log(`🚫 [WAKE WORD MISSING] ${timestamp}: Ignoring transcript - no wake word pattern found`, {
        transcript: transcript,
        cleanTranscript: cleanTranscript,
        expected: "Hello/Hi/Hii/Hey Peter, [question] OR Peter, [question]"
      });
      
      // Clear the transcript buffer and reset flags
      finalTranscriptRef.current = "";
      hasContentRef.current = false;
      return;
    }

    // Extract the question part after the wake word
    // Find where "peter" ends in the original transcript and extract everything after it
    let question = "";
    const peterIndex = transcriptLower.indexOf("peter");
    if (peterIndex >= 0) {
      question = transcript.substring(peterIndex + 5).trim(); // 5 = length of "peter"
    }
    
    // Remove common separators at the beginning of the question
    question = question.replace(/^[.,!?;:\s]+/, '').trim();

    if (!question) {
      console.log(`📭 [NO QUESTION FOUND] ${timestamp}: "Hey Peter" detected but no question provided`, {
        originalTranscript: transcript,
        extractedQuestion: question
      });
      
      // Clear the transcript buffer and reset flags
      finalTranscriptRef.current = "";
      hasContentRef.current = false;
      return;
    }

    console.log(`🎯 [WAKE WORD DETECTED] ${timestamp}:`, {
      originalTranscript: transcript,
      extractedQuestion: question,
      questionLength: question.length,
      wordCount: question.split(' ').length
    });

    console.log(`🚀 [PROCESSING QUESTION] ${timestamp}:`, {
      question: question,
      questionLength: question.length,
      wordCount: question.split(' ').length
    });
    
    // SET BLOCKING FLAG IMMEDIATELY when we start processing
    hasFinalTranscriptRef.current = true;
    setHasProcessedFinalTranscript(true);
    console.log(`🔒 [TRANSCRIPT PROCESSING LOCKED] ${timestamp}: Blocking all subsequent transcripts during processing`);
    
    try {
      isProcessingRef.current = true;
      
      // Clear the transcript buffer
      finalTranscriptRef.current = "";
      hasContentRef.current = false;
      
      // Add the full transcript (with "Hey Peter") to the chat history for context
      console.log(`💬 [ADDING USER MESSAGE] ${timestamp}:`, {
        fullMessage: transcript,
        messageLength: transcript.length
      });
      
      addUserMessage(transcript);
      
      // But send only the question to RAG processing
      console.log(`🤖 [FETCHING RAG RESPONSE] ${timestamp}: Starting RAG processing with extracted question...`, {
        questionSentToRAG: question
      });
      await fetchRagResponse(question);
      
      console.log(`✅ [TRANSCRIPT PROCESSING COMPLETE] ${timestamp}: Successfully processed wake word question and generated response`);
      
    } catch (error) {
      console.error(`❌ [TRANSCRIPT PROCESSING ERROR] ${timestamp}:`, error);
    } finally {
      isProcessingRef.current = false;
      console.log(`🔓 [TRANSCRIPT PROCESSING UNLOCKED] ${timestamp}: Processing flag cleared, ready for next transcript`);
    }
  }, [fetchRagResponse, addUserMessage]);

  const setupDeepgram = useCallback(() => {
    if (connectionRef.current) {
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
    if (!apiKey) {
      console.error('Deepgram API key not found');
      return;
    }

    try {
      import("@deepgram/sdk").then(({ createClient, LiveTranscriptionEvents }) => {
        deepgramRef.current = createClient(apiKey);
        
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
          console.log('✅ Deepgram connection established');
          setIsDeepgramConnected(true);
          setShowStartTalkingPrompt(true);
          
          // Reset failure counters on successful connection
          (window as any).__keepAliveFailures = 0;
          (window as any).__intensiveOperation = false;
          console.log('🔄 [CONNECTION OPEN] Reset all failure counters');
          
          // Initialize connection health
          connectionHealthRef.current = {
            lastKeepAlive: Date.now(),
            consecutiveFailures: 0
          };
          
          // Set up tab-aware keep-alive ping every 5 seconds to maintain connection
          keepAliveTimerRef.current = setInterval(() => {
            if (connectionRef.current) {
              try {
                // Skip keep-alive during intensive operations (like TTS stop processing)
                if ((window as any).__intensiveOperation) {
                  console.log('🔄 [KEEP-ALIVE] Skipping during intensive operation');
                  return;
                }
                
                // Only send keep-alive if tab is visible to avoid browser throttling
                if (document.visibilityState !== 'visible') {
                  console.log('🔄 [KEEP-ALIVE] Skipping - tab not visible');
                  return;
                }
                
                connectionRef.current.keepAlive();
                
                // Update connection health on successful keep-alive
                connectionHealthRef.current.lastKeepAlive = Date.now();
                connectionHealthRef.current.consecutiveFailures = 0;
                
                // Reset failure counter on successful keep-alive
                if ((window as any).__keepAliveFailures > 0) {
                  console.log('✅ [KEEP-ALIVE] Success - resetting failure counter');
                  (window as any).__keepAliveFailures = 0;
                }
              } catch (error) {
                console.error('⚠️ [KEEP-ALIVE ERROR] Error sending keep-alive ping:', error);
                
                // Update connection health on failure
                connectionHealthRef.current.consecutiveFailures++;
                
                // Don't immediately close connection on keep-alive error - could be temporary
                // Only close if we have multiple consecutive failures
                let keepAliveFailures = (window as any).__keepAliveFailures || 0;
                keepAliveFailures++;
                (window as any).__keepAliveFailures = keepAliveFailures;
                
                console.log(`[KEEP-ALIVE] Failure count: ${keepAliveFailures}/3`);
                
                if (keepAliveFailures >= 3) {
                  console.error('❌ [KEEP-ALIVE] Multiple failures - connection will be recreated on tab focus');
                  setIsDeepgramConnected(false);
                  (window as any).__keepAliveFailures = 0; // Reset counter
                  // Don't close connection here - let visibility change handler handle reconnection
                } else {
                  console.log('🔄 [KEEP-ALIVE] Temporary failure - keeping connection open');
                }
              }
            }
          }, 5000); // Increased to 5 seconds for better browser compatibility
        });

        connectionRef.current.on(LiveTranscriptionEvents.Close, () => {
          console.log('❌ Deepgram connection closed');
          setIsDeepgramConnected(false);
          if (keepAliveTimerRef.current) {
            clearInterval(keepAliveTimerRef.current);
            keepAliveTimerRef.current = null;
          }
        });

        connectionRef.current.on(LiveTranscriptionEvents.Transcript, (data: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          const transcript = data.channel?.alternatives?.[0]?.transcript || "";
          const isFinal = data.is_final;
          const confidence = data.channel?.alternatives?.[0]?.confidence;
          const timestamp = new Date().toISOString();
          
          // Log all transcripts with detailed information
          if (transcript.trim()) {
            if (isFinal) {
              console.log(`🎯 [FINAL TRANSCRIPT] ${timestamp}:`, {
                text: transcript,
                confidence: confidence,
                length: transcript.length,
                currentFinalBuffer: finalTranscriptRef.current,
                isBlocked: hasFinalTranscriptRef.current,
                isAvatarTalking: isAvatarSessionActiveRef.current
              });
            } else {
              console.log(`⚡ [INTERIM TRANSCRIPT] ${timestamp}:`, {
                text: transcript,
                confidence: confidence,
                length: transcript.length,
                isBlocked: hasFinalTranscriptRef.current,
                isAvatarTalking: isAvatarSessionActiveRef.current
              });
            }
            setShowStartTalkingPrompt(false);
          } else {
            // Log empty transcripts too for debugging
            // console.log(`📭 [EMPTY TRANSCRIPT] ${timestamp}:`, {
            //   isFinal: isFinal,
            //   rawData: data
            // });
          }
          
          // Enhanced stop command detection during avatar speech
          if (isAvatarSessionActiveRef.current && transcript.trim()) {
            const transcriptLower = transcript.toLowerCase().trim();
            const cleanTranscript = transcriptLower.replace(/[.,!?;:]/g, '').replace(/\s+/g, ' ').trim();
            
            // Add current transcript to buffer for fragment analysis
            if (isFinal) {
              stopCommandBufferRef.current += (stopCommandBufferRef.current ? ' ' : '') + cleanTranscript;
              
              // Clear old buffer data after 3 seconds to prevent accumulation
              if (stopCommandTimerRef.current) {
                clearTimeout(stopCommandTimerRef.current);
              }
              stopCommandTimerRef.current = setTimeout(() => {
                stopCommandBufferRef.current = "";
              }, 3000);
            }
            
            // Enhanced stop command detection with fuzzy matching
            const currentBuffer = stopCommandBufferRef.current.toLowerCase();
            const fragments = cleanTranscript.split(' ').filter(word => word.length > 0);
            
            // Check for various stop command patterns and common transcription errors
            const stopPatterns = [
              // Exact matches
              "stop",
              "peter stop", "stop peter","peter, stop",
              // Common transcription errors during bot speech
              "peter stop it", "stop it peter", "stop peter now",
              "peter", "stop it", "peter,", "stop,",
              // Fragmented versions
              "pet stop", "peter st", "st peter", "stop pe",
              // Audio interference patterns
              "peter's top", "peter stop", "peter top", "stop either"
            ];
            
            // Check if buffer contains stop command indicators
            const bufferContainsStop = currentBuffer.includes("stop") || currentBuffer.includes("peter");
            const hasStopKeywords = fragments.some(word => 
              ["stop", "peter", "pet", "st", "pe", "top", "it"].includes(word)
            );
            
            // More flexible stop command detection
            const isStopCommand = stopPatterns.some(pattern => 
              cleanTranscript.includes(pattern) || currentBuffer.includes(pattern)
            ) || (bufferContainsStop && (
              currentBuffer.includes("peter stop") ||
              currentBuffer.includes("stop peter") ||
              (currentBuffer.includes("peter") && currentBuffer.includes("stop"))
            ));
            
            console.log(`🔍 [ENHANCED INTERRUPT CHECK] ${timestamp}:`, {
              transcript: transcript,
              cleanTranscript: cleanTranscript,
              fragments: fragments,
              currentBuffer: currentBuffer,
              bufferContainsStop: bufferContainsStop,
              hasStopKeywords: hasStopKeywords,
              isStopCommand: isStopCommand,
              isAvatarTalking: isAvatarSessionActiveRef.current,
              isFinal: isFinal
            });
            
            if (isStopCommand && isFinal) {
              console.log(`⏹️ [STOP COMMAND DETECTED] ${timestamp}: User requested to stop audio during avatar speech`, {
                detectedVia: currentBuffer.includes("peter stop") || currentBuffer.includes("stop peter") ? "complete_command" : "fragment_analysis",
                buffer: currentBuffer
              });
              
              // Clear the buffer immediately
              stopCommandBufferRef.current = "";
              if (stopCommandTimerRef.current) {
                clearTimeout(stopCommandTimerRef.current);
                stopCommandTimerRef.current = null;
              }
              
              // Dispatch stop event
              console.log(`🛑 [STOPPING AVATAR AUDIO] ${timestamp}: Executing stop command`);
              try {
                window.dispatchEvent(new CustomEvent('userRequestedStop', { 
                  detail: { timestamp, reason: 'peter_stop_command' }
                }));
              } catch (e) {
                console.log('Could not dispatch stop event:', e);
              }
              
              return; // Don't process this transcript further
            } else if (isAvatarSessionActiveRef.current) {
              console.log(`🚫 [TRANSCRIPT IGNORED DURING SPEECH] ${timestamp}: Ignoring non-stop command while avatar is talking`, {
                transcript: transcript,
                reason: 'Avatar is speaking - only stop commands allowed',
                buffer: currentBuffer
              });
              return; // Ignore all other transcripts while avatar is talking
            }
          }
          
          // BLOCK ALL TRANSCRIPTS after final message is processed until audio stops (but allow stop commands)
          if (hasFinalTranscriptRef.current) {
            console.log(`🚫 [TRANSCRIPT BLOCKED] ${timestamp}: Ignoring ${isFinal ? 'FINAL' : 'INTERIM'} transcript due to processing flag`);
            return;
          }
          
          if (isFinal && transcript.trim()) {
            // Combine final transcripts into a complete sentence
            const previousBuffer = finalTranscriptRef.current;
            finalTranscriptRef.current += (finalTranscriptRef.current ? ' ' : '') + transcript;
            hasContentRef.current = true;
            setCurrentTranscript("");
            
            // Check if the combined buffer starts with wake word (using flexible matching)
            const combinedLower = finalTranscriptRef.current.toLowerCase().trim();
            const cleanCombined = combinedLower.replace(/[.,!?;:]/g, '').replace(/\s+/g, ' ').trim();
            const hasWakeWord = cleanCombined.startsWith("hello peter") || 
                              cleanCombined.startsWith("hii peter") || 
                              cleanCombined.startsWith("hi peter") || 
                              cleanCombined.startsWith("hey peter") || 
                              cleanCombined.startsWith("peter");
            
            console.log(`✅ [FINAL TRANSCRIPT PROCESSED] ${timestamp}:`, {
              newTranscript: transcript,
              previousBuffer: previousBuffer,
              combinedBuffer: finalTranscriptRef.current,
              bufferLength: finalTranscriptRef.current.length,
              cleanCombined: cleanCombined,
              hasWakeWord: hasWakeWord,
              wakeWordStatus: hasWakeWord ? "✅ Wake word detected" : "⚠️ No wake word yet"
            });
            
            // Reset silence timer for each final transcript
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
            }
            silenceTimerRef.current = setTimeout(handleSilence, silenceThresholdRef.current);
          } else if (transcript.trim()) {
            // Only show interim transcripts if we haven't processed a final transcript yet
            if (!hasFinalTranscriptRef.current) {
              setCurrentTranscript(transcript);
              
              console.log(`🔄 [INTERIM TRANSCRIPT DISPLAYED] ${timestamp}:`, {
                transcript: transcript,
                isShowing: true
              });
              
              // Reset silence timer for interim transcripts too
              if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);    
              }
              silenceTimerRef.current = setTimeout(handleSilence, silenceThresholdRef.current);
            } else {
              console.log(`⏸️ [INTERIM TRANSCRIPT IGNORED] ${timestamp}:`, {
                transcript: transcript,
                reason: 'Final transcript already processed'
              });
            }
          }
        });

        connectionRef.current.on(LiveTranscriptionEvents.Error, (error: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          console.error('⚠️ [DEEPGRAM ERROR]', error);
          
          // Only close connection for critical errors, not minor ones
          const errorType = error?.type || error?.message || 'unknown';
          const isCriticalError = errorType.includes('socket') || 
                                 errorType.includes('connection') || 
                                 errorType.includes('authentication') ||
                                 errorType.includes('authorization');
          
          if (isCriticalError) {
            console.error('❌ [CRITICAL DEEPGRAM ERROR] Closing connection due to critical error:', errorType);
            setIsDeepgramConnected(false);
          } else {
            console.log('🔄 [NON-CRITICAL DEEPGRAM ERROR] Keeping connection open for error:', errorType);
            // Don't close connection for non-critical errors
          }
        });

        connectionRef.current.on(LiveTranscriptionEvents.Metadata, (data: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          // Keep metadata logging for debugging connection issues
          console.log('Deepgram metadata:', data);
        });
      });
    } catch (error) {
      console.error('[AudioVoiceChat] Error setting up Deepgram:', error);
      cleanup();
    }
  }, [fetchRagResponse, cleanup, handleSilence, isVoiceChatActive, isMuted]);

  // Function to force reconnect Deepgram connection
  const forceReconnectDeepgram = useCallback(() => {
    console.log('[AudioVoiceChat] Force reconnecting Deepgram connection');
    
    // Close existing connection
    if (connectionRef.current) {
      try {
        connectionRef.current.finish();
      } catch (error) {
        console.log('[AudioVoiceChat] Error closing existing connection:', error);
      }
      connectionRef.current = null;
    }
    
    // Clear timers
    if (keepAliveTimerRef.current) {
      clearInterval(keepAliveTimerRef.current);
      keepAliveTimerRef.current = null;
    }
    
    // Reset state
    setIsDeepgramConnected(false);
    
    // Reconnect if voice chat is active
    if (isVoiceChatActive && !isMuted) {
      console.log('[AudioVoiceChat] Reconnecting Deepgram for active voice chat');
      setTimeout(() => {
        setupDeepgram();
      }, 1000); // Small delay to ensure cleanup completes
    }
  }, [isVoiceChatActive, isMuted, setupDeepgram]);

  const startVoiceChat = useCallback(async () => {
    console.log('[AudioVoiceChat] Starting voice chat...');
    cleanup();
    
    try {
      // Set voice chat as active first
      setIsVoiceChatActive(true);
      setIsRecording(true);
      // Start voice chat in muted state - will be immediately unmuted by caller
      setIsMuted(true);
      
      // Keep the persistent ping timer as backup for connection recovery
      keepAliveTimerRef.current = setInterval(() => {
        if (isVoiceChatActive && !isMuted && !connectionRef.current) {
          console.log('[AudioVoiceChat] Persistent ping - setting up Deepgram connection');
          setupDeepgram();
        }
      }, 10000); // Check every 10 seconds for recovery only
      
      console.log('[AudioVoiceChat] Voice chat started, ready for immediate unmuting');
      
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
    setIsMuted(true);
    
    // Only stop audio recording, but keep Deepgram connection alive
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    
    // Clear timers but keep Deepgram connection and voice chat active
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    
    // Reset transcript flags
    finalTranscriptRef.current = "";
    hasContentRef.current = false;
    isProcessingRef.current = false;
    hasFinalTranscriptRef.current = false;
    setHasProcessedFinalTranscript(false);
  }, [setIsMuted]);

  const unmuteInputAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Enhanced settings for better transcription during bot speech
          sampleRate: 16000,
          channelCount: 1
        }
      });
      audioStreamRef.current = stream;
      setIsMuted(false);
      // Setup audio processing with worklet
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      await audioContextRef.current.audioWorklet.addModule(
        URL.createObjectURL(new Blob([`
          class AudioProcessor extends AudioWorkletProcessor {
            constructor() { super(); }
            process(inputs, outputs, parameters) {
              const input = inputs[0];
              if (input && input[0] && input[0].length > 0) {
                const hasAudio = input[0].some(sample => sample !== 0);
                if (hasAudio) {
                  this.port.postMessage({ type: 'audio', data: Array.from(input[0]), timestamp: Date.now() });
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
        // Allow audio sending even during avatar speech to enable "peter stop" interrupts
        const shouldSendAudio = event.data.type === 'audio' &&
                               connectionRef.current &&
                               !hasFinalTranscriptRef.current;
        
        // Log when we're allowing audio during avatar speech
        if (shouldSendAudio && isAvatarSessionActiveRef.current) {
          console.log(`🎤 [AUDIO DURING AVATAR SPEECH] Sending audio data for interrupt detection`);
        }
        
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
      setShowStartTalkingPrompt(true);
      // Set up Deepgram connection after audio stream is ready
      setupDeepgram();
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setIsMuted(true);
      throw error;
    }
  }, [setIsMuted, setupDeepgram]);

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
    
    const handleVoiceModeDisabled = () => {
      console.log('[AudioVoiceChat] Voice mode disabled - stopping voice chat');
      cleanup();
      setIsVoiceChatActive(false);
      setIsMuted(true);
      setIsRecording(false);
    };
    
    const handleUserRequestedStop = (event: any) => {
      const timestamp = event.detail?.timestamp || new Date().toISOString();
      const reason = event.detail?.reason || 'unknown';
      console.log(`🛑 [USER STOP REQUEST] ${timestamp}: Handling stop request due to: ${reason}`);
      
      // We'll trigger the interrupt through a more direct method by dispatching to audio controls
      try {
        window.dispatchEvent(new CustomEvent('audioInterruptRequest', { 
          detail: { source: 'peter_stop_command', timestamp }
        }));
        console.log(`📤 [INTERRUPT DISPATCHED] ${timestamp}: Sent interrupt request to audio controls`);
      } catch (error) {
        console.log(`❌ [INTERRUPT DISPATCH ERROR] ${timestamp}:`, error);
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('forceStopVoiceChat', handleForceStopVoiceChat);
    window.addEventListener('forceStopConnections', handleForceStopConnections);
    window.addEventListener('voiceModeDisabled', handleVoiceModeDisabled);
    window.addEventListener('userRequestedStop', handleUserRequestedStop);
    
    return () => {
      console.log('[AudioVoiceChat] Component unmounting - cleaning up voice chat');
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('forceStopVoiceChat', handleForceStopVoiceChat);
      window.removeEventListener('forceStopConnections', handleForceStopConnections);
      window.removeEventListener('voiceModeDisabled', handleVoiceModeDisabled);
      window.removeEventListener('userRequestedStop', handleUserRequestedStop);
      
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
    isDeepgramConnected,
    forceReconnectDeepgram,
  };
}; 