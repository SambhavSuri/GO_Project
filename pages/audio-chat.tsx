import React from 'react';
import AudioChatWrapper from '../AudioChat';
import { WebSearchProvider } from '../logic/WebSearchContext';

export default function AudioChatPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Looking Glass Project
                </h1>
              </div>
              <div className="hidden md:block">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-gray-600">AI Avatar Assistant</span>
                </div>
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                Powered by Azure & Deepgram
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 h-[calc(100vh-4rem)]">
        <WebSearchProvider>
          <AudioChatWrapper />
        </WebSearchProvider>
      </main>
    </div>
  );
}