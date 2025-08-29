import React from 'react';
import AudioChatWrapper from '../AudioChat';
import { WebSearchProvider } from '../logic/WebSearchContext';
import { VoiceProvider } from '../logic/VoiceContext';
import VoiceDropdown from '../components/VoiceDropdown';
import VoicePreviewButton from '../components/VoicePreviewButton';

export default function AudioChatPage() {
  return (
    <VoiceProvider>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Top Navigation Bar */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-gray-900">Looking Glass Project</h1>
              </div>
              <div className="flex items-center space-x-3">
                <VoiceDropdown />
                <VoicePreviewButton />
              </div>
              <div className="hidden md:block">
                <div className="ml-10 flex items-baseline space-x-4">
                  <span className="text-gray-500 text-sm">AI Avatar Assistant</span>
                </div>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="ml-4 flex items-center md:ml-6">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">Interactive 3D Experience</p>
                  <p className="text-xs text-gray-500">Voice & Chat Enabled</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="h-[calc(100vh-4rem)] overflow-hidden">
        <div className="h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <WebSearchProvider>
            <AudioChatWrapper />
          </WebSearchProvider>
        </div>
      </div>
      </div>
    </VoiceProvider>
  );
}