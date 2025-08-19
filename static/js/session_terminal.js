/**
 * 会话终端管理器 - 支持多会话的终端系统
 * 基于原有terminal.js重构为多会话支持
 * 
 * 备份说明: 原始ANSI序列限制逻辑已备份至session_terminal.js.backup (2025-08-07)
 * 当前版本: 简化版ANSI处理，参考Claudecodeui的透传策略，解决Claude CLI 1.0.70兼容问题
 */

class SessionTerminal {
    constructor() {
        this.terminals = new Map(); // sessionId -> terminal instance
        this.connections = new Map(); // sessionId -> websocket connection
        this.connectingStates = new Map(); // sessionId -> connecting state (防止重复连接)
        this.activeSessionId = null;
        this.isInitialized = false;
        
        // 状态保存相关
        this.CONNECTION_STATE_KEY = 'heliki_session_terminal_state';
        this.autoRestoreEnabled = true;
        
        // 主题相关
        this.THEME_STATE_KEY = 'heliki_terminal_theme';
        this.isLightTheme = false;
        
        // 初始化会话自动引导相关
        this.initializingSessions = new Set(); // 追踪初始化会话
        this.claudeStartupDetected = new Map(); // sessionId -> 是否检测到Claude启动
        
        this.initElements();
        this.initEventListeners();
        this.initTheme();
        
        // 页面加载后尝试恢复状态
        setTimeout(() => {
            this.attemptStateRestore();
        }, 1000);
    }

    /**
     * 初始化DOM元素
     */
    initElements() {
        this.terminalWrapper = document.getElementById('session-terminal-wrapper');
        this.currentProject = document.getElementById('current-project');
        this.currentSessionName = document.getElementById('current-session-name');
        this.themeToggleBtn = document.getElementById('terminal-theme-toggle');
    }

