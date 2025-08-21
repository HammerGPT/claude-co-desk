/**
 * 主应用模块
 * 移植自claudecodeui/src/App.jsx
 */

class App {
    constructor() {
        this.isLoading = true;
        this.activeTab = 'chat';
        this.environmentStatus = null;
        
        // 会话保护系统 - 移植自claudecodeui
        this.activeSessions = new Set(); // 活跃会话ID集合
        this.sessionActivity = new Map(); // 会话活动时间戳
        this.selectedSession = null; // 当前选中的会话
        
        // 进度管理系统
        this.currentProgress = 0;
        this.progressFill = null;
        this.progressText = null;
        this.progressPercent = null;
        this.statusItems = null;
        
        this.initElements();
        this.initEventListeners();
        this.initialize();
    }

    /**
     * 初始化DOM元素引用
     */
    initElements() {
        this.loadingScreen = document.getElementById('loading-screen');
        this.environmentError = document.getElementById('environment-error');
        this.mainApp = document.getElementById('main-app');
        this.environmentStatus = document.getElementById('environment-status');
        this.retryBtn = document.getElementById('retry-check');
        this.forceContinueBtn = document.getElementById('force-continue');
        
        // 进度条元素
        this.progressFill = document.getElementById('init-progress-fill');
        this.progressText = document.getElementById('init-progress-text');
        this.progressPercent = document.getElementById('init-progress-percent');
        this.statusItems = document.getElementById('init-status-items');
        
        
        // 标签按钮
        this.chatTab = document.getElementById('chat-tab');
        this.filesTab = document.getElementById('files-tab');
        this.terminalTab = document.getElementById('terminal-tab');
        
        // 内容面板
        this.chatPanel = document.getElementById('chat-panel');
        this.filesPanel = document.getElementById('files-panel');
        this.terminalPanel = document.getElementById('terminal-panel');
    }

