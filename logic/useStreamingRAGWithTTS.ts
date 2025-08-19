import { useCallback, useRef, useState } from 'react';
import { useStreamingRAG } from './useStreamingRAG';
import { useAudioContext } from './AudioProvider';
import { SentenceDetector, TTSQueueManager } from '../lib/sentenceDetector';

export interface UseStreamingRAGWithTTSReturn {
  sendMessage: (message: string, history?: any[]) => Promise<void>;
  stopStreaming: () => void;
  isStreaming: boolean;
  currentResponse: string;
  error: string | null;
  isSpeaking: boolean;
}

export function useStreamingRAGWithTTS(): UseStreamingRAGWithTTSReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // Get audio context functions
  const { 
    speakText, 
    stopSpeaking,
    appendToCurrentAiResponse,
    finalizeCurrentAiResponse,
    setIsProcessingResponse,
    setIsAvatarTalking,
    setIsAvatarSessionActive
  } = useAudioContext();
  
  // Create refs for sentence detector and TTS queue
  const sentenceDetectorRef = useRef<SentenceDetector | null>(null);
  const ttsQueueRef = useRef<TTSQueueManager | null>(null);
  
  // Initialize sentence detector and TTS queue
  const initializeDetectors = useCallback(() => {
    if (!sentenceDetectorRef.current) {
      sentenceDetectorRef.current = new SentenceDetector();
    }
    
    if (!ttsQueueRef.current) {
      ttsQueueRef.current = new TTSQueueManager(
        // TTS callback for each sentence
        async (sentence: string) => {
          console.log('[StreamingRAGWithTTS] 🎤 Starting TTS for sentence');
          try {
            await speakText(sentence, false, true); // false = not welcome message, true = sequential
            console.log('[StreamingRAGWithTTS] ✅ TTS sentence completed');
          } catch (error) {
            console.error('[StreamingRAGWithTTS] ❌ TTS sentence failed:', error);
          }
        },
        // Session start callback - start avatar animation
        () => {
          console.log('[StreamingRAGWithTTS] 🎬 TTS session started - enabling avatar animation');
          setIsSpeaking(true);
          if (setIsAvatarTalking) {
            setIsAvatarTalking(true);
          }
          if (setIsAvatarSessionActive) {
            setIsAvatarSessionActive(true);
          }
        },
        // Session end callback - stop avatar animation
        () => {
          console.log('[StreamingRAGWithTTS] 🎬 TTS session ended - disabling avatar animation');
          setIsSpeaking(false);
          if (setIsAvatarTalking) {
            setIsAvatarTalking(false);
          }
          if (setIsAvatarSessionActive) {
            setIsAvatarSessionActive(false);
          }
        }
      );
    }
  }, [speakText, setIsAvatarTalking, setIsAvatarSessionActive, setIsSpeaking]);
  
  // Handle RAG response chunks
  const handleResponseChunk = useCallback((chunk: string) => {
    console.log('[StreamingRAGWithTTS] Received chunk:', chunk);
    
    // Append to current AI response in UI
    appendToCurrentAiResponse(chunk);
    
    // Initialize detectors if needed
    initializeDetectors();
    
    // Add chunk to sentence detector
    const completeSentences = sentenceDetectorRef.current!.addChunk(chunk);
    
    // Queue complete sentences for TTS
    completeSentences.forEach(sentence => {
      console.log('[StreamingRAGWithTTS] Complete sentence detected:', sentence);
      ttsQueueRef.current!.addToQueue(sentence);
    });
  }, [appendToCurrentAiResponse, initializeDetectors]);
  
  // Handle response completion
  const handleResponseComplete = useCallback((fullResponse: string) => {
    console.log('[StreamingRAGWithTTS] Response complete');
    
    // Get any remaining text from sentence detector
    const remaining = sentenceDetectorRef.current?.flush();
    if (remaining) {
      console.log('[StreamingRAGWithTTS] Flushing remaining text:', remaining);
      ttsQueueRef.current?.addToQueue(remaining);
    }
    
    // Finalize the response in the UI
    finalizeCurrentAiResponse();
    setIsProcessingResponse(false);
  }, [finalizeCurrentAiResponse, setIsProcessingResponse]);
  
  // Handle errors
  const handleError = useCallback((error: string) => {
    console.error('[StreamingRAGWithTTS] Error:', error);
    
    // Stop TTS queue
    ttsQueueRef.current?.stop();
    
    // Reset detectors
    sentenceDetectorRef.current?.reset();
    
    setIsProcessingResponse(false);
  }, [setIsProcessingResponse]);
  
  // Use the streaming RAG hook with our handlers
  const {
    sendMessage: sendRAGMessage,
    stopStreaming: stopRAGStreaming,
    isStreaming,
    currentResponse,
    error
  } = useStreamingRAG(
    handleResponseChunk,
    handleResponseComplete,
    handleError
  );
  
  // Enhanced send message function
  const sendMessage = useCallback(async (message: string, history?: any[]) => {
    console.log('[StreamingRAGWithTTS] Sending message:', message);
    
    // Initialize detectors
    initializeDetectors();
    
    // Reset detectors for new message
    sentenceDetectorRef.current!.reset();
    ttsQueueRef.current!.reset();
    
    // Set processing state
    setIsProcessingResponse(true);
    
    // Send message to RAG
    await sendRAGMessage(message, history);
  }, [sendRAGMessage, initializeDetectors, setIsProcessingResponse]);
  
  // Enhanced stop function
  const stopStreaming = useCallback(() => {
    console.log('[StreamingRAGWithTTS] Stopping streaming and TTS');
    
    // Stop RAG streaming
    stopRAGStreaming();
    
    // Stop TTS
    stopSpeaking();
    ttsQueueRef.current?.stop();
    
    // Reset detectors
    sentenceDetectorRef.current?.reset();
    
    setIsSpeaking(false);
    setIsProcessingResponse(false);
  }, [stopRAGStreaming, stopSpeaking, setIsProcessingResponse]);
  
  return {
    sendMessage,
    stopStreaming,
    isStreaming,
    currentResponse,
    error,
    isSpeaking
  };
}
