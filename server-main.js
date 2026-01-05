const express = require('express');
const WebSocket = require('ws');
const ffmpeg = require('fluent-ffmpeg');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// 导入配置和日志
const config = require('./config');
const Logger = require('./logger');

// 初始化日志记录器
const logger = new Logger(config);

class RTSPStreamer {
    constructor() {
        console.log('初始化RTSP流媒体服务器...');
        this.app = express();
        this.server = http.createServer(this.app);
        this.wss = null; // 将在启动时创建
        this.activeStreams = new Map();
        this.wsConnections = new Map();
        this.heartbeatInterval = null;
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
        this.ensureDirectories();
        this.cleanupInterval = null;
        this.startCleanupTask();
    }
    
    setupWebSocket() {
        // 使用独立模式创建WebSocket服务器
        this.wss = new WebSocket.Server({ 
            noServer: true,
            maxPayloadSize: 1024 * 1024, // 1MB
            perMessageDeflate: false
        });
        
        // 处理升级请求
        this.server.on('upgrade', (request, socket, head) => {
            this.wss.handleUpgrade(request, socket, head, (ws) => {
                this.wss.emit('connection', ws, request);
            });
        });
        
        this.wss.on('connection', (ws, req) => {
            // 连接数限制
            if (this.wsConnections.size >= config.websocket.maxConnections) {
                ws.close(1008, '服务器连接数已满');
                return;
            }

            const connectionId = this.generateConnectionId();
            const clientInfo = {
                id: connectionId,
                ws: ws,
                ip: req.socket.remoteAddress || 'unknown',
                userAgent: req.headers['user-agent'] || 'unknown',
                connectTime: Date.now(),
                lastPing: Date.now()
            };

            this.wsConnections.set(connectionId, clientInfo);
            
            logger.info('新的WebSocket连接', clientInfo);
            
            ws.on('message', (message) => {
                try {
                    this.handleWebSocketMessage(connectionId, message);
                } catch (error) {
                    logger.error('处理WebSocket消息失败', {
                        connectionId,
                        error: error.message,
                        message: message.toString()
                    });
                    this.sendError(connectionId, '消息处理失败');
                }
            });
            
            ws.on('close', (code, reason) => {
                logger.info('WebSocket连接关闭', {
                    connectionId,
                    code,
                    reason: reason.toString(),
                    duration: Date.now() - clientInfo.connectTime
                });
                
                this.handleWebSocketClose(connectionId);
            });
            
            ws.on('error', (error) => {
                logger.error('WebSocket错误', {
                    connectionId,
                    error: error.message
                });
                this.wsConnections.delete(connectionId);
            });
        });
        
        this.wss.on('error', (error) => {
            logger.error('WebSocket服务器错误', { error: error.message });
        });
    }
    
    handleWebSocketMessage(connectionId, message) {
        const data = JSON.parse(message);

        logger.debug('收到WebSocket消息', {
            connectionId,
            type: data.type,
            data: data.type === 'startStream' ? { rtspUrl: data.rtspUrl } : data
        });

        // 更新lastPing时间（响应任何消息）
        const clientInfo = this.wsConnections.get(connectionId);
        if (clientInfo) {
            clientInfo.lastPing = Date.now();
        }

        switch(data.type) {
            case 'startStream':
                this.startRtspStream(data.rtspUrl, connectionId);
                break;
            case 'stopStream':
                this.stopRtspStream(data.streamId, connectionId);
                break;
            case 'pong':
                // pong消息，仅更新lastPing时间（已在上面处理）
                break;
            default:
                logger.warn('未知消息类型', { connectionId, type: data.type });
                this.sendError(connectionId, '未知消息类型');
        }
    }
    
    handleWebSocketClose(connectionId) {
        this.wsConnections.delete(connectionId);
        
        // 停止相关的流
        this.activeStreams.forEach((streamInfo, streamId) => {
            if (streamInfo.connections.includes(connectionId)) {
                this.stopRtspStream(streamId, connectionId);
            }
        });
    }
    
