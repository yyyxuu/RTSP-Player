# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a full-stack RTSP (Real Time Streaming Protocol) streaming application that converts RTSP streams to HLS (HTTP Live Streaming) format for web browser playback. The system uses FFmpeg for transcoding and provides a modern frontend with Video.js player.

**Streaming Pipeline**: `RTSP Source → FFmpeg Transcoding → HLS Segmentation → Browser Player`

## Development Commands

### Running the Application
```bash
# Development mode (with auto-restart using nodemon)
npm run dev

# Production mode
npm start
```

Default server port is configured in `config.js` (typically 8080 or 3000).

### Dependencies Management
```bash
npm install
```

**Note**: This project does not have automated tests. The `npm test` script is not implemented.

## Architecture

### Core Components

**RTSPStreamer Class** (`server-main.js`)
- Main service class managing the entire application lifecycle
- Orchestrates HTTP server (Express), WebSocket server, and FFmpeg processes
- Handles stream lifecycle: start, monitor, and cleanup
- Manages connection limits and resource allocation

**Logger Class** (`logger.js`)
- Structured logging with levels: error, warn, info, debug
- Dual output: console and file rotation
- Automatic log cleanup based on maxFiles configuration

**Configuration System** (`config.js` and `config.example.js`)
- Environment variable support with fallback to config file
- Key sections: server, streams, hls, ffmpeg, websocket, logging
- Copy `config.example.js` to `config.js` and customize for your environment

### WebSocket Communication Protocol

**Connection Management**
- Server attaches WebSocket to HTTP server using upgrade handling
- Implements heartbeat/ping-pong mechanism (configurable interval)
- Connection limits enforced via `maxConnections` config
- Each connection tracked with unique connectionId

**Message Types**
- `startStream`: Begin RTSP to HLS conversion, includes rtspUrl
- `stopStream`: Terminate stream processing, includes streamId
- Server responses include type, streamId, message, and timestamp

### FFmpeg Integration

The application uses `fluent-ffmpeg` to manage transcoding processes:
- **Input**: RTSP URL with configurable transport protocol (tcp/udp)
- **Video Encoding**: libx264 codec with resolution, fps, and bitrate controls
- **Audio Encoding**: AAC codec
- **HLS Output**: Configurable segment duration and playlist size
- **Low-latency optimization**: tune zerolatency, preset ultrafast

Key FFmpeg parameters (configurable in `config.js`):
- `rtsp_transport`: tcp (recommended) or udp
- `size`: output resolution (default 640x480)
- `fps`: frame rate (default 25)
- `preset`: encoding speed (ultrafast for low latency)
- `tune`: optimization target (zerolatency for streaming)
- `hls_time`: segment duration in seconds (default 2)

### Stream Management

**Stream Lifecycle**
1. Client sends `startStream` message with RTSP URL
2. Server generates unique streamId: `stream_${timestamp}_${random}`
3. FFmpeg process spawned to transcode RTSP to HLS
4. HLS segments written to `public/streams/{streamId}/` directory
5. Client plays HLS stream via standard HTTP endpoint
6. On `stopStream`, FFmpeg process killed and HLS files cleaned up

**Resource Management**
- Active streams tracked in `Map<streamId, streamData>`
- Automatic HLS segment cleanup based on `maxAge` configuration
- Periodic cleanup task runs every `cleanupInterval` milliseconds
- On WebSocket disconnect, associated streams can optionally be terminated

### API Endpoints

**RESTful API**
- `GET /api/streams` - List all active streams with metadata
- `GET /api/health` - Server health check (uptime, memory, connections, stream count)

**Static Files**
- `public/` directory served via Express
- `public/index.html` - Frontend application
- `public/streams/{streamId}/stream.m3u8` - HLS playlist endpoint

### Frontend Architecture

- **Single Page Application**: `public/index.html` contains all frontend code
- **Video.js Player**: HTML5 video player with HLS support
- **WebSocket Client**: Real-time communication with backend
- **No build step required**: Vanilla JavaScript, direct browser execution

