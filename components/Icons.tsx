import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

export const MicIcon: React.FC<IconProps> = ({ size = 24, className = '' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="currentColor"
    className={className}
  >
    <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z" />
    <path d="M16 10v1a4 4 0 0 1-8 0v-1M12 18.5v-3.5M8 21h8" />
  </svg>
);

export const MicOffIcon: React.FC<IconProps> = ({ size = 24, className = '' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="currentColor"
    className={className}
  >
    <path d="m2 2 20 20M9 9v2a3 3 0 0 0 5.12 2.12L9 9ZM15 9.34V6a3 3 0 0 0-5.94-.6" />
    <path d="M16 10v1a4 4 0 0 1-6.68 2.97M8 10v1a4 4 0 0 0 6.68 2.97M12 18.5v-3.5M8 21h8" />
  </svg>
);