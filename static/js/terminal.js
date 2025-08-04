/**
 * 终端组件 - 使用xterm.js
 * 移植自claudecodeui/src/components/Shell.jsx
 */

class Terminal {
    constructor() {
        this.terminal = null;
        this.fitAddon = null;
        this.webLinksAddon = null;
        this.isConnected = false;
        this.isConnecting = false;  // 添加连接状态锁
        this.isInitialized = false;
        this.selectedProject = null;
        this.selectedSession = null;
        
        this.initElements();
        this.initEventListeners();
        this.initTerminal();
        this.initDebugEventListeners();
    }

    /**
     * 初始化DOM元素引用
     */
    initElements() {
        this.terminalWrapper = document.getElementById('terminal-wrapper');
        this.terminalConnect = document.getElementById('terminal-connect');
        this.terminalClear = document.getElementById('terminal-clear');
        this.terminalRestart = document.getElementById('terminal-restart');
        this.terminalPanel = document.getElementById('terminal-panel');
    }

    /**
     * 初始化事件监听器
     */
    initEventListeners() {
        // 连接按钮
        this.terminalConnect?.addEventListener('click', () => {
            if (this.isConnected) {
                this.disconnect();
            } else {
                this.connect();
            }
        });

        // 清除按钮
        this.terminalClear?.addEventListener('click', () => {
            this.clearTerminal();
        });

        // 重启按钮
        this.terminalRestart?.addEventListener('click', () => {
            this.restart();
        });

        // 监听项目选择
        document.addEventListener('projectSelected', (event) => {
            this.setSelectedProject(event.detail.project);
        });

        // 监听会话选择
        document.addEventListener('sessionSelected', (event) => {
            this.setSelectedSession(event.detail.project, event.detail.session);
        });

        // 禁用窗口大小变化时的终端调整，使用固定尺寸
        // window.addEventListener('resize', () => {
        //     console.log('🚫 已禁用动态尺寸调整，使用固定120x30');
        // });
    }

    /**
     * 初始化xterm.js终端 - 改进版
     */
    initTerminal() {
        if (!this.terminalWrapper || !window.Terminal) {
            console.error('❌ xterm.js未加载或终端容器不存在');
            return;
        }

        try {
            // 等待容器完全渲染后再初始化
            setTimeout(() => {
                this._createTerminal();
            }, 150);

        } catch (error) {
            console.error('❌ 初始化xterm.js终端失败:', error);
        }
    }


