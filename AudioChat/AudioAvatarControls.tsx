import React, { useState, useEffect } from "react";
import { useAudioContext } from "../logic/AudioProvider";
import { AudioTextInput } from "./AudioTextInput";
import { AudioVoiceChatControls } from "./AudioVoiceChatControls";
import { WebSearchToggle } from "../components/WebSearchToggle";

// Audio-specific avatar controls with tabs
export const AudioAvatarControls = () => {
  const [activeTab, setActiveTab] = useState<'text' | 'voice'>('text');
  const { isAvatarTalking, isProcessingResponse } = useAudioContext();
  const [isSending, setIsSending] = useState(false);

  const handleMessageSent = () => {
    setIsSending(true);
  };

  const handleAvatarStopTalking = () => {
    setIsSending(false);
  };

  // Listen for avatar stop talking event
  useEffect(() => {
    if (!isAvatarTalking) {
      handleAvatarStopTalking();
    }
  }, [isAvatarTalking]);

  // Check if switching should be disabled
  const isSwitchDisabled = isSending || isAvatarTalking || isProcessingResponse;

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border border-gray-300 bg-white p-1">
          <button
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'text'
                ? 'bg-black text-white'
                : 'text-zinc-400 hover:text-white hover:bg-gray-800'
            }`}
            onClick={() => setActiveTab('text')}
            disabled={isSwitchDisabled}
            title={isSwitchDisabled ? "Please wait for current conversation to finish" : "Switch to text chat"}
          >
            Text Chat
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'voice'
                ? 'bg-black text-white'
                : 'text-zinc-400 hover:text-white hover:bg-gray-800'
            }`}
            onClick={() => setActiveTab('voice')}
            disabled={isSwitchDisabled}
            title={isSwitchDisabled ? "Please wait for current conversation to finish" : "Switch to voice chat"}
          >
            Voice Chat
          </button>
        </div>
      </div>
      
      {/* Web Search Toggle */}
      <div className="flex justify-center">
        <WebSearchToggle disabled={isSwitchDisabled} />
      </div>
      
      {activeTab === 'text' ? (
        <AudioTextInput onMessageSent={handleMessageSent} />
      ) : (
        <AudioVoiceChatControls />
      )}
    </div>
  );
}; 