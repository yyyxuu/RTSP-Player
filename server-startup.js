const RTSPStreamer = require('./server-main.js');

try {
    const rtspStreamer = new RTSPStreamer();
    rtspStreamer.start();
} catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
}