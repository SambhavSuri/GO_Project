# Deepgram Logging Documentation

This document describes the comprehensive logging functionality added to track input and output for Deepgram API calls in the AI VRM Chat application.

## Overview

The logging system provides detailed tracking of:
- **Input**: Audio file details, request parameters, API configuration
- **Output**: Transcription results, confidence scores, response timing
- **Errors**: Detailed error information with context
- **Performance**: Response times and API call metrics

## Logging Features

### 1. Request Logging (`🎤 DEEPGRAM API REQUEST`)

When a Deepgram API call is made, the system logs:

```
============================================================
🎤 DEEPGRAM API REQUEST
============================================================
Timestamp: 2024-01-15T10:30:45.123456
Input Type: Audio File
File Path: /tmp/temp_audio_1705311045.wav
File Size: 128000 bytes (125.00 KB)
API Key Configured: True
Request Options: {
  "smart_format": true,
  "punctuate": true,
  "diarize": false
}
------------------------------------------------------------
```

**Information tracked:**
- Timestamp of the request
- Input type (file or bytes)
- File size and path (if applicable)
- Data size (if using bytes)
- API key configuration status
- Request options and parameters

### 2. Response Logging (`🎵 DEEPGRAM API RESPONSE`)

When Deepgram responds, the system logs:

```
============================================================
🎵 DEEPGRAM API RESPONSE
============================================================
Response Time: 1.234 seconds
Response Type: dict
Results Available: 1
Channels: 1
Transcription: "Hello, this is a test message"
Confidence: 0.987
Word Count: 7
Full Response Structure:
{
  "results": {
    "channels": [
      {
        "alternatives": [
          {
            "transcript": "Hello, this is a test message",
            "confidence": 0.987
          }
        ]
      }
    ]
  }
}
------------------------------------------------------------
```

**Information tracked:**
- Response time in seconds
- Response type and structure
- Transcription text
- Confidence score
- Word count
- Complete response structure

### 3. Error Logging (`❌ DEEPGRAM API ERROR`)

If an error occurs, the system logs:

```
============================================================
❌ DEEPGRAM API ERROR
============================================================
Error Time: 2024-01-15T10:30:46.123456
Duration: 1.234 seconds
Error Type: DeepgramException
Error Message: Invalid API key provided
HTTP Status Code: 401
Error Response: {"error": "Invalid API key"}
------------------------------------------------------------
```

**Information tracked:**
- Error timestamp
- Duration before error
- Error type and message
- HTTP status code (if available)
- Error response details

### 4. HTTP Endpoint Logging

The `/api/speech-to-text` endpoint also includes comprehensive logging:

```
============================================================
🎤 SPEECH-TO-TEXT ENDPOINT CALLED
============================================================
Timestamp: 2024-01-15T10:30:45.123456
Request Method: POST
Content Type: multipart/form-data
Content Length: 128000 bytes
Audio File Name: recording.webm
Audio File Content Type: audio/webm
Saved temporary file: temp_audio_1705311045.wav
Audio data size: 128000 bytes (125.00 KB)
Calling Deepgram service for transcription...
Cleaned up temporary file: temp_audio_1705311045.wav
============================================================
✅ SPEECH-TO-TEXT COMPLETED
============================================================
Total Duration: 1.456 seconds
Transcription Result: 'Hello, this is a test message'
------------------------------------------------------------
```

## Usage Examples

### 1. Testing with Real API

```bash
# Set your Deepgram API key
export DEEPGRAM_API_KEY="your_api_key_here"

# Run the test script
python test_deepgram_logging.py
```

### 2. Testing with Mock Responses

```bash
# Without API key (will show mock response logging)
python test_deepgram_logging.py
```

### 3. Using the Web Application

1. Start the Flask application:
   ```bash
   python app.py
   ```

2. Use the voice input feature in the web interface
3. Check the console output for detailed logging

## Log Levels

The logging system uses different levels:

- **INFO**: Normal operations, requests, responses
- **WARNING**: Configuration issues, missing API keys
- **ERROR**: API errors, transcription failures

## Configuration

### Environment Variables

```bash
# Required for real API calls
DEEPGRAM_API_KEY=your_deepgram_api_key_here

# Optional: Set log level
export PYTHONPATH=.
```

### Log Format

Logs are formatted with:
- Clear section separators (`=` and `-`)
- Emoji indicators for easy scanning
- Structured JSON for complex data
- Timestamps for all events

## Monitoring and Debugging

### 1. Real-time Monitoring

Watch the logs in real-time:
```bash
python app.py 2>&1 | grep -E "(🎤|🎵|❌)"
```

### 2. Performance Analysis

Track response times:
```bash
python app.py 2>&1 | grep "Response Time:"
```

### 3. Error Tracking

Monitor errors:
```bash
python app.py 2>&1 | grep "❌ DEEPGRAM API ERROR"
```

## Integration Points

### 1. Flask Application (`app.py`)

- `/api/speech-to-text` endpoint logging
- WebSocket event logging
- Request/response tracking

### 2. Deepgram Service (`services/deepgram_service.py`)

- API call logging
- Response processing
- Error handling

### 3. Test Script (`test_deepgram_logging.py`)

- Standalone testing
- Mock vs real API comparison
- Performance benchmarking

## Benefits

1. **Debugging**: Easy identification of API issues
2. **Performance**: Track response times and bottlenecks
3. **Monitoring**: Real-time visibility into API usage
4. **Error Handling**: Detailed error context for troubleshooting
5. **Audit Trail**: Complete record of all API interactions

## Troubleshooting

### Common Issues

1. **No logs appearing**
   - Check log level configuration
   - Ensure logging is imported

2. **Missing API key warnings**
   - Set `DEEPGRAM_API_KEY` environment variable
   - Check `.env` file configuration

3. **Error logs without details**
   - Check network connectivity
   - Verify API key validity
   - Review Deepgram account status

### Debug Commands

```bash
# Test logging functionality
python test_deepgram_logging.py

# Check API key configuration
python -c "from services.deepgram_service import DeepgramService; print(DeepgramService().is_configured())"

# Monitor real-time logs
tail -f app.log 2>/dev/null || python app.py
```

## Future Enhancements

Potential improvements:
- Log rotation and archival
- Metrics aggregation
- Alert system for errors
- Performance dashboards
- Integration with monitoring tools 