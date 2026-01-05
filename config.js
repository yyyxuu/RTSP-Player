// 配置文件
const path = require('path');
const fs = require('fs');

// 默认配置
const defaultConfig = {
    server: {
        port: process.env.PORT || 8080,
        host: process.env.HOST || '0.0.0.0'
    },
    streams: {
        directory: path.join(__dirname, 'public', 'streams'),
        cleanupInterval: 60000, // 1分钟
        maxAge: 300000 // 5分钟
    },
    hls: {
        hls_time: 2,
        hls_list_size: 3,
        hls_flags: 'delete_segments',
        start_number: 0
    },
    ffmpeg: {
        rtsp_transport: 'tcp',
        use_wallclock_as_timestamps: '1',
        vcodec: 'libx264',
        acodec: 'aac',
        size: '640x480',
        fps: 25,
        tune: 'zerolatency',
        preset: 'ultrafast',
        g: 50,
        keyint_min: 25,
        sc_threshold: 0,
        timeout: 30000 // 30秒超时
    },
    websocket: {
        heartbeatInterval: 30000, // 30秒心跳
        maxConnections: 100,
        noServer: true // 使用独立的WebSocket服务器
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        file: path.join(__dirname, 'logs', 'app.log'),
        maxSize: '10m',
        maxFiles: 5
    }
};

// 用户配置文件路径
const userConfigPath = path.join(__dirname, 'user.config.json');

// 加载用户配置
let userConfig = {};
if (fs.existsSync(userConfigPath)) {
    try {
        const userConfigData = fs.readFileSync(userConfigPath, 'utf8');
        userConfig = JSON.parse(userConfigData);
        console.log('已加载用户配置文件:', userConfigPath);
    } catch (error) {
        console.error('加载用户配置文件失败:', error.message);
    }
}

// 合并配置 - 支持深度合并
function mergeConfig(defaultConfig, userConfig) {
    const merged = { ...defaultConfig };

    for (const key in userConfig) {
        // 如果两边都是对象且不是数组，则递归合并
        if (typeof userConfig[key] === 'object' && !Array.isArray(userConfig[key]) &&
            typeof merged[key] === 'object' && !Array.isArray(merged[key])) {
            merged[key] = mergeConfig(merged[key], userConfig[key]);
        } else {
            // 否则直接覆盖
            merged[key] = userConfig[key];
        }
    }

    return merged;
}

module.exports = mergeConfig(defaultConfig, userConfig);
