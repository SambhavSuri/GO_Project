import { useRef, useCallback, useEffect } from "react";
import { useAudioSpeakingContext } from "./useAudioSpeakingContext";
import { azureTTS, azureStreamingTTS, VisemeData } from "../lib/azureTTS";
import { AzureTTSBufferManager } from "../lib/azureTTSBufferManager";

// Audio constants
const SAMPLE_RATE = 48000;
const BUFFER_DURATION_MS = 800; // Reduced to 800ms for more fluent TTS

// Audio constants for compatibility
// The actual buffer manager is now in AzureTTSBufferManager

// Azure TTS hook with viseme support
export const useAzureTTS = (
  setIsAvatarTalking?: (talking: boolean) => void,
  setIsAvatarSessionActive?: (active: boolean) => void,
  onAudioChunkFinished?: (duration: number) => void,
  onAudioStartPlaying?: () => void,
  onViseme?: (viseme: VisemeData) => void
) => {
  const { canSpeakRef, isInterruptedRef, registerStopSpeaking, resetInterruptionState } = useAudioSpeakingContext();
  const audioBufferManagerRef = useRef<AzureTTSBufferManager | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isSpeakingRef = useRef<boolean>(false);
  const speechTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const stopSpeakingRef = useRef<(() => void) | null>(null);
  
  // Add missing refs
  const isWelcomeMessageRef = useRef<boolean>(false);
  const onAudioChunkFinishedRef = useRef<((duration: number) => void) | null>(null);
  const onAudioStartPlayingRef = useRef<(() => void) | null>(null);
  const onVisemeRef = useRef<((viseme: VisemeData) => void) | null>(null);

  // Initialize audio buffer manager
  const initAudioBufferManager = useCallback(() => {
    console.log('[AzureTTS] initAudioBufferManager called');
    if (!audioBufferManagerRef.current) {
      console.log('[AzureTTS] Creating new AzureTTSBufferManager');
      audioBufferManagerRef.current = new AzureTTSBufferManager();
      
      // Set up a unified completion callback that handles both welcome and regular messages
      audioBufferManagerRef.current.setOnComplete((duration: number) => {
        console.log('[AzureTTS] ✅ Audio playback completed, duration:', duration, 'isWelcome:', isWelcomeMessageRef.current);
        
        // Call original callback if it exists
        if (onAudioChunkFinishedRef.current) {
          onAudioChunkFinishedRef.current(duration);
        }
        
        // ALWAYS reset avatar talking state when audio completes
        if (setIsAvatarTalking) {
          console.log('[AzureTTS] Setting isAvatarTalking to false after audio completion');
          setIsAvatarTalking(false);
        }
        
        // For welcome messages, also reset session state
        // For regular messages, only reset if it's not a welcome message
        if (isWelcomeMessageRef.current) {
          console.log('[AzureTTS] Welcome message completed - resetting session state');
          if (setIsAvatarSessionActive) {
            setIsAvatarSessionActive(false);
          }
        } else {
          // For regular messages, let the TTS queue manager control session state
          console.log('[AzureTTS] Regular message completed - keeping session active');
        }
        
        // Reset welcome message flag
        isWelcomeMessageRef.current = false;
        
        // Resolve the current promise if it exists
        if (audioBufferManagerRef.current && (audioBufferManagerRef.current as any).currentResolve) {
          console.log('[AzureTTS] Resolving current promise');
          (audioBufferManagerRef.current as any).currentResolve();
          (audioBufferManagerRef.current as any).currentResolve = null;
        }
        
        // Ensure buffer manager is completely cleared after audio finishes
        if (audioBufferManagerRef.current) {
          console.log('[AzureTTS] Audio finished, clearing buffer manager');
          audioBufferManagerRef.current.forceClear();
        }
      });
      
      // Set up callback for when audio starts playing (for GLB animation)
      if (onAudioStartPlaying) {
        audioBufferManagerRef.current.setOnStartPlaying(() => {
          console.log('[AzureTTS] Audio started playing - triggering GLB animation');
          if (onAudioStartPlayingRef.current) {
            onAudioStartPlayingRef.current();
          }
        });
      }
      
      // Set up viseme callback for lip sync
      if (onViseme) {
        audioBufferManagerRef.current.setOnViseme((viseme: VisemeData) => {
          console.log('[AzureTTS] Viseme triggered:', viseme.visemeId);
          if (onVisemeRef.current) {
            onVisemeRef.current(viseme);
          }
        });
      }
    } else {
      console.log('[AzureTTS] Resetting existing AzureTTSBufferManager');
      console.log('[AzureTTS] Buffer manager state before reset:', audioBufferManagerRef.current.getBufferStatus());
      audioBufferManagerRef.current.reset();
      console.log('[AzureTTS] Buffer manager state after reset:', audioBufferManagerRef.current.getBufferStatus());
    }
  }, [onAudioChunkFinished, setIsAvatarTalking, setIsAvatarSessionActive, onAudioStartPlaying, onViseme]);

  // Main TTS function using Azure REST API
  const speakText = useCallback(async (text: string, isWelcome: boolean = false, isSequential: boolean = false): Promise<void> => {
    // CRITICAL FIX: Reset interruption state for new TTS requests
    console.log('[AzureTTS] 🔄 Resetting interruption state for new TTS request');
    resetInterruptionState();
    
    // Initialize audio buffer manager if not already done
    initAudioBufferManager();
    
    // Reset the audio buffer manager if it's in a stopped state (like Deepgram version)
    if (audioBufferManagerRef.current) {
      const bufferStatus = audioBufferManagerRef.current.getBufferStatus();
      if (bufferStatus.isStopped) {
        console.log('[AzureTTS] Buffer manager is stopped, resetting for new message');
        audioBufferManagerRef.current.reset();
      }
      // Force clear any remaining audio from previous session if not sequential
      if (!isSequential && (bufferStatus.queueLength > 0 || bufferStatus.totalBytes > 0)) {
        console.log('[AzureTTS] Clearing remaining audio from previous session');
        audioBufferManagerRef.current.forceClear();
        // Wait a moment to ensure audio is fully cleared
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    if (!text.trim() || !canSpeakRef.current || isInterruptedRef.current) {
      console.log('[AzureTTS] ❌ TTS request blocked - text:', !!text.trim(), 'canSpeak:', canSpeakRef.current, 'notInterrupted:', !isInterruptedRef.current);
      return;
    }

    // Create a promise that resolves when audio playback completes
    return new Promise<void>(async (resolve, reject) => {
      try {
        // Set welcome message flag
        isWelcomeMessageRef.current = isWelcome;
        
        // Set isAvatarTalking to true immediately since we'll start playing soon
        // Only set this for the first sentence in a sequence or for standalone messages
        if (!isSequential && setIsAvatarTalking) {
          setIsAvatarTalking(true);
        }
        
        // Only set isAvatarSessionActive for non-welcome messages
        if (!isWelcome && !isSequential && setIsAvatarSessionActive) {
          setIsAvatarSessionActive(true);
        }

        console.log('[AzureTTS] 🎵 Speaking sentence:', text.substring(0, 50) + '...', 'isWelcome:', isWelcome, 'isSequential:', isSequential);
        
        // Call the Azure TTS API to get audio data and visemes
        const response = await azureTTS(text);
        
        if (!response || !response.audio) {
          console.error('[AzureTTS] Failed to get audio data from Azure TTS API');
          if (setIsAvatarTalking) setIsAvatarTalking(false);
          if (setIsAvatarSessionActive) setIsAvatarSessionActive(false);
          reject(new Error('Failed to get audio data from Azure TTS API'));
          return;
        }

        console.log('[AzureTTS] Received audio data, size:', response.audio.length, 'bytes');
        console.log('[AzureTTS] Received visemes:', response.visemes.length);

        // Add the complete audio to the buffer manager
        if (audioBufferManagerRef.current) {
          console.log('[AzureTTS] Adding audio and visemes to buffer manager');
          console.log('[AzureTTS] Visemes to process:', response.visemes.length);
          
          // Store the resolve function for this promise
          (audioBufferManagerRef.current as any).currentResolve = resolve;
          
          // Ensure AudioContext is ready before adding audio
          const isReady = await audioBufferManagerRef.current.ensureAudioContextReady();
          if (isReady) {
            await audioBufferManagerRef.current.addCompleteAudio(response.audio, response.visemes, isSequential);
          } else {
            console.error('[AzureTTS] Failed to initialize AudioContext - cannot play audio');
            if (setIsAvatarTalking) setIsAvatarTalking(false);
            if (setIsAvatarSessionActive) setIsAvatarSessionActive(false);
            reject(new Error('Failed to initialize AudioContext'));
          }
        } else {
          console.error('[AzureTTS] Audio buffer manager is null!');
          reject(new Error('Audio buffer manager is null'));
        }

      } catch (error) {
        console.error('[AzureTTS] Error in speakText:', error);
        if (setIsAvatarTalking) setIsAvatarTalking(false);
        if (setIsAvatarSessionActive) setIsAvatarSessionActive(false);
        reject(error);
      }
    });
  }, [initAudioBufferManager, setIsAvatarTalking, setIsAvatarSessionActive, resetInterruptionState]);
  
  // Update refs when callbacks change
  useEffect(() => {
    onAudioChunkFinishedRef.current = onAudioChunkFinished ?? null;
    onAudioStartPlayingRef.current = onAudioStartPlaying ?? null;
    onVisemeRef.current = onViseme ?? null;
  }, [onAudioChunkFinished, onAudioStartPlaying, onViseme]);

  // Stop speaking function
  const stopSpeaking = useCallback((forceStop: boolean = false) => {
    console.log('[AzureTTS] stopSpeaking called with forceStop:', forceStop);
    
    // CRITICAL FIX: Set intensive operation flag to prevent Deepgram keep-alive conflicts
    if (forceStop) {
      console.log('[AzureTTS] 🔒 Setting intensive operation flag to protect Deepgram connection');
      (window as any).__intensiveOperation = true;
      
      // Clear the flag after a short delay to allow operations to complete
      setTimeout(() => {
        (window as any).__intensiveOperation = false;
        console.log('[AzureTTS] 🔓 Cleared intensive operation flag');
      }, 1000);
    }
    
    // Stop browser speech synthesis
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
      console.log('[AzureTTS] Browser speech synthesis cancelled');
    }
    
    // Clear speech synthesis state
    isSpeakingRef.current = false;
    currentUtteranceRef.current = null;
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
      console.log('[AzureTTS] Speech timeout cleared');
    }
    
    // Stop Azure TTS audio buffer manager
    if (audioBufferManagerRef.current) {
      console.log('[AzureTTS] Stopping Azure TTS audio buffer manager');
      if (forceStop) {
        // Use force clear for interruptions to immediately clear all queued audio
        audioBufferManagerRef.current.forceClear();
      } else {
        // Use normal stop for graceful stopping
        audioBufferManagerRef.current.stop();
      }
      console.log('[AzureTTS] Azure TTS audio buffer manager stopped');
    } else {
      console.log('[AzureTTS] No audio buffer manager to stop');
    }
    
    // Immediately update state
    if (setIsAvatarTalking) {
      console.log('[AzureTTS] Setting isAvatarTalking to false');
      setIsAvatarTalking(false);
      console.log('[AzureTTS] isAvatarTalking set to false');
    }
    if (setIsAvatarSessionActive) {
      console.log('[AzureTTS] Setting isAvatarSessionActive to false');
      setIsAvatarSessionActive(false);
      console.log('[AzureTTS] isAvatarSessionActive set to false');
    }
    
    console.log('[AzureTTS] stopSpeaking completed - all speech stopped');
  }, [setIsAvatarTalking, setIsAvatarSessionActive]);

  // Store the current stopSpeaking function in the ref
  useEffect(() => {
    stopSpeakingRef.current = stopSpeaking;
  }, [stopSpeaking]);

  // Register the stopSpeaking function with the AudioSpeakingContext
  // For interruptions (stop keywords), we need to force stop immediately
  useEffect(() => {
    registerStopSpeaking(() => stopSpeaking(true)); // Always use force stop for interruptions
  }, [registerStopSpeaking, stopSpeaking]);

  // Listen for force stop audio events (when modal is closed)
  useEffect(() => {
    const handleForceStopAudio = () => {
      console.log('[AzureTTS] Force stop audio event received - stopping all audio');
      if (audioBufferManagerRef.current) {
        audioBufferManagerRef.current.forceClear();
      }
      if (setIsAvatarTalking) {
        setIsAvatarTalking(false);
      }
      if (setIsAvatarSessionActive) {
        setIsAvatarSessionActive(false);
      }
    };

    window.addEventListener('forceStopAudio', handleForceStopAudio);
    
    return () => {
      window.removeEventListener('forceStopAudio', handleForceStopAudio);
    };
  }, [setIsAvatarTalking, setIsAvatarSessionActive]);

  const getBufferingState = useCallback(() => {
    if (!audioBufferManagerRef.current) return { isBuffering: false, totalBufferedBytes: 0, minBufferBytes: 0, bufferProgress: 0 };
    const status = audioBufferManagerRef.current.getBufferStatus();
    return {
      isBuffering: status.isPlaying || isSpeakingRef.current,
      totalBufferedBytes: status.totalBytes,
      minBufferBytes: 1000,
      bufferProgress: status.isProcessed ? 100 : Math.min((status.totalBytes / 10000) * 100, 99)
    };
  }, []);

  return { 
    speakText, 
    stopSpeaking, 
    getBufferingState
  };
};

