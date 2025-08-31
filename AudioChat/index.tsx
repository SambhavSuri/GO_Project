'use client'
import React from "react";
import { AudioSpeakingProvider, AudioChatProvider } from "../logic/audio";
import { AudioProvider } from "../logic/AudioProvider";
import { AudioChatWithAvatar } from "./AudioChatWithAvatar";

export default function AudioChatWrapper() {
  return (
    <AudioSpeakingProvider>
      <AudioChatProvider>
        <AudioProvider>
          <AudioChatWithAvatar />
        </AudioProvider>
      </AudioChatProvider>
    </AudioSpeakingProvider>
  );
} 