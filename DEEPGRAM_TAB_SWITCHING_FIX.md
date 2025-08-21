# Deepgram Tab Switching Fix

## Problem
When users switch browser tabs, the Deepgram WebSocket connection for real-time speech recognition closes, causing voice chat to stop working when they return to the tab.

## Root Cause
Browsers suspend or throttle operations in background tabs, including WebSocket connections. The Deepgram live transcription WebSocket connection gets closed when the tab becomes inactive.

## Solution Overview
Implemented a comprehensive tab-aware connection management system that:

1. **Detects tab visibility changes** using the Page Visibility API
2. **Pauses keep-alive when tab is hidden** to avoid browser throttling
3. **Automatically reconnects when tab becomes visible** if connection is lost
4. **Monitors connection health** to detect stale connections
5. **Provides graceful reconnection** without interrupting user experience

## Key Features

### 1. Tab Visibility Detection
- Uses `document.visibilityState` to detect when tab becomes hidden/visible
- Automatically pauses keep-alive pings when tab is hidden
- Resumes connection monitoring when tab becomes visible

### 2. Connection Health Monitoring
- Tracks last successful keep-alive timestamp
- Counts consecutive failures
- Detects stale connections (no successful keep-alive for 30+ seconds)

### 3. Smart Reconnection
- Checks connection health when tab becomes visible
- Automatically reconnects if connection is stale or lost
- Only reconnects if voice chat is still active
- Includes cleanup and retry mechanisms

### 4. Improved Keep-Alive
- Increased interval from 3 to 5 seconds for better browser compatibility
- Only sends keep-alive when tab is visible
- Better error handling and failure tracking

## Implementation Details

### Files Modified
- `logic/useAudioVoiceChat.ts` - Main implementation

### Key Functions Added
1. `isConnectionHealthy()` - Checks if Deepgram connection is healthy
2. `forceReconnectDeepgram()` - Forces reconnection with proper cleanup
3. Enhanced visibility change handler with automatic reconnection

### Connection Health Tracking
```typescript
connectionHealthRef.current = {
  lastKeepAlive: Date.now(),
  consecutiveFailures: 0
}
```

### Tab-Aware Keep-Alive
- Only sends keep-alive pings when tab is visible
- Increased interval to 5 seconds for stability
- Better failure handling with connection recreation

## Usage
The fix is automatic and requires no user intervention. When a user:

1. **Switches away from tab** - Keep-alive is paused, connection preserved
2. **Returns to tab** - System checks connection health
3. **If connection lost** - Automatically reconnects in the background
4. **If connection healthy** - Resumes normal operation

## Benefits
- ✅ Voice chat continues working after tab switches
- ✅ Automatic reconnection without user action
- ✅ Better battery/resource usage (no keep-alive in background)
- ✅ Robust error handling and recovery
- ✅ Maintains user experience continuity

## Technical Notes
- Uses Page Visibility API (`document.visibilityState`)
- Implements exponential backoff for failed connections
- Includes connection health monitoring
- Graceful cleanup and resource management
- Compatible with browser throttling policies

## Testing
To test the fix:
1. Start voice chat
2. Switch to another tab for 30+ seconds
3. Return to the original tab
4. Voice chat should automatically reconnect and continue working

The console will show detailed logs of the reconnection process.