    /**
     * 初始化事件监听器
     */
    initEventListeners() {
        // 监听会话切换事件
        document.addEventListener('sessionSwitch', (event) => {
            const { sessionId, project, sessionName, originalSession, initialCommand, resumeSession, originalSessionId } = event.detail;
            // 如果是恢复会话，创建一个特殊的originalSession对象
            let sessionToRestore = originalSession;
            if (resumeSession && originalSessionId) {
                sessionToRestore = { id: originalSessionId };
            }
            this.switchToSession(sessionId, project, sessionName, sessionToRestore, initialCommand);
        });

        // 监听终端命令事件（来自文件抽屉）
        document.addEventListener('terminalCommand', (event) => {
            const { command, project } = event.detail;
            this.executeCommand(command);
        });

        // 监听主题切换按钮
        if (this.themeToggleBtn) {
            this.themeToggleBtn.addEventListener('click', () => {
                this.toggleTheme();
            });
        }

        // 窗口大小变化时调整终端
        window.addEventListener('resize', () => {
            this.resizeActiveTerminal();
        });
        
        // 完全禁用beforeunload自动清理
        /*
        window.addEventListener('beforeunload', () => {
            console.log('🔄 [SESSION TERMINAL] 页面即将卸载，清理所有会话终端状态');
            this.cleanup();
        });
        */
        
        // 完全禁用pagehide自动清理
        /*
        window.addEventListener('pagehide', () => {
            console.log('🔄 [SESSION TERMINAL] 页面隐藏，清理所有会话终端状态');
            this.cleanup();
        });
        */
        
        // 监听浏览器标签页可见性变化 - 完全禁用自动清理
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('🔄 [SESSION TERMINAL] 页面变为隐藏状态，保持连接不清理');
                // 完全禁用自动清理，保持终端连接状态
            } else {
                console.log('🔄 [SESSION TERMINAL] 页面变为可见状态');
                // 取消任何可能的延迟清理
                if (this.pageHideTimeout) {
                    clearTimeout(this.pageHideTimeout);
                    this.pageHideTimeout = null;
                }
            }
        });
    }

    /**
     * 切换到指定会话
     */
    async switchToSession(sessionId, project, sessionName, originalSession = null, initialCommand = null) {
        console.log('切换到会话终端:', sessionId, project.name, sessionName, originalSession?.id, '初始命令:', initialCommand);
        
        this.activeSessionId = sessionId;
        
        // 检查是否为初始化会话（通过sessionName或其他标识）
        if (sessionName && sessionName.includes('系统初始化')) {
            console.log('🚀 检测到初始化会话，将使用组合命令直接启动:', sessionId);
            // 不再需要复杂的启动检测，直接使用组合命令
        }
        
        // 如果终端不存在，创建新终端
        if (!this.terminals.has(sessionId)) {
            await this.createTerminal(sessionId, project, sessionName, originalSession);
        }
        
        // 显示对应的终端
        this.showTerminal(sessionId);
        
        // 更新当前项目和会话的显示
        this.updateCurrentSessionDisplay(project, sessionName);
        
        // 如果连接不存在，建立连接
        if (!this.connections.has(sessionId)) {
            await this.connectSession(sessionId, project, originalSession, initialCommand);
        }
    }

    /**
     * 创建新的终端实例
     */
    async createTerminal(sessionId, project, sessionName, originalSession = null) {
        if (!window.Terminal) {
            console.error('xterm.js未加载');
            return;
        }

        const terminal = new window.Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            allowTransparency: false,
            convertEol: true,
            scrollback: 10000,
            tabStopWidth: 4,
            cols: 120,
            rows: 30,
            allowProposedApi: true,
            macOptionIsMeta: true,
            // 使用动态主题配置
            theme: this.getTerminalThemeConfig()
        });

        // 加载插件
        const fitAddon = new window.FitAddon.FitAddon();
        const webLinksAddon = new window.WebLinksAddon.WebLinksAddon();
        
        terminal.loadAddon(fitAddon);
        terminal.loadAddon(webLinksAddon);

        // 创建终端容器
        const terminalContainer = document.createElement('div');
        terminalContainer.className = 'session-terminal-instance';
        terminalContainer.id = `terminal-${sessionId}`;
        terminalContainer.style.display = 'none';
        
        // 隐藏空状态提示
        const emptyState = this.terminalWrapper.querySelector('.empty-terminal-state');
        if (emptyState) {
            emptyState.style.display = 'none';
        }
        
        this.terminalWrapper.appendChild(terminalContainer);
        terminal.open(terminalContainer);

        // 处理终端输入 - 添加连接状态检查
        terminal.onData((data) => {
            const connection = this.connections.get(sessionId);
            if (connection && connection.readyState === WebSocket.OPEN) {
                // 直接传输所有输入，不做过度过滤
                // 之前的焦点检查会导致终端内容被意外清除
                connection.send(JSON.stringify({
                    type: 'input',
                    data: data
                }));
            }
        });

        // 添加xterm.js事件监听器进行调试
        try {
            this._addTerminalEventListeners(sessionId, terminal);
        } catch (error) {
            console.error('❌ 添加终端事件监听器失败:', sessionId, error);
        }

        // 禁用终端大小变化处理，使用固定尺寸
        terminal.onResize(({ cols, rows }) => {
            console.log(`🚫 终端尺寸变化被忽略: ${cols}x${rows}，保持固定120x30`, sessionId);
        });

        // 保存终端实例和相关信息
        this.terminals.set(sessionId, {
            terminal: terminal,
            fitAddon: fitAddon,
            container: terminalContainer,
            project: project,
            sessionName: sessionName,
            originalSession: originalSession // 保存原始会话信息
        });

        // 显示欢迎信息
        terminal.writeln(`\x1b[36m欢迎使用 ${project.name} - ${sessionName}\x1b[0m`);
        terminal.writeln('\x1b[90m正在连接到 Claude CLI...\x1b[0m');
        terminal.writeln('');

        console.log('✅ xterm.js多会话终端初始化完成:', sessionId);
        console.log('创建终端成功:', sessionId);
    }

    /**
     * 显示指定的终端
     */
    showTerminal(sessionId) {
        // 隐藏所有终端
        for (const [id, terminalData] of this.terminals) {
            if (terminalData.container) {
                terminalData.container.style.display = 'none';
                terminalData.container.classList.remove('active');
            }
        }

        // 显示当前终端
        const terminalData = this.terminals.get(sessionId);
        if (terminalData && terminalData.container) {
            terminalData.container.style.display = 'block';
            terminalData.container.classList.add('active');
            
            // 调整终端大小
            setTimeout(() => {
                if (terminalData.fitAddon) {
                    terminalData.fitAddon.fit();
                }
            }, 100);
        }
    }

    /**
     * 连接会话到WebSocket - 添加连接状态锁防止重复连接
     */
    async connectSession(sessionId, project, originalSession = null, initialCommand = null) {
        // 检查是否正在连接中
        if (this.connectingStates.get(sessionId)) {
            console.warn('⚠️ 连接正在进行中，忽略重复请求', sessionId);
            const terminalData = this.terminals.get(sessionId);
            if (terminalData && terminalData.terminal) {
                terminalData.terminal.writeln('\x1b[33m⚠️ 连接正在进行中，请稍候...\x1b[0m');
            }
            return;
        }

        const terminalData = this.terminals.get(sessionId);
        if (!terminalData) {
            console.error('终端不存在:', sessionId);
            return;
        }

        // 设置连接锁
        this.connectingStates.set(sessionId, true);

        try {
            const wsUrl = `ws://${window.location.host}/shell`;
            const ws = new WebSocket(wsUrl);
            
            ws.onopen = () => {
                console.log('WebSocket连接已建立:', sessionId);
                
                // 发送初始化消息 - 正确判断是否为已有会话
                const fixedCols = 120;
                const fixedRows = 30;
                const hasSession = !!originalSession; // 关键修复：基于originalSession判断
                
                console.log(`📐 发送固定终端尺寸: ${fixedCols}x${fixedRows}`, sessionId);
                console.log(`🔍 会话状态: hasSession=${hasSession}, originalSessionId=${originalSession?.id}`, sessionId);
                console.log(`🚀 初始命令: ${initialCommand || 'claude'}`, sessionId);
                
                // 检查是否为任务执行（sessionId以task_开头）
                const isTaskExecution = sessionId && sessionId.startsWith('task_');
                const taskId = isTaskExecution ? sessionId : null;
                
                ws.send(JSON.stringify({
                    type: 'init',
                    projectPath: project.path || project.fullPath,
                    sessionId: originalSession?.id || sessionId, // 使用原始会话ID或当前sessionId
                    hasSession: hasSession,
                    initialCommand: initialCommand, // 传递初始命令
                    taskId: taskId, // 传递任务ID用于session_id捕获
                    cols: fixedCols,
                    rows: fixedRows
                }));
                
                // 连接成功后清除欢迎信息，无论新会话还是已有会话
                terminalData.terminal.clear();
                terminalData.terminal.write('\x1b[2J\x1b[H'); // 清屏并移动光标到左上角
                
                if (!hasSession) {
                    console.log('🆕 新会话已清屏', sessionId);
                } else {
                    console.log('🔄 恢复已有会话，等待历史内容加载', sessionId, originalSession.id);
                }
                
                // 调整终端尺寸
                setTimeout(() => {
                    this._fitTerminalSize(sessionId);
                }, 100);
                
                // 保存连接状态
                this.saveConnectionState();
                
                console.log('✅ WebSocket连接已建立:', sessionId);
            };
            
            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleWebSocketMessage(sessionId, message);
                } catch (error) {
                    // 如果不是JSON，直接当作文本输出
                    if (terminalData.terminal) {
                        terminalData.terminal.write(event.data);
                    }
                }
            };
            
            ws.onclose = () => {
                console.log('WebSocket连接已关闭:', sessionId);
                terminalData.terminal.writeln('\x1b[31m❌ 连接已断开\x1b[0m');
                this.connections.delete(sessionId);
                // 释放连接锁
                this.connectingStates.delete(sessionId);
            };
            
            ws.onerror = (error) => {
                console.error('WebSocket错误:', error);
                terminalData.terminal.writeln('\x1b[31m❌ 连接错误\x1b[0m');
                // 释放连接锁
                this.connectingStates.delete(sessionId);
            };
            
            this.connections.set(sessionId, ws);
            
        } catch (error) {
            console.error('连接失败:', error);
            terminalData.terminal.writeln('\x1b[31m❌ 无法连接到服务器\x1b[0m');
        } finally {
            // 无论成功失败都要释放连接锁
            this.connectingStates.delete(sessionId);
        }
    }

    /**
     * 处理WebSocket消息 - 整合高级ANSI处理功能
     */
    handleWebSocketMessage(sessionId, message) {
        const terminalData = this.terminals.get(sessionId);
        if (!terminalData) return;

        switch (message.type) {
            case 'output':
                // 使用高级输出处理方法
                this._processTerminalOutput(sessionId, message.data);
                break;
                
            case 'error':
                terminalData.terminal.writeln(`\x1b[31m错误: ${message.error}\x1b[0m`);
                break;
                
            case 'url_open':
                // 处理URL打开事件
                if (message.url) {
                    window.open(message.url, '_blank');
                }
                break;
                
            default:
                console.log('未知消息类型:', message.type);
        }
    }

    /**
     * 高级终端输出处理 - 移植自terminal.js的ANSI处理逻辑
     */
    _processTerminalOutput(sessionId, data) {
        const terminalData = this.terminals.get(sessionId);
        if (!terminalData || !terminalData.terminal || !data) return;

        // 基本的输出监控（简化版）
        console.log(`📤 [TERMINAL] 会话输出:`, {
            sessionId: sessionId,
            length: data.length,
            preview: data.substring(0, 50) + (data.length > 50 ? '...' : '')
        });
        
        // 不再需要复杂的启动检测，组合命令会直接处理初始化
        
        // 简化的ANSI处理 - 直接透传，让xterm.js处理（参考Claudecodeui策略）
        let output = data;
        
        // 基本的终端状态检查
        if (terminalData.terminal && terminalData.terminal.buffer) {
            console.log(`🔍 [TERMINAL DEBUG] 写入终端:`, {
                sessionId: sessionId,
                outputLength: output.length,
                terminalBufferLength: terminalData.terminal.buffer.active?.length || 0
            });
            terminalData.terminal.write(output);
        } else {
            console.warn(`🔍 [TERMINAL DEBUG] 终端状态异常，跳过写入:`, {
                sessionId: sessionId,
                hasTerminal: !!terminalData.terminal,
                hasBuffer: !!terminalData.terminal?.buffer,
                hasActive: !!terminalData.terminal?.buffer?.active,
                dataLength: output.length
            });
            // 尝试恢复终端状态
            this._tryRecoverTerminalState(sessionId);
        }
    }

    /**
     * 执行命令（来自文件抽屉等）
     */
    executeCommand(command) {
        if (!this.activeSessionId) {
            console.warn('没有活跃的会话');
            return;
        }

        const connection = this.connections.get(this.activeSessionId);
        if (connection && connection.readyState === WebSocket.OPEN) {
            connection.send(JSON.stringify({
                type: 'input',
                data: command + '\r'
            }));
        }
    }

    /**
     * 调整活跃终端大小 - 增强版智能尺寸调整
     */
    resizeActiveTerminal() {
        if (!this.activeSessionId) return;
        
        const terminalData = this.terminals.get(this.activeSessionId);
        if (terminalData && terminalData.fitAddon) {
            setTimeout(() => {
                this._fitTerminalSize(this.activeSessionId);
            }, 100);
        }
    }

    /**
     * 智能调整终端大小 - 移植自terminal.js的高级尺寸控制
     */
    _fitTerminalSize(sessionId) {
        const terminalData = this.terminals.get(sessionId);
        if (!terminalData || !terminalData.fitAddon || !terminalData.terminal) return;

        try {
            // 获取容器实际尺寸
            const containerRect = terminalData.container.getBoundingClientRect();
            console.log(`📐 容器尺寸:`, {
                sessionId: sessionId,
                width: containerRect.width,
                height: containerRect.height
            });

            // 确保容器有实际尺寸
            if (containerRect.width > 100 && containerRect.height > 50) {
                // 先手动计算合理的尺寸范围
                const charWidth = 9; // 大约的字符宽度
                const charHeight = 17; // 大约的行高
                const maxCols = Math.floor((containerRect.width - 20) / charWidth);
                const maxRows = Math.floor((containerRect.height - 20) / charHeight);
                
                console.log(`📏 预计算尺寸:`, {
                    sessionId: sessionId,
                    maxCols: maxCols,
                    maxRows: maxRows
                });
                
                // 使用fitAddon调整
                terminalData.fitAddon.fit();
                
                // 验证调整后的尺寸是否合理
                const cols = terminalData.terminal.cols;
                const rows = terminalData.terminal.rows;
                
                if (cols > 500 || rows > 200 || cols < 20 || rows < 5) {
                    console.warn(`⚠️ 检测到异常尺寸 ${cols}x${rows}，使用安全默认值`, sessionId);
                    // 使用安全的默认尺寸
                    const safeCols = Math.min(Math.max(maxCols, 80), 150);
                    const safeRows = Math.min(Math.max(maxRows, 24), 50);
                    
                    // 手动设置尺寸
                    terminalData.terminal.resize(safeCols, safeRows);
                    console.log(`🔧 已修正为安全尺寸: ${safeCols}x${safeRows}`, sessionId);
                } else {
                    console.log(`✅ 终端尺寸正常: ${cols}x${rows}`, sessionId);
                }
                
                // 如果已连接，通知后端
                const connection = this.connections.get(sessionId);
                if (connection && connection.readyState === WebSocket.OPEN) {
                    this._sendTerminalSize(sessionId);
                }
            } else {
                // 容器尺寸为0，延迟重试
                console.warn('⚠️ 容器尺寸太小，延迟重试...', sessionId);
                setTimeout(() => this._fitTerminalSize(sessionId), 200);
            }
        } catch (error) {
            console.error('❌ 调整终端大小失败:', sessionId, error);
            // 使用默认尺寸作为后备
            if (terminalData.terminal) {
                terminalData.terminal.resize(80, 24);
                console.log('🔧 使用默认后备尺寸: 80x24', sessionId);
            }
        }
    }

    /**
     * 发送终端大小到后端
     */
    _sendTerminalSize(sessionId) {
        const connection = this.connections.get(sessionId);
        const terminalData = this.terminals.get(sessionId);
        
        if (connection && connection.readyState === WebSocket.OPEN && 
            terminalData && terminalData.terminal) {
            connection.send(JSON.stringify({
                type: 'resize',
                cols: terminalData.terminal.cols,
                rows: terminalData.terminal.rows
            }));
            console.log(`📐 终端尺寸已发送:`, {
                sessionId: sessionId,
                cols: terminalData.terminal.cols,
                rows: terminalData.terminal.rows
            });
        }
    }

    /**
     * 关闭会话 - 清理所有相关状态（修复版）
     */
    closeSession(sessionId) {
        console.log('🗝 [SESSION TERMINAL] 关闭会话:', sessionId);
        
        // 1. 关闭WebSocket连接
        const connection = this.connections.get(sessionId);
        if (connection) {
            try {
                connection.close();
            } catch (error) {
                console.warn('⚠️ [SESSION TERMINAL] 关闭连接失败:', error);
            }
            this.connections.delete(sessionId);
        }

        // 2. 销毁终端实例
        const terminalData = this.terminals.get(sessionId);
        if (terminalData) {
            try {
                if (terminalData.terminal) {
                    terminalData.terminal.dispose();
                }
                if (terminalData.container) {
                    terminalData.container.remove();
                }
            } catch (error) {
                console.warn('⚠️ [SESSION TERMINAL] 清理终端实例失败:', error);
            }
            this.terminals.delete(sessionId);
        }

        // 3. 清理连接状态
        this.connectingStates.delete(sessionId);

        // 4. 如果关闭的是当前活跃会话，重置活跃ID（不显示空状态）
        // 由 sidebar 负责判断是否显示空状态或切换到其他会话
        if (this.activeSessionId === sessionId) {
            this.activeSessionId = null;
            console.log('🗝 [SESSION TERMINAL] 当前活跃会话已清除，等待sidebar切换逐譡');
        }

        console.log('✅ [SESSION TERMINAL] 会话关闭完成:', sessionId);
    }

    /**
     * 清空当前终端
     */
    clearActiveTerminal() {
        if (!this.activeSessionId) return;
        
        const terminalData = this.terminals.get(this.activeSessionId);
        if (terminalData && terminalData.terminal) {
            terminalData.terminal.clear();
        }
    }

    /**
     * 尝试恢复终端状态 - 移植自terminal.js
     */
    _tryRecoverTerminalState(sessionId) {
        console.log('🔧 [TERMINAL DEBUG] 尝试恢复终端状态...', sessionId);
        
        const terminalData = this.terminals.get(sessionId);
        if (!terminalData || !terminalData.terminal) {
            console.error('🔧 [TERMINAL DEBUG] 终端实例不存在，无法恢复', sessionId);
            return false;
        }
        
        // 检查终端是否需要重新初始化
        if (!terminalData.terminal.buffer || !terminalData.terminal.buffer.active) {
            console.log('🔧 [TERMINAL DEBUG] 终端缓冲区异常，尝试刷新...', sessionId);
            
            try {
                // 尝试触发终端重新渲染
                if (terminalData.fitAddon) {
                    terminalData.fitAddon.fit();
                }
                
                // 检查恢复结果
                if (terminalData.terminal.buffer && terminalData.terminal.buffer.active) {
                    console.log('✅ [TERMINAL DEBUG] 终端状态恢复成功', sessionId);
                    return true;
                } else {
                    console.warn('⚠️ [TERMINAL DEBUG] 终端状态恢复失败', sessionId);
                    return false;
                }
            } catch (error) {
                console.error('❌ [TERMINAL DEBUG] 终端状态恢复出错:', sessionId, error);
                return false;
            }
        }
        
        return true;
    }

    /**
     * 添加xterm.js事件监听器进行调试 - 移植自terminal.js
     */
    _addTerminalEventListeners(sessionId, terminal) {
        if (!terminal) return;

        try {
            // 监听终端渲染事件
            if (typeof terminal.onRender === 'function') {
                terminal.onRender((event) => {
                    console.log(`🔍 [XTERM DEBUG] 终端渲染事件:`, {
                        sessionId: sessionId,
                        start: event?.start || 'N/A',
                        end: event?.end || 'N/A',
                        bufferLength: terminal?.buffer?.active?.length || 0,
                        viewportY: terminal?.buffer?.active?.viewportY || 0,
                        timestamp: new Date().toISOString()
                    });
                });
            } else {
                console.warn('🔍 [XTERM DEBUG] onRender方法不存在:', sessionId);
            }

            // 监听缓冲区变化
            if (typeof terminal.onScroll === 'function') {
                terminal.onScroll((yDisp) => {
                    console.log(`🔍 [XTERM DEBUG] 滚动事件:`, {
                        sessionId: sessionId,
                        yDisp,
                        bufferLength: terminal?.buffer?.active?.length || 0,
                        viewportY: terminal?.buffer?.active?.viewportY || 0,
                        timestamp: new Date().toISOString()
                    });
                });
            } else {
                console.warn('🔍 [XTERM DEBUG] onScroll方法不存在:', sessionId);
            }

            // 监听选择变化
            if (typeof terminal.onSelectionChange === 'function') {
                terminal.onSelectionChange(() => {
                    console.log(`🔍 [XTERM DEBUG] 选择变化事件:`, {
                        sessionId: sessionId,
                        hasSelection: typeof terminal.hasSelection === 'function' ? terminal.hasSelection() : 'N/A',
                        bufferLength: terminal?.buffer?.active?.length || 0,
                        timestamp: new Date().toISOString()
                    });
                });
            } else {
                console.warn('🔍 [XTERM DEBUG] onSelectionChange方法不存在:', sessionId);
            }

            console.log('🔍 [XTERM DEBUG] 事件监听器已添加:', sessionId);
        } catch (error) {
            console.error('❌ [XTERM DEBUG] 添加事件监听器失败:', sessionId, error);
        }
    }

    /**
     * 保存连接状态到localStorage
     */
    saveConnectionState() {
        if (!this.activeSessionId) {
            console.warn('⚠️ 没有活跃的会话，清除保存的状态');
            this.clearConnectionState();
            return;
        }

        // 获取当前活跃会话的信息
        const terminalData = this.terminals.get(this.activeSessionId);
        if (!terminalData) {
            console.warn('⚠️ 找不到活跃会话的终端数据，清除保存的状态');
            this.clearConnectionState();
            return;
        }

        const state = {
            activeSessionId: this.activeSessionId,
            project: terminalData.project,
            sessionName: terminalData.sessionName,
            originalSession: terminalData.originalSession,
            connected: true,
            timestamp: Date.now()
        };

        try {
            localStorage.setItem(this.CONNECTION_STATE_KEY, JSON.stringify(state));
            console.log('✅ 会话终端连接状态已保存:', {
                sessionId: this.activeSessionId,
                project: state.project.name,
                sessionName: state.sessionName
            });
        } catch (error) {
            console.error('❌ 保存会话终端连接状态失败:', error);
        }
    }

    /**
     * 从localStorage恢复连接状态
     */
    async attemptStateRestore() {
        if (!this.autoRestoreEnabled) {
            console.log('🔒 自动恢复已禁用');
            return false;
        }

        try {
            const stateStr = localStorage.getItem(this.CONNECTION_STATE_KEY);
            if (!stateStr) {
                console.log('📭 没有保存的会话终端连接状态');
                return false;
            }

            const state = JSON.parse(stateStr);
            
            // 检查状态有效性（24小时内）
            const maxAge = 24 * 60 * 60 * 1000; // 24小时
            if (Date.now() - state.timestamp > maxAge) {
                console.log('⏰ 保存的会话终端连接状态已过期，清除');
                this.clearConnectionState();
                return false;
            }

            console.log('🔄 开始恢复会话终端连接状态:', {
                sessionId: state.activeSessionId,
                project: state.project.name,
                sessionName: state.sessionName,
                saveTime: new Date(state.timestamp).toLocaleString()
            });

            // 等待所有组件初始化
            await new Promise(resolve => setTimeout(resolve, 2000));

            // 自动切换到终端标签
            if (window.app) {
                window.app.switchTab('terminal');
            }

            // 通知侧边栏恢复选择状态
            if (window.enhancedSidebar) {
                await window.enhancedSidebar.restoreSelection(state.project, state.originalSession);
                
                // 等待一小段时间让侧边栏更新完成
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // 使用侧边栏的连接方法来恢复会话，这样会正确创建页签
                if (state.originalSession) {
                    console.log('🔄 通过侧边栏连接方法恢复会话:', state.originalSession.id);
                    window.enhancedSidebar.connectToExistingSession(
                        state.project, 
                        state.originalSession, 
                        state.sessionName
                    );
                } else {
                    // 如果没有原始会话，直接创建新会话
                    console.log('🔄 创建新会话:', state.activeSessionId);
                    await this.switchToSession(
                        state.activeSessionId,
                        state.project,
                        state.sessionName,
                        null
                    );
                }
            }

            return true;

        } catch (error) {
            console.error('❌ 恢复会话终端连接状态失败:', error);
            this.clearConnectionState();
            return false;
        }
    }

    /**
     * 清除保存的连接状态
     */
    clearConnectionState() {
        try {
            localStorage.removeItem(this.CONNECTION_STATE_KEY);
            console.log('🗑️ 已清除保存的会话终端连接状态');
        } catch (error) {
            console.error('❌ 清除会话终端连接状态失败:', error);
        }
    }

    /**
     * 检查是否有保存的连接状态
     */
    hasSavedConnectionState() {
        try {
            const stateStr = localStorage.getItem(this.CONNECTION_STATE_KEY);
            if (!stateStr) return false;

            const state = JSON.parse(stateStr);
            const maxAge = 24 * 60 * 60 * 1000; // 24小时
            
            return (Date.now() - state.timestamp) <= maxAge;
        } catch (error) {
            return false;
        }
    }

    /**
     * 断开会话连接（用户主动断开时清除状态）
     */
    disconnectSession(sessionId) {
        if (this.connections.has(sessionId)) {
            const connection = this.connections.get(sessionId);
            if (connection) {
                connection.disconnect();
            }
            this.connections.delete(sessionId);
        }

        // 如果是活跃会话，清除保存的状态
        if (sessionId === this.activeSessionId) {
            this.clearConnectionState();
        }

        console.log('🔌 会话连接已断开:', sessionId);
    }

    /**
     * 显示空状态 - 由 sidebar 调用
     */
    showEmptyState() {
        console.log('💭 [SESSION TERMINAL] 显示空状态');
        
        // 重置活跃会话
        this.activeSessionId = null;
        
        // 显示空状态提示
        if (this.terminalWrapper) {
            const emptyState = this.terminalWrapper.querySelector('.empty-terminal-state');
            if (emptyState) {
                emptyState.style.display = 'flex';
            }
        }
        
        // 清理localStorage状态
        this.clearConnectionState();
    }

    /**
     * 完全清理所有会话终端资源 - 修复页面关闭时状态未清除的问题
     */
    cleanup() {
        console.log('🧹 [SESSION TERMINAL] 开始清理所有会话终端资源...');
        
        try {
            // 1. 清理定时器
            if (this.pageHideTimeout) {
                clearTimeout(this.pageHideTimeout);
                this.pageHideTimeout = null;
            }
            
            // 2. 断开所有WebSocket连接
            console.log('🧹 [SESSION TERMINAL] 断开所有WebSocket连接...');
            for (const [sessionId, connection] of this.connections) {
                try {
                    if (connection && connection.readyState === WebSocket.OPEN) {
                        connection.onclose = null; // 防止触发重连
                        connection.onerror = null;
                        connection.close();
                    }
                    console.log('✅ [SESSION TERMINAL] 已断开会话连接:', sessionId);
                } catch (error) {
                    console.error('❌ [SESSION TERMINAL] 断开会话连接失败:', sessionId, error);
                }
            }
            this.connections.clear();
            
            // 3. 销毁所有终端实例和清理DOM
            console.log('🧹 [SESSION TERMINAL] 清理所有终端实例...');
            for (const [sessionId, terminalData] of this.terminals) {
                try {
                    // 销毁终端实例
                    if (terminalData.terminal) {
                        terminalData.terminal.dispose();
                    }
                    
                    // 移除DOM元素
                    if (terminalData.container) {
                        terminalData.container.remove();
                    }
                    
                    console.log('✅ [SESSION TERMINAL] 已清理会话终端:', sessionId);
                } catch (error) {
                    console.error('❌ [SESSION TERMINAL] 清理会话终端失败:', sessionId, error);
                }
            }
            this.terminals.clear();
            
            // 4. 清理连接状态
            this.connectingStates.clear();
            
            // 5. 重置活跃会话
            this.activeSessionId = null;
            
            // 6. 清理localStorage中的连接状态 - 关键修复
            console.log('🧹 [SESSION TERMINAL] 清理localStorage中的连接状态...');
            this.clearConnectionState();
            
            // 7. 清理终端容器显示，显示空状态
            if (this.terminalWrapper) {
                // 移除所有终端实例容器
                const terminalInstances = this.terminalWrapper.querySelectorAll('.session-terminal-instance');
                terminalInstances.forEach(instance => instance.remove());
                
                // 显示空状态提示
                const emptyState = this.terminalWrapper.querySelector('.empty-terminal-state');
                if (emptyState) {
                    emptyState.style.display = 'flex';
                }
            }
            
            // 8. 清理项目显示
            if (this.currentProject) {
                this.currentProject.textContent = '未选择项目';
            }
            
            if (this.currentSessionName) {
                this.currentSessionName.textContent = '';
            }
            
            console.log('✅ [SESSION TERMINAL] 所有会话终端资源清理完成');
            
        } catch (error) {
            console.error('❌ [SESSION TERMINAL] 清理过程中出现错误:', error);
        }
    }

    /**
     * 更新当前会话显示
     */
    updateCurrentSessionDisplay(project, sessionName) {
        if (this.currentProject) {
            this.currentProject.textContent = project.display_name || project.name;
        }
        
        if (this.currentSessionName) {
            this.currentSessionName.textContent = sessionName || '';
        }
        
        console.log('📱 已更新当前会话显示:', {
            project: project.name,
            sessionName: sessionName
        });
    }

    /**
     * 获取活跃会话数量
     */
    getActiveSessionCount() {
        return this.terminals.size;
    }

    /**
     * 检查是否有活跃会话
     */
    hasActiveSessions() {
        return this.terminals.size > 0;
    }

    /**
     * 初始化主题
     */
    initTheme() {
        // 从localStorage恢复主题设置
        try {
            const savedTheme = localStorage.getItem(this.THEME_STATE_KEY);
            if (savedTheme) {
                this.isLightTheme = JSON.parse(savedTheme);
            }
        } catch (error) {
            console.error('恢复主题设置失败:', error);
            this.isLightTheme = false;
        }

        // 应用初始主题状态
        this.applyTheme();
        this.updateThemeButton();
        
        // 强制设置按钮样式 - 终极解决方案
        setTimeout(() => {
            this.forceButtonStyles();
        }, 500); // 延迟执行确保DOM已完全加载
    }

    /**
     * 切换主题
     */
    toggleTheme() {
        this.isLightTheme = !this.isLightTheme;
        
        // 保存主题设置到localStorage
        try {
            localStorage.setItem(this.THEME_STATE_KEY, JSON.stringify(this.isLightTheme));
        } catch (error) {
            console.error('保存主题设置失败:', error);
        }

        // 应用新主题
        this.applyTheme();
        this.updateThemeButton();
        
        console.log('切换终端主题:', this.isLightTheme ? '明亮模式' : '暗色模式');
    }

    /**
     * 应用主题到所有终端
     */
    applyTheme() {
        // 更新终端包装器的CSS类
        if (this.terminalWrapper) {
            if (this.isLightTheme) {
                this.terminalWrapper.classList.add('terminal-light-theme');
            } else {
                this.terminalWrapper.classList.remove('terminal-light-theme');
            }
        }

        // 更新所有已创建的终端主题
        for (const [sessionId, terminalData] of this.terminals) {
            this.updateTerminalTheme(terminalData.terminal);
        }
    }

    /**
     * 更新指定终端的主题配置
     */
    updateTerminalTheme(terminal) {
        if (!terminal) return;

        const theme = this.getTerminalThemeConfig();
        
        try {
            // 更新xterm.js的主题选项
            terminal.options.theme = theme;
            
            // 强制刷新终端显示
            terminal.refresh(0, terminal.rows - 1);
            
        } catch (error) {
            console.error('更新终端主题失败:', error);
        }
    }

    /**
     * 获取当前主题配置
     */
    getTerminalThemeConfig() {
        if (this.isLightTheme) {
            // 明亮主题配置
            return {
                background: '#ffffff',
                foreground: '#000000',
                cursor: '#000000',
                cursorAccent: '#ffffff',
                selection: '#0078d4',
                selectionForeground: '#ffffff',
                selectionBackground: '#0078d4',
                // 标准ANSI颜色 - 明亮主题适配
                black: '#000000',
                red: '#cd3131',
                green: '#00bc00',
                yellow: '#949800',
                blue: '#0451a5',
                magenta: '#bc05bc',
                cyan: '#0598bc',
                white: '#000000',
                // 亮色变体
                brightBlack: '#666666',
                brightRed: '#cd3131',
                brightGreen: '#14ce14',
                brightYellow: '#b5ba00',
                brightBlue: '#0451a5',
                brightMagenta: '#bc05bc',
                brightCyan: '#0598bc',
                brightWhite: '#000000'
            };
        } else {
            // 暗色主题配置（原有配置）
            return {
                background: '#1e1e1e',
                foreground: '#d4d4d4',
                cursor: '#ffffff',
                cursorAccent: '#1e1e1e',
                selection: '#264f78',
                selectionForeground: '#ffffff',
                selectionBackground: '#264f78',
                // 标准ANSI颜色
                black: '#333333',
                red: '#cd3131',
                green: '#0dbc79', 
                yellow: '#e5e510',
                blue: '#2472c8',
                magenta: '#bc3fbc',
                cyan: '#11a8cd',
                white: '#e5e5e5',
                // 亮色变体
                brightBlack: '#666666',
                brightRed: '#f14c4c',
                brightGreen: '#23d18b',
                brightYellow: '#f5f543',
                brightBlue: '#3b8eea',
                brightMagenta: '#d670d6',
                brightCyan: '#29b8db',
                brightWhite: '#ffffff'
            };
        }
    }

    /**
     * 更新主题按钮状态
     */
    updateThemeButton() {
        if (!this.themeToggleBtn) return;

        const themeIcon = this.themeToggleBtn.querySelector('.terminal-theme-icon');
        if (!themeIcon) return;

        // 切换按钮的CSS类来控制图标显示
        if (this.isLightTheme) {
            themeIcon.classList.remove('terminal-theme-dark');
            themeIcon.classList.add('terminal-theme-light');
            // 明亮模式下按钮激活状态
            this.themeToggleBtn.classList.add('theme-active');
        } else {
            themeIcon.classList.remove('terminal-theme-light');
            themeIcon.classList.add('terminal-theme-dark');
            // 暗色模式下移除激活状态
            this.themeToggleBtn.classList.remove('theme-active');
        }

        // 更新按钮标题
        this.themeToggleBtn.title = this.isLightTheme ? '切换到暗色模式' : '切换到明亮模式';
        
        console.log('更新主题按钮状态:', {
            isLightTheme: this.isLightTheme,
            iconClass: this.isLightTheme ? 'terminal-theme-light' : 'terminal-theme-dark',
            buttonClass: this.isLightTheme ? 'theme-active' : 'normal'
        });
    }

    /**
     * 强制设置按钮样式 - 终极解决方案
     * 通过JavaScript内联样式绕过所有CSS冲突
     */
    forceButtonStyles() {
        console.log('🎨 [强制样式] 开始设置session-actions按钮样式... [v2.0-蓝色主题]');
        
        // 文件按钮 - 主题蓝色
        const filesBtn = document.getElementById('files-drawer-btn');
        if (filesBtn) {
            filesBtn.style.cssText = `
                background: hsl(221.2, 83.2%, 53.3%) !important;
                border: 1px solid hsl(221.2, 83.2%, 48%) !important;
                color: white !important;
                padding: 8px !important;
                border-radius: 6px !important;
                min-width: 32px !important;
                min-height: 32px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                cursor: pointer !important;
                transition: all 0.2s ease !important;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2) !important;
            `;
            
            // 悬停效果
            filesBtn.onmouseenter = function() {
                this.style.background = 'hsl(221.2, 83.2%, 58%)';
                this.style.borderColor = 'hsl(221.2, 83.2%, 53%)';
                this.style.transform = 'translateY(-1px) scale(1.05)';
                this.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
            };
            filesBtn.onmouseleave = function() {
                this.style.background = 'hsl(221.2, 83.2%, 53.3%)';
                this.style.borderColor = 'hsl(221.2, 83.2%, 48%)';
                this.style.transform = 'none';
                this.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
            };
            
            console.log('✅ [强制样式] 文件按钮样式已设置');
        }

        // 主题切换按钮 - 统一主题蓝色
        const themeBtn = document.getElementById('terminal-theme-toggle');
        if (themeBtn) {
            const setThemeButtonStyle = () => {
                // 使用统一的主题蓝色，不再根据状态切换颜色
                const bgColor = 'hsl(221.2, 83.2%, 53.3%)';
                const borderColor = 'hsl(221.2, 83.2%, 48%)';
                const hoverBg = 'hsl(221.2, 83.2%, 58%)';
                const hoverBorder = 'hsl(221.2, 83.2%, 53%)';
                
                themeBtn.style.cssText = `
                    background: ${bgColor} !important;
                    border: 1px solid ${borderColor} !important;
                    color: white !important;
                    padding: 8px !important;
                    border-radius: 6px !important;
                    min-width: 32px !important;
                    min-height: 32px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    cursor: pointer !important;
                    transition: all 0.2s ease !important;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2) !important;
                `;
                
                themeBtn.onmouseenter = function() {
                    this.style.background = hoverBg;
                    this.style.borderColor = hoverBorder;
                    this.style.transform = 'translateY(-1px) scale(1.05)';
                    this.style.boxShadow = `0 4px 12px rgba(59, 130, 246, 0.4)`;
                };
                themeBtn.onmouseleave = function() {
                    this.style.background = bgColor;
                    this.style.borderColor = borderColor;
                    this.style.transform = 'none';
                    this.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
                };
            };
            
            setThemeButtonStyle();
            
            // 监听主题变化，更新按钮样式
            const originalToggle = this.toggleTheme.bind(this);
            this.toggleTheme = function() {
                originalToggle();
                setTimeout(setThemeButtonStyle, 100); // 延迟执行确保类已更新
            };
            
            console.log('✅ [强制样式] 主题切换按钮样式已设置');
        }

        // 终极解决方案：强制覆盖所有可能的样式设置
        const forceBlueTheme = () => {
            [filesBtn, themeBtn].filter(Boolean).forEach(btn => {
                if (btn) {
                    btn.style.setProperty('background', 'hsl(221.2, 83.2%, 53.3%)', 'important');
                    btn.style.setProperty('border-color', 'hsl(221.2, 83.2%, 48%)', 'important');
                    
                    // 重新绑定hover事件
                    btn.onmouseenter = function() {
                        this.style.setProperty('background', 'hsl(221.2, 83.2%, 58%)', 'important');
                        this.style.setProperty('border-color', 'hsl(221.2, 83.2%, 53%)', 'important');
                    };
                    btn.onmouseleave = function() {
                        this.style.setProperty('background', 'hsl(221.2, 83.2%, 53.3%)', 'important');
                        this.style.setProperty('border-color', 'hsl(221.2, 83.2%, 48%)', 'important');
                    };
                }
            });
        };
        
        // 立即执行一次
        forceBlueTheme();
        
        // 每秒检查一次，确保样式不被覆盖
        setInterval(forceBlueTheme, 1000);
        
        // 强制设置SVG图标样式
        const buttons = [filesBtn, themeBtn].filter(Boolean);
        buttons.forEach(btn => {
            const svg = btn.querySelector('svg');
            if (svg) {
                svg.style.cssText = `
                    width: 16px !important;
                    height: 16px !important;
                    stroke: currentColor !important;
                    fill: none !important;
                    stroke-width: 2 !important;
                `;
            }
        });

        console.log('🎨 [强制样式] 所有按钮样式设置完成！');
    }

    /**
     * 检测Claude Code启动
     */
    _detectClaudeStartup(sessionId, data) {
        // 增强调试：记录原始数据
        console.log(`🔍 [启动检测] 检测数据 (${sessionId}):`, {
            dataLength: data.length,
            dataPreview: data.substring(0, 100),
            fullData: data // 临时显示完整数据用于调试
        });

        // Claude Code的启动标志：扩展检测范围
        const claudeStartupSignals = [
            '>', // Claude Code提示符
            'Claude Code', // Claude Code欢迎信息  
            'claude.ai', // Claude相关信息
            'Welcome to Claude', // 欢迎信息
            'Type a message', // 输入提示
            'Available commands:', // 命令帮助
            'Enter a message', // 输入提示变体
            'How can I help', // 帮助信息
            'What can I do', // 服务提示
            'I\'m ready to help', // 就绪信息
            'claude@', // 终端提示符
            'Ready to assist' // 准备协助
        ];
        
        // 检查是否包含启动信号 - 增强调试
        let detectedSignal = null;
        const detectedStartup = claudeStartupSignals.some(signal => {
            const found = data.includes(signal) || data.toLowerCase().includes(signal.toLowerCase());
            if (found) {
                detectedSignal = signal;
                console.log(`🎯 [启动检测] 找到启动信号: "${signal}" 在数据中`);
            }
            return found;
        });
        
        console.log(`🔍 [启动检测] 检测结果 (${sessionId}): ${detectedStartup ? '✅ 检测到' : '❌ 未检测到'}`);
        if (detectedSignal) {
            console.log(`🔍 [启动检测] 匹配的信号: "${detectedSignal}"`);
        }
        
        if (detectedStartup) {
            console.log('🎯 检测到Claude Code启动信号:', sessionId, '信号:', detectedSignal);
            this.claudeStartupDetected.set(sessionId, true);
            
            // 延时发送引导文字，确保Claude Code完全启动
            console.log('⏰ 设置2秒延迟后自动发送引导文字...');
            setTimeout(() => {
                console.log('⏰ 延迟结束，开始发送引导文字...');
                this._sendInitializationGuidance(sessionId);
            }, 2000); // 2秒延迟
        } else {
            console.log('🔍 [启动检测] 未发现Claude Code启动信号，继续等待...');
        }
    }

    /**
     * 发送初始化引导文字
     */
    _sendInitializationGuidance(sessionId) {
        console.log('📤 [引导发送] 开始发送初始化引导文字:', sessionId);
        
        const connection = this.connections.get(sessionId);
        console.log('📤 [引导发送] WebSocket连接状态:', {
            sessionId: sessionId,
            hasConnection: !!connection,
            readyState: connection ? connection.readyState : 'N/A',
            isOpen: connection ? connection.readyState === WebSocket.OPEN : false
        });
        
        if (!connection || connection.readyState !== WebSocket.OPEN) {
            console.warn('⚠️ WebSocket连接不可用，无法发送引导文字:', sessionId);
            console.warn('⚠️ [引导发送] 连接详情:', {
                connection: !!connection,
                readyState: connection?.readyState,
                CONNECTING: WebSocket.CONNECTING,
                OPEN: WebSocket.OPEN,
                CLOSING: WebSocket.CLOSING,
                CLOSED: WebSocket.CLOSED
            });
            return;
        }

        // 完整的初始化引导文字（标准化流程）
        const guidanceText = `你现在要初始化用户电脑的根目录/主目录 (~/)，包含用户的全部数字生活内容：

- 各种应用程序和工具
- 工作文档和项目文件  
- 财务数据和个人文档
- 代码项目和开发环境
- 媒体文件和个人资料
- 系统配置和环境设置

请按照以下标准流程执行：

1. 创建TodoList追踪进度：
   - 分析主目录整体结构和文件分布
   - 识别开发项目、工作文档、个人文件分类  
   - 检测系统配置和开发环境
   - 创建CLAUDE.md配置文件
   - 建立智能管理规则

2. 系统分析步骤：
   - 使用List(.)命令分析主目录结构
   - 使用Search命令查找关键文件类型（*.py, *.js, *.json等）
   - 检测开发环境配置（Python, Node.js, Git等）
   - 读取系统配置文件(.zshrc, .bash_profile等）

3. 配置文件创建：
   - 创建详细的CLAUDE.md配置文件，包含目录映射和工作流程
   - 创建智能管理脚本claude_system_manager.py
   - 生成系统分析报告

4. 完成标志：
   - 所有TodoList项目标记为完成
   - 生成最终的初始化总结报告
   - 确认系统已AI化并准备就绪

请直接执行 /init 命令开始分析，并严格按照上述流程完成初始化。`;

        console.log('📤 [引导发送] 准备发送的引导文字长度:', guidanceText.length);
        console.log('📤 [引导发送] 引导文字预览:', guidanceText.substring(0, 100) + '...');
        
        try {
            // 发送引导文字
            const message = JSON.stringify({
                type: 'input',
                data: guidanceText + '\r'
            });
            
            console.log('📤 [引导发送] 发送WebSocket消息:', {
                messageLength: message.length,
                messageType: 'input',
                dataLength: guidanceText.length + 1 // +1 for \r
            });
            
            connection.send(message);
            console.log('✅ [引导发送] WebSocket消息已发送成功');
            
        } catch (error) {
            console.error('❌ [引导发送] 发送WebSocket消息失败:', error);
            return;
        }

        // 清理追踪状态
        console.log('🧹 [引导发送] 清理追踪状态...');
        this.initializingSessions.delete(sessionId);
        this.claudeStartupDetected.delete(sessionId);
        
        console.log('✅ 初始化引导已发送并清理追踪状态:', sessionId);
        console.log('✅ [引导发送] 剩余初始化会话:', Array.from(this.initializingSessions));
    }
}

// 创建全局实例
window.sessionTerminal = new SessionTerminal();