    /**
     * 创建终端实例
     */
    _createTerminal() {
        
        // 创建xterm.js终端实例 - 只做ANSI处理修复，保持原有配置
        this.terminal = new window.Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            allowTransparency: false,
            convertEol: true,
            scrollback: 10000,
            tabStopWidth: 4,
            // 恢复固定尺寸配置
            cols: 120,
            rows: 30,
            // 启用完整ANSI支持
            allowProposedApi: true,
            macOptionIsMeta: true,
            rightClickSelectsWord: false,
            // 优化字符处理
            disableStdin: false,
            windowsPty: false,
            // 启用真彩色和完整ANSI转义序列支持
            experimentalCharAtlas: 'dynamic',
            // 增强ANSI处理
            drawBoldTextInBrightColors: true,
            screenReaderMode: false,
            smoothScrollDuration: 0,
            // 完整的ANSI颜色主题配置
            theme: {
                background: '#000000',
                foreground: '#ffffff',
                cursor: '#ffffff',
                cursorAccent: '#000000',
                selectionBackground: '#ffffff40',
                // 标准16色支持
                black: '#000000',
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
            }
        });

        // 加载插件
        this.fitAddon = new window.FitAddon.FitAddon();
        this.webLinksAddon = new window.WebLinksAddon.WebLinksAddon();
        
        this.terminal.loadAddon(this.fitAddon);
        this.terminal.loadAddon(this.webLinksAddon);

        // 挂载终端到DOM
        this.terminal.open(this.terminalWrapper);

        // 使用固定尺寸，不进行动态调整
        console.log('✅ 使用固定终端尺寸: 120x30');

        // 处理终端输入 - 恢复简单版本，避免过度过滤
        this.terminal.onData((data) => {
            if (this.isConnected && window.shellWsManager) {
                // 直接传输所有输入，不做过度过滤
                // 之前的焦点检查会导致终端内容被意外清除
                window.shellWsManager.sendInput(data);
            }
        });

        // 禁用终端大小变化处理，使用固定尺寸
        this.terminal.onResize(({ cols, rows }) => {
            console.log(`🚫 终端尺寸变化被忽略: ${cols}x${rows}，保持固定120x30`);
        });

        this.isInitialized = true;
        console.log('✅ xterm.js终端初始化完成');

        // 添加xterm.js事件监听器进行调试
        this._addTerminalEventListeners();

        // 显示欢迎信息
        this.terminal.writeln('\x1b[36m欢迎使用 Heliki OS Claude 终端\x1b[0m');
        this.terminal.writeln('\x1b[90m请选择项目和会话，然后点击"连接"开始\x1b[0m');
        this.terminal.writeln('');
    }

    /**
     * 智能调整终端大小
     */
    _fitTerminalSize() {
        if (!this.fitAddon || !this.terminal) return;

        try {
            // 获取容器实际尺寸
            const containerRect = this.terminalWrapper.getBoundingClientRect();
            console.log(`📐 容器尺寸: ${containerRect.width}x${containerRect.height}`);

            // 确保容器有实际尺寸
            if (containerRect.width > 100 && containerRect.height > 50) {
                // 先手动计算合理的尺寸范围
                const charWidth = 9; // 大约的字符宽度
                const charHeight = 17; // 大约的行高
                const maxCols = Math.floor((containerRect.width - 20) / charWidth);
                const maxRows = Math.floor((containerRect.height - 20) / charHeight);
                
                console.log(`📏 预计算尺寸: ${maxCols}x${maxRows}`);
                
                // 使用fitAddon调整
                this.fitAddon.fit();
                
                // 验证调整后的尺寸是否合理
                const cols = this.terminal.cols;
                const rows = this.terminal.rows;
                
                if (cols > 500 || rows > 200 || cols < 20 || rows < 5) {
                    console.warn(`⚠️ 检测到异常尺寸 ${cols}x${rows}，使用安全默认值`);
                    // 使用安全的默认尺寸
                    const safeCols = Math.min(Math.max(maxCols, 80), 150);
                    const safeRows = Math.min(Math.max(maxRows, 24), 50);
                    
                    // 手动设置尺寸
                    this.terminal.resize(safeCols, safeRows);
                    console.log(`🔧 已修正为安全尺寸: ${safeCols}x${safeRows}`);
                } else {
                    console.log(`✅ 终端尺寸正常: ${cols}x${rows}`);
                }
                
                // 如果已连接，通知后端
                if (this.isConnected) {
                    this.sendTerminalSize();
                }
            } else {
                // 容器尺寸为0，延迟重试
                console.warn('⚠️ 容器尺寸太小，延迟重试...');
                setTimeout(() => this._fitTerminalSize(), 200);
            }
        } catch (error) {
            console.error('❌ 调整终端大小失败:', error);
            // 使用默认尺寸作为后备
            if (this.terminal) {
                this.terminal.resize(80, 24);
                console.log('🔧 使用默认后备尺寸: 80x24');
            }
        }
    }


    /**
     * 初始化WebSocket处理器
     */
    initWebSocketHandlers() {
        if (!window.shellWsManager) {
            console.error('❌ Shell WebSocket管理器不存在');
            return;
        }

        // 终端输出处理 - 添加ANSI序列调试
        window.shellWsManager.onMessage('output', (data) => {
            if (this.terminal && data.data) {
                // 检查是否包含可能导致清除的ANSI序列
                const hasClearLine = data.data.includes('\x1B[2K');
                const hasCursorUp = data.data.includes('\x1B[1A');
                const hasClearScreen = data.data.includes('\x1B[2J');
                const hasHome = data.data.includes('\x1B[H');
                
                console.log(`🔍 [TERMINAL DEBUG] 收到WebSocket输出消息:`, {
                    originalLength: data.data.length,
                    preview: data.data.substring(0, 100),
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
                        raw: data.data.split('').map(c => c.charCodeAt(0) < 32 ? `\\x${c.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase()}` : c).join(''),
                        clearLineCount: (data.data.match(/\x1B\[2K/g) || []).length,
                        cursorUpCount: (data.data.match(/\x1B\[1A/g) || []).length
                    });
                }
                
                // 精确的ANSI清除序列限制 - 防止过度清除历史内容
                let output = data.data;
                
                // 检测并限制过度清除序列
                if (hasClearLine && hasCursorUp) {
                    const clearLineCount = (data.data.match(/\x1B\[2K/g) || []).length;
                    const cursorUpCount = (data.data.match(/\x1B\[1A/g) || []).length;
                    
                    // 如果清除行数过多，进行动态调整
                    if (clearLineCount >= 5 && cursorUpCount >= 4) {
                        // 动态计算：减少2行以保护历史内容，最少保留3行清除能力
                        const limitedCount = Math.max(clearLineCount - 1, 3);
                        
                        console.log(`🛡️ [DYNAMIC LIMIT] 检测到过度清除序列，动态调整清除行数:`, {
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
                        output = data.data.replace(originalPattern, limitedPattern);
                        
                        console.warn(`✅ [DYNAMIC LIMIT] 已动态调整清除序列:`, {
                            原始长度: data.data.length,
                            处理后长度: output.length,
                            策略: `${clearLineCount}行 → ${limitedCount}行`,
                            保护效果: `保护了${clearLineCount - limitedCount}行历史内容`
                        });
                    } else if (clearLineCount >= 5) {
                        // 记录但不限制（用于观察）
                        console.log(`📝 [ANSI MONITOR] Claude CLI重绘序列:`, {
                            clearLineCount,
                            cursorUpCount,
                            状态: '正常传递',
                            timestamp: new Date().toISOString()
                        });
                    }
                }
                
                // 基本的终端状态检查
                if (this.terminal && this.terminal.buffer) {
                    console.log(`🔍 [TERMINAL DEBUG] 写入终端:`, {
                        outputLength: output.length,
                        terminalBufferLength: this.terminal.buffer.active?.length || 0
                    });
                    this.terminal.write(output);
                } else {
                    console.warn(`🔍 [TERMINAL DEBUG] 终端状态异常，跳过写入:`, {
                        hasTerminal: !!this.terminal,
                        hasBuffer: !!this.terminal?.buffer,
                        hasActive: !!this.terminal?.buffer?.active,
                        dataLength: output.length
                    });
                    // 尝试恢复终端状态
                    this._tryRecoverTerminalState();
                }
            }
        });

        // URL打开处理
        window.shellWsManager.onMessage('url_open', (data) => {
            this.handleUrlOpen(data.url);
        });

        // 连接状态处理
        window.shellWsManager.onConnection((connected) => {
            this.updateConnectionStatus(connected);
            
            // 连接成功后清除欢迎信息并调整终端尺寸
            if (connected && this.terminal) {
                // 参考claudecodeui的实现，连接成功后清屏
                this.terminal.clear();
                this.terminal.write('\x1b[2J\x1b[H'); // 清屏并移动光标到左上角
                
                // 调整终端尺寸
                if (this.fitAddon) {
                    setTimeout(() => {
                        this._fitTerminalSize();
                    }, 100);
                }
            }
        });
    }

    /**
     * 连接终端 - 添加状态锁防止重复连接
     */
    async connect() {
        // 检查是否正在连接中
        if (this.isConnecting) {
            console.warn('⚠️ 连接正在进行中，忽略重复请求');
            this.terminal.writeln('\x1b[33m⚠️ 连接正在进行中，请稍候...\x1b[0m');
            return;
        }

        // 设置连接锁
        this.isConnecting = true;
        // 更新连接状态显示
        this.updateConnectionStatus(false);

        try {
            console.log('🔧 开始连接终端...', {
                project: this.selectedProject?.name,
                session: this.selectedSession?.id,
                hasSession: !!this.selectedSession
            });

            // 检查终端是否已初始化
            if (!this.isInitialized) {
                this.terminal.writeln('\x1b[31m❌ 终端未初始化\x1b[0m');
                return;
            }

            // 检查项目选择
            if (!this.selectedProject) {
                const selectedProject = window.sidebar?.getSelectedProject();
                if (selectedProject) {
                    this.selectedProject = selectedProject;
                    console.log('✅ 从侧边栏获取到项目:', selectedProject);
                } else {
                    this.terminal.writeln('\x1b[31m⚠️ 请先选择一个项目\x1b[0m');
                    console.error('❌ 没有选中的项目');
                    return;
                }
            }

            // 如果已经连接，先断开
            if (this.isConnected) {
                console.log('🔄 检测到已有连接，先断开...');
                this.disconnect();
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // 显示简单的连接状态（避免与后端输出重复）
            this.terminal.write(`\x1b[36m🔗 正在连接...\x1b[0m\r\n`);

            // 初始化WebSocket处理器
            this.initWebSocketHandlers();

            // 连接WebSocket
            await window.shellWsManager.connect();
            console.log('✅ Shell WebSocket连接已建立');

            // 使用固定尺寸发送初始化消息
            const fixedCols = 120;
            const fixedRows = 30;
            
            console.log(`📐 发送固定终端尺寸: ${fixedCols}x${fixedRows}`);

            // 发送初始化消息
            const success = window.shellWsManager.initTerminal(
                this.selectedProject.path,
                this.selectedSession?.id,
                !!this.selectedSession,
                fixedCols,
                fixedRows
            );

            if (success) {
                console.log('✅ 终端初始化消息已发送');
            } else {
                throw new Error('发送初始化消息失败');
            }

        } catch (error) {
            console.error('❌ 终端连接错误:', error);
            this.terminal.writeln(`\x1b[31m❌ 连接失败: ${error.message}\x1b[0m`);
            this.isConnected = false;
        } finally {
            // 无论成功失败都要释放连接锁
            this.isConnecting = false;
            // 更新连接状态显示
            this.updateConnectionStatus(this.isConnected);
        }
    }

    /**
     * 断开终端连接
     */
    disconnect() {
        try {
            if (window.shellWsManager) {
                window.shellWsManager.disconnect();
            }
            this.terminal.writeln('\x1b[33m🔌 连接已断开\x1b[0m');
        } catch (error) {
            console.error('❌ 断开连接时发生错误:', error);
        }
    }

    /**
     * 清除终端
     */
    clearTerminal() {
        if (this.terminal) {
            this.terminal.clear();
        }
    }

    /**
     * 重启终端
     */
    restart() {
        console.log('🔄 重启终端...');
        
        // 防止在连接过程中重启
        if (this.isConnecting) {
            this.terminal.writeln('\x1b[33m⚠️ 正在连接中，请稍候...\x1b[0m');
            return;
        }
        
        // 断开连接
        if (this.isConnected) {
            this.disconnect();
        }

        // 清除终端
        this.clearTerminal();

        // 重新显示欢迎信息
        setTimeout(() => {
            this.terminal.writeln('\x1b[36m欢迎使用 Heliki OS Claude 终端\x1b[0m');
            this.terminal.writeln('\x1b[90m请选择项目和会话，然后点击"连接"开始\x1b[0m');
            this.terminal.writeln('');
            
            // 如果有选中的项目，显示提示
            if (this.selectedProject) {
                this.terminal.writeln(`\x1b[90m📁 已选择项目: ${this.selectedProject.display_name || this.selectedProject.name}\x1b[0m`);
                if (this.selectedSession) {
                    const sessionInfo = this.selectedSession.summary || this.selectedSession.id.substring(0, 8);
                    this.terminal.writeln(`\x1b[90m📋 已选择会话: ${sessionInfo}\x1b[0m`);
                }
                this.terminal.writeln('');
            }
        }, 100);
    }

    /**
     * 发送终端大小到后端
     */
    sendTerminalSize() {
        if (this.isConnected && this.terminal && window.shellWsManager) {
            window.shellWsManager.sendMessage({
                type: 'resize',
                cols: this.terminal.cols,
                rows: this.terminal.rows
            });
        }
    }

    /**
     * 处理URL打开
     */
    handleUrlOpen(url) {
        this.terminal.writeln(`\x1b[32m🌐 正在打开浏览器: ${url}\x1b[0m`);
        
        // 在新标签页中打开URL
        window.open(url, '_blank');
    }

    /**
     * 更新连接状态
     */
    updateConnectionStatus(connected) {
        this.isConnected = connected;
        
        // 更新连接按钮
        if (this.terminalConnect) {
            if (this.isConnecting) {
                this.terminalConnect.textContent = '连接中...';
                this.terminalConnect.className = 'btn btn-sm btn-warning';
                this.terminalConnect.disabled = true;
            } else if (connected) {
                this.terminalConnect.textContent = '断开';
                this.terminalConnect.className = 'btn btn-sm btn-secondary';
                this.terminalConnect.disabled = false;
            } else {
                this.terminalConnect.textContent = '连接';
                this.terminalConnect.className = 'btn btn-sm btn-primary';
                this.terminalConnect.disabled = false;
            }
        }
        
        // 更新标题状态指示器
        const headerElement = document.querySelector('#terminal-panel .terminal-header');
        if (headerElement) {
            headerElement.classList.toggle('connected', connected);
            headerElement.classList.toggle('has-session', connected && !!this.selectedSession);
        }
    }

    /**
     * 设置选中的项目
     */
    setSelectedProject(project) {
        console.log('📁 Terminal: 项目切换', { 
            from: this.selectedProject?.name, 
            to: project?.name,
            isConnecting: this.isConnecting
        });
        
        // 如果正在连接中，显示警告并忽略
        if (this.isConnecting) {
            console.warn('⚠️ 正在连接中，忽略项目切换请求');
            this.terminal.writeln('\x1b[33m⚠️ 正在连接中，请稍候...\x1b[0m');
            return;
        }
        
        this.selectedProject = project;
        this.selectedSession = null; // 重置会话
        
        // 更新终端标题
        this.updateTerminalTitle();
        
        // 显示项目切换信息
        if (this.isConnected) {
            this.terminal.writeln(`\x1b[33m\n📁 切换到项目: ${project?.display_name || project?.name}\x1b[0m`);
            this.terminal.writeln(`\x1b[90m💡 点击"连接"按钮切换到此项目\x1b[0m`);
        }
    }

    /**
     * 设置选中的会话
     */
    setSelectedSession(project, session) {
        console.log('🔄 Terminal: 会话切换', { 
            project: project?.name, 
            session: session?.id,
            currentlyConnected: this.isConnected,
            isConnecting: this.isConnecting
        });
        
        // 如果正在连接中，显示警告并忽略
        if (this.isConnecting) {
            console.warn('⚠️ 正在连接中，忽略会话切换请求');
            this.terminal.writeln('\x1b[33m⚠️ 正在连接中，请稍候...\x1b[0m');
            return;
        }
        
        // 更新项目和会话状态
        this.selectedProject = project;
        this.selectedSession = session;
        
        // 更新终端标题显示
        this.updateTerminalTitle();
        
        // 显示会话切换信息
        const sessionInfo = session ? session.summary || session.id.substring(0, 8) : '新会话';
        this.terminal.writeln(`\x1b[33m📋 已选择会话: ${sessionInfo}\x1b[0m`);
        
        // 如果已连接，提示用户重新连接
        if (this.isConnected) {
            this.terminal.writeln(`\x1b[90m💡 点击"连接"按钮切换到此会话\x1b[0m`);
        } else {
            this.terminal.writeln(`\x1b[90m💡 点击"连接"按钮开始会话\x1b[0m`);
        }
    }


    /**
     * 更新终端标题显示
     */
    updateTerminalTitle() {
        const titleElement = document.querySelector('#terminal-panel .terminal-header h3');
        if (titleElement) {
            let title = 'Claude 终端';
            if (this.selectedProject) {
                title += ` - ${this.selectedProject.display_name || this.selectedProject.name}`;
            }
            if (this.selectedSession) {
                title += ` (${this.selectedSession.summary || this.selectedSession.id.substring(0, 8)})`;
            }
            titleElement.textContent = title;
        }
    }

    /**
     * 简化的输出处理 - 参考claudecodeui的直接写入方式
     */
    _filterTerminalOutput(rawData) {
        if (!rawData || typeof rawData !== 'string') {
            return rawData;
        }
        
        // 简化处理：基本不过滤，直接返回原始数据
        // 参考claudecodeui的实现，避免过度处理导致的问题
        return rawData;
    }

    /**
     * 添加xterm.js事件监听器进行调试
     */
    _addTerminalEventListeners() {
        if (!this.terminal) return;

        // 监听终端渲染事件
        this.terminal.onRender((event) => {
            console.log(`🔍 [XTERM DEBUG] 终端渲染事件:`, {
                start: event.start,
                end: event.end,
                bufferLength: this.terminal?.buffer?.active?.length || 0,
                viewportY: this.terminal?.buffer?.active?.viewportY || 0,
                timestamp: new Date().toISOString()
            });
        });

        // 移除onWriteParsed监听器 - claudecodeui未使用此事件，可能导致问题
        // 保留注释以说明移除原因：避免undefined错误和过度处理

        // 监听缓冲区变化
        this.terminal.onScroll((yDisp) => {
            console.log(`🔍 [XTERM DEBUG] 滚动事件:`, {
                yDisp,
                bufferLength: this.terminal?.buffer?.active?.length || 0,
                viewportY: this.terminal?.buffer?.active?.viewportY || 0,
                timestamp: new Date().toISOString()
            });
        });

        // 监听选择变化
        this.terminal.onSelectionChange(() => {
            console.log(`🔍 [XTERM DEBUG] 选择变化事件:`, {
                hasSelection: this.terminal.hasSelection(),
                bufferLength: this.terminal?.buffer?.active?.length || 0,
                timestamp: new Date().toISOString()
            });
        });

        console.log('🔍 [XTERM DEBUG] 事件监听器已添加');
    }

    /**
     * 初始化调试事件监听器
     */
    initDebugEventListeners() {
        // 监听页面可见性变化
        document.addEventListener('visibilitychange', () => {
            console.log(`🔍 [PAGE DEBUG] 页面可见性变化:`, {
                hidden: document.hidden,
                visibilityState: document.visibilityState,
                hasFocus: document.hasFocus(),
                terminalActive: this.isActive(),
                timestamp: new Date().toISOString()
            });
        });

        // 监听窗口焦点变化
        window.addEventListener('focus', () => {
            console.log(`🔍 [PAGE DEBUG] 窗口获得焦点:`, {
                terminalActive: this.isActive(),
                isConnected: this.isConnected,
                terminalBufferLength: this.terminal?.buffer?.active?.length,
                timestamp: new Date().toISOString()
            });
        });

        window.addEventListener('blur', () => {
            console.log(`🔍 [PAGE DEBUG] 窗口失去焦点:`, {
                terminalActive: this.isActive(),
                isConnected: this.isConnected,
                terminalBufferLength: this.terminal?.buffer?.active?.length,
                timestamp: new Date().toISOString()
            });
        });

        // 监听文档焦点变化
        document.addEventListener('focusin', (event) => {
            console.log(`🔍 [PAGE DEBUG] 文档焦点进入:`, {
                target: event.target.tagName,
                targetId: event.target.id,
                terminalActive: this.isActive(),
                timestamp: new Date().toISOString()
            });
        });

        document.addEventListener('focusout', (event) => {
            console.log(`🔍 [PAGE DEBUG] 文档焦点离开:`, {
                target: event.target.tagName,
                targetId: event.target.id,
                terminalActive: this.isActive(),
                timestamp: new Date().toISOString()
            });
        });

        console.log('🔍 [PAGE DEBUG] 浏览器事件监听器已添加');
    }

    /**
     * 尝试恢复终端状态
     */
    _tryRecoverTerminalState() {
        console.log('🔧 [TERMINAL DEBUG] 尝试恢复终端状态...');
        
        if (!this.terminal) {
            console.error('🔧 [TERMINAL DEBUG] 终端实例不存在，无法恢复');
            return false;
        }
        
        // 检查终端是否需要重新初始化
        if (!this.terminal.buffer || !this.terminal.buffer.active) {
            console.log('🔧 [TERMINAL DEBUG] 终端缓冲区异常，尝试刷新...');
            
            try {
                // 尝试触发终端重新渲染
                if (this.fitAddon) {
                    this.fitAddon.fit();
                }
                
                // 检查恢复结果
                if (this.terminal.buffer && this.terminal.buffer.active) {
                    console.log('✅ [TERMINAL DEBUG] 终端状态恢复成功');
                    return true;
                } else {
                    console.warn('⚠️ [TERMINAL DEBUG] 终端状态恢复失败');
                    return false;
                }
            } catch (error) {
                console.error('❌ [TERMINAL DEBUG] 终端状态恢复出错:', error);
                return false;
            }
        }
        
        return true;
    }

    /**
     * 检查是否处于活动状态
     */
    isActive() {
        return this.terminalPanel?.classList.contains('active');
    }

    /**
     * 激活终端面板时的处理
     */
    onActivate() {
        // 面板激活时只做日志记录，不进行任何终端内容操作
        console.log('📺 终端面板激活，使用固定尺寸120x30');
        
        // 移除任何可能导致终端内容丢失的writeln操作
        // 焦点切换时不应该向终端写入任何内容
    }

    /**
     * 停用终端面板时的处理
     */
    onDeactivate() {
        // 面板停用时的逻辑
    }
}

// 创建全局实例
window.terminal = new Terminal();