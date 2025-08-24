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
    <div className="h-full flex flex-col bg-gradient-to-b from-gray-50 to-white">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        {conversationHistory.length === 0 && !currentAiResponse ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">💭</span>
            </div>
            <p className="text-gray-600 font-medium">No conversation yet</p>
            <p className="text-gray-500 text-sm mt-1">Start talking to begin your chat</p>
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
                    <div className="group relative">
                      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl rounded-tr-md py-3 px-4 max-w-xs lg:max-w-sm shadow-sm">
                        <p className="text-sm leading-relaxed">{pair.user}</p>
                      </div>
                      <div className="flex justify-end mt-1">
                        <span className="text-xs text-gray-400">You</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* AI response */}
                  {pair.ai ? (
                    <div className="flex justify-start">
                      <div className="group relative">
                        <div className="flex items-start space-x-2">
                          <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center shadow-sm">
                            <span className="text-white text-sm">🤖</span>
                          </div>
                          <div className="bg-white border border-gray-200 text-gray-800 rounded-2xl rounded-tl-md py-3 px-4 max-w-xs lg:max-w-sm shadow-sm">
                            <p className="text-sm leading-relaxed">{displayText}</p>
                            {shouldTruncate && (
                              <button
                                type="button"
                                className="mt-2 text-blue-600 hover:text-blue-700 text-xs font-medium hover:underline transition-colors"
                                onClick={() => toggle(pair.id)}
                                aria-expanded={!collapsed}
                                aria-controls={`ai-msg-${pair.id}`}
                              >
                                {collapsed ? "Show more" : "Show less"}
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-start ml-10 mt-1">
                          <span className="text-xs text-gray-400">Assistant</span>
                        </div>
                      </div>
                    </div>
                  ) : pair === lastPendingPair && isProcessingResponse ? (
                    <div className="flex justify-start">
                      <div className="group relative">
                        <div className="flex items-start space-x-2">
                          <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center shadow-sm">
                            <span className="text-white text-sm animate-pulse">🤖</span>
                          </div>
                          <div className="bg-white border border-gray-200 text-gray-800 rounded-2xl rounded-tl-md py-3 px-4 max-w-xs lg:max-w-sm shadow-sm">
                            <div className="flex items-center space-x-2">
                              {currentAiResponse ? (
                                <p className="text-sm leading-relaxed">{currentAiResponse}</p>
                              ) : (
                                <>
                                  <div className="flex space-x-1">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                  </div>
                                  <span className="text-sm text-gray-600">Thinking...</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-start ml-10 mt-1">
                          <span className="text-xs text-gray-400">Assistant</span>
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