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
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-2 md:space-y-4">
        {conversationHistory.length === 0 && !currentAiResponse ? (
          <div className="text-center text-gray-500 text-xs md:text-sm">
            No messages yet
          </div>
        ) : (
          <>
            {conversationHistory.map((pair: ConversationPair) => {
              const aiText = pair.ai ?? "";
              const collapsed = isCollapsed(pair.id, aiText);
              const shouldTruncate = aiText.length > TOGGLE_THRESHOLD;
              const displayText = collapsed && shouldTruncate ? aiText.slice(0, TOGGLE_THRESHOLD) + "…" : aiText;
              return (
                <div key={pair.id} className="space-y-1 md:space-y-2">
                  {/* User message */}
                  <div className="flex justify-end">
                    <div className="bg-blue-500 text-white rounded-lg py-1.5 md:py-2 px-2 md:px-4 max-w-[85%] md:max-w-[80%] text-xs md:text-sm">
                      {pair.user}
                    </div>
                  </div>
                  {/* AI response */}
                  {pair.ai ? (
                    <div className="flex justify-start">
                      <div className="bg-gray-200 text-gray-800 rounded-lg py-1.5 md:py-2 px-2 md:px-4 max-w-[85%] md:max-w-[80%] text-xs md:text-sm">
                        <div>{displayText}</div>
                        {shouldTruncate && (
                          <button
                            type="button"
                            className="mt-1 text-blue-600 hover:underline text-[11px] md:text-xs"
                            onClick={() => toggle(pair.id)}
                            aria-expanded={!collapsed}
                            aria-controls={`ai-msg-${pair.id}`}
                          >
                            {collapsed ? "Show more" : "Show less"}
                          </button>
                        )}
                      </div>
                    </div>
                  ) : pair === lastPendingPair && isProcessingResponse ? (
                    <div className="flex justify-start">
                      <div className="bg-gray-200 text-gray-800 rounded-lg py-1.5 md:py-2 px-2 md:px-4 max-w-[85%] md:max-w-[80%] animate-pulse text-xs md:text-sm">
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