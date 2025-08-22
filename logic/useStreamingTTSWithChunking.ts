import { useState, useRef, useEffect, useCallback } from 'react';
import { TextChunker } from '../lib/text-chunker';
import { createSpeechService } from '../lib/azure-speech-streaming';
import { useAudioSpeakingContext } from './useAudioSpeakingContext';

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
  onAudioStartPlaying?: () => void
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
  
  // Audio buffering state
  const audioBuffer = useRef<Map<number, { audioData: ArrayBuffer; text: string }>>(new Map());
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
      const audioData = await speechService.current.synthesizeAudioData(
        nextChunk,
        onVisemeRef.current ? (viseme) => {
          // Forward viseme events with proper timing
          if (onVisemeRef.current) {
            onVisemeRef.current(viseme.visemeId, viseme.audioOffset / 10000); // Convert to ms
          }
        } : undefined
      );
      
      audioBuffer.current.set(bufferChunkNumber, {
        audioData: audioData,
        text: nextChunk
      });
      
      console.log(`[StreamingTTS] Buffered chunk ${bufferChunkNumber}`);
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
    if (isProcessingChunk || !textChunker.current.hasChunks() || processingLock.current) {
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

    const nextChunk = textChunker.current.getNextChunk();
    if (!nextChunk) {
      setIsProcessingChunk(false);
      processingLock.current = false;
      return;
    }

    const nextChunkNumber = currentChunkIndex.current + 1;
    currentChunkIndex.current = nextChunkNumber;
    setIsProcessingChunk(true);
    setQueueUpdate(prev => prev + 1);

    try {
      let audioData: ArrayBuffer;
      
      // Check if this chunk is already buffered
      const bufferedChunk = audioBuffer.current.get(nextChunkNumber);
      
      if (bufferedChunk && bufferedChunk.text === nextChunk) {
        console.log(`[StreamingTTS] Using buffered chunk ${nextChunkNumber}`);
        audioData = bufferedChunk.audioData;
        audioBuffer.current.delete(nextChunkNumber);
        setBufferUpdate(prev => prev + 1);
      } else {
        console.log(`[StreamingTTS] Synthesizing chunk ${nextChunkNumber}: "${nextChunk.substring(0, 50)}..."`);
        audioData = await speechService.current.synthesizeAudioData(
          nextChunk,
          onVisemeRef.current ? (viseme) => {
            // Forward viseme events with proper timing
            if (onVisemeRef.current) {
              onVisemeRef.current(viseme.visemeId, viseme.audioOffset / 10000); // Convert to ms
            }
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
        
        // Call audio chunk finished callback
        if (onAudioChunkFinished) {
          onAudioChunkFinished(duration);
        }
        
        // Check if there are more chunks to play
        if (textChunker.current.hasChunks()) {
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
        
        setIsProcessingChunk(false);
        setIsAudioPlaying(false);
        processingLock.current = false;
        processNextChunk('error-event');
      };
      
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('error', handleError);
      
      // Notify that audio is starting
      if (onAudioStartPlaying) {
        onAudioStartPlaying();
      }
      
      // Audio starts playing
      setIsAudioPlaying(true);
      if (setIsAvatarTalking) {
        setIsAvatarTalking(true);
      }
      if (setIsAvatarSessionActive) {
        setIsAvatarSessionActive(true);
      }
      
      await audio.play();
      
    } catch (error: any) {
      console.error(`[StreamingTTS] Error processing chunk:`, error);
      setIsProcessingChunk(false);
      processingLock.current = false;
      processNextChunk('catch-block');
    }
  }, [isProcessingChunk, canSpeakRef, isInterruptedRef, stopAudio, bufferNextChunk, onAudioChunkFinished, onAudioStartPlaying, setIsAvatarTalking, setIsAvatarSessionActive]);

  // Start the first chunk when available
  useEffect(() => {
    const hasChunks = textChunker.current.hasChunks();
    const queueLength = textChunker.current.getQueueLength();
    
    console.log(`[StreamingTTS] useEffect check: hasChunks=${hasChunks}, queueLength=${queueLength}, hasStartedProcessing=${hasStartedProcessing.current}, isProcessingChunk=${isProcessingChunk}`);
    
    if (hasChunks && !hasStartedProcessing.current && !isProcessingChunk) {
      console.log(`[StreamingTTS] Starting chunk processing - ${queueLength} chunks in queue`);
      hasStartedProcessing.current = true;
      processNextChunk('useEffect');
    }
  }, [queueUpdate, isProcessingChunk, processNextChunk]);

  // Main function to speak streaming text
  const speakStreamingText = useCallback((text: string, onViseme?: (visemeId: number, offset: number) => void, isComplete: boolean = false) => {
    console.log('[StreamingTTS] Received text for streaming TTS');
    
    // Store the viseme callback
    onVisemeRef.current = onViseme || null;
    
    // Reset interruption state
    resetInterruptionState();
    
    // Only clear state if we're truly starting a new conversation (no existing text buffer)
    // This prevents clearing chunks that were just added for the current response
    if (!hasStartedProcessing.current && textChunker.current.getProcessedLength() === 0) {
      console.log('[StreamingTTS] Starting new conversation - clearing state');
      clearAudioState();
      textChunker.current.clear();
    }
    
    // Add text to chunker
    textChunker.current.addText(text);
    
    // If this is the complete response, flush any remaining buffer content
    if (isComplete) {
      console.log('[StreamingTTS] Response complete - flushing remaining buffer content');
      textChunker.current.flush();
    }
    
    setQueueUpdate(prev => prev + 1);
  }, [clearAudioState, resetInterruptionState]);

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
