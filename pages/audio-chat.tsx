'use client'
import React from 'react';
import AudioChatWrapper from '../AudioChat';
import { WebSearchProvider } from '../logic/WebSearchContext';

export default function AudioChatPage() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl">
        <h1 className="text-3xl font-bold text-center mb-6">Deepgram Audio Chat</h1>
        <WebSearchProvider>
          <AudioChatWrapper />
        </WebSearchProvider>
      </div>
    </div>
  );
}