import React, { useState, useRef, useEffect } from 'react';
import { useVoice, AZURE_VOICES } from '../logic/VoiceContext';

const VoiceDropdown: React.FC = () => {
  const { selectedVoice, setSelectedVoice, getVoiceLabel, isSessionActive } = useVoice();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleVoiceSelect = (voice: string) => {
    setSelectedVoice(voice);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown Trigger */}
      <button
        onClick={() => !isSessionActive && setIsOpen(!isOpen)}
        disabled={isSessionActive}
        className={`flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm transition-colors duration-200 ${
          isSessionActive 
            ? 'opacity-60 cursor-not-allowed bg-gray-100' 
            : 'hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
        }`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <svg 
          className="w-4 h-4 text-gray-500" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" 
          />
        </svg>
        <span className="text-sm font-medium text-gray-700 min-w-0 truncate">
          {isSessionActive ? `Voice locked to ${getVoiceLabel(selectedVoice)}` : getVoiceLabel(selectedVoice)}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
            isOpen ? 'transform rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && !isSessionActive && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="py-2">
            {Object.entries(AZURE_VOICES).map(([categoryKey, category]) => (
              <div key={categoryKey} className="mb-2 last:mb-0">
                {/* Category Header */}
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                  {category.label}
                </div>
                
                {/* Voice Options */}
                <div className="py-1">
                  {category.voices.map((voice) => (
                    <button
                      key={voice.value}
                      onClick={() => handleVoiceSelect(voice.value)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 focus:outline-none focus:bg-blue-50 transition-colors duration-150 ${
                        selectedVoice === voice.value
                          ? 'bg-blue-100 text-blue-700 font-medium'
                          : 'text-gray-700'
                      }`}
                      role="option"
                      aria-selected={selectedVoice === voice.value}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate">{voice.label}</span>
                        {selectedVoice === voice.value && (
                          <svg
                            className="w-4 h-4 text-blue-600 ml-2 flex-shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceDropdown;
