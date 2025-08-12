import React, { useRef, useEffect } from "react";
import { useAudioContext, type ConversationPair } from "../logic/AudioProvider";

// Audio-specific message history component
export const AudioMessageHistory = () => {
  const { conversationHistory, currentAiResponse, isProcessingResponse } = useAudioContext();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Add logging to debug message history
  console.log('[AudioMessageHistory] Render - conversationHistory length:', conversationHistory.length);
  console.log('[AudioMessageHistory] Render - currentAiResponse length:', currentAiResponse?.length || 0);
  console.log('[AudioMessageHistory] Render - isProcessingResponse:', isProcessingResponse);
  if (conversationHistory.length > 0) {
    console.log('[AudioMessageHistory] Render - last conversation pair:', conversationHistory[conversationHistory.length - 1]);
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversationHistory, currentAiResponse]);

  // Find the last conversation pair that's waiting for an AI response
  const lastPendingPair = React.useMemo(() => {
    const pending = conversationHistory.find((pair: ConversationPair) => !pair.ai);
    console.log('[AudioMessageHistory] lastPendingPair:', pending);
    return pending;
  }, [conversationHistory]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {conversationHistory.length === 0 && !currentAiResponse ? (
          <div className="text-center text-gray-500">
            No messages yet
          </div>
        ) : (
          <>
            {conversationHistory.map((pair: ConversationPair) => {
              return (
                <div key={pair.id} className="space-y-2">
                  {/* User message */}
                  <div className="flex justify-end">
                    <div className="bg-blue-500 text-white rounded-lg py-2 px-4 max-w-[80%]">
                      {pair.user}
                    </div>
                  </div>
                  {/* AI response */}
                  {pair.ai ? (
                    <div className="flex justify-start">
                      <div className="bg-gray-200 text-gray-800 rounded-lg py-2 px-4 max-w-[80%]">
                        {pair.ai}
                      </div>
                    </div>
                  ) : pair === lastPendingPair && isProcessingResponse ? (
                    <div className="flex justify-start">
                      <div className="bg-gray-200 text-gray-800 rounded-lg py-2 px-4 max-w-[80%] animate-pulse">
                        {currentAiResponse || "Thinking..."}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
    </div>
  );
}; 