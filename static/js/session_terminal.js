/**
 * 会话终端管理器 - 支持多会话的终端系统
 * 基于原有terminal.js重构为多会话支持
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
        
        this.initElements();
        this.initEventListeners();
        
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
    }

    /**
     * 初始化事件监听器
     */
    initEventListeners() {
        // 监听会话切换事件
        document.addEventListener('sessionSwitch', (event) => {
            const { sessionId, project, sessionName, originalSession } = event.detail;
            this.switchToSession(sessionId, project, sessionName, originalSession);
        });

        // 监听终端命令事件（来自文件抽屉）
        document.addEventListener('terminalCommand', (event) => {
            const { command, project } = event.detail;
            this.executeCommand(command);
        });

        // 窗口大小变化时调整终端
        window.addEventListener('resize', () => {
            this.resizeActiveTerminal();
        });
    }

    /**
     * 切换到指定会话
     */
    async switchToSession(sessionId, project, sessionName, originalSession = null) {
        console.log('切换到会话终端:', sessionId, project.name, sessionName, originalSession?.id);
        
        this.activeSessionId = sessionId;
        
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
            await this.connectSession(sessionId, project, originalSession);
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
            // 移植claudecodeui的优化ANSI颜色主题配置
            theme: {
                // 基础颜色 - 改善对比度和护眼效果
                background: '#1e1e1e',       // 深灰色背景，更护眼
                foreground: '#d4d4d4',       // 浅灰色前景，更好的对比度
                cursor: '#ffffff',           // 白色光标
                cursorAccent: '#1e1e1e',     // 光标强调色
                selection: '#264f78',        // 选择区域背景色
                selectionForeground: '#ffffff', // 选择区域文字色
                selectionBackground: '#264f78', // 选择区域背景色(兼容)
                // 标准ANSI颜色 (0-7) - 优化可见性
                black: '#333333',            // 改为深灰避免与背景融合
                red: '#cd3131',
                green: '#0dbc79', 
                yellow: '#e5e510',
                blue: '#2472c8',
                magenta: '#bc3fbc',
                cyan: '#11a8cd',
                white: '#e5e5e5',
                // 亮色变体 (8-15) - 保持高对比度
                brightBlack: '#666666',      // 中灰色，确保可见
                brightRed: '#f14c4c',
                brightGreen: '#23d18b',
                brightYellow: '#f5f543',
                brightBlue: '#3b8eea',
                brightMagenta: '#d670d6',
                brightCyan: '#29b8db',
                brightWhite: '#ffffff'
            }
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
        this._addTerminalEventListeners(sessionId, terminal);

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
    async connectSession(sessionId, project, originalSession = null) {
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
            const wsUrl = `ws://localhost:3005/shell`;
            const ws = new WebSocket(wsUrl);
            
            ws.onopen = () => {
                console.log('WebSocket连接已建立:', sessionId);
                
                // 发送初始化消息 - 正确判断是否为已有会话
                const fixedCols = 120;
                const fixedRows = 30;
                const hasSession = !!originalSession; // 关键修复：基于originalSession判断
                
                console.log(`📐 发送固定终端尺寸: ${fixedCols}x${fixedRows}`, sessionId);
                console.log(`🔍 会话状态: hasSession=${hasSession}, originalSessionId=${originalSession?.id}`, sessionId);
                
                ws.send(JSON.stringify({
                    type: 'init',
                    projectPath: project.path || project.fullPath,
                    sessionId: originalSession?.id || sessionId, // 使用原始会话ID或当前sessionId
                    hasSession: hasSession,
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

        // 检查是否包含可能导致清除的ANSI序列
        const hasClearLine = data.includes('\x1B[2K');
        const hasCursorUp = data.includes('\x1B[1A');
        const hasClearScreen = data.includes('\x1B[2J');
        const hasHome = data.includes('\x1B[H');
        
        console.log(`🔍 [TERMINAL DEBUG] 收到WebSocket输出消息:`, {
            sessionId: sessionId,
            originalLength: data.length,
            preview: data.substring(0, 100),
            ansiSequences: {
                clearLine: hasClearLine,
                cursorUp: hasCursorUp,
                clearScreen: hasClearScreen,
                home: hasHome
            },
            timestamp: new Date().toISOString()
        });
        
        // 如果包含多个清除序列，记录详细信息
        if (hasClearLine || hasCursorUp) {
            console.warn(`⚠️ [ANSI DEBUG] 检测到可能的内容清除序列:`, {
                sessionId: sessionId,
                raw: data.split('').map(c => c.charCodeAt(0) < 32 ? `\\x${c.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase()}` : c).join(''),
                clearLineCount: (data.match(/\x1B\[2K/g) || []).length,
                cursorUpCount: (data.match(/\x1B\[1A/g) || []).length
            });
        }
        
        // 精确的ANSI清除序列限制 - 防止过度清除历史内容
        let output = data;
        
        // 检测并限制过度清除序列
        if (hasClearLine && hasCursorUp) {
            const clearLineCount = (data.match(/\x1B\[2K/g) || []).length;
            const cursorUpCount = (data.match(/\x1B\[1A/g) || []).length;
            
            // 如果清除行数过多，进行动态调整
            if (clearLineCount >= 5 && cursorUpCount >= 4) {
                // 动态计算：减少2行以保护历史内容，最少保留3行清除能力
                const limitedCount = Math.max(clearLineCount - 1, 3);
                
                console.log(`🛡️ [DYNAMIC LIMIT] 检测到过度清除序列，动态调整清除行数:`, {
                    sessionId: sessionId,
                    原始清除行数: clearLineCount,
                    原始光标上移: cursorUpCount,
                    调整后行数: limitedCount,
                    保护行数: clearLineCount - limitedCount,
                    timestamp: new Date().toISOString()
                });
                
                // 动态生成限制后的清除序列
                let limitedPattern = '';
                for (let i = 0; i < limitedCount; i++) {
                    if (i === limitedCount - 1) {
                        // 最后一个序列，添加光标归位
                        limitedPattern += '\x1B[2K\x1B[G';
                    } else {
                        // 中间序列，清除行并上移
                        limitedPattern += '\x1B[2K\x1B[1A';
                    }
                }
                
                // 替换原始的连续清除序列
                const originalPattern = /(\x1B\[2K\x1B\[1A)+\x1B\[2K\x1B\[G/g;
                output = data.replace(originalPattern, limitedPattern);
                
                console.warn(`✅ [DYNAMIC LIMIT] 已动态调整清除序列:`, {
                    sessionId: sessionId,
                    原始长度: data.length,
                    处理后长度: output.length,
                    策略: `${clearLineCount}行 → ${limitedCount}行`,
                    保护效果: `保护了${clearLineCount - limitedCount}行历史内容`
                });
            } else if (clearLineCount >= 5) {
                // 记录但不限制（用于观察）
                console.log(`📝 [ANSI MONITOR] Claude CLI重绘序列:`, {
                    sessionId: sessionId,
                    clearLineCount,
                    cursorUpCount,
                    状态: '正常传递',
                    timestamp: new Date().toISOString()
                });
            }
        }
        
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
                data: command + '\\r'
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
     * 关闭会话 - 清理所有相关状态
     */
    closeSession(sessionId) {
        // 关闭WebSocket连接
        const connection = this.connections.get(sessionId);
        if (connection) {
            connection.close();
            this.connections.delete(sessionId);
        }

        // 销毁终端
        const terminalData = this.terminals.get(sessionId);
        if (terminalData) {
            if (terminalData.terminal) {
                terminalData.terminal.dispose();
            }
            if (terminalData.container) {
                terminalData.container.remove();
            }
            this.terminals.delete(sessionId);
        }

        // 清理连接状态
        this.connectingStates.delete(sessionId);

        // 如果关闭的是当前活跃会话，清空状态
        if (this.activeSessionId === sessionId) {
            this.activeSessionId = null;
            
            // 显示空状态
            const emptyState = this.terminalWrapper.querySelector('.empty-terminal-state');
            if (emptyState) {
                emptyState.style.display = 'flex';
            }
        }

        console.log('关闭会话终端:', sessionId);
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

        // 监听终端渲染事件
        terminal.onRender((event) => {
            console.log(`🔍 [XTERM DEBUG] 终端渲染事件:`, {
                sessionId: sessionId,
                start: event.start,
                end: event.end,
                bufferLength: terminal?.buffer?.active?.length || 0,
                viewportY: terminal?.buffer?.active?.viewportY || 0,
                timestamp: new Date().toISOString()
            });
        });

        // 监听缓冲区变化
        terminal.onScroll((yDisp) => {
            console.log(`🔍 [XTERM DEBUG] 滚动事件:`, {
                sessionId: sessionId,
                yDisp,
                bufferLength: terminal?.buffer?.active?.length || 0,
                viewportY: terminal?.buffer?.active?.viewportY || 0,
                timestamp: new Date().toISOString()
            });
        });

        // 监听选择变化
        terminal.onSelectionChange(() => {
            console.log(`🔍 [XTERM DEBUG] 选择变化事件:`, {
                sessionId: sessionId,
                hasSelection: terminal.hasSelection(),
                bufferLength: terminal?.buffer?.active?.length || 0,
                timestamp: new Date().toISOString()
            });
        });

        console.log('🔍 [XTERM DEBUG] 事件监听器已添加:', sessionId);
    }

    /**
     * 保存连接状态到localStorage
     */
    saveConnectionState() {
        if (!this.activeSessionId) {
            console.warn('⚠️ 没有活跃的会话，无法保存连接状态');
            return;
        }

        // 获取当前活跃会话的信息
        const terminalData = this.terminals.get(this.activeSessionId);
        if (!terminalData) {
            console.warn('⚠️ 找不到活跃会话的终端数据');
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
}

// 创建全局实例
window.sessionTerminal = new SessionTerminal();