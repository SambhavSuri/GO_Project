import React, { createContext, useContext, useState } from 'react';

interface WebSearchContextType {
  webSearchEnabled: boolean;
  setWebSearchEnabled: (enabled: boolean) => void;
}

const WebSearchContext = createContext<WebSearchContextType | undefined>(undefined);

export const WebSearchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

  return (
    <WebSearchContext.Provider value={{ webSearchEnabled, setWebSearchEnabled }}>
      {children}
    </WebSearchContext.Provider>
  );
};

export const useWebSearch = () => {
  const context = useContext(WebSearchContext);
  if (context === undefined) {
    throw new Error('useWebSearch must be used within a WebSearchProvider');
  }
  return context;
};