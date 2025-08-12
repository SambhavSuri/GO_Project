import React from "react";
import { useAudioContext } from "./AudioProvider";
import { useAudioRagIntegration } from "./useAudioRagIntegration";

// Custom text chat for audio mode that reuses existing logic
export const useAudioTextChat = () => {
  const { addUserMessage } = useAudioContext();
  const { fetchRagResponse } = useAudioRagIntegration();

  const sendMessage = React.useCallback(
    async (message: string) => {
      try {
        console.log('[AudioTextChat] Sending message:', message);
        addUserMessage(message);
        await fetchRagResponse(message);
      } catch (error) {
        console.error('Error in audio RAG integration:', error);
      }
    },
    [addUserMessage, fetchRagResponse],
  );

  return { sendMessage };
}; 