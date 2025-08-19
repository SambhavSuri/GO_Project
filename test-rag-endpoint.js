#!/usr/bin/env node

/**
 * Test script for the new streaming RAG endpoint
 * Usage: node test-rag-endpoint.js
 */

const https = require('https');
const http = require('http');

async function testStreamingRAGEndpoint() {
  const endpoint = 'http://10.99.23.96:8000/chat';
  const testMessage = 'Hello, can you tell me about artificial intelligence?';
  
  const requestBody = JSON.stringify({
    message: testMessage,
    conversation_history: [],
    stream: true
  });
  
  console.log('🧪 Testing streaming RAG endpoint...');
  console.log('📍 Endpoint:', endpoint);
  console.log('💬 Test message:', testMessage);
  console.log('📦 Request body:', requestBody);
  console.log('---');
  
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };
    
    const req = http.request(options, (res) => {
      console.log('📡 Response status:', res.statusCode);
      console.log('📋 Response headers:', res.headers);
      console.log('---');
      
      if (res.statusCode !== 200) {
        console.error('❌ Request failed with status:', res.statusCode);
        res.on('data', (chunk) => {
          console.error('Error response:', chunk.toString());
        });
        res.on('end', () => {
          reject(new Error(`Request failed with status ${res.statusCode}`));
        });
        return;
      }
      
      console.log('📥 Streaming response:');
      let accumulatedResponse = '';
      
      res.on('data', (chunk) => {
        const chunkStr = chunk.toString();
        accumulatedResponse += chunkStr;
        
        // Show chunk with timestamp
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
        console.log(`[${timestamp}] Chunk (${chunkStr.length} chars):`, 
          chunkStr.substring(0, 100) + (chunkStr.length > 100 ? '...' : ''));
      });
      
      res.on('end', () => {
        console.log('---');
        console.log('✅ Streaming complete!');
        console.log('📊 Total response length:', accumulatedResponse.length);
        console.log('📝 Full response preview:', 
          accumulatedResponse.substring(0, 500) + (accumulatedResponse.length > 500 ? '...' : ''));
        resolve(accumulatedResponse);
      });
      
      res.on('error', (error) => {
        console.error('❌ Stream error:', error);
        reject(error);
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Request error:', error);
      reject(error);
    });
    
    req.on('timeout', () => {
      console.error('❌ Request timeout');
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.setTimeout(30000); // 30 second timeout
    req.write(requestBody);
    req.end();
  });
}

// Run the test
testStreamingRAGEndpoint()
  .then(() => {
    console.log('🎉 Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test failed:', error.message);
    process.exit(1);
  });
