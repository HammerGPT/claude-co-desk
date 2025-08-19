/**
 * 聊天界面模块
 * 移植自claudecodeui/src/components/ChatInterface.jsx
 */

class ChatInterface {
    constructor() {
        this.messages = [];
        this.sessionMessages = []; // 当前会话的原始消息
        this.currentSessionId = null;
        this.selectedSession = null;
        this.isLoading = false;
        this.isLoadingSessionMessages = false;
        this.selectedProject = null;
        this.messageCache = new Map(); // 会话消息缓存
        
        this.initElements();
        this.initEventListeners();
        this.initWebSocketHandlers();
    }

    /**
     * 初始化DOM元素引用
     */
    initElements() {
        this.chatMessages = document.getElementById('chat-messages');
        this.chatInput = document.getElementById('chat-input');
        this.sendBtn = document.getElementById('send-btn');
        this.chatPanel = document.getElementById('chat-panel');
    }

    /**
     * 初始化事件监听器
     */
    initEventListeners() {
        // 发送按钮点击事件
        this.sendBtn?.addEventListener('click', () => {
            this.handleSubmit();
        });

        // 输入框键盘事件
        this.chatInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSubmit();
            }
        });

        // 输入框自动调整高度
        this.chatInput?.addEventListener('input', () => {
            this.autoResizeTextarea();
        });
    }

    /**
     * 初始化WebSocket消息处理器
     */
    initWebSocketHandlers() {
        // Claude响应处理
        window.wsManager.onMessage('claude-response', (data) => {
            this.handleClaudeResponse(data.data);
        });

        // Claude输出处理
        window.wsManager.onMessage('claude-output', (data) => {
            this.handleClaudeOutput(data.data);
        });

        // Claude错误处理
        window.wsManager.onMessage('claude-error', (data) => {
            this.handleClaudeError(data.error);
        });

        // Claude完成处理
        window.wsManager.onMessage('claude-complete', (data) => {
            this.handleClaudeComplete(data);
        });

        // 会话创建处理
        window.wsManager.onMessage('session-created', (data) => {
            this.handleSessionCreated(data.sessionId);
        });

        // 会话中止处理
        window.wsManager.onMessage('session-aborted', (data) => {
            this.handleSessionAborted(data);
        });
        
        // 监听项目选择事件
        document.addEventListener('projectSelected', (e) => {
            this.setSelectedProject(e.detail.project);
        });
        
        // 监听会话选择事件
        document.addEventListener('sessionSelected', (e) => {
            // 适配不同的事件结构 - 有些事件只传session，有些传project和session
            const session = e.detail.session;
            const project = e.detail.project || (session ? {name: session.projectName, path: session.projectPath} : null);
            this.setSelectedSession(project, session);
        });
        
        // 监听新会话事件
        document.addEventListener('newSession', (e) => {
            this.createNewSession(e.detail.project);
        });
    }

    /**
     * 处理消息提交
     */
    handleSubmit() {
        const message = this.chatInput?.value?.trim();
        if (!message || this.isLoading) return;

        // 添加用户消息到界面
        this.addUserMessage(message);

        // 清空输入框
        this.chatInput.value = '';
        this.autoResizeTextarea();

        // 设置加载状态
        this.setLoading(true);

        // 构建选项
        const options = {
            projectPath: this.selectedProject?.path,
            cwd: this.selectedProject?.path,
            sessionId: this.currentSessionId,
            resume: !!this.currentSessionId,
            toolsSettings: this.getToolsSettings(),
            permissionMode: this.getPermissionMode()
        };

        // 发送Claude命令
        const success = window.wsManager.sendClaudeCommand(message, options);
        if (!success) {
            this.addErrorMessage('WebSocket连接未建立，请稍后重试');
            this.setLoading(false);
        }
    }

    /**
     * 添加用户消息
     */
    addUserMessage(message) {
        const messageData = {
            id: Date.now(),
            type: 'user',
            content: message,
            timestamp: new Date().toISOString()
        };

        this.messages.push(messageData);
        this.renderMessage(messageData);
        this.scrollToBottom();
        this.saveMessages();
    }

    /**
     * 添加助手消息
     */
    addAssistantMessage(content, type = 'text') {
        const messageData = {
            id: Date.now(),
            type: 'assistant',
            content,
            messageType: type,
            timestamp: new Date().toISOString()
        };

        this.messages.push(messageData);
        this.renderMessage(messageData);
        this.scrollToBottom();
        this.saveMessages();
    }

    /**
     * 添加错误消息
     */
    addErrorMessage(error) {
        const messageData = {
            id: Date.now(),
            type: 'error',
            content: error,
            timestamp: new Date().toISOString()
        };

        this.messages.push(messageData);
        this.renderMessage(messageData);
        this.scrollToBottom();
        this.saveMessages();
    }

    /**
     * 渲染单个消息
     */
    renderMessage(message) {
        const messageEl = document.createElement('div');
        messageEl.className = `chat-message ${message.type}`;
        messageEl.setAttribute('data-id', message.id);

        if (message.type === 'user') {
            messageEl.innerHTML = `
                <div class="message-bubble user">
                    <div class="message-content">${this.escapeHtml(message.content)}</div>
                    <div class="message-time">${this.formatTime(message.timestamp)}</div>
                </div>
            `;
        } else if (message.type === 'assistant') {
            if (message.isToolUse) {
                // 工具使用消息
                const toolResultClass = message.toolError ? 'tool-error' : 'tool-success';
                const toolIcon = this.getToolIcon(message.toolName);
                
                messageEl.innerHTML = `
                    <div class="message-bubble assistant tool-use">
                        <div class="tool-header">
                            <span class="tool-icon">${toolIcon}</span>
                            <span class="tool-name">${message.toolName}</span>
                            <span class="tool-status ${toolResultClass}">
                                ${message.toolError ? '' : ''}
                            </span>
                        </div>
                        ${message.toolInput ? `
                            <details class="tool-input">
                                <summary>工具输入</summary>
                                <pre class="tool-input-content">${this.escapeHtml(message.toolInput)}</pre>
                            </details>
                        ` : ''}
                        ${message.toolResult ? `
                            <div class="tool-result">
                                <div class="tool-result-content">${this.formatToolResult(message.toolResult, message.toolName)}</div>
                            </div>
                        ` : ''}
                        <div class="message-time">${this.formatTime(message.timestamp)}</div>
                    </div>
                `;
            } else {
                // 普通助手消息
                messageEl.innerHTML = `
                    <div class="message-bubble assistant">
                        <div class="message-content">${this.formatAssistantMessage(message.content)}</div>
                        <div class="message-time">${this.formatTime(message.timestamp)}</div>
                    </div>
                `;
            }
        } else if (message.type === 'error') {
            messageEl.innerHTML = `
                <div class="message-bubble error" style="background: hsl(var(--destructive)); color: hsl(var(--destructive-foreground));">
                    <div class="message-content"> ${this.escapeHtml(message.content)}</div>
                    <div class="message-time">${this.formatTime(message.timestamp)}</div>
                </div>
            `;
        }

        this.chatMessages?.appendChild(messageEl);
    }

    /**
     * 格式化助手消息（支持Markdown）
     */
    formatAssistantMessage(content) {
        // 简单的Markdown渲染
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            .replace(/\n/g, '<br>');
    }

    /**
     * 处理Claude响应
     */
    handleClaudeResponse(data) {
        console.log('处理Claude响应:', data);

        if (data.content) {
            this.addAssistantMessage(data.content);
        }

        // 处理工具使用
        if (data.tool_use) {
            this.handleToolUse(data.tool_use);
        }

        // 处理会话信息
        if (data.session_id && !this.currentSessionId) {
            this.currentSessionId = data.session_id;
        }
    }

    /**
     * 处理Claude输出
     */
    handleClaudeOutput(data) {
        console.log('Claude输出:', data);
        this.addAssistantMessage(data, 'output');
    }

    /**
     * 处理Claude错误
     */
    handleClaudeError(error) {
        console.error('Claude错误:', error);
        this.addErrorMessage(error);
        this.setLoading(false);
    }

    /**
     * 处理Claude完成
     */
    handleClaudeComplete(data) {
        console.log('Claude完成:', data);
        this.setLoading(false);

        if (data.isNewSession && data.exitCode === 0) {
            // 新会话成功创建
            console.log('新会话创建成功');
        }
    }

    /**
     * 处理会话创建
     */
    handleSessionCreated(sessionId) {
        console.log('会话已创建:', sessionId);
        this.currentSessionId = sessionId;
    }

    /**
     * 处理会话中止
     */
    handleSessionAborted(data) {
        console.log('会话已中止:', data);
        this.setLoading(false);
        if (data.success) {
            this.addAssistantMessage('会话已中止', 'system');
        }
    }

    /**
     * 处理工具使用
     */
    handleToolUse(toolUse) {
        const toolMessage = `<img src="/static/assets/icons/interface/tools.png" width="16" height="16" alt=""> 使用工具: ${toolUse.name}`;
        this.addAssistantMessage(toolMessage, 'tool');
    }

    /**
     * 设置加载状态
     */
    setLoading(loading) {
        this.isLoading = loading;
        
        if (this.sendBtn) {
            this.sendBtn.disabled = loading;
        }
        
        if (this.chatInput) {
            this.chatInput.disabled = loading;
        }

        if (loading) {
            this.addTypingIndicator();
        } else {
            this.removeTypingIndicator();
        }
    }

    /**
     * 添加输入指示器
     */
    addTypingIndicator() {
        this.removeTypingIndicator(); // 确保只有一个
        
        const indicator = document.createElement('div');
        indicator.className = 'chat-message assistant typing-indicator';
        indicator.innerHTML = `
            <div class="message-bubble assistant">
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        
        this.chatMessages?.appendChild(indicator);
        this.scrollToBottom();
    }

    /**
     * 移除输入指示器
     */
    removeTypingIndicator() {
        const indicator = this.chatMessages?.querySelector('.typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    /**
     * 自动调整文本区域高度
     */
    autoResizeTextarea() {
        if (!this.chatInput) return;
        
        this.chatInput.style.height = 'auto';
        this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 120) + 'px';
    }

    /**
     * 滚动到底部
     */
    scrollToBottom() {
        if (this.chatMessages) {
            setTimeout(() => {
                this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
            }, 100);
        }
    }

    /**
     * 获取工具设置
     */
    getToolsSettings() {
        // 默认工具设置
        return {
            allowedTools: [],
            disallowedTools: [],
            skipPermissions: false
        };
    }

    /**
     * 获取权限模式
     */
    getPermissionMode() {
        return 'default';
    }

    /**
     * 保存消息到本地存储
     */
    saveMessages() {
        try {
            const key = `chat_messages_${this.selectedProject?.name || 'default'}`;
            localStorage.setItem(key, JSON.stringify(this.messages));
        } catch (error) {
            console.warn('保存消息失败:', error);
        }
    }

    /**
     * 从本地存储加载消息
     */
    loadMessages() {
        try {
            const key = `chat_messages_${this.selectedProject?.name || 'default'}`;
            const saved = localStorage.getItem(key);
            if (saved) {
                this.messages = JSON.parse(saved);
                this.renderAllMessages();
            }
        } catch (error) {
            console.warn('加载消息失败:', error);
            this.messages = [];
        }
    }

    /**
     * 渲染所有消息
     */
    renderAllMessages() {
        if (this.chatMessages) {
            this.chatMessages.innerHTML = '';
            this.messages.forEach(message => {
                this.renderMessage(message);
            });
            this.scrollToBottom();
        }
    }

    /**
     * 设置选中的项目
     */
    setSelectedProject(project) {
        this.selectedProject = project;
        this.selectedSession = null;
        this.currentSessionId = null;
        this.clearMessages();
    }

    /**
     * 设置选中的会话
     */
    async setSelectedSession(project, session) {
        // 参数验证
        if (!session) {
            console.warn('setSelectedSession: session is undefined or null');
            return;
        }
        
        // 如果project未提供，尝试从session中获取
        if (!project && session.projectName) {
            project = {
                name: session.projectName,
                path: session.projectPath || session.projectName
            };
        }
        
        if (!project || !project.name) {
            console.warn('setSelectedSession: project or project.name is undefined');
            return;
        }
        
        this.selectedProject = project;
        this.selectedSession = session;
        this.currentSessionId = session.id;
        
        // 显示加载状态
        this.showLoadingMessages();
        
        try {
            // 从缓存或API加载会话消息
            const messages = await this.loadSessionMessages(project.name, session.id);
            this.sessionMessages = messages;
            this.convertAndDisplayMessages(messages);
        } catch (error) {
            console.error('加载会话消息失败:', error);
            this.showError('加载会话消息失败');
        }
    }

    /**
     * 创建新会话
     */
    createNewSession(project) {
        this.selectedProject = project;
        this.selectedSession = null;
        this.currentSessionId = null;
        this.sessionMessages = [];
        this.clearMessages();
        
        // 聚焦到输入框
        if (this.chatInput) {
            this.chatInput.focus();
        }
    }

    /**
     * 从API加载会话消息
     */
    async loadSessionMessages(projectName, sessionId) {
        // 检查缓存
        const cacheKey = `${projectName}:${sessionId}`;
        if (this.messageCache.has(cacheKey)) {
            return this.messageCache.get(cacheKey);
        }
        
        this.isLoadingSessionMessages = true;
        
        try {
            const response = await fetch(`/api/projects/${projectName}/sessions/${sessionId}/messages`);
            if (!response.ok) {
                throw new Error('Failed to load session messages');
            }
            
            const data = await response.json();
            const messages = data.messages || [];
            
            // 缓存消息
            this.messageCache.set(cacheKey, messages);
            
            return messages;
        } finally {
            this.isLoadingSessionMessages = false;
        }
    }

    /**
     * 转换并显示会话消息
     */
    convertAndDisplayMessages(rawMessages) {
        // 转换原始消息为显示格式
        const convertedMessages = this.convertSessionMessages(rawMessages);
        
        // 清空当前消息并显示新消息
        this.messages = convertedMessages;
        this.renderAllMessages();
    }

    /**
     * 转换会话消息格式
     */
    convertSessionMessages(rawMessages) {
        const converted = [];
        const toolResults = new Map(); // 存储工具结果
        
        // 第一遍：收集所有工具结果
        for (const msg of rawMessages) {
            if (msg.message?.role === 'user' && Array.isArray(msg.message?.content)) {
                for (const part of msg.message.content) {
                    if (part.type === 'tool_result') {
                        toolResults.set(part.tool_use_id, {
                            content: part.content,
                            isError: part.is_error,
                            timestamp: new Date(msg.timestamp || Date.now())
                        });
                    }
                }
            }
        }
        
        // 第二遍：处理消息并关联工具结果
        for (const msg of rawMessages) {
            if (msg.message?.role === 'user' && msg.message?.content) {
                // 处理用户消息
                let content = '';
                if (Array.isArray(msg.message.content)) {
                    const textParts = msg.message.content
                        .filter(part => part.type === 'text')
                        .map(part => part.text);
                    content = textParts.join('\n');
                } else {
                    content = String(msg.message.content);
                }
                
                if (content && !content.startsWith('<command-name>')) {
                    converted.push({
                        id: `${msg.sessionId}-user-${Date.now()}-${Math.random()}`,
                        type: 'user',
                        content: content,
                        timestamp: new Date(msg.timestamp || Date.now()).toISOString(),
                        sessionId: msg.sessionId
                    });
                }
            }
            else if (msg.message?.role === 'assistant' && msg.message?.content) {
                // 处理助手消息
                if (Array.isArray(msg.message.content)) {
                    for (const part of msg.message.content) {
                        if (part.type === 'text' && part.text && part.text.trim()) {
                            converted.push({
                                id: `${msg.sessionId}-assistant-text-${Date.now()}-${Math.random()}`,
                                type: 'assistant',
                                content: part.text,
                                timestamp: new Date(msg.timestamp || Date.now()).toISOString(),
                                sessionId: msg.sessionId
                            });
                        } else if (part.type === 'tool_use') {
                            // 获取对应的工具结果
                            const toolResult = toolResults.get(part.id);
                            
                            converted.push({
                                id: `${msg.sessionId}-tool-${part.id}`,
                                type: 'assistant',
                                content: '',
                                timestamp: new Date(msg.timestamp || Date.now()).toISOString(),
                                sessionId: msg.sessionId,
                                isToolUse: true,
                                toolName: part.name,
                                toolInput: JSON.stringify(part.input, null, 2),
                                toolResult: toolResult ? String(toolResult.content) : null,
                                toolError: toolResult?.isError || false,
                                toolResultTimestamp: toolResult?.timestamp || new Date()
                            });
                        }
                    }
                } else if (typeof msg.message.content === 'string' && msg.message.content.trim()) {
                    converted.push({
                        id: `${msg.sessionId}-assistant-${Date.now()}-${Math.random()}`,
                        type: 'assistant',
                        content: String(msg.message.content),
                        timestamp: new Date(msg.timestamp || Date.now()).toISOString(),
                        sessionId: msg.sessionId
                    });
                }
            }
        }
        
        // 按时间戳排序
        converted.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        return converted;
    }

    /**
     * 提取消息内容
     */
    extractMessageContent(content) {
        if (typeof content === 'string') {
            return content;
        } else if (Array.isArray(content)) {
            // 处理复合内容（文本 + 工具使用等）
            return content
                .filter(part => part.type === 'text')
                .map(part => part.text)
                .join('\n');
        }
        return String(content);
    }

    /**
     * 显示加载消息状态
     */
    showLoadingMessages() {
        if (this.chatMessages) {
            this.chatMessages.innerHTML = `
                <div class="loading-messages">
                    <div class="spinner"></div>
                    <p>加载会话消息中...</p>
                </div>
            `;
        }
    }

    /**
     * 显示错误信息
     */
    showError(message) {
        if (this.chatMessages) {
            this.chatMessages.innerHTML = `
                <div class="error-message">
                    <p> ${this.escapeHtml(message)}</p>
                </div>
            `;
        }
    }

    /**
     * 清空聊天记录
     */
    clearMessages() {
        this.messages = [];
        if (this.chatMessages) {
            this.chatMessages.innerHTML = '';
        }
        this.saveMessages();
    }

    /**
     * 中止当前会话
     */
    abortCurrentSession() {
        if (this.currentSessionId && this.isLoading) {
            window.wsManager.abortClaudeSession(this.currentSessionId);
        }
    }

    /**
     * 工具函数
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    /**
     * 获取工具图标
     */
    getToolIcon(toolName) {
        const icons = {
            'Read': '',
            'Write': '',
            'Edit': '',
            'MultiEdit': '',
            'Bash': '',
            'LS': '<img src="/static/assets/icons/interface/folder.png" width="16" height="16" alt="">',
            'Glob': '',
            'Grep': '',
            'TodoWrite': '',
            'TodoRead': '',
            'WebFetch': '',
            'WebSearch': '',
            'Task': ''
        };
        return icons[toolName] || '<img src="/static/assets/icons/interface/tools.png" width="16" height="16" alt="">';
    }

    /**
     * 格式化工具结果
     */
    formatToolResult(result, toolName) {
        if (!result) return '';
        
        // 特殊处理不同工具的结果
        if (toolName === 'Read') {
            // 文件读取结果，截断长内容
            if (result.length > 500) {
                return `<div class="tool-result-preview">
                    ${this.escapeHtml(result.substring(0, 500))}
                    <div class="result-truncated">... (内容已截断，共 ${result.length} 字符)</div>
                </div>`;
            }
            return `<pre class="file-content">${this.escapeHtml(result)}</pre>`;
        } else if (toolName === 'TodoWrite') {
            // Todo更新结果
            try {
                const parsed = JSON.parse(result);
                if (parsed.success) {
                    return '<div class="todo-success"> Todo列表已更新</div>';
                }
            } catch (e) {
                // 继续使用默认处理
            }
        } else if (toolName === 'Bash') {
            // 命令执行结果
            return `<pre class="bash-output">${this.escapeHtml(result)}</pre>`;
        }
        
        // 默认处理：如果是JSON，尝试格式化
        try {
            const parsed = JSON.parse(result);
            return `<pre class="json-result">${JSON.stringify(parsed, null, 2)}</pre>`;
        } catch (e) {
            // 不是JSON，直接显示
            if (result.length > 300) {
                return `<div class="tool-result-long">
                    <div class="result-preview">${this.escapeHtml(result.substring(0, 300))}</div>
                    <details class="result-expand">
                        <summary>显示完整内容 (${result.length} 字符)</summary>
                        <pre class="result-full">${this.escapeHtml(result)}</pre>
                    </details>
                </div>`;
            }
            return `<pre class="tool-result-text">${this.escapeHtml(result)}</pre>`;
        }
    }

    // ===== 会话连接管理 - 移植自claudecodeui =====

    /**
     * 连接到指定会话
     */
    connectToSession(session) {
        console.log(` 连接到会话:`, session);
        
        // 设置选中的会话和项目
        this.selectedSession = session;
        this.selectedProject = {
            name: session.projectName,
            path: session.projectPath
        };
        
        // 通知app组件会话已选中
        if (window.app) {
            window.app.setSelectedSession(session);
        }
        
        // 加载会话消息
        this.loadSessionMessages(session.id);
        
        // 设置当前会话ID
        this.currentSessionId = session.id;
        
        console.log(` 已连接到会话: ${session.id}`);
    }

    /**
     * 处理会话完成事件
     */
    handleSessionComplete(sessionId, exitCode = 0) {
        console.log(` 会话完成: ${sessionId}, 退出码: ${exitCode}`);
        
        // 标记会话为非活跃
        if (window.app) {
            window.app.markSessionAsInactive(sessionId);
        }
        
        // 如果是当前会话，清理状态
        if (this.currentSessionId === sessionId) {
            this.currentSessionId = null;
        }
    }

    /**
     * 处理会话创建事件
     */
    handleSessionCreated(sessionId, tempSessionId) {
        console.log(`🆕 会话已创建: ${sessionId} (临时ID: ${tempSessionId})`);
        
        // 更新当前会话ID
        if (this.currentSessionId === tempSessionId) {
            this.currentSessionId = sessionId;
        }
        
        // 标记会话为活跃
        if (window.app) {
            window.app.markSessionAsActive(sessionId);
        }
    }
}

// 创建全局实例
window.chatInterface = new ChatInterface();