    setupMiddleware() {
        this.app.use(cors({
            origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
            credentials: true
        }));

        this.app.use(express.json({ limit: '10mb' }));

        // 请求日志
        this.app.use((req, res, next) => {
            logger.debug('HTTP请求', {
                method: req.method,
                url: req.url,
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            next();
        });
    }

    setupRoutes() {
        // HLS路由 - 必须在静态文件中间件之前注册
        this.app.get('/streams/:streamId.m3u8', (req, res) => {
            this.serveHLSPlaylist(req, res);
        });

        this.app.get('/streams/:streamId-:segment', (req, res) => {
            this.serveHLSSegment(req, res);
        });

        // API路由
        this.app.get('/api/streams', (req, res) => {
            try {
                const streams = this.getActiveStreamsInfo();
                res.json({ success: true, data: streams });
            } catch (error) {
                logger.error('获取流列表失败', { error: error.message });
                res.status(500).json({
                    success: false,
                    error: '获取流列表失败'
                });
            }
        });

        // 健康检查
        this.app.get('/api/health', (req, res) => {
            res.json({
                success: true,
                data: {
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    connections: this.wsConnections.size,
                    streams: this.activeStreams.size,
                    timestamp: new Date().toISOString()
                }
            });
        });

        // 静态文件服务 - 放在最后
        this.app.use(express.static(path.join(__dirname, 'public'), {
            maxAge: '1d', // 缓存1天
            etag: true
        }));

        // 根路由
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });
    }
    
    setupErrorHandling() {
        // 404处理
        this.app.use('*', (req, res) => {
            res.status(404).json({
                success: false,
                error: '接口不存在'
            });
        });
        
        // 全局错误处理
        this.app.use((error, req, res, next) => {
            logger.error('Express错误', {
                error: error.message,
                stack: error.stack,
                url: req.url,
                method: req.method
            });
            
            res.status(500).json({
                success: false,
                error: '服务器内部错误'
            });
        });
        
        // 进程错误处理
        process.on('uncaughtException', (error) => {
            logger.error('未捕获的异常', {
                error: error.message,
                stack: error.stack
            });
            process.exit(1);
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('未处理的Promise拒绝', {
                reason: reason.toString(),
                promise: promise.toString()
            });
        });
    }
    
