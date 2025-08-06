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
            console.log('🔄 [APP] 页面即将卸载，清理应用资源');
            this.cleanup();
        });
        
        window.addEventListener('pagehide', () => {
            console.log('🔄 [APP] 页面隐藏，清理应用资源');
            this.cleanup();
        });
    }

    /**
     * 应用初始化
     */
    async initialize() {
        console.log('🚀 初始化 Heliki OS...');
        
        // 检查环境
        await this.checkEnvironment();
        
        // 如果环境就绪，继续初始化
        if (this.environmentStatus?.ready) {
            await this.initializeApp();
        }
    }

    /**
     * 检查环境状态
     */
    async checkEnvironment() {
        try {
            console.log('🔍 检查环境状态...');
            
            const response = await fetch('/api/environment');
            const status = await response.json();
            
            console.log('环境状态:', status);
            this.environmentStatus = status;
            
            if (status.ready) {
                console.log('✅ 环境检查通过');
                await this.initializeApp();
            } else {
                console.log('⚠️ 环境配置不完整');
                this.showEnvironmentError(status);
            }
        } catch (error) {
            console.error('❌ 环境检查失败:', error);
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
        
        if (this.environmentStatus) {
            this.environmentStatus.innerHTML = `
                <div class="status-item">
                    <span>Claude CLI</span>
                    <span class="status-indicator ${status.claude_cli ? 'success' : 'error'}">
                        ${status.claude_cli ? '✅ 已安装' : '❌ 未安装'}
                    </span>
                </div>
                <div class="status-item">
                    <span>项目目录</span>
                    <span class="status-indicator ${status.projects_dir ? 'success' : 'error'}">
                        ${status.projects_dir ? '✅ 已存在' : '❌ 不存在'}
                    </span>
                </div>
                ${status.projects_path ? 
                    `<div class="status-item">
                        <span>路径</span>
                        <span style="font-family: monospace; font-size: 12px;">${status.projects_path}</span>
                    </div>` : ''
                }
                ${status.error ? 
                    `<div class="status-item">
                        <span>错误</span>
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
        console.log('🚀 初始化应用组件...');
        
        try {
            // 连接WebSocket
            await window.wsManager.connect();
            
            // 加载项目列表
            await window.enhancedSidebar.loadProjects();
            
            // 显示主应用
            this.showMainApp();
            
            console.log('✅ 应用初始化完成');
        } catch (error) {
            console.error('❌ 应用初始化失败:', error);
            this.showEnvironmentError({
                claude_cli: this.environmentStatus?.claude_cli || false,
                projects_dir: this.environmentStatus?.projects_dir || false,
                ready: false,
                error: `初始化失败: ${error.message}`
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
        
        console.log('✅ 主应用界面已显示');
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
        console.log(`🔍 [APP DEBUG] 切换标签: ${this.activeTab} -> ${tabName}`, {
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
        
        console.log(`🔍 [APP DEBUG] 标签切换完成: ${tabName}`, {
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
        console.log(`🔍 [APP DEBUG] 终端标签激活，保持当前状态`, {
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

    // ===== 会话保护系统 - 移植自claudecodeui =====

    /**
     * 标记会话为活跃状态
     */
    markSessionAsActive(sessionId) {
        if (!sessionId) return;
        
        this.activeSessions.add(sessionId);
        this.sessionActivity.set(sessionId, Date.now());
        
        console.log(`✅ 会话已激活: ${sessionId}`);
        
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
        
        console.log(`🔕 会话已去激活: ${sessionId}`);
        
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
        
        console.log(`🎯 选中会话: ${session?.id || 'null'}`);
        
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
            console.log(`🔄 切换到已连接的会话: ${session.id}`);
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
        console.log('🧹 [APP] 开始清理应用资源...');
        
        try {
            // 1. 清理会话终端（新版多会话终端）
            if (window.sessionTerminal) {
                console.log('🧹 [APP] 清理会话终端...');
                window.sessionTerminal.cleanup();
            }
            
            // 2. 清理旧版终端（兼容性）
            if (window.terminal) {
                console.log('🧹 [APP] 清理旧版终端...');
                window.terminal.cleanup();
            }
            
            // 3. 清理WebSocket连接
            if (window.wsManager) {
                console.log('🧹 [APP] 清理聊天WebSocket...');
                window.wsManager.disconnect();
            }
            
            if (window.shellWsManager) {
                console.log('🧹 [APP] 清理Shell WebSocket...');
                window.shellWsManager.cleanup();
            }
            
            // 4. 清理会话状态
            this.activeSessions.clear();
            this.sessionActivity.clear();
            this.selectedSession = null;
            
            console.log('✅ [APP] 应用资源清理完成');
            
        } catch (error) {
            console.error('❌ [APP] 清理过程中出现错误:', error);
        }
    }

}

// 应用启动
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 启动 Heliki OS...');
    window.app = new App();
});

// 全局错误处理
window.addEventListener('error', (event) => {
    console.error('全局错误:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('未处理的Promise拒绝:', event.reason);
});