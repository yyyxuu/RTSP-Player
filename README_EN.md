# RTSP Player

English | [简体中文](README.md)

A complete RTSP streaming solution with frontend player and backend transcoding service. Supports real-time RTSP to HLS conversion with comprehensive error handling, logging, and performance optimization.

## ✨ Key Features

- **Real-time Transcoding**: Convert RTSP streams to HLS format using FFmpeg
- **Modern Frontend**: Responsive design with mobile support and elegant UI
- **Comprehensive Error Handling**: Complete error capture and handling mechanisms
- **Structured Logging**: Hierarchical logging with file rotation support
- **Configuration Management**: Flexible configuration system with environment variable support
- **Performance Optimization**: Connection limits, automatic resource cleanup, heartbeat detection
- **Health Monitoring**: Built-in health check and monitoring endpoints
- **Graceful Shutdown**: Support for graceful shutdown without data loss

## 🏗️ System Architecture

```
RTSP Source -> FFmpeg Transcoding -> HLS Segmentation -> Browser Playback
     ^              |                  |                  |
     |              v                  v                  |
   Camera      Backend Service    WebSocket        Frontend Player
```

### Core Components

- **RTSPStreamer**: Main service class managing all functionality
- **Logger**: Structured logging system
- **Config**: Configuration management module
- **WebSocket**: Real-time communication interface
- **Express**: HTTP service and static file serving

## 📋 System Requirements

- Node.js (v14.0.0 or higher)
- FFmpeg (for transcoding)
- Memory: 2GB+ recommended
- Disk: At least 1GB free space (for HLS caching)

### Installing FFmpeg

**macOS:**

```bash
brew install ffmpeg
```

**Ubuntu/Debian:**

```bash
sudo apt update
sudo apt install ffmpeg
```

**CentOS/RHEL:**

```bash
sudo yum install ffmpeg
# Or on newer versions:
sudo dnf install ffmpeg
```