// Keep the old hook name for backward compatibility, but redirect to Azure TTS
export const useDeepgramTTS = useAzureTTS; 

// Streaming TTS hook using Azure's streaming API with stop support and visemes
export const useStreamingAzureTTS = (
  setIsAvatarTalking?: (talking: boolean) => void,
  setIsAvatarSessionActive?: (active: boolean) => void,
  onAudioChunkFinished?: (duration: number) => void,
  onViseme?: (viseme: VisemeData) => void
) => {
  const { canSpeakRef, isInterruptedRef, registerStopSpeaking, resetInterruptionState } = useAudioSpeakingContext();
  const audioBufferManagerRef = useRef<AzureTTSBufferManager | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isWelcomeMessageRef = useRef<boolean>(false);
  const onAudioChunkFinishedRef = useRef<((duration: number) => void) | null>(null);
  const onVisemeRef = useRef<((viseme: VisemeData) => void) | null>(null);

  useEffect(() => { 
    onAudioChunkFinishedRef.current = onAudioChunkFinished ?? null; 
    onVisemeRef.current = onViseme ?? null;
  }, [onAudioChunkFinished, onViseme]);

  // Initialize audio buffer manager
  const initAudioBufferManager = useCallback(() => {
    if (!audioBufferManagerRef.current) {
      audioBufferManagerRef.current = new AzureTTSBufferManager();
      if (onAudioChunkFinished) {
        audioBufferManagerRef.current.setOnComplete((duration: number) => {
          console.log('[AzureStreamingTTS] ✅ Audio playback completed, duration:', duration, 'isWelcome:', isWelcomeMessageRef.current);
          
          // Call original callback if it exists
          if (onAudioChunkFinishedRef.current) {
            onAudioChunkFinishedRef.current(duration);
          }
          
          // ALWAYS reset avatar talking state when audio completes
          if (setIsAvatarTalking) {
            console.log('[AzureStreamingTTS] Setting isAvatarTalking to false after audio completion');
            setIsAvatarTalking(false);
          }
          
          // For welcome messages, also reset session state
          // For regular messages, only reset if it's not a welcome message
          if (isWelcomeMessageRef.current) {
            console.log('[AzureStreamingTTS] Welcome message completed - resetting session state');
            if (setIsAvatarSessionActive) {
              setIsAvatarSessionActive(false);
            }
          } else {
            // For regular messages, let the TTS queue manager control session state
            console.log('[AzureStreamingTTS] Regular message completed - keeping session active');
          }
          
          // Reset welcome message flag
          isWelcomeMessageRef.current = false;
          
          // Ensure buffer manager is completely cleared after audio finishes
          if (audioBufferManagerRef.current) {
            console.log('[AzureStreamingTTS] Audio finished, clearing buffer manager');
            audioBufferManagerRef.current.forceClear();
          }
        });
      }
      
      // Set up viseme callback
      if (onViseme) {
        audioBufferManagerRef.current.setOnViseme((viseme: VisemeData) => {
          console.log('[AzureStreamingTTS] Viseme triggered:', viseme.visemeId);
          if (onVisemeRef.current) {
            onVisemeRef.current(viseme);
          }
        });
      }
    } else {
      console.log('[AzureStreamingTTS] Resetting existing AzureTTSBufferManager');
      audioBufferManagerRef.current.reset();
    }
  }, [onAudioChunkFinished, setIsAvatarTalking, setIsAvatarSessionActive, onViseme]);

  // Main streaming TTS function
  const speakTextStreaming = useCallback(async (text: string, isWelcome: boolean = false) => {
    // CRITICAL FIX: Reset interruption state for new TTS requests
    console.log('[AzureStreamingTTS] 🔄 Resetting interruption state for new streaming TTS request');
    resetInterruptionState();
    
    initAudioBufferManager();
    
    // Reset the audio buffer manager if it's in a stopped state (like Deepgram version)
    if (audioBufferManagerRef.current) {
      const bufferStatus = audioBufferManagerRef.current.getBufferStatus();
      if (bufferStatus.isStopped) {
        console.log('[AzureStreamingTTS] Buffer manager is stopped, resetting for new message');
        audioBufferManagerRef.current.reset();
      }
      // Force clear any remaining audio from previous session
      if (bufferStatus.queueLength > 0 || bufferStatus.totalBytes > 0) {
        console.log('[AzureStreamingTTS] Clearing remaining audio from previous session');
        audioBufferManagerRef.current.forceClear();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    if (!text.trim() || !canSpeakRef.current || isInterruptedRef.current) {
      console.log('[AzureStreamingTTS] ❌ Streaming TTS request blocked - text:', !!text.trim(), 'canSpeak:', canSpeakRef.current, 'notInterrupted:', !isInterruptedRef.current);
      return;
    }
    try {
      isWelcomeMessageRef.current = isWelcome;
      if (setIsAvatarTalking) setIsAvatarTalking(true);
      if (!isWelcome && setIsAvatarSessionActive) setIsAvatarSessionActive(true);
      // Abort previous fetch if any
      if (abortControllerRef.current) abortControllerRef.current.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      await azureStreamingTTS(
        text,
        async (audioData: Uint8Array, isFirstChunk: boolean) => {
          if (audioBufferManagerRef.current) {
            // Ensure AudioContext is ready before adding streaming chunk
            const isReady = await audioBufferManagerRef.current.ensureAudioContextReady();
            if (isReady) {
              audioBufferManagerRef.current.addStreamingChunk(audioData, isFirstChunk);
            }
          }
        },
        undefined, // onViseme - handled by buffer manager
        () => {}, // onComplete
        (error: string) => {
          if (setIsAvatarTalking) setIsAvatarTalking(false);
          if (setIsAvatarSessionActive) setIsAvatarSessionActive(false);
        },
        abortController.signal
      );
    } catch (error) {
      if (setIsAvatarTalking) setIsAvatarTalking(false);
      if (setIsAvatarSessionActive) setIsAvatarSessionActive(false);
    }
  }, [initAudioBufferManager, setIsAvatarTalking, setIsAvatarSessionActive, resetInterruptionState]);

  // Stop speaking function
  const stopSpeaking = useCallback((forceStop: boolean = false) => {
    console.log('[AzureStreamingTTS] stopSpeaking called with forceStop:', forceStop);
    
    // CRITICAL FIX: Set intensive operation flag to prevent Deepgram keep-alive conflicts
    if (forceStop) {
      console.log('[AzureStreamingTTS] 🔒 Setting intensive operation flag to protect Deepgram connection');
      (window as any).__intensiveOperation = true;
      
      // Clear the flag after a short delay to allow operations to complete
      setTimeout(() => {
        (window as any).__intensiveOperation = false;
        console.log('[AzureStreamingTTS] 🔓 Cleared intensive operation flag');
      }, 1000);
    }
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    if (audioBufferManagerRef.current) {
      if (forceStop) audioBufferManagerRef.current.forceClear();
      else audioBufferManagerRef.current.stop();
    }
    if (setIsAvatarTalking) setIsAvatarTalking(false);
    if (setIsAvatarSessionActive) setIsAvatarSessionActive(false);
  }, [setIsAvatarTalking, setIsAvatarSessionActive]);

  useEffect(() => { registerStopSpeaking(() => stopSpeaking(true)); }, [registerStopSpeaking, stopSpeaking]); // Force stop for interruptions
  useEffect(() => {
    const handleForceStopAudio = () => {
      if (audioBufferManagerRef.current) audioBufferManagerRef.current.forceClear();
      if (setIsAvatarTalking) setIsAvatarTalking(false);
      if (setIsAvatarSessionActive) setIsAvatarSessionActive(false);
    };
    window.addEventListener('forceStopAudio', handleForceStopAudio);
    return () => { window.removeEventListener('forceStopAudio', handleForceStopAudio); };
  }, [setIsAvatarTalking, setIsAvatarSessionActive]);

  return { speakTextStreaming, stopSpeaking };
};

// Keep the old hook name for backward compatibility, but redirect to Azure TTS
export const useStreamingDeepgramTTS = useStreamingAzureTTS;

// Azure TTS implementation is now complete - no additional functions needed
// All Azure TTS functionality is handled in lib/azureTTS.ts 