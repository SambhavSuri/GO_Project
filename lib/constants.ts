// API endpoints configuration
export const API_ENDPOINTS = {
  RAG_QUERY: '/query', // Always use the Next.js API route for RAG queries
  HEALTH: '/api/health',
  TEST_RAG: '/api/test-rag',
};

// WebSocket configuration
export const WS_CONFIG = {
  URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000',
  RECONNECT_INTERVAL: 3000,
  MAX_RECONNECT_ATTEMPTS: 5,
};