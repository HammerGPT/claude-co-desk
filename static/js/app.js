/**
 * 主应用模块
 * 移植自claudecodeui/src/App.jsx
 */

class App {
    constructor() {
        this.isLoading = true;
        this.activeTab = 'chat';
        this.environmentStatus = null;
        
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
            selectedProject: window.enhancedSidebar?.getSelectedProject()
        };
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