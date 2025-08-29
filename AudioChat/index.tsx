import React from "react";
import { AudioSpeakingProvider, AudioChatProvider } from "../logic/audio";
import { AudioProvider } from "../logic/AudioProvider";
import { AudioChatWithAvatar } from "./AudioChatWithAvatar";
import { VoicePreviewManager } from "../components/VoicePreviewManager";

export default function AudioChatWrapper() {
  return (
    <AudioSpeakingProvider>
      <AudioChatProvider>
        <AudioProvider>
          <VoicePreviewManager>
            <AudioChatWithAvatar />
          </VoicePreviewManager>
        </AudioProvider>
      </AudioChatProvider>
    </AudioSpeakingProvider>
  );
} 