    ensureDirectories() {
        const directories = [
            config.streams.directory,
            path.dirname(config.logging.file)
        ];
        
        directories.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                logger.info('创建目录', { dir });
            }
        });
    }
    
    startCleanupTask() {
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredFiles();
        }, config.streams.cleanupInterval);
    }
    
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            this.checkConnections();
        }, config.websocket.heartbeatInterval);
    }
    
    checkConnections() {
        const now = Date.now();
        const timeout = config.websocket.heartbeatInterval * 2;

        this.wsConnections.forEach((clientInfo, connectionId) => {
            // 检查连接是否超时
            if (now - clientInfo.lastPing > timeout) {
                logger.warn('连接超时，关闭连接', { connectionId });
                clientInfo.ws.terminate();
                this.wsConnections.delete(connectionId);
            } else {
                // 发送应用层ping消息
                this.sendMessage(connectionId, { type: 'ping' });
            }
        });
    }
    
    cleanupExpiredFiles() {
        try {
            const files = fs.readdirSync(config.streams.directory);
            const now = Date.now();
            
            files.forEach(file => {
                const filePath = path.join(config.streams.directory, file);
                const stats = fs.statSync(filePath);
                
                // 删除超过最大时间的文件
                if (now - stats.mtimeMs > config.streams.maxAge) {
                    fs.unlinkSync(filePath);
                    logger.debug('删除过期文件', { file, age: now - stats.mtimeMs });
                }
            });
        } catch (error) {
            logger.error('清理文件失败', { error: error.message });
        }
    }
    
    generateConnectionId() {
        return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    generateStreamId(connectionId) {
        return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    getActiveStreamsInfo() {
        return Array.from(this.activeStreams.entries()).map(([id, info]) => ({
            id,
            rtspUrl: info.rtspUrl,
            connections: info.connections.length,
            startTime: info.startTime,
            duration: Date.now() - info.startTime,
            status: info.command && info.command.kill ? 'active' : 'inactive'
        }));
    }
    
    sendError(connectionId, message) {
        const clientInfo = this.wsConnections.get(connectionId);
        if (clientInfo && clientInfo.ws.readyState === WebSocket.OPEN) {
            clientInfo.ws.send(JSON.stringify({
                type: 'error',
                message: message,
                timestamp: new Date().toISOString()
            }));
        }
    }
    
    sendMessage(connectionId, message) {
        const clientInfo = this.wsConnections.get(connectionId);
        if (clientInfo && clientInfo.ws.readyState === WebSocket.OPEN) {
            clientInfo.ws.send(JSON.stringify({
                ...message,
                timestamp: new Date().toISOString()
            }));
        }
    }
    
    validateRtspUrl(url) {
        if (!url || typeof url !== 'string') {
            return { valid: false, error: 'URL不能为空' };
        }

        // 去除首尾空格
        url = url.trim();

        if (!url.startsWith('rtsp://')) {
            return { valid: false, error: '无效的RTSP URL，必须以 rtsp:// 开头' };
        }

        // 检查URL长度限制
        if (url.length > 2048) {
            return { valid: false, error: 'URL长度超过限制' };
        }

        // 检查潜在的命令注入
        const dangerousPatterns = [
            /[;&|`$()]/,  // Shell命令注入字符
            /\.\./,       // 路径遍历
            /file:\/\//i, // file协议
            /\/etc\//,    // 系统文件路径
            /\\/i,        // Windows路径分隔符
        ];

        for (const pattern of dangerousPatterns) {
            if (pattern.test(url)) {
                return { valid: false, error: 'URL包含非法字符' };
            }
        }

        // URL格式验证
        try {
            const parsedUrl = new URL(url);

            // 检查协议是否为rtsp或rtsps
            if (!['rtsp:', 'rtsps:'].includes(parsedUrl.protocol)) {
                return { valid: false, error: '只支持 RTSP 和 RTSPS 协议' };
            }

            // 检查是否有主机名
            if (!parsedUrl.hostname) {
                return { valid: false, error: 'URL缺少主机名' };
            }

        } catch (error) {
            return { valid: false, error: '无效的URL格式' };
        }

        return { valid: true };
    }
    
    startRtspStream(rtspUrl, connectionId) {
        const validation = this.validateRtspUrl(rtspUrl);
        if (!validation.valid) {
            this.sendError(connectionId, validation.error);
            return;
        }
        
        const streamId = this.generateStreamId(connectionId);
        
        logger.info('开始处理RTSP流', {
            rtspUrl,
            streamId,
            connectionId
        });
        
        this.sendMessage(connectionId, {
            type: 'streamStarted',
            streamId: streamId,
            message: 'RTSP流开始处理'
        });
        
        const outputPath = path.join(config.streams.directory, `${streamId}.m3u8`);

        logger.info('FFmpeg输出路径', { outputPath });

        // 确保流目录存在
        if (!fs.existsSync(config.streams.directory)) {
            fs.mkdirSync(config.streams.directory, { recursive: true });
            logger.info('创建流输出目录', { directory: config.streams.directory });
        }

        try {
            const command = ffmpeg(rtspUrl)
                .inputOptions(['-rtsp_transport', config.ffmpeg.rtsp_transport])
                .inputOptions(['-use_wallclock_as_timestamps', config.ffmpeg.use_wallclock_as_timestamps])
                .inputOptions(['-timeout', (config.ffmpeg.timeout * 1000000).toString()]) // 转换为微秒
                .videoCodec(config.ffmpeg.vcodec)
                .audioCodec(config.ffmpeg.acodec)
                .size(config.ffmpeg.size)
                .fps(config.ffmpeg.fps)
                .outputOptions(['-tune', config.ffmpeg.tune])
                .outputOptions(['-preset', config.ffmpeg.preset])
                .outputOptions(['-g', config.ffmpeg.g.toString()])
                .outputOptions(['-keyint_min', config.ffmpeg.keyint_min.toString()])
                .outputOptions(['-sc_threshold', config.ffmpeg.sc_threshold.toString()])
                .outputOptions(['-f', 'hls'])
                .outputOptions(['-hls_time', config.hls.hls_time.toString()])
                .outputOptions(['-hls_list_size', config.hls.hls_list_size.toString()])
                .outputOptions(['-hls_flags', config.hls.hls_flags])
                .outputOptions(['-start_number', config.hls.start_number.toString()])
                .on('start', (cmd) => {
                    logger.info('FFmpeg命令执行', { command: cmd });
                })
                .on('error', (err, stdout, stderr) => {
                    logger.error('FFmpeg错误', {
                        streamId,
                        rtspUrl,
                        error: err.message,
                        stdout: stdout?.substring(0, 1000),
                        stderr: stderr?.substring(0, 1000)
                    });

                    this.sendError(connectionId, `FFmpeg错误: ${err.message}`);
                    this.cleanupStream(streamId);
                })
                .on('end', () => {
                    logger.info('RTSP流正常结束', { streamId, rtspUrl });
                    
                    this.sendMessage(connectionId, {
                        type: 'streamEnded',
                        streamId: streamId,
                        message: 'RTSP流已结束'
                    });
                    
                    this.cleanupStream(streamId);
                })
                .on('progress', (progress) => {
                    logger.debug('FFmpeg进度', {
                        streamId,
                        percent: progress.percent,
                        currentKbps: progress.currentKbps,
                        targetSize: progress.targetSize
                    });
                })
                .save(outputPath);
            
            this.activeStreams.set(streamId, {
                command: command,
                connections: [connectionId],
                rtspUrl: rtspUrl,
                startTime: Date.now(),
                timeoutId: null
            });
            
        } catch (error) {
            logger.error('创建FFmpeg进程失败', {
                rtspUrl,
                error: error.message
            });
            this.sendError(connectionId, '启动转码失败');
        }
    }
    
    stopRtspStream(streamId, connectionId) {
        const streamInfo = this.activeStreams.get(streamId);
        if (!streamInfo) {
            this.sendError(connectionId, '流不存在');
            return;
        }
        
        logger.info('停止RTSP流', {
            streamId,
            connectionId,
            rtspUrl: streamInfo.rtspUrl
        });
        
        // 从连接列表中移除当前连接
        streamInfo.connections = streamInfo.connections.filter(id => id !== connectionId);
        
        // 如果没有连接使用这个流，则停止FFmpeg进程
        if (streamInfo.connections.length === 0) {
            try {
                if (streamInfo.command) {
                    streamInfo.command.kill('SIGTERM');

                    // 强制杀死超时，存储timeoutId以便清理
                    streamInfo.timeoutId = setTimeout(() => {
                        if (this.activeStreams.has(streamId)) {
                            const info = this.activeStreams.get(streamId);
                            if (info && info.command) {
                                info.command.kill('SIGKILL');
                            }
                            this.cleanupStream(streamId);
                        }
                    }, 5000);

                    // 更新streamInfo以包含timeoutId
                    this.activeStreams.set(streamId, streamInfo);
                }
            } catch (error) {
                logger.error('停止FFmpeg进程失败', {
                    streamId,
                    error: error.message
                });
            }

            this.cleanupStream(streamId);
        } else {
            this.activeStreams.set(streamId, streamInfo);
        }
        
        this.sendMessage(connectionId, {
            type: 'streamStopped',
            streamId: streamId,
            message: 'RTSP流已停止'
        });
    }
    
    cleanupStream(streamId) {
        logger.debug('清理流资源', { streamId });

        // 获取流信息并清除超时定时器
        const streamInfo = this.activeStreams.get(streamId);
        if (streamInfo && streamInfo.timeoutId) {
            clearTimeout(streamInfo.timeoutId);
            streamInfo.timeoutId = null;
        }

        // 清理内存中的流信息
        this.activeStreams.delete(streamId);

        // 删除HLS文件
        try {
            const files = fs.readdirSync(config.streams.directory);
            const deletedFiles = [];

            files.forEach(file => {
                if (file.startsWith(`${streamId}.`)) {
                    fs.unlinkSync(path.join(config.streams.directory, file));
                    deletedFiles.push(file);
                }
            });

            if (deletedFiles.length > 0) {
                logger.debug('删除HLS文件', { streamId, files: deletedFiles });
            }
        } catch (error) {
            logger.error('清理HLS文件失败', {
                streamId,
                error: error.message
            });
        }
    }
    
    serveHLSPlaylist(req, res) {
        const streamId = req.params.streamId;
        const streamInfo = this.activeStreams.get(streamId);

        logger.debug('请求HLS播放列表', { streamId, exists: !!streamInfo });

        if (!streamInfo) {
            logger.warn('流不存在', { streamId });
            res.status(404).json({ error: '流不存在' });
            return;
        }

        const filePath = path.join(config.streams.directory, `${streamId}.m3u8`);

        logger.debug('检查播放列表文件', { filePath, exists: fs.existsSync(filePath) });

        if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.sendFile(filePath);
        } else {
            logger.warn('播放列表文件不存在', { filePath });
            res.status(404).json({ error: '播放列表文件不存在' });
        }
    }

    serveHLSSegment(req, res) {
        const { streamId, segment } = req.params;
        const streamInfo = this.activeStreams.get(streamId);

        if (!streamInfo) {
            logger.warn('流不存在', { streamId });
            res.status(404).json({ error: '流不存在' });
            return;
        }

        const filePath = path.join(config.streams.directory, `${streamId}-${segment}`);

        if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', 'video/MP2T');
            res.setHeader('Cache-Control', 'max-age=30');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.sendFile(filePath);
        } else {
            logger.warn('分片文件不存在', { filePath, segment });
            res.status(404).json({ error: '分片文件不存在' });
        }
    }
    
    gracefulShutdown() {
        logger.info('开始优雅关闭服务器...');

        // 停止清理任务
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        // 停止心跳
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }

        // 停止所有流
        this.activeStreams.forEach((streamInfo, streamId) => {
            try {
                // 清除超时定时器
                if (streamInfo.timeoutId) {
                    clearTimeout(streamInfo.timeoutId);
                }

                if (streamInfo.command) {
                    streamInfo.command.kill('SIGTERM');
                }
            } catch (error) {
                logger.error('停止流失败', { streamId, error: error.message });
            }
        });

        // 关闭所有WebSocket连接
        this.wsConnections.forEach((clientInfo, connectionId) => {
            try {
                clientInfo.ws.close(1001, '服务器关闭');
            } catch (error) {
                logger.error('关闭连接失败', { connectionId, error: error.message });
            }
        });

        // 停止接受新连接并关闭服务器
        this.server.close(() => {
            logger.info('HTTP服务器已关闭');

            // 停止WebSocket服务器
            if (this.wss) {
                this.wss.close(() => {
                    logger.info('WebSocket服务器已关闭');
                    logger.info('服务器优雅关闭完成');
                    process.exit(0);
                });
            } else {
                logger.info('服务器优雅关闭完成');
                process.exit(0);
            }
        });

        // 如果服务器在10秒内没有关闭，强制退出
        setTimeout(() => {
            logger.warn('服务器关闭超时，强制退出');
            process.exit(1);
        }, 10000);
    }
    
    start() {
        console.log(`准备启动服务器，主机: ${config.server.host}, 端口: ${config.server.port}`);
        
        // 先启动HTTP服务器
        this.server.listen(config.server.port, config.server.host, () => {
            console.log(`RTSP播放器服务器启动成功，监听 ${config.server.host}:${config.server.port}`);
            logger.info('RTSP播放器服务器启动成功', {
                host: config.server.host,
                port: config.server.port,
                env: process.env.NODE_ENV || 'development'
            });
            console.log(`访问 http://localhost:${config.server.port} 或 http://${config.server.host}:${config.server.port} 开始使用`);
            
            // 然后设置WebSocket
            this.setupWebSocket();
            this.startHeartbeat();
        });
        
        // 优雅关闭处理
        process.on('SIGTERM', () => this.gracefulShutdown());
        process.on('SIGINT', () => this.gracefulShutdown());
    }
}

// 启动服务器
console.log('正在启动RTSP流媒体服务器...');
const rtspStreamer = new RTSPStreamer();
rtspStreamer.start();

module.exports = RTSPStreamer;