import { useState, useRef, useEffect, useCallback } from 'react';
import { TextChunker } from '../lib/text-chunker';
import { createSpeechService } from '../lib/azure-speech-streaming';
import { useAudioSpeakingContext } from './useAudioSpeakingContext';

// 🎯 NEW: Interface for stored visemes with chunk association
interface ChunkViseme {
  visemeId: number;
  offset: number;
}

// 🎯 NEW: Interface for complete buffered chunk data
interface BufferedChunk {
  audioData: ArrayBuffer;
  text: string;
  visemes: ChunkViseme[];
}

interface UseStreamingTTSWithChunkingReturn {
  speakStreamingText: (text: string, onViseme?: (visemeId: number, offset: number) => void, isComplete?: boolean) => void;
  stopSpeaking: () => void;
  isProcessingChunk: boolean;
  isAudioPlaying: boolean;
  queueLength: number;
  bufferStatus: string;
}

export function useStreamingTTSWithChunking(
  setIsAvatarTalking?: (talking: boolean) => void,
  setIsAvatarSessionActive?: (active: boolean) => void,
  onAudioChunkFinished?: (duration: number) => void,
  onAudioStartPlaying?: () => void,
  onViseme?: (visemeId: number, offset: number) => void  // 🎯 NEW: Add viseme callback parameter
): UseStreamingTTSWithChunkingReturn {
  const [isProcessingChunk, setIsProcessingChunk] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [queueUpdate, setQueueUpdate] = useState(0);
  const [bufferUpdate, setBufferUpdate] = useState(0);
  
  const { canSpeakRef, isInterruptedRef, registerStopSpeaking, resetInterruptionState } = useAudioSpeakingContext();
  
  const currentChunkIndex = useRef(0);
  const processingLock = useRef(false);
  const currentAudio = useRef<HTMLAudioElement | null>(null);
  const hasStartedProcessing = useRef(false);
  
  // Audio buffering state - 🎯 UPDATED: Now includes visemes
  const audioBuffer = useRef<Map<number, BufferedChunk>>(new Map());
  const isBuffering = useRef(false);
  const bufferLock = useRef(false);
  
  // Text chunker for buffering and dividing text into chunks
  const textChunker = useRef(new TextChunker());
  
  // Speech service instance
  const speechService = useRef(createSpeechService(
    process.env.NEXT_PUBLIC_AZURE_SPEECH_KEY || '',
    process.env.NEXT_PUBLIC_AZURE_SPEECH_REGION || '',
    'en-US-DavisNeural' // Use same voice as existing system
  ));
  
  // Store the current viseme callback
  const onVisemeRef = useRef<((visemeId: number, offset: number) => void) | null>(null);
  
  // 🎯 NEW: Set the viseme callback from parameter
  useEffect(() => {
    onVisemeRef.current = onViseme || null;
    console.log(`🔗 [StreamingTTS] Viseme callback ${onViseme ? 'registered' : 'not provided'}`);
  }, [onViseme]);
  
  // Helper to clear all audio state
  const clearAudioState = useCallback(() => {
    audioBuffer.current.clear();
    isBuffering.current = false;
    bufferLock.current = false;
    setBufferUpdate(0);
    setIsProcessingChunk(false);
    setIsAudioPlaying(false);
    currentChunkIndex.current = 0;
    processingLock.current = false;
    hasStartedProcessing.current = false;
    
    if (currentAudio.current) {
      currentAudio.current.pause();
      currentAudio.current = null;
    }
  }, []);

  // Stop audio playback and clear everything
  const stopAudio = useCallback(() => {
    console.log('[StreamingTTS] Stopping audio playback and resetting for new conversation');
    
    // Stop any ongoing speech synthesis
    try {
      speechService.current.stopSpeaking();
    } catch (error) {
      // Ignore errors if no speech is playing
    }
    
    // Clear all audio state and reset processing flag for next conversation
    clearAudioState();
    
    // Clear text chunker completely for new conversation
    textChunker.current.clear();
    setQueueUpdate(0);
    
    // Reset avatar states
    if (setIsAvatarTalking) {
      setIsAvatarTalking(false);
    }
    // CONTINUOUS CONVERSATION FIX: Keep session active for continuous conversation
    // Only end session for forced interruptions, not normal completion
    if (setIsAvatarSessionActive) {
      console.log('[StreamingTTSChunking] Audio stopped - keeping session active for continuous conversation');
      // Keep session active to allow continuous conversation without closing Deepgram connection
    }
  }, [clearAudioState, setIsAvatarTalking, setIsAvatarSessionActive]);

  // Register stop speaking function
  useEffect(() => {
    registerStopSpeaking(stopAudio);
  }, [registerStopSpeaking, stopAudio]);

  // Buffer next audio chunk while current is playing
  const bufferNextChunk = useCallback(async (chunkIndex: number) => {
    if (bufferLock.current || isBuffering.current) return;

    const nextChunk = textChunker.current.peekNextChunk();
    if (!nextChunk || audioBuffer.current.has(chunkIndex + 1)) return;

    bufferLock.current = true;
    isBuffering.current = true;
    setBufferUpdate(prev => prev + 1);

    try {
      const bufferChunkNumber = chunkIndex + 1;
      
      // 🎯 COLLECT VISEMES: Store visemes for this specific chunk instead of forwarding
      const chunkVisemes: ChunkViseme[] = [];
      
      const audioData = await speechService.current.synthesizeAudioData(
        nextChunk,
        onVisemeRef.current ? (viseme) => {
          // ✅ STORE visemes instead of forwarding immediately during buffering
          chunkVisemes.push({
            visemeId: viseme.visemeId,
            offset: viseme.audioOffset / 10000  // Convert to ms
          });
          console.log(`🎯 [StreamingTTS] STORED viseme ${viseme.visemeId} for chunk ${bufferChunkNumber} at ${viseme.audioOffset / 10000}ms`);
        } : undefined
      );
      
      // Store complete chunk data including visemes
      audioBuffer.current.set(bufferChunkNumber, {
        audioData: audioData,
        text: nextChunk,
        visemes: chunkVisemes  // 🎯 KEY: Store visemes with chunk
      });
      
      console.log(`🎯 [StreamingTTS] Buffered chunk ${bufferChunkNumber} with ${chunkVisemes.length} stored visemes`);
    } catch (error) {
      console.error(`[StreamingTTS] Buffer error for chunk ${chunkIndex + 1}:`, error);
    } finally {
      isBuffering.current = false;
      bufferLock.current = false;
      setBufferUpdate(prev => prev + 1);
    }
  }, []);

  // Sequential chunk processing with manual audio playback
  const processNextChunk = useCallback(async (caller = 'unknown') => {
    const hasTextChunks = textChunker.current.hasChunks();
    const hasBufferedChunks = audioBuffer.current.size > 0;
    
    console.log(`[StreamingTTS] processNextChunk(${caller}): hasTextChunks=${hasTextChunks}, hasBufferedChunks=${hasBufferedChunks}, isProcessingChunk=${isProcessingChunk}`);
    
    if (isProcessingChunk || (!hasTextChunks && !hasBufferedChunks) || processingLock.current) {
      console.log(`[StreamingTTS] Skipping processNextChunk: isProcessingChunk=${isProcessingChunk}, noChunksAvailable=${!hasTextChunks && !hasBufferedChunks}, processingLock=${processingLock.current}`);
      return;
    }

    // Check if we should continue speaking
    if (isInterruptedRef.current || !canSpeakRef.current) {
      console.log('[StreamingTTS] Interrupted or cannot speak, stopping');
      stopAudio();
      return;
    }

    processingLock.current = true;

    // Stop any currently playing audio
    if (currentAudio.current) {
      currentAudio.current.pause();
      currentAudio.current.src = '';
      currentAudio.current.load();
      currentAudio.current = null;
    }

    // Try to get next text chunk first
    let nextChunk = textChunker.current.getNextChunk();
    let nextChunkNumber: number = 0;
    let isBufferedChunk = false;
    
    // If no text chunk, try to get buffered audio chunk
    if (!nextChunk && audioBuffer.current.size > 0) {
      const bufferedEntry = audioBuffer.current.entries().next().value;
      if (bufferedEntry) {
        const [chunkIndex, bufferedData] = bufferedEntry;
        nextChunk = bufferedData.text;
        nextChunkNumber = chunkIndex;
        isBufferedChunk = true;
        console.log(`[StreamingTTS] Using buffered chunk ${chunkIndex}: "${nextChunk.slice(0, 50)}..."`);
      }
    }
    
    if (!nextChunk) {
      console.log('[StreamingTTS] No chunks available (text or buffered)');
      setIsProcessingChunk(false);
      processingLock.current = false;
      return;
    }

    // Set chunk number (either from text queue or buffered chunk)
    if (!isBufferedChunk) {
      nextChunkNumber = currentChunkIndex.current + 1;
    }
    currentChunkIndex.current = nextChunkNumber;
    setIsProcessingChunk(true);
    setQueueUpdate(prev => prev + 1);

    // 🎯 SCOPE FIX: Declare chunkVisemes at function level for cleanup access
    let chunkVisemes: ChunkViseme[] = [];

    try {
      let audioData: ArrayBuffer;
      
      // Check if this chunk is already buffered
      const bufferedChunk = audioBuffer.current.get(nextChunkNumber);
      
      if (bufferedChunk && bufferedChunk.text === nextChunk) {
        console.log(`✅ [StreamingTTS] Using buffered chunk ${nextChunkNumber} with ${bufferedChunk.visemes.length} stored visemes`);
        audioData = bufferedChunk.audioData;
        chunkVisemes = bufferedChunk.visemes;  // 🎯 USE STORED VISEMES
        audioBuffer.current.delete(nextChunkNumber);
        setBufferUpdate(prev => prev + 1);
      } else {
        console.log(`🔄 [StreamingTTS] Generating fresh chunk ${nextChunkNumber}: "${nextChunk.substring(0, 50)}..."`);
        
        // For non-buffered chunks, collect visemes during generation
        audioData = await speechService.current.synthesizeAudioData(
          nextChunk,
          onVisemeRef.current ? (viseme) => {
            // ✅ COLLECT visemes for fresh chunks (same as buffering logic)
            chunkVisemes.push({
              visemeId: viseme.visemeId,
              offset: viseme.audioOffset / 10000  // Convert to ms
            });
            console.log(`🎯 [StreamingTTS] COLLECTED fresh viseme ${viseme.visemeId} for chunk ${nextChunkNumber} at ${viseme.audioOffset / 10000}ms`);
          } : undefined
        );
      }
      
      // Start buffering the next chunk while this one plays
      if (textChunker.current.hasChunks()) {
        bufferNextChunk(nextChunkNumber).catch(() => {});
      }
      
      // Create and setup audio
      const audioBlob = new Blob([audioData], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      currentAudio.current = audio;
      
      // Calculate duration for callback
      const duration = audio.duration || 1;
      
      // Set up event handlers with cleanup
      const handleEnded = () => {
        URL.revokeObjectURL(audioUrl);
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('error', handleError);
        
        if (currentAudio.current === audio) {
          currentAudio.current = null;
        }
        
        setIsProcessingChunk(false);
        processingLock.current = false;
        
        // 🎯 CLEANUP: Clear viseme references to prevent memory leaks
        chunkVisemes.length = 0;
        
        // Call audio chunk finished callback
        if (onAudioChunkFinished) {
          onAudioChunkFinished(duration);
        }
        
        // Check if there are more chunks to play (both text and buffered audio)
        const hasTextChunks = textChunker.current.hasChunks();
        const hasBufferedChunks = audioBuffer.current.size > 0;
        
        console.log(`[StreamingTTS] Audio ended - checking for more chunks: hasTextChunks=${hasTextChunks}, hasBufferedChunks=${hasBufferedChunks}`);
        
        if (hasTextChunks || hasBufferedChunks) {
          console.log(`[StreamingTTS] More chunks available - continuing processing`);
          processNextChunk('ended-event');
        } else {
          // No more chunks - audio playback complete
          console.log('[StreamingTTS] All chunks processed, stopping');
          setIsAudioPlaying(false);
          if (setIsAvatarTalking) {
            setIsAvatarTalking(false);
          }
        }
      };
      
      const handleError = () => {
        URL.revokeObjectURL(audioUrl);
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('error', handleError);
        
        if (currentAudio.current === audio) {
          currentAudio.current = null;
        }
        
        // 🎯 CLEANUP: Clear viseme references on error
        chunkVisemes.length = 0;
        
        setIsProcessingChunk(false);
        setIsAudioPlaying(false);
        processingLock.current = false;
        processNextChunk('error-event');
      };
      
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('error', handleError);
      
      // 🎯 COORDINATE WITH VRMAVATAR: Set audio start time reference BEFORE sending visemes
      if (onAudioStartPlaying) {
        console.log('🎬 [StreamingTTS] Calling onAudioStartPlaying to trigger body animation');
        console.log('🎬 [StreamingTTS] Audio is about to start playing - triggering VRMAvatar body animation');
        onAudioStartPlaying();  // This sets audioStartTimeRef.current in VRMAvatar and triggers body animation
        console.log('✅ [StreamingTTS] onAudioStartPlaying callback executed successfully');
      } else {
        console.log('⚠️ [StreamingTTS] onAudioStartPlaying callback not available - body animation will not be triggered');
      }
      
      // 🎯 APPLY STORED VISEMES: Send all visemes for this chunk to VRMAvatar for scheduling
      console.log(`🎯 [StreamingTTS] Applying ${chunkVisemes.length} stored visemes for chunk ${nextChunkNumber}`);
      
      if (chunkVisemes.length > 0 && onVisemeRef.current) {
        console.log(`👄 [StreamingTTS] Sending ${chunkVisemes.length} visemes to VRMAvatar for lip sync`);
        chunkVisemes.forEach((viseme, index) => {
          console.log(`🎯 [StreamingTTS] Viseme ${index + 1}/${chunkVisemes.length}: ID=${viseme.visemeId} at ${viseme.offset}ms`);
          // VRMAvatar will use its existing timing logic with audioStartTimeRef
          onVisemeRef.current!(viseme.visemeId, viseme.offset);
        });
        console.log(`✅ [StreamingTTS] All ${chunkVisemes.length} visemes sent to VRMAvatar for chunk ${nextChunkNumber}`);
      } else if (chunkVisemes.length === 0) {
        console.log(`⚠️ [StreamingTTS] No visemes to apply for chunk ${nextChunkNumber} - check Azure TTS integration`);
      } else {
        console.log(`⚠️ [StreamingTTS] onVisemeRef not available for chunk ${nextChunkNumber} - VRMAvatar not connected`);
      }
      
      // 🎯 CRITICAL: Set avatar talking state FIRST, then start audio
      console.log('🎬 [StreamingTTS] Setting avatar talking state and starting audio playback');
      
      setIsAudioPlaying(true);
      if (setIsAvatarTalking) {
        console.log('🎬 [StreamingTTS] Calling setIsAvatarTalking(true) to trigger body animation');
        setIsAvatarTalking(true);
      } else {
        console.warn('⚠️ [StreamingTTS] setIsAvatarTalking callback not available');
      }
      
      if (setIsAvatarSessionActive) {
        console.log('🎬 [StreamingTTS] Setting avatar session active');
        setIsAvatarSessionActive(true);
      }
      
      console.log('🎬 [StreamingTTS] Starting audio playback...');
      await audio.play();
      console.log('✅ [StreamingTTS] Audio playback started successfully');
      
    } catch (error: any) {
      console.error(`[StreamingTTS] Error processing chunk:`, error);
      
      // 🎯 CLEANUP: Clear viseme references on exception
      chunkVisemes.length = 0;
      
      setIsProcessingChunk(false);
      processingLock.current = false;
      processNextChunk('catch-block');
    }
  }, [isProcessingChunk, canSpeakRef, isInterruptedRef, stopAudio, bufferNextChunk, onAudioChunkFinished, onAudioStartPlaying, setIsAvatarTalking, setIsAvatarSessionActive]);

  // 🎯 FIX: Use ref to avoid infinite re-renders in useEffect
  const processNextChunkRef = useRef(processNextChunk);
  processNextChunkRef.current = processNextChunk;

  // Start the first chunk when available - SIMPLIFIED to avoid infinite loops
  useEffect(() => {
    const hasChunks = textChunker.current.hasChunks();
    const queueLength = textChunker.current.getQueueLength();
    
    console.log(`[StreamingTTS] useEffect check: hasChunks=${hasChunks}, queueLength=${queueLength}, hasStartedProcessing=${hasStartedProcessing.current}, isProcessingChunk=${isProcessingChunk}`);
    
    if (hasChunks && !hasStartedProcessing.current && !isProcessingChunk) {
      console.log(`[StreamingTTS] ✅ Starting chunk processing - ${queueLength} chunks in queue`);
      hasStartedProcessing.current = true;
      processNextChunkRef.current('useEffect');
    }
  }, [queueUpdate, isProcessingChunk]);

  // Main function to speak streaming text
  // 🎯 FIX: Track conversation reset needs without causing render loop
  const needsConversationReset = useRef(false);
  
  const speakStreamingText = useCallback((text: string, onViseme?: (visemeId: number, offset: number) => void, isComplete: boolean = false) => {
    console.log('[StreamingTTS] Received text for streaming TTS, length:', text.length);
    console.log('[StreamingTTS] 🔍 Interruption state check: isInterruptedRef.current =', isInterruptedRef.current);
    
    // 🎯 FIX: Don't reset interruption state if user manually interrupted (peter stop)
    if (isInterruptedRef.current) {
      console.log('[StreamingTTS] 🛑 User manually interrupted - not starting TTS (this should be cleared for new queries)');
      return; // Don't start TTS if user said "peter stop"
    }
    
    console.log('[StreamingTTS] ✅ No interruption detected - proceeding with TTS');
    
    // Store the viseme callback
    onVisemeRef.current = onViseme || null;
    
    // Reset interruption state only if not manually interrupted
    resetInterruptionState();
    
    // 🎯 FIX: Mark need for reset instead of doing it during render
    // Only reset if we have leftover data from a previous conversation, not for fresh conversations
    if (!hasStartedProcessing.current && textChunker.current.getProcessedLength() === 0 && textChunker.current.getQueueLength() > 0) {
      console.log('[StreamingTTS] Starting new conversation with leftover data - marking for state reset');
      needsConversationReset.current = true;
    } else if (!hasStartedProcessing.current && textChunker.current.getProcessedLength() === 0) {
      console.log('[StreamingTTS] Starting fresh new conversation - no reset needed');
    }
    
    // Add text to chunker
    textChunker.current.addText(text);
    
    // If this is the complete response, flush any remaining buffer content
    if (isComplete) {
      console.log('[StreamingTTS] Response complete - flushing remaining buffer content');
      textChunker.current.flush();
    }
    
    // 🎯 FIX: Use safe state update to trigger processing without infinite loop
    console.log('[StreamingTTS] Triggering chunk processing safely');
    
    // Use a separate trigger mechanism that doesn't cause infinite loops
    setTimeout(() => {
      setQueueUpdate(prev => prev + 1);
    }, 0);
  }, []); // 🎯 STABLE: No dependencies to avoid infinite loop
  
  // 🎯 FIX: Handle conversation reset in useEffect to avoid render loop
  useEffect(() => {
    if (needsConversationReset.current) {
      console.log('[StreamingTTS] Executing conversation reset in useEffect');
      clearAudioState();
      textChunker.current.clear();
      needsConversationReset.current = false;
    }
  }, [clearAudioState]);
  
  // 🎯 REMOVED: Complex ref-based queue update system replaced with direct state update above

  // Get buffer status for debugging
  const getBufferStatus = useCallback(() => {
    return `Queue: ${textChunker.current.getQueueLength()} chunks, Buffer: ${textChunker.current.getBuffer().length} chars, Audio Buffer: ${audioBuffer.current.size} chunks`;
  }, [bufferUpdate, queueUpdate]);

  return {
    speakStreamingText,
    stopSpeaking: stopAudio,
    isProcessingChunk,
    isAudioPlaying,
    queueLength: textChunker.current.getQueueLength(),
    bufferStatus: getBufferStatus()
  };
}
