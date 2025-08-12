import React from 'react';
import { useWebSearch } from '../logic/WebSearchContext';

interface WebSearchToggleProps {
  disabled?: boolean;
}

export const WebSearchToggle: React.FC<WebSearchToggleProps> = ({ disabled = false }) => {
  const { webSearchEnabled, setWebSearchEnabled } = useWebSearch();

  return (
    <div className="flex items-center gap-2">
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={webSearchEnabled}
          onChange={(e) => setWebSearchEnabled(e.target.checked)}
          disabled={disabled}
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
        <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300">
          Web Search {webSearchEnabled ? 'Enabled' : 'Disabled'}
        </span>
      </label>
    </div>
  );
};