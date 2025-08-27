import React, { useRef, useEffect } from "react";
import { useAudioContext, type ConversationPair } from "../logic/AudioProvider";

// Audio-specific message history component
export const AudioMessageHistory = () => {
  const { conversationHistory, currentAiResponse, isProcessingResponse } = useAudioContext();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversationHistory, currentAiResponse]);

  // Find the last conversation pair that's waiting for an AI response
  const lastPendingPair = React.useMemo(() => {
    const pending = conversationHistory.find((pair: ConversationPair) => !pair.ai);
    return pending;
  }, [conversationHistory]);

  // Collapsible state per message id (default collapsed for long messages)
  const [collapsedMap, setCollapsedMap] = React.useState<Record<string, boolean>>({});
  const TOGGLE_THRESHOLD = 220;
  const isCollapsed = (id: string, content: string) => {
    const v = collapsedMap[id];
    if (typeof v === 'boolean') return v;
    return content.length > TOGGLE_THRESHOLD; // default collapsed if long
  };
  const toggle = (id: string) => {
    setCollapsedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-gray-50/30 to-white">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        {conversationHistory.length === 0 && !currentAiResponse ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center mb-4">
              <span className="text-xl">💬</span>
            </div>
            <p className="text-gray-500 text-sm font-medium">No messages yet</p>
            <p className="text-gray-400 text-xs mt-1">Start a conversation to see your chat history</p>
          </div>
        ) : (
          <>
            {conversationHistory.map((pair: ConversationPair) => {
              const aiText = pair.ai ?? "";
              const collapsed = isCollapsed(pair.id, aiText);
              const shouldTruncate = aiText.length > TOGGLE_THRESHOLD;
              const displayText = collapsed && shouldTruncate ? aiText.slice(0, TOGGLE_THRESHOLD) + "…" : aiText;
              return (
                <div key={pair.id} className="space-y-3">
                  {/* User message */}
                  <div className="flex justify-end">
                    <div className="relative group">
                      <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl rounded-br-md py-3 px-4 max-w-[280px] shadow-sm">
                        <div className="text-sm leading-relaxed">{pair.user}</div>
                      </div>
                      <div className="flex items-center justify-end mt-1 space-x-2">
                        <span className="text-xs text-gray-400 font-medium">You</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* AI response */}
                  {pair.ai ? (
                    <div className="flex justify-start">
                      <div className="relative group max-w-[280px]">
                        <div className="flex items-center space-x-2 mb-2">
                          <div className="w-6 h-6 bg-gradient-to-br from-purple-100 to-purple-200 rounded-full flex items-center justify-center">
                            <span className="text-xs">🤖</span>
                          </div>
                          <span className="text-xs text-gray-500 font-medium">Assistant</span>
                        </div>
                        <div className="bg-white border border-gray-200 text-gray-800 rounded-2xl rounded-bl-md py-3 px-4 shadow-sm">
                          <div className="text-sm leading-relaxed">{displayText}</div>
                          {shouldTruncate && (
                            <button
                              type="button"
                              className="mt-2 text-blue-600 hover:text-blue-700 hover:underline text-xs font-medium transition-colors"
                              onClick={() => toggle(pair.id)}
                              aria-expanded={!collapsed}
                              aria-controls={`ai-msg-${pair.id}`}
                            >
                              {collapsed ? "Show more ↓" : "Show less ↑"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : pair === lastPendingPair && isProcessingResponse ? (
                    <div className="flex justify-start">
                      <div className="relative group max-w-[280px]">
                        <div className="flex items-center space-x-2 mb-2">
                          <div className="w-6 h-6 bg-gradient-to-br from-purple-100 to-purple-200 rounded-full flex items-center justify-center">
                            <span className="text-xs">🤖</span>
                          </div>
                          <span className="text-xs text-gray-500 font-medium">Assistant</span>
                        </div>
                        <div className="bg-white border border-gray-200 text-gray-800 rounded-2xl rounded-bl-md py-3 px-4 shadow-sm">
                          <div className="flex items-center space-x-2">
                            <div className="flex space-x-1">
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                            </div>
                            <span className="text-sm text-gray-600">
                              {currentAiResponse || "Thinking..."}
                            </span>
                          </div>
                        </div>
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