    /**
     * 初始化事件监听器
     */
    initEventListeners() {
        // 环境检测重试
        this.retryBtn?.addEventListener('click', () => {
            this.checkEnvironment();
        });

        // 强制继续
        this.forceContinueBtn?.addEventListener('click', () => {
            this.showMainApp();
        });

        // 标签切换
        this.chatTab?.addEventListener('click', () => this.switchTab('chat'));
        this.filesTab?.addEventListener('click', () => this.switchTab('files'));
        this.terminalTab?.addEventListener('click', () => this.switchTab('terminal'));

        // 窗口大小变化
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            this.handleKeyboard(e);
        });
        
        // 页面卸载事件监听 - 修复标签页关闭时连接未断开的bug
        window.addEventListener('beforeunload', () => {
            console.log(' [APP] 页面即将卸载，清理应用资源');
            this.cleanup();
        });
        
        window.addEventListener('pagehide', () => {
            console.log(' [APP] 页面隐藏，清理应用资源');
            this.cleanup();
        });
        
        // 注册语言切换刷新方法
        if (window.i18n) {
            window.i18n.registerComponent('app', () => {
                // 如果当前显示环境错误，重新渲染
                if (this.environmentStatusData && this.environmentError && !this.environmentError.classList.contains('hidden')) {
                    this.renderEnvironmentStatus(this.environmentStatusData);
                }
            });
        }
    }

    /**
     * 应用初始化
     */
    async initialize() {
        console.log('Initializing Claude Co-Desk...');
        
        // 阶段1：环境检测 (0-40%)
        this.updateProgress(5, 'init.detectingEnvironment', 'init.detectingEnvironment');
        
        // 添加延迟确保用户能看到loading状态
        await new Promise(resolve => setTimeout(resolve, 300));
        
        await this.checkEnvironment();
        
        // 如果环境就绪，继续初始化
        if (this.environmentStatus?.ready) {
            this.updateProgress(40, 'init.foundClaude');
            this.updateLastStatusItem('success');
            
            // 短暂延迟显示成功状态
            await new Promise(resolve => setTimeout(resolve, 200));
            
            await this.initializeApp();
        }
    }

    /**
     * 检查环境状态
     */
    async checkEnvironment() {
        try {
            console.log('Checking environment status...');
            
            // 显示检查项目目录的进度
            this.updateProgress(20, 'init.checkingProjects', 'init.checkingProjects');
            
            // 添加延迟确保用户能看到loading状态
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const response = await fetch('/api/environment');
            const status = await response.json();
            
            console.log('Environment status:', status);
            this.environmentStatus = status;
            
            if (status.ready) {
                console.log('Environment check passed');
                this.updateLastStatusItem('success');
                // 不在这里调用initializeApp，因为已经在initialize方法中处理
            } else {
                console.log('Environment configuration incomplete');
                this.updateLastStatusItem('error');
                this.showEnvironmentError(status);
            }
        } catch (error) {
            console.error('Environment check failed:', error);
            this.updateLastStatusItem('error');
            this.showEnvironmentError({
                claude_cli: false,
                projects_dir: false,
                ready: false,
                error: error.message
            });
        }
    }

    /**
     * 显示环境错误
     */
    showEnvironmentError(status) {
        this.hideLoading();
        this.environmentStatusData = status; // 保存状态用于语言切换
        this.renderEnvironmentStatus(status);
    }
    
    /**
     * 渲染环境状态（支持语言切换）
     */
    renderEnvironmentStatus(status) {
        if (this.environmentStatus) {
            this.environmentStatus.innerHTML = `
                <div class="status-item">
                    <span>${t('dashboard.claudeCli')}</span>
                    <span class="status-indicator ${status.claude_cli ? 'success' : 'error'}">
                        ${status.claude_cli ? '✓ ' + t('status.ready') : '✗ ' + t('dashboard.claudeNotFound')}
                    </span>
                </div>
                <div class="status-item">
                    <span>${t('project.workingDirectory')}</span>
                    <span class="status-indicator ${status.projects_dir ? 'success' : 'error'}">
                        ${status.projects_dir ? '✓ ' + t('status.ready') : '✗ ' + t('error.loadFailed')}
                    </span>
                </div>
                ${status.projects_path ? 
                    `<div class="status-item">
                        <span>${t('dashboard.executionPath')}</span>
                        <span style="font-family: monospace; font-size: 12px;">${status.projects_path}</span>
                    </div>` : ''
                }
                ${status.error ? 
                    `<div class="status-item">
                        <span>${t('common.error')}</span>
                        <span class="status-indicator error">${status.error}</span>
                    </div>` : ''
                }
            `;
        }
        
        this.environmentError?.classList.remove('hidden');
    }

    /**
     * 初始化应用
     */
    async initializeApp() {
        console.log('Initializing application components...');
        
        try {
            // 阶段2：WebSocket连接 (40-60%)
            this.updateProgress(50, 'init.connectingWebSocket', 'init.connectingWebSocket');
            await new Promise(resolve => setTimeout(resolve, 300));
            await window.wsManager.connect();
            this.updateLastStatusItem('success');
            
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // 阶段3：组件加载 (60-80%)
            this.updateProgress(70, 'init.loadingComponents', 'init.loadingComponents');
            await new Promise(resolve => setTimeout(resolve, 300));
            if (window.employeesManager) {
                console.log('Initializing employees manager...');
                // 员工管理器已经在自己的构造函数中初始化了
            }
            this.updateLastStatusItem('success');
            
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // 阶段4：项目加载 (80-100%)
            this.updateProgress(90, 'init.loadingProjects', 'init.loadingProjects');
            await new Promise(resolve => setTimeout(resolve, 300));
            await window.enhancedSidebar.loadProjects();
            this.updateLastStatusItem('success');
            
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // 完成
            this.updateProgress(100, 'init.systemReady', 'init.systemReady');
            await new Promise(resolve => setTimeout(resolve, 200));
            this.updateLastStatusItem('success');
            
            console.log('Application initialization completed');
            
            // 短暂延迟显示完成状态
            setTimeout(() => this.showMainApp(), 500);
            
        } catch (error) {
            console.error('Application initialization failed:', error);
            this.updateLastStatusItem('error');
            this.showEnvironmentError({
                claude_cli: this.environmentStatus?.claude_cli || false,
                projects_dir: this.environmentStatus?.projects_dir || false,
                ready: false,
                error: `Initialization failed: ${error.message}`
            });
        }
    }

    /**
     * 显示主应用
     */
    showMainApp() {
        this.hideLoading();
        this.environmentError?.classList.add('hidden');
        this.mainApp?.classList.remove('hidden');
        this.isLoading = false;
        
        // 激活默认标签
        this.switchTab(this.activeTab);
        
        console.log(' 主应用界面已显示');
    }

    /**
     * 隐藏加载界面
     */
    hideLoading() {
        this.loadingScreen?.classList.add('hidden');
    }

    /**
     * 切换标签
     */
    switchTab(tabName) {
        console.log(`[DEBUG] 切换标签: ${this.activeTab} -> ${tabName}`, {
            terminalBufferLength: window.terminal?.terminal?.buffer?.active?.length || 0,
            timestamp: new Date().toISOString()
        });
        
        this.activeTab = tabName;
        
        // 更新标签按钮状态
        const tabs = [this.chatTab, this.filesTab, this.terminalTab];
        const panels = [this.chatPanel, this.filesPanel, this.terminalPanel];
        
        tabs.forEach(tab => tab?.classList.remove('active'));
        panels.forEach(panel => panel?.classList.remove('active'));
        
        // 激活当前标签
        switch (tabName) {
            case 'chat':
                this.chatTab?.classList.add('active');
                this.chatPanel?.classList.add('active');
                break;
            case 'files':
                this.filesTab?.classList.add('active');
                this.filesPanel?.classList.add('active');
                this.handleFilesTabActivation();
                break;
            case 'terminal':
                this.terminalTab?.classList.add('active');
                this.terminalPanel?.classList.add('active');
                this.handleTerminalTabActivation();
                break;
        }
        
        console.log(`[DEBUG] 标签切换完成: ${tabName}`, {
            terminalBufferLength: window.terminal?.terminal?.buffer?.active?.length || 0,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * 处理文件标签激活
     */
    handleFilesTabActivation() {
        // 文件标签激活时的逻辑
        this.loadFileTree();
    }

    /**
     * 处理终端标签激活
     */
    handleTerminalTabActivation() {
        // 终端标签激活时不进行任何操作，避免内容丢失
        // 移除对window.terminal.onActivate()的调用
        console.log(`[DEBUG] 终端标签激活，保持当前状态`, {
            terminalBufferLength: window.terminal?.terminal?.buffer?.active?.length || 0,
            isConnected: window.terminal?.isConnected,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * 加载文件树
     */
    async loadFileTree() {
        const selectedProject = window.enhancedSidebar?.getSelectedProject();
        
        if (!selectedProject) {
            // 如果没有选中项目，显示提示
            const fileTreeFiles = document.getElementById('file-tree-files');
            if (fileTreeFiles) {
                fileTreeFiles.innerHTML = '<p class="empty-message">请先选择一个项目</p>';
            }
            return;
        }
        
        // 使用FileTree类加载文件
        if (window.fileTree) {
            window.fileTree.setSelectedProject(selectedProject);
        }
    }

    /**
     * 处理窗口大小变化
     */
    handleResize() {
        // 响应式处理逻辑
        const isMobile = window.innerWidth < 768;
        
        if (isMobile) {
            // 移动端处理
            window.enhancedSidebar?.hideMobileSidebar();
        }
    }

    /**
     * 处理键盘快捷键
     */
    handleKeyboard(e) {
        // Ctrl/Cmd + 数字键切换标签
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
            switch (e.key) {
                case '1':
                    e.preventDefault();
                    this.switchTab('chat');
                    break;
                case '2':
                    e.preventDefault();
                    this.switchTab('files');
                    break;
                case '3':
                    e.preventDefault();
                    this.switchTab('terminal');
                    break;
            }
        }
        
        // ESC键处理
        if (e.key === 'Escape') {
            // 可以在这里添加ESC键的全局处理逻辑
        }
    }

    /**
     * 获取当前状态
     */
    getState() {
        return {
            isLoading: this.isLoading,
            activeTab: this.activeTab,
            environmentStatus: this.environmentStatus,
            selectedProject: window.enhancedSidebar?.getSelectedProject(),
            activeSessions: Array.from(this.activeSessions),
            selectedSession: this.selectedSession
        };
    }

    // ===== 进度管理系统 =====

    /**
     * 更新初始化进度
     */
    updateProgress(percent, textKey, statusKey = null) {
        this.currentProgress = percent;
        
        // 更新进度条
        if (this.progressFill) {
            this.progressFill.style.width = percent + '%';
        }
        
        // 更新百分比显示
        if (this.progressPercent) {
            this.progressPercent.textContent = percent + '%';
        }
        
        // 更新状态文本
        if (this.progressText && textKey) {
            this.progressText.setAttribute('data-i18n', textKey);
            this.progressText.textContent = window.i18n ? t(textKey) : textKey;
        }
        
        // 添加状态日志项
        if (statusKey) {
            this.addStatusItem(statusKey);
        }
        
        console.log(`Progress: ${percent}% - ${textKey}`);
    }

    /**
     * 添加状态日志项（只保留最新的一个）
     */
    addStatusItem(textKey, status = 'loading') {
        if (!this.statusItems) return;
        
        // 清空现有内容，只保留最新的状态
        this.statusItems.innerHTML = '';
        
        const item = document.createElement('div');
        item.className = 'status-item';
        
        // 状态图标
        let iconHtml = '';
        switch (status) {
            case 'loading':
                iconHtml = '<img src="/static/assets/icons/interface/detect.png" width="16" height="16" alt="检测中">';
                break;
            case 'success':
                iconHtml = '<img src="/static/assets/icons/status/check.png" width="16" height="16" alt="完成">';
                break;
            case 'error':
                iconHtml = '<img src="/static/assets/icons/status/warning.png" width="16" height="16" alt="错误">';
                break;
            default:
                iconHtml = '<img src="/static/assets/icons/interface/detect.png" width="16" height="16" alt="检测中">';
        }
        
        item.innerHTML = `
            <span class="status-icon ${status}">${iconHtml}</span>
            <span data-i18n="${textKey}">${window.i18n ? t(textKey) : textKey}</span>
        `;
        
        this.statusItems.appendChild(item);
    }

    /**
     * 更新当前状态项的状态
     */
    updateLastStatusItem(status = 'success') {
        if (!this.statusItems) return;
        
        const item = this.statusItems.querySelector('.status-item');
        if (item) {
            const iconSpan = item.querySelector('.status-icon');
            if (iconSpan) {
                iconSpan.className = `status-icon ${status}`;
                
                // 更新图标为PNG
                let iconHtml = '';
                switch (status) {
                    case 'loading':
                        iconHtml = '<img src="/static/assets/icons/interface/detect.png" width="16" height="16" alt="检测中">';
                        break;
                    case 'success':
                        iconHtml = '<img src="/static/assets/icons/status/check.png" width="16" height="16" alt="完成">';
                        break;
                    case 'error':
                        iconHtml = '<img src="/static/assets/icons/status/warning.png" width="16" height="16" alt="错误">';
                        break;
                    default:
                        iconHtml = '<img src="/static/assets/icons/interface/detect.png" width="16" height="16" alt="检测中">';
                }
                iconSpan.innerHTML = iconHtml;
            }
        }
    }

    // ===== 会话保护系统 - 移植自claudecodeui =====

    /**
     * 标记会话为活跃状态
     */
    markSessionAsActive(sessionId) {
        if (!sessionId) return;
        
        this.activeSessions.add(sessionId);
        this.sessionActivity.set(sessionId, Date.now());
        
        console.log(` 会话已激活: ${sessionId}`);
        
        // 通知侧边栏更新视觉状态
        this.notifySessionStateChange();
    }

    /**
     * 标记会话为非活跃状态
     */
    markSessionAsInactive(sessionId) {
        if (!sessionId) return;
        
        this.activeSessions.delete(sessionId);
        this.sessionActivity.delete(sessionId);
        
        console.log(` 会话已去激活: ${sessionId}`);
        
        // 通知侧边栏更新视觉状态
        this.notifySessionStateChange();
    }

    /**
     * 检查会话是否活跃
     */
    isSessionActive(sessionId) {
        return this.activeSessions.has(sessionId);
    }

    /**
     * 设置当前选中的会话
     */
    setSelectedSession(session) {
        const previousSession = this.selectedSession;
        this.selectedSession = session;
        
        console.log(`[TARGET] 选中会话: ${session?.id || 'null'}`);
        
        // 如果选择了新会话，激活它
        if (session?.id) {
            this.markSessionAsActive(session.id);
        }
        
        // 通知其他组件会话选择变化
        document.dispatchEvent(new CustomEvent('sessionSelected', {
            detail: { session, previousSession }
        }));
        
        return session;
    }

    /**
     * 获取当前选中的会话
     */
    getSelectedSession() {
        return this.selectedSession;
    }

    /**
     * 检查会话是否在最近10分钟内活跃
     */
    isSessionRecentlyActive(sessionId) {
        const lastActivity = this.sessionActivity.get(sessionId);
        if (!lastActivity) return false;
        
        const tenMinutesAgo = Date.now() - 10 * 60 * 1000; // 10分钟
        return lastActivity > tenMinutesAgo;
    }

    /**
     * 清理过期的会话活动记录
     */
    cleanupExpiredSessions() {
        const now = Date.now();
        const oneHourAgo = now - 60 * 60 * 1000; // 1小时
        
        for (const [sessionId, timestamp] of this.sessionActivity.entries()) {
            if (timestamp < oneHourAgo) {
                this.markSessionAsInactive(sessionId);
            }
        }
    }

    /**
     * 通知侧边栏会话状态变化
     */
    notifySessionStateChange() {
        document.dispatchEvent(new CustomEvent('sessionStateChanged', {
            detail: {
                activeSessions: Array.from(this.activeSessions),
                selectedSession: this.selectedSession
            }
        }));
    }

    /**
     * 智能会话选择 - 避免重复连接
     */
    handleSessionClick(session) {
        // 如果点击的是已选中的会话，直接切换到chat标签
        if (this.selectedSession?.id === session.id) {
            console.log(` 切换到已连接的会话: ${session.id}`);
            this.switchTab('chat');
            return false; // 阻止重复连接
        }
        
        // 选择新会话
        this.setSelectedSession(session);
        this.switchTab('chat');
        return true; // 允许新连接
    }

    /**
     * 清理应用资源 - 修复页面关闭时连接未断开的问题
     */
    cleanup() {
        console.log(' [APP] 开始清理应用资源...');
        
        try {
            // 1. 清理会话终端（新版多会话终端）
            if (window.sessionTerminal) {
                console.log(' [APP] 清理会话终端...');
                window.sessionTerminal.cleanup();
            }
            
            // 2. 清理旧版终端（兼容性）
            if (window.terminal) {
                console.log(' [APP] 清理旧版终端...');
                window.terminal.cleanup();
            }
            
            // 3. 清理WebSocket连接
            if (window.wsManager) {
                console.log(' [APP] 清理聊天WebSocket...');
                window.wsManager.disconnect();
            }
            
            if (window.shellWsManager) {
                console.log(' [APP] 清理Shell WebSocket...');
                window.shellWsManager.cleanup();
            }
            
            // 4. 清理会话状态
            this.activeSessions.clear();
            this.sessionActivity.clear();
            this.selectedSession = null;
            
            console.log(' [APP] 应用资源清理完成');
            
        } catch (error) {
            console.error(' [APP] 清理过程中出现错误:', error);
        }
    }

}

// 应用启动
document.addEventListener('DOMContentLoaded', () => {
    console.log(' 启动 Claude Co-Desk...');
    window.app = new App();
});

// 全局错误处理
window.addEventListener('error', (event) => {
    console.error('全局错误:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('未处理的Promise拒绝:', event.reason);
});