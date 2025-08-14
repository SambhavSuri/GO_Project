import React, { useState, useEffect } from "react";
import { useAudioContext } from "../logic/AudioProvider";
import { AudioVoiceChatControls } from "./AudioVoiceChatControls";
import { WebSearchToggle } from "../components/WebSearchToggle";

// Audio-specific avatar controls - voice chat only
export const AudioAvatarControls = () => {
  const { isAvatarTalking, isProcessingResponse } = useAudioContext();
  const [isSending, setIsSending] = useState(false);

  const handleAvatarStopTalking = () => {
    setIsSending(false);
  };

  // Listen for avatar stop talking event
  useEffect(() => {
    if (!isAvatarTalking) {
      handleAvatarStopTalking();
    }
  }, [isAvatarTalking]);

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Web Search Toggle */}
      {/* <div className="flex justify-center">
        <WebSearchToggle disabled={isProcessingResponse || isAvatarTalking} />
      </div> */}
      
      <AudioVoiceChatControls />
    </div>
  );
};