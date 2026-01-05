// 示例配置文件
// 复制为 config.js 并根据需要修改配置

module.exports = {
    server: {
        port: 3000,              // 服务器端口
        host: '0.0.0.0'          // 服务器地址
    },
    streams: {
        directory: './public/streams',  // HLS文件存储目录
        cleanupInterval: 60000,          // 清理间隔(毫秒)
        maxAge: 300000                    // 文件最大保存时间(毫秒)
    },
    hls: {
        hls_time: 2,            // HLS片段时长(秒)
        hls_list_size: 3,       // 播放列表大小
        hls_flags: 'delete_segments',  // HLS标志
        start_number: 0          // 起始编号
    },
    ffmpeg: {
        rtsp_transport: 'tcp',               // RTSP传输协议
        use_wallclock_as_timestamps: '1',    // 使用系统时钟作为时间戳
        vcodec: 'libx264',                   // 视频编码器
        acodec: 'aac',                       // 音频编码器
        size: '640x480',                     // 输出分辨率
        fps: 25,                             // 帧率
        tune: 'zerolatency',                 // 优化低延迟
        preset: 'ultrafast',                 // 编码速度预设
        g: 50,                               // GOP大小
        keyint_min: 25,                      // 最小关键帧间隔
        sc_threshold: 0,                     // 场景变化检测阈值
        timeout: 30000                       // 超时时间(毫秒)
    },
    websocket: {
        heartbeatInterval: 30000,  // 心跳间隔(毫秒)
        maxConnections: 100        // 最大连接数
    },
    logging: {
        level: 'info',                    // 日志级别 (error|warn|info|debug)
        file: './logs/app.log',            // 日志文件路径
        maxSize: '10m',                    // 单个日志文件最大大小
        maxFiles: 5                         // 最大日志文件数
    }
};
