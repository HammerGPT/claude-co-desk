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
            
            
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
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
                    
                    this.messages.push(data);
                    this._handleMessage(data);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };
            
            this.ws.onclose = () => {
                this.isConnected = false;
                this.ws = null;
                this._notifyConnectionHandlers(false);
                
                // 3秒后尝试重连
                this.reconnectTimeout = setTimeout(() => {
                    this.connect();
                }, 3000);
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket Error:', error);
            };
            
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
        }
    }

    /**
     * 发送消息
     */
    sendMessage(message) {
        if (this.ws && this.isConnected) {
            const messageStr = JSON.stringify(message);
            this.ws.send(messageStr);
            return true;
        } else {
            console.warn('WebSocket not connected, unable to send message');
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
        
        // 优先处理会话状态相关消息
        this._handleSessionStateMessages(data);
        
        // 触发全局WebSocket事件（备用方案）
        document.dispatchEvent(new CustomEvent('websocketMessage', {
            detail: data
        }));
        
        if (this.messageHandlers.has(type)) {
            const handlers = this.messageHandlers.get(type);
            handlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error('消息处理器错误:', error);
                }
            });
        } else {
        }
    }

    /**
     * 处理会话状态消息 - 移植自claudecodeui
     */
    _handleSessionStateMessages(data) {
        const type = data.type;
        
        switch (type) {
            case 'claude-response':
                // Claude开始响应，标记会话为活跃
                if (data.session_id && window.app) {
                    window.app.markSessionAsActive(data.session_id);
                }
                break;
                
            case 'claude-complete':
                // Claude完成响应，处理会话状态
                if (data.session_id && window.chatInterface) {
                    window.chatInterface.handleSessionComplete(data.session_id, data.exitCode);
                }
                break;
                
            case 'session-created':
                // 新会话创建
                if (data.sessionId && data.tempSessionId && window.chatInterface) {
                    window.chatInterface.handleSessionCreated(data.sessionId, data.tempSessionId);
                }
                break;
                
            case 'session-resumed':
                // 会话恢复
                if (data.sessionId && window.app) {
                    window.app.markSessionAsActive(data.sessionId);
                }
                break;
                
            case 'create-task-tab':
                // 创建任务页签
                if (data.taskId && data.taskName && window.enhancedSidebar) {
                    console.log(' 恢复会话:', data.resumeSession);
                    console.log(' 会话ID:', data.sessionId);
                    console.log('🔔 Received initialCommand from backend:', data.initialCommand);
                    console.log('🔔 initialCommand length:', data.initialCommand ? data.initialCommand.length : 0);
                    
                    // 传递所有必要参数给createTaskTab
                    window.enhancedSidebar.createTaskTab(
                        data.taskId, 
                        data.taskName, 
                        data.initialCommand, 
                        data.workingDirectory,
                        data.resumeSession,
                        data.sessionId
                    );
                }
                break;
                
                
            case 'task-error':
                // 处理任务错误
                if (data.taskId && data.error) {
                    console.error('任务执行错误:', data);
                    this._showTaskError(data);
                }
                break;
                
            case 'task-session-captured':
                // 处理任务会话捕获成功，刷新任务数据
                if (data.taskId && data.sessionId) {
                    console.log(' 任务会话已捕获:', data);
                    console.log(' 刷新任务列表以更新按钮状态');
                    
                    // 通知任务管理器刷新数据
                    if (window.taskManager) {
                        window.taskManager.loadTasks().then(() => {
                            console.log('任务数据刷新完成');
                        });
                    }
                }
                break;
        }
    }

    /**
     * 显示任务错误通知
     */
    _showTaskError(errorData) {
        const { taskId, error, category = 'execution' } = errorData;
        
        // 获取错误图标
        const errorIcons = {
            validation: '',
            system: '',
            execution: ''
        };
        const icon = errorIcons[category] || '';
        
        // 创建错误通知元素
        const notification = document.createElement('div');
        notification.className = 'task-error-notification';
        notification.innerHTML = `
            <div class="notification-content error">
                <span class="notification-icon">${icon}</span>
                <div class="notification-details">
                    <div class="notification-title">${t('task.executionFailed')}</div>
                    <div class="notification-message">${this._escapeHtml(error)}</div>
                    <div class="notification-taskid">任务ID: ${taskId}</div>
                </div>
                <button class="notification-close" onclick="this.parentElement.remove()">×</button>
            </div>
        `;
        
        // 添加样式
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--destructive);
            color: var(--destructive-foreground);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 16px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 10001;
            max-width: 400px;
            animation: slideInRight 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        // 10秒后自动移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease-out';
                setTimeout(() => {
                    notification.remove();
                }, 300);
            }
        }, 10000);
    }
    
    /**
     * HTML转义
     */
    _escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 通知连接状态变化
     */
    _notifyConnectionHandlers(connected) {
        this.connectionHandlers.forEach(handler => {
            try {
                handler(connected);
            } catch (error) {
                console.error('连接状态处理器错误:', error);
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
        // 自动重连相关
        this.reconnectTimeout = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000; // 3秒重连间隔
        this.shouldReconnect = true; // 是否应该自动重连
        // 心跳机制 - 设置极长间隔实现静默连接
        this.heartbeatInterval = null;
        this.heartbeatFrequency = 86400000; // 24小时心跳间隔（基本等于禁用）
        this.missedHeartbeats = 0;
        this.maxMissedHeartbeats = 999; // 极大容忍度，基本不会触发断开
    }

    /**
     * 连接Shell WebSocket
     */
    async connect() {
        // 防止重复连接
        if (this.isConnecting) {
            console.warn('Shell WebSocket正在连接中，忽略重复请求');
            return Promise.resolve();
        }
        
        if (this.isConnected) {
            console.log('Shell WebSocket已连接，无需重复连接');
            return Promise.resolve();
        }
        
        this.isConnecting = true;
        
        return new Promise((resolve, reject) => {
            try {
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = `${protocol}//${window.location.host}/shell`;
                
                console.log('连接Shell WebSocket:', wsUrl);
                
                this.ws = new WebSocket(wsUrl);
                
                this.ws.onopen = () => {
                    console.log('Shell WebSocket连接已建立');
                    this.isConnected = true;
                    this.isConnecting = false;
                    this.reconnectAttempts = 0; // 重置重连计数器
                    this.missedHeartbeats = 0; // 重置心跳计数器
                    this._startHeartbeat(); // 启动心跳
                    this._notifyConnectionHandlers(true);
                    resolve(); // 连接成功后resolve
                };
                
                this.ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this._handleMessage(data);
                    } catch (error) {
                        console.error('解析Shell WebSocket消息失败:', error);
                    }
                };
                
                this.ws.onclose = (event) => {
                    console.log('Shell WebSocket连接已断开');
                    console.log('断开详情:', {
                        code: event.code,
                        reason: event.reason,
                        wasClean: event.wasClean,
                        timestamp: new Date().toISOString(),
                        url: this.ws?.url
                    });
                    console.trace('WebSocket断开调用栈');
                    this.isConnected = false;
                    this.isConnecting = false;
                    this.ws = null;
                    this._stopHeartbeat(); // 停止心跳
                    this._notifyConnectionHandlers(false);
                    
                    // 自动重连机制
                    if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.reconnectAttempts++;
                        console.log(` 尝试重新连接Shell WebSocket (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
                        
                        this.reconnectTimeout = setTimeout(() => {
                            this.connect().catch(error => {
                                console.error('Shell WebSocket重连失败:', error);
                            });
                        }, this.reconnectDelay);
                    } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                        console.error('Shell WebSocket重连次数已达上限，停止重连');
                    }
                };
                
                this.ws.onerror = (error) => {
                    console.error('Shell WebSocket Error:', error);
                    this.isConnected = false;
                    this.isConnecting = false;
                    reject(error); // 连接失败时reject
                };
                
            } catch (error) {
                console.error('创建Shell WebSocket连接失败:', error);
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
     * 手动断开连接（不自动重连）
     */
    manualDisconnect() {
        console.log('[SHELL WS] 手动断开Shell WebSocket连接');
        console.trace('手动断开调用栈');
        this.shouldReconnect = false; // 禁用自动重连
        // 清理重连计时器
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        this.disconnect();
    }

    /**
     * 断开连接
     */
    disconnect() {
        console.log('[SHELL WS] 正在断开Shell WebSocket连接...');
        console.trace('disconnect()调用栈');
        
        this._stopHeartbeat(); // 停止心跳
        
        // 清理重连计时器
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        
        if (this.ws) {
            // 先移除事件监听器，防止触发重连
            this.ws.onclose = null;
            this.ws.onerror = null;
            this.ws.close();
            this.ws = null;
        }
        
        this.isConnected = false;
        this.isConnecting = false;
        
        // 通知连接状态变化
        this._notifyConnectionHandlers(false);
        
        console.log('[SHELL WS] Shell WebSocket连接已断开');
    }

    /**
     * 处理收到的消息
     */
    _handleMessage(data) {
        const type = data.type;
        
        // 特殊处理心跳响应
        if (type === 'pong') {
            this._handlePong(data);
            return;
        }
        
        if (this.messageHandlers.has(type)) {
            const handlers = this.messageHandlers.get(type);
            handlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error('Shell消息处理器错误:', error);
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
                console.error('Shell连接状态处理器错误:', error);
            }
        });
    }

    /**
     * 启动心跳机制 - 完全禁用以避免自动断开
     */
    _startHeartbeat() {
        // 完全禁用心跳机制，避免任何可能的自动断开
        console.log('Shell WebSocket心跳机制已禁用，保持永久连接');
        return;
        
        /* 原心跳逻辑已禁用
        this._stopHeartbeat(); // 先清理现有心跳
        
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected && this.ws) {
                const timestamp = Date.now();
                this.sendMessage({
                    type: 'ping',
                    timestamp: timestamp
                });
                
                // 记录心跳发送
                this._lastPingTime = timestamp;
                this.missedHeartbeats++;
                
                // 检查是否超过最大丢失心跳数
                if (this.missedHeartbeats > this.maxMissedHeartbeats) {
                    console.warn('Shell WebSocket心跳超时，主动断开连接');
                    this.disconnect();
                }
            }
        }, this.heartbeatFrequency);
        
        console.log('Shell WebSocket心跳机制已启动');
        */
    }

    /**
     * 停止心跳机制
     */
    _stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
            console.log('Shell WebSocket心跳机制已停止');
        }
    }

    /**
     * 处理心跳响应
     */
    _handlePong(data) {
        this.missedHeartbeats = 0; // 重置丢失计数
        const latency = Date.now() - data.timestamp;
        console.log(`Shell WebSocket心跳响应: ${latency}ms`);
    }

    /**
     * 完全清理WebSocket连接和资源
     */
    cleanup() {
        console.log('[SHELL WS] 开始清理Shell WebSocket资源...');
        
        // 禁用自动重连
        this.shouldReconnect = false;
        
        // 停止心跳
        this._stopHeartbeat();
        
        // 清理所有计时器
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        
        // 清理WebSocket连接
        if (this.ws) {
            this.ws.onopen = null;
            this.ws.onmessage = null;
            this.ws.onclose = null;
            this.ws.onerror = null;
            
            if (this.ws.readyState === WebSocket.OPEN) {
                this.ws.close();
            }
            this.ws = null;
        }
        
        // 重置状态
        this.isConnected = false;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.missedHeartbeats = 0;
        
        // 清理处理器
        this.messageHandlers.clear();
        this.connectionHandlers = [];
        
        console.log('[SHELL WS] Shell WebSocket资源清理完成');
    }
}

// 导出全局实例
window.wsManager = new WebSocketManager();
window.shellWsManager = new ShellWebSocketManager();

// 为了兼容性，添加别名
window.websocketManager = window.wsManager;

// 添加全局调试监听器
window.addEventListener('load', () => {
    
    // 监听所有可能导致页面状态变化的事件
    ['beforeunload', 'pagehide', 'visibilitychange', 'focus', 'blur'].forEach(eventType => {
        document.addEventListener(eventType, (event) => {
            console.log(`[GLOBAL DEBUG] page event triggered: ${eventType}`, {
                hidden: document.hidden,
                visibilityState: document.visibilityState,
                hasFocus: document.hasFocus(),
                shellConnected: window.shellWsManager?.isConnected,
                timestamp: new Date().toISOString()
            });
        });
    });
});