import React, { useState, useRef, useCallback } from "react";
import { useAudioTextChat, useAudioRagIntegration } from "../logic/audio";
import { useAudioContext } from "../logic/AudioProvider";
import { handleValidatedInput } from '../lib/input-validation';

// Audio-specific text input component
export const AudioTextInput = ({ onMessageSent }: { onMessageSent?: () => void }) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [validationWarning, setValidationWarning] = useState('');
  const { sendMessage } = useAudioTextChat();
  const { isAvatarTalking, isProcessingResponse, stopSpeaking, isAvatarSessionActive, initializeAudioContext } = useAudioContext();
  const { requestAudioInterruption } = useAudioRagIntegration();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check if text exceeds limits
  const checkLimits = (text: string) => {
    const charCount = text.length;
    return {
      charCount,
      exceedsCharLimit: charCount > 700,
      exceedsAnyLimit: charCount > 700
    };
  };

  // Trim text to fit within limits
  const trimToLimits = useCallback((text: string) => {
    const limits = checkLimits(text);
    
    if (!limits.exceedsAnyLimit) {
      return text;
    }
    
    // If character limit is exceeded, trim by characters
    if (limits.exceedsCharLimit) {
      text = text.substring(0, 700);
    }
    
    return text;
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (isAvatarTalking) {
        // Stop the TTS audio
        if (stopSpeaking) {
          stopSpeaking();
        }
        // Also request interruption to stop any ongoing RAG processing
        requestAudioInterruption();
        setIsSending(false);
        return;
      }
      if (!message.trim() || isSending || isProcessingResponse) return;
      setIsSending(true);
      setMessage("");
      if (onMessageSent) onMessageSent();
      try {
        // Initialize audio context on user interaction before sending message
        console.log('[AudioTextInput] Initializing audio context on user interaction...');
        await initializeAudioContext();
        
        await sendMessage(message);
      } catch (error) {
        console.error('[AudioTextInput] Error sending message:', error);
      } finally {
        setIsSending(false);
      }
    },
    [message, sendMessage, isSending, isAvatarTalking, isProcessingResponse, stopSpeaking, requestAudioInterruption, onMessageSent, initializeAudioContext]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
      }
    },
    [handleSubmit]
  );

  const handleStopAudio = () => {
    if (stopSpeaking) {
      stopSpeaking(true); // Use forceStop to immediately clear all queued audio
    }
    requestAudioInterruption();
  };

  const handleStopButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleStopAudio();
  };

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    handleValidatedInput(
      value,
      (validatedText) => {
        const trimmedText = trimToLimits(validatedText);
        setMessage(trimmedText);
      },
      (warning) => {
        setValidationWarning(warning);
        // Clear warning after 3 seconds
        setTimeout(() => setValidationWarning(''), 3000);
      }
    );
  }, [trimToLimits]);

  const isDisabled = isSending || isAvatarTalking || isProcessingResponse;
  const isStopButtonDisabled = false; // Stop button should always be enabled when visible

  return (
    <div className="w-full flex justify-center">
      <div className="w-full max-w-2xl">
        <form onSubmit={handleSubmit} className="flex gap-2 w-full">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder={
                isProcessingResponse ? "Processing response..." : 
                isAvatarTalking ? "Waiting for response to complete..." : 
                "Type your message (max 700 chars)..."
              }
              disabled={isDisabled}
              className="w-full px-4 py-2 rounded-lg bg-white text-black border border-zinc-200 focus:outline-none focus:border-blue-500"
              rows={3}
            />
            <div className="flex justify-between items-center text-xs mt-1">
              <span className="text-gray-500">
                Max-limit: 700 characters
              </span>
              <span 
                className={`font-medium ${
                  message.length > 700 
                    ? message.length === 700
                      ? 'text-red-600' 
                      : 'text-amber-600'
                    : 'text-gray-600'
                }`}
              >
                {message.length}/700c
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {isAvatarTalking && isAvatarSessionActive ? (
              <button
                type="button"
                onClick={handleStopButtonClick}
                disabled={isStopButtonDisabled}
                className="bg-red-500 hover:bg-red-600 transition-colors text-white text-sm px-6 py-2 rounded-lg h-fit cursor-pointer"
                style={{ pointerEvents: 'auto' }}
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={isDisabled}
                className="bg-black hover:bg-gray-800 disabled:opacity-50 text-white text-sm px-6 py-2 rounded-lg h-fit"
              >
                Send
              </button>
            )}
          </div>
        </form>
        {/* Validation message with dedicated space */}
        <div className="mt-2 min-h-[20px] flex justify-start">
          {validationWarning && (
            <div className="text-xs text-red-600 bg-red-50 px-3 py-1 rounded border border-red-200 shadow-sm z-50 relative">
              <div className="flex items-center gap-1">
                <span className="text-red-500">⚠</span>
                {validationWarning}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 