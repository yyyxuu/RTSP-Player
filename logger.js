// 日志记录器
const fs = require('fs');
const path = require('path');

class Logger {
    constructor(config) {
        this.config = config.logging;
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
        
        this.currentLevel = this.levels[this.config.level] || 2;
        
        // 确保日志目录存在
        this.ensureLogDirectory();
        
        // 定期清理日志文件
        if (this.config.maxFiles) {
            this.startLogCleanup();
        }
    }
    
    ensureLogDirectory() {
        const logDir = path.dirname(this.config.file);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }
    
    formatMessage(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const metaString = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
        return `[${timestamp}] [${level.toUpperCase()}] ${message} ${metaString}`.trim();
    }
    
    writeToFile(level, formattedMessage) {
        if (!this.config.file) return;

        // 使用异步写入避免阻塞事件循环
        fs.appendFile(this.config.file, formattedMessage + '\n', (error) => {
            if (error) {
                console.error('写入日志文件失败:', error.message);
            }
        });
    }
    
    shouldLog(level) {
        return this.levels[level] <= this.currentLevel;
    }
    
    log(level, message, meta = {}) {
        if (!this.shouldLog(level)) return;
        
        const formattedMessage = this.formatMessage(level, message, meta);
        
        // 输出到控制台
        switch (level) {
            case 'error':
                console.error(formattedMessage);
                break;
            case 'warn':
                console.warn(formattedMessage);
                break;
            case 'debug':
                console.debug(formattedMessage);
                break;
            default:
                console.log(formattedMessage);
        }
        
        // 写入文件
        this.writeToFile(level, formattedMessage);
    }
    
    error(message, meta = {}) {
        this.log('error', message, meta);
    }
    
    warn(message, meta = {}) {
        this.log('warn', message, meta);
    }
    
    info(message, meta = {}) {
        this.log('info', message, meta);
    }
    
    debug(message, meta = {}) {
        this.log('debug', message, meta);
    }
    
    startLogCleanup() {
        // 每天检查一次日志文件
        const interval = 24 * 60 * 60 * 1000;
        setInterval(() => {
            this.cleanupOldLogs();
        }, interval);
    }
    
    cleanupOldLogs() {
        const logDir = path.dirname(this.config.file);
        const logFile = path.basename(this.config.file);
        const logName = path.basename(logFile, path.extname(logFile)); // 获取不带扩展名的文件名

        try {
            const files = fs.readdirSync(logDir);
            // 匹配所有相关的日志文件（包括轮转的文件，如 app.log.1, app.log.2 等）
            const logFiles = files.filter(file => {
                const fileBaseName = path.basename(file, path.extname(file));
                return fileBaseName === logName && file !== logFile;
            });

            // 删除超过最大文件数的日志
            if (logFiles.length >= this.config.maxFiles) {
                logFiles.sort().slice(0, logFiles.length - this.config.maxFiles + 1).forEach(file => {
                    fs.unlinkSync(path.join(logDir, file));
                    this.info('删除旧日志文件', { file });
                });
            }
        } catch (error) {
            this.error('清理日志文件失败', { error: error.message });
        }
    }
}

module.exports = Logger;