## File Structure

```
server-main.js          # Main RTSPStreamer class, server startup logic
server-startup.js       # Entry point for launching the server
config.js               # Active configuration (created from config.example.js)
config.example.js       # Configuration template with all options
logger.js               # Logging system with file rotation
public/
  index.html            # Frontend application (Video.js + WebSocket client)
  streams/              # HLS segments directory (created at runtime)
logs/                   # Log files directory (created at runtime)
package.json            # Dependencies and npm scripts
README.md               # Comprehensive documentation (in Chinese)
```

## Key Dependencies

- **express**: HTTP server framework
- **ws**: WebSocket implementation
- **fluent-ffmpeg**: FFmpeg Node.js wrapper
- **cors**: Cross-origin resource sharing
- **nodemon** (devOnly): Auto-restart on file changes

## Configuration

### Environment Variables
```bash
PORT=8080              # Server port
HOST=0.0.0.0          # Server host
LOG_LEVEL=info        # Logging level (error|warn|info|debug)
ALLOWED_ORIGINS=*     # CORS allowed origins
```

### Important Config Sections

**streams.cleanupInterval**: How often to check for old HLS files to delete
**streams.maxAge**: Maximum age of HLS files before cleanup
**websocket.maxConnections**: Maximum concurrent WebSocket connections
**websocket.heartbeatInterval**: Ping interval for connection health
**ffmpeg.timeout**: How long to wait for FFmpeg before considering it failed

## Development Notes

### Adding New Features

1. **New WebSocket message types**: Add handler in `handleWebSocketMessage()` method
2. **Custom FFmpeg parameters**: Add to `config.ffmpeg` section, access via `config.ffmpeg.*`
3. **Additional API endpoints**: Add routes in `setupRoutes()` method before error handlers
4. **Logging**: Always use the Logger instance with context metadata: `logger.info('message', { key: value })`

### Error Handling Patterns

- All FFmpeg processes wrapped in error handlers
- WebSocket errors logged but don't crash server
- Resource cleanup on errors (kill processes, delete files)
- Client errors sent via WebSocket with `sendError()` method

### Resource Cleanup

The application implements automatic cleanup at multiple levels:
- HLS files older than `maxAge` are deleted periodically
- FFmpeg processes killed when streams stop
- WebSocket connections tracked and cleaned up on disconnect
- Log files rotated based on `maxFiles` configuration

## FFmpeg Requirements

The application requires FFmpeg to be installed on the system:
- macOS: `brew install ffmpeg`
- Ubuntu/Debian: `sudo apt install ffmpeg`
- Windows: Download from ffmpeg.org and add to PATH

The `fluent-ffmpeg` library will find FFmpeg via the system PATH.

## Common Operations

### Viewing Logs
```bash
# Follow logs in real-time
tail -f logs/app.log

# Check for errors
grep "ERROR" logs/app.log
```

### Monitoring Server Health
```bash
curl http://localhost:8080/api/health
```

### Debugging Stream Issues

1. Check logs for FFmpeg errors
2. Verify RTSP URL is accessible (test with VLC or ffplay)
3. Review FFmpeg process logs for codec/transport issues
4. Monitor HLS segment generation in `public/streams/{streamId}/`

## Performance Considerations

- **Connection Limits**: Set `maxConnections` based on server capacity
- **FFmpeg Resources**: Each stream spawns one FFmpeg process; monitor CPU/memory
- **Disk I/O**: HLS segments create frequent small file writes; use SSD if possible
- **Network**: RTSP over TCP is more reliable but UDP may be lower latency
- **Cleanup Frequency**: Balance between responsiveness and resource usage

## Security Notes

- No authentication is implemented by default
- CORS is enabled via the `cors` middleware
- Consider adding authentication for production deployments
- RTSP URLs should be validated before processing
- Limit access to `/api/` endpoints in production environments