**Windows:**
Download from [FFmpeg Official Website](https://ffmpeg.org/download.html), install, and add to PATH environment variable

## 🚀 Quick Start

### 1. Clone the Project

```bash
git clone https://github.com/yyyxuu/RTSP-Player.git
cd RTSP_Test
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure the Project

Copy the default configuration and modify as needed:

```bash
cp config.js.example config.js
```

Main configuration options:

```javascript
// config.js
module.exports = {
  server: {
    port: 3000, // Server port
    host: "0.0.0.0", // Server address
  },
  ffmpeg: {
    size: "640x480", // Output resolution
    fps: 25, // Frame rate
    preset: "ultrafast", // Encoding speed preset
  },
  logging: {
    level: "info", // Log level
    file: "./logs/app.log", // Log file path
  },
};
```

### 4. Start the Server

```bash
# Production mode
npm start

# Development mode (auto-restart)
npm run dev
```

### 5. Access the Application

Open your browser and visit: `http://localhost:3000`

## 📖 Usage

### Basic Usage

1. Enter the RTSP stream URL in the input box
2. Click the "Connect" button to start playback
3. Click the "Stop" button to end playback

### Example RTSP Streams

The project provides some test stream addresses:

- `rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mp4`
- `rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_465k.mp4`

### Quick Operations

The page provides preset example stream buttons - click to quickly fill in the address.

## ⚙️ Advanced Configuration

### Environment Variables

Supports the following environment variable configurations:

```bash
# Server Configuration
PORT=3000                    # Server port
HOST=0.0.0.0                 # Server address
NODE_ENV=production         # Runtime environment

# Logging Configuration
LOG_LEVEL=info              # Log level (error|warn|info|debug)

# Security Configuration
ALLOWED_ORIGINS=*           # Allowed CORS origins, comma-separated
```

### FFmpeg Parameter Optimization

FFmpeg parameter recommendations for different scenarios:

**Low Latency Scenario:**

```javascript
ffmpeg: {
    preset: 'ultrafast',
    tune: 'zerolatency',
    g: 25,
    hls_time: 1
}
```

**High Quality Scenario:**

```javascript
ffmpeg: {
    preset: 'medium',
    crf: 23,
    size: '1280x720',
    hls_time: 4
}
```

**Low Bandwidth Scenario:**

```javascript
ffmpeg: {
    preset: 'fast',
    size: '426x240',
    fps: 15,
    bitrate: '300k'
}
```

## 📊 API Endpoints

### RESTful API

#### Get All Active Streams

```http
GET /api/streams
```

Response Example:

```json
{
  "success": true,
  "data": [
    {
      "id": "stream_1234567890_abc123",
      "rtspUrl": "rtsp://example.com/live/stream",
      "connections": 1,
      "startTime": 1640995200000,
      "duration": 30000,
      "status": "active"
    }
  ]
}
```

#### Health Check

```http
GET /api/health
```

Response Example:

```json
{
  "success": true,
  "data": {
    "uptime": 3600,
    "memory": {
      "rss": 134217728,
      "heapTotal": 67108864,
      "heapUsed": 45088768,
      "external": 2097152
    },
    "connections": 5,
    "streams": 2,
    "timestamp": "2023-12-31T12:00:00.000Z"
  }
}
```

### WebSocket Interface

#### Connection Address

```
ws://localhost:3000
wss://your-domain.com (HTTPS environment)
```

#### Message Format

**Start Playback:**

```json
{
  "type": "startStream",
  "rtspUrl": "rtsp://example.com/live/stream"
}
```

**Stop Playback:**

```json
{
  "type": "stopStream",
  "streamId": "stream_1234567890_abc123"
}
```

**Server Response:**

```json
{
  "type": "streamStarted",
  "streamId": "stream_1234567890_abc123",
  "message": "RTSP stream processing started",
  "timestamp": "2023-12-31T12:00:00.000Z"
}
```

## 📁 Project Structure

```
RTSP_Test/
├── package.json              # Project dependencies configuration
├── server.js                 # Original server file
├── server-improved.js        # Improved server file
├── config.js                 # Configuration management module
├── logger.js                 # Logging module
├── public/                   # Frontend static files
│   ├── index.html           # Main page
│   └── streams/             # HLS file directory (created at runtime)
├── logs/                     # Log file directory (created at runtime)
├── user.config.js           # User custom configuration file (optional)
└── README.md                 # Project documentation
```

## 🔧 Development Guide

### Development Environment Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run in production mode
npm start
```

### Code Standards

- Use ES6+ syntax
- Follow camelCase naming convention
- Functions and methods should have descriptive comments
- Error handling must be complete
- Logging must include context information

### Extending Functionality

#### Adding New Message Types

1. Add a new case in WebSocket message handling
2. Implement the corresponding handler method
3. Update frontend message handling logic

#### Custom FFmpeg Parameters

Modify FFmpeg options in the configuration file:

```javascript
ffmpeg: {
  // Add custom parameters
  customOptions: ["-vf", "scale=1920:1080", "-b:v", "2000k"];
}
```

## 🐛 Troubleshooting

### Common Issues

**1. FFmpeg Not Found**

```
Error: Cannot find ffmpeg
Solution: Ensure FFmpeg is installed and added to PATH environment variable
```

**2. RTSP Connection Failed**

```
Error: Connection timeout
Solution: Check if RTSP address is correct and network is accessible
```

**3. Playback Stuttering**

```
Issue: Video playback is not smooth
Solution: Adjust FFmpeg parameters, reduce resolution or bitrate
```

**4. High Memory Usage**

```
Issue: Server memory usage continues to grow
Solution: Check file cleanup configuration, restart server
```

### Log Analysis

Log file location: `./logs/app.log`

Common error keywords:

- `FFmpeg错误`: Transcoding related issues
- `WebSocket错误`: Connection issues
- `文件清理失败`: Disk permission issues

### Performance Monitoring

Use health check endpoint to monitor server status:

```bash
curl http://localhost:3000/api/health
```

Key metrics:

- `uptime`: Server uptime
- `connections`: Current connection count
- `streams`: Active stream count
- `memory`: Memory usage

## 🛡️ Security Recommendations

1. **Production Environment Configuration:**

   - Set appropriate CORS policies
   - Use HTTPS protocol
   - Configure firewall rules

2. **Access Control:**

   - Restrict allowed RTSP source addresses
   - Set connection limits
   - Implement rate limiting

3. **Data Protection:**
   - Regularly clean up HLS cache files
   - Configure log rotation
   - Monitor disk space usage

## 📈 Performance Optimization

### Server Configuration

```javascript
// config.js
module.exports = {
  websocket: {
    maxConnections: 100, // Maximum connections
    heartbeatInterval: 30000, // Heartbeat interval
  },
  streams: {
    cleanupInterval: 60000, // Cleanup interval
    maxAge: 300000, // Maximum file retention time
  },
};
```

### FFmpeg Tuning

Optimization recommendations for different hardware configurations:

**Low-spec Server:**

```javascript
ffmpeg: {
    preset: 'ultrafast',
    size: '426x240',
    fps: 15,
    bitrate: '300k'
}
```

**High-spec Server:**

```javascript
ffmpeg: {
    preset: 'medium',
    size: '1920x1080',
    fps: 30,
    bitrate: '5000k'
}
```

## 🤝 Contributing

1. Fork the project
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Commit Message Convention

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation update
- `style`: Code formatting adjustments
- `refactor`: Code refactoring
- `test`: Testing related
- `chore`: Build process or auxiliary tool changes

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Video.js](https://videojs.com/) - HTML5 video player
- [fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg) - FFmpeg Node.js wrapper
- [WebSocket](https://github.com/websockets/ws) - WebSocket implementation
- [FFmpeg](https://ffmpeg.org/) - Multimedia processing tool

## 📞 Support

If you encounter issues or have feature suggestions, please:

1. Check the [FAQ](#-troubleshooting) section
2. Search existing [Issues](../../issues)
3. Create a new Issue with detailed information

---

**Note:** This project is for learning and development purposes only. Please ensure thorough testing before using in production environments.
