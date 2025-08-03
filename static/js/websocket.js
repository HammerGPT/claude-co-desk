/**
 * WebSocket管理模块
 * 移植自claudecodeui/src/utils/websocket.js
 */

class WebSocketManager {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.messages = [];
        this.reconnectTimeout = null;
        this.messageHandlers = new Map();
        this.connectionHandlers = [];
    }

    /**
     * 连接WebSocket
     */
    async connect() {
        try {
            // 确定WebSocket URL
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws`;
            
            console.log('🔗 连接WebSocket:', wsUrl);
            
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('✅ WebSocket连接已建立');
                this.isConnected = true;
                this._notifyConnectionHandlers(true);
                
                // 清除重连定时器
                if (this.reconnectTimeout) {
                    clearTimeout(this.reconnectTimeout);
                    this.reconnectTimeout = null;
                }
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('📨 收到WebSocket消息:', data);
                    
                    this.messages.push(data);
                    this._handleMessage(data);
                } catch (error) {
                    console.error('❌ 解析WebSocket消息失败:', error);
                }
            };
            
            this.ws.onclose = () => {
                console.log('🔌 WebSocket连接已断开');
                this.isConnected = false;
                this.ws = null;
                this._notifyConnectionHandlers(false);
                
                // 3秒后尝试重连
                this.reconnectTimeout = setTimeout(() => {
                    console.log('🔄 尝试重新连接WebSocket...');
                    this.connect();
                }, 3000);
            };
            
            this.ws.onerror = (error) => {
                console.error('❌ WebSocket错误:', error);
            };
            
        } catch (error) {
            console.error('❌ 创建WebSocket连接失败:', error);
        }
    }

    /**
     * 发送消息
     */
    sendMessage(message) {
        if (this.ws && this.isConnected) {
            const messageStr = JSON.stringify(message);
            console.log('📤 发送WebSocket消息:', messageStr);
            this.ws.send(messageStr);
            return true;
        } else {
            console.warn('⚠️ WebSocket未连接，无法发送消息');
            return false;
        }
    }

    /**
     * 注册消息处理器
     */
    onMessage(type, handler) {
        if (!this.messageHandlers.has(type)) {
            this.messageHandlers.set(type, []);
        }
        this.messageHandlers.get(type).push(handler);
    }

    /**
     * 移除消息处理器
     */
    offMessage(type, handler) {
        if (this.messageHandlers.has(type)) {
            const handlers = this.messageHandlers.get(type);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    /**
     * 注册连接状态处理器
     */
    onConnection(handler) {
        this.connectionHandlers.push(handler);
    }

    /**
     * 移除连接状态处理器
     */
    offConnection(handler) {
        const index = this.connectionHandlers.indexOf(handler);
        if (index > -1) {
            this.connectionHandlers.splice(index, 1);
        }
    }

    /**
     * 断开连接
     */
    disconnect() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        this.isConnected = false;
    }

    /**
     * 处理收到的消息
     */
    _handleMessage(data) {
        const type = data.type;
        if (this.messageHandlers.has(type)) {
            const handlers = this.messageHandlers.get(type);
            handlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error('❌ 消息处理器错误:', error);
                }
            });
        }
    }

    /**
     * 通知连接状态变化
     */
    _notifyConnectionHandlers(connected) {
        this.connectionHandlers.forEach(handler => {
            try {
                handler(connected);
            } catch (error) {
                console.error('❌ 连接状态处理器错误:', error);
            }
        });
    }

    /**
     * 发送Claude命令
     */
    sendClaudeCommand(command, options = {}) {
        return this.sendMessage({
            type: 'claude-command',
            command,
            options
        });
    }

    /**
     * 中止Claude会话
     */
    abortClaudeSession(sessionId) {
        return this.sendMessage({
            type: 'abort-session',
            sessionId
        });
    }

    /**
     * 发送心跳
     */
    ping() {
        return this.sendMessage({
            type: 'ping'
        });
    }
}

// Shell WebSocket管理器
class ShellWebSocketManager {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.isConnecting = false;  // 添加连接状态锁
        this.messageHandlers = new Map();
        this.connectionHandlers = [];
    }

    /**
     * 连接Shell WebSocket
     */
    async connect() {
        // 防止重复连接
        if (this.isConnecting) {
            console.warn('⚠️ Shell WebSocket正在连接中，忽略重复请求');
            return Promise.resolve();
        }
        
        if (this.isConnected) {
            console.log('✅ Shell WebSocket已连接，无需重复连接');
            return Promise.resolve();
        }
        
        this.isConnecting = true;
        
        return new Promise((resolve, reject) => {
            try {
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = `${protocol}//${window.location.host}/shell`;
                
                console.log('🐚 连接Shell WebSocket:', wsUrl);
                
                this.ws = new WebSocket(wsUrl);
                
                this.ws.onopen = () => {
                    console.log('✅ Shell WebSocket连接已建立');
                    this.isConnected = true;
                    this.isConnecting = false;
                    this._notifyConnectionHandlers(true);
                    resolve(); // 连接成功后resolve
                };
                
                this.ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this._handleMessage(data);
                    } catch (error) {
                        console.error('❌ 解析Shell WebSocket消息失败:', error);
                    }
                };
                
                this.ws.onclose = () => {
                    console.log('🔌 Shell WebSocket连接已断开');
                    this.isConnected = false;
                    this.isConnecting = false;
                    this.ws = null;
                    this._notifyConnectionHandlers(false);
                };
                
                this.ws.onerror = (error) => {
                    console.error('❌ Shell WebSocket错误:', error);
                    this.isConnected = false;
                    this.isConnecting = false;
                    reject(error); // 连接失败时reject
                };
                
            } catch (error) {
                console.error('❌ 创建Shell WebSocket连接失败:', error);
                this.isConnecting = false;
                reject(error);
            }
        });
    }

    /**
     * 发送消息
     */
    sendMessage(message) {
        if (this.ws && this.isConnected) {
            this.ws.send(JSON.stringify(message));
            return true;
        }
        return false;
    }

    /**
     * 初始化终端
     */
    initTerminal(projectPath, sessionId = null, hasSession = false, cols = 80, rows = 24) {
        return this.sendMessage({
            type: 'init',
            projectPath,
            sessionId,
            hasSession,
            cols,
            rows
        });
    }

    /**
     * 发送输入
     */
    sendInput(data) {
        return this.sendMessage({
            type: 'input',
            data
        });
    }

    /**
     * 调整终端大小
     */
    resize(cols, rows) {
        return this.sendMessage({
            type: 'resize',
            cols,
            rows
        });
    }

    /**
     * 注册消息处理器
     */
    onMessage(type, handler) {
        if (!this.messageHandlers.has(type)) {
            this.messageHandlers.set(type, []);
        }
        this.messageHandlers.get(type).push(handler);
    }

    /**
     * 注册连接状态处理器
     */
    onConnection(handler) {
        this.connectionHandlers.push(handler);
    }

    /**
     * 断开连接
     */
    disconnect() {
        console.log('🔌 正在断开Shell WebSocket连接...');
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        this.isConnected = false;
        this.isConnecting = false;
        
        // 通知连接状态变化
        this._notifyConnectionHandlers(false);
    }

    /**
     * 处理收到的消息
     */
    _handleMessage(data) {
        const type = data.type;
        if (this.messageHandlers.has(type)) {
            const handlers = this.messageHandlers.get(type);
            handlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error('❌ Shell消息处理器错误:', error);
                }
            });
        }
    }

    /**
     * 通知连接状态变化
     */
    _notifyConnectionHandlers(connected) {
        this.connectionHandlers.forEach(handler => {
            try {
                handler(connected);
            } catch (error) {
                console.error('❌ Shell连接状态处理器错误:', error);
            }
        });
    }
}

// 导出全局实例
window.wsManager = new WebSocketManager();
window.shellWsManager = new ShellWebSocketManager();