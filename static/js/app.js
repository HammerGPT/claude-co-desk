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
        
        // 移动端支持
        this.isMobile = window.innerWidth <= 768;
        this.mobileMenuOpen = false;
        
        this.initElements();
        this.initEventListeners();
        this.initMobileSupport();
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
            this.cleanup();
        });
        
        window.addEventListener('pagehide', () => {
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
            
            // 阶段3：组件加载 (60-80%) - 移动端条件加载
            this.updateProgress(70, 'init.loadingComponents', 'init.loadingComponents');
            await new Promise(resolve => setTimeout(resolve, 300));
            
            if (this.isMobile) {
                console.log('Mobile mode: Loading essential components only...');
                // 移动端只加载必要组件
                await this.initMobileComponents();
            } else {
                console.log('Desktop mode: Loading all components...');
                // PC端加载所有组件
                await this.initDesktopComponents();
            }
            
            this.updateLastStatusItem('success');
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // 阶段4：项目加载 (80-100%) - 移动端跳过项目管理
            if (!this.isMobile) {
                this.updateProgress(90, 'init.loadingProjects', 'init.loadingProjects');
                await new Promise(resolve => setTimeout(resolve, 300));
                await window.enhancedSidebar.loadProjects();
                this.updateLastStatusItem('success');
                await new Promise(resolve => setTimeout(resolve, 200));
            } else {
                console.log('Mobile mode: Skipping project management...');
                this.updateProgress(90, 'init.systemReady', 'init.systemReady');
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            // 完成
            this.updateProgress(100, 'init.systemReady', 'init.systemReady');
            await new Promise(resolve => setTimeout(resolve, 200));
            this.updateLastStatusItem('success');
            
            console.log(`Application initialization completed (${this.isMobile ? 'Mobile' : 'Desktop'} mode)`);
            
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
     * 初始化移动端组件 - 只加载必要功能
     */
    async initMobileComponents() {
        console.log('Initializing mobile-essential components...');
        
        // 只初始化任务管理器（核心功能）
        if (window.taskManager) {
            console.log('✓ Task Manager loaded (mobile-essential)');
        }
        
        // 跳过以下组件以提升性能：
        // - employeesManager (智能体团队管理)
        // - 项目管理相关组件
        // - Dashboard复杂功能
        // - MCP工具管理
        // - 文件管理器
        
        console.log('Mobile components initialization completed');
    }

    /**
     * 初始化桌面端组件 - 加载所有功能
     */
    async initDesktopComponents() {
        console.log('Initializing desktop components...');
        
        // 加载所有功能组件
        if (window.employeesManager) {
            console.log('✓ Employees Manager loaded');
        }
        
        if (window.taskManager) {
            console.log('✓ Task Manager loaded');
        }
        
        // 其他PC端专用组件在各自的文件中已经初始化
        console.log('Desktop components initialization completed');
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
        
        // 系统完全初始化后，触发初始化引导检查
        setTimeout(() => {
            if (window.initGuide) {
                // 重新检查系统状态并显示引导（如果需要）
                window.initGuide.checkSystemStatus().then(() => {
                    if (window.initGuide.needsInit) {
                        window.initGuide.showWelcomeModal();
                    }
                });
            }
        }, 1000); // 延迟1秒确保所有组件都已完全加载
        
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
        
        try {
            // 1. 清理会话终端（新版多会话终端）
            if (window.sessionTerminal) {
                window.sessionTerminal.cleanup();
            }
            
            // 2. 清理旧版终端（兼容性）
            if (window.terminal) {
                window.terminal.cleanup();
            }
            
            // 3. 清理WebSocket连接
            if (window.wsManager) {
                window.wsManager.disconnect();
            }
            
            if (window.shellWsManager) {
                window.shellWsManager.cleanup();
            }
            
            // 4. 清理会话状态
            this.activeSessions.clear();
            this.sessionActivity.clear();
            this.selectedSession = null;
            
            
        } catch (error) {
            console.error(' [APP] 清理过程中出现错误:', error);
        }
    }

    /**
     * Initialize mobile support
     */
    initMobileSupport() {
        // 移动端新增任务按钮 (替换原菜单按钮)
        const mobileAddTaskBtn = document.getElementById('mobile-add-task-btn');
        
        if (mobileAddTaskBtn) {
            // 新增任务功能
            mobileAddTaskBtn.addEventListener('click', () => {
                if (window.taskManager) {
                    window.taskManager.showQuickAddTask();
                } else {
                    console.warn('TaskManager not available');
                }
            });
        }

        // 添加PC端功能提示
        if (this.isMobile) {
            this.initPCOnlyToasts();
            this.initMobileTasks();
        }

        // Handle window resize
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }

    /**
     * Initialize mobile tasks display
     */
    initMobileTasks() {
        // 如果TaskManager已经加载，立即初始化移动端任务显示
        if (window.taskManager) {
            this.setupMobileTasksSync();
            
            // 移动端兜底同步机制
            if (this.isMobile) {
                // 立即尝试同步
                this.syncTasksToMobile();
                
                // 多重延迟重试，确保在各种加载时序下都能同步
                setTimeout(() => this.syncTasksToMobile(), 100);
                setTimeout(() => this.syncTasksToMobile(), 300);
                setTimeout(() => this.syncTasksToMobile(), 500);
            }
        } else {
            // 等待TaskManager加载完成
            const checkTaskManager = setInterval(() => {
                if (window.taskManager) {
                    clearInterval(checkTaskManager);
                    this.setupMobileTasksSync();
                    
                    // 移动端兜底同步机制
                    if (this.isMobile) {
                        // TaskManager刚加载完成，立即同步
                        this.syncTasksToMobile();
                        
                        // 延迟重试确保数据已加载
                        setTimeout(() => this.syncTasksToMobile(), 200);
                        setTimeout(() => this.syncTasksToMobile(), 500);
                    }
                }
            }, 100);
        }
    }

    /**
     * Setup mobile tasks synchronization with TaskManager
     */
    setupMobileTasksSync() {
        // 立即执行一次初始同步
        this.syncTasksToMobile();
        
        // 监听任务列表变化，同步到移动端容器 - 修正方法名
        const originalRenderTasksList = window.taskManager.renderTasksList;
        if (originalRenderTasksList) {
            window.taskManager.renderTasksList = function() {
                // 调用原方法
                originalRenderTasksList.call(this);
                
                // 同步到移动端
                if (window.app && window.app.isMobile) {
                    window.app.syncTasksToMobile();
                }
            };
        }
        
        // 监听任务加载完成事件，确保初始任务显示
        const originalLoadTasks = window.taskManager.loadTasks;
        if (originalLoadTasks) {
            window.taskManager.loadTasks = function() {
                // 调用原方法
                const result = originalLoadTasks.call(this);
                
                // 加载完成后同步到移动端
                if (window.app && window.app.isMobile) {
                    // 减少延迟时间，提高响应性
                    setTimeout(() => {
                        window.app.syncTasksToMobile();
                    }, 50);
                }
                
                return result;
            };
        }
        
        // 增加事件驱动的同步机制（最可靠的方式）
        document.addEventListener('tasksUpdated', (event) => {
            if (window.app && window.app.isMobile) {
                // 确保DOM更新完成后再同步
                requestAnimationFrame(() => {
                    window.app.syncTasksToMobile();
                });
            }
        });
    }

    /**
     * Sync tasks to mobile container
     */
    syncTasksToMobile() {
        // 只在移动端模式下执行同步
        if (!this.isMobile) return;
        
        const mobileTasksList = document.getElementById('mobile-tasks-list');
        const sidebarTasksList = document.getElementById('tasks-list');
        
        if (mobileTasksList && sidebarTasksList) {
            // 检查源容器是否有内容，避免清空已有内容
            if (sidebarTasksList.innerHTML.trim()) {
                // 复制侧边栏任务列表到移动端
                mobileTasksList.innerHTML = sidebarTasksList.innerHTML;
                console.log('Mobile tasks synced successfully, source has content');
            } else if (sidebarTasksList.innerHTML.includes('empty-tasks')) {
                // 源容器显示空状态，也同步空状态到移动端
                mobileTasksList.innerHTML = sidebarTasksList.innerHTML;
                console.log('Mobile tasks synced: empty state');
            } else {
                console.log('Mobile sync skipped: source container has no content yet');
            }
        } else {
            console.log('Mobile sync failed: containers not found', {
                mobileTasksList: !!mobileTasksList,
                sidebarTasksList: !!sidebarTasksList
            });
        }
    }

    /**
     * Initialize PC-only feature toast notifications for mobile
     */
    initPCOnlyToasts() {
        // 为所有PC功能提示按钮添加事件监听
        document.addEventListener('click', (e) => {
            const pcHintBtn = e.target.closest('.mobile-pc-hint-btn');
            if (pcHintBtn && this.isMobile) {
                e.preventDefault();
                e.stopPropagation();
                
                const featureKey = pcHintBtn.getAttribute('data-pc-feature') || 'default';
                let message;
                
                // 确保国际化系统加载完成
                if (typeof t === 'function') {
                    message = t(`mobile.pcFeatureHint.${featureKey}`);
                    if (!message || message.startsWith('mobile.pcFeatureHint.')) {
                        message = t('mobile.pcFeatureHint.default');
                    }
                }
                
                // Fallback机制
                if (!message || message.startsWith('mobile.pcFeatureHint.')) {
                    const fallbackMessages = {
                        'settings': 'System settings feature, please use on PC for full experience',
                        'projectManagement': 'Project management feature, please use on PC',
                        'agentsTeam': 'Digital employee team management, please use on PC',
                        'fileManagement': 'File management feature, please use on PC',
                        'default': 'This feature is available on PC'
                    };
                    message = fallbackMessages[featureKey] || fallbackMessages.default;
                }
                
                this.showPCOnlyToast(message);
            }
        });

        // 为移动端隐藏的元素添加数据属性，如果用户尝试访问则显示提示
        const hiddenElements = [
            { selector: '#settings-btn', feature: 'settings' },
            { selector: '#agents-team-btn', feature: 'agentsTeam' },
            { selector: '#new-project', feature: 'projectManagement' },
            { selector: '#refresh-projects', feature: 'projectManagement' },
            { selector: '#files-drawer-btn', feature: 'fileManagement' }
        ];

        hiddenElements.forEach(({ selector, feature }) => {
            const element = document.querySelector(selector);
            if (element) {
                element.setAttribute('data-pc-feature', feature);
                element.classList.add('mobile-pc-hint-btn');
            }
        });
    }

    /**
     * Show PC-only feature toast notification
     */
    showPCOnlyToast(message) {
        // 移除现有的toast
        const existingToast = document.querySelector('.pc-only-toast');
        if (existingToast) {
            existingToast.remove();
        }

        // 创建toast元素
        const toast = document.createElement('div');
        toast.className = 'pc-only-toast';
        toast.innerHTML = `
            <div class="toast-content">
                <img src="/static/assets/icons/interface/settings.png" width="16" height="16" alt="PC" class="toast-icon">
                <span class="toast-message">${message}</span>
            </div>
        `;

        // 添加toast样式
        Object.assign(toast.style, {
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'hsl(var(--card))',
            color: 'hsl(var(--card-foreground))',
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid hsl(var(--border))',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: '9999',
            maxWidth: '80vw',
            fontSize: '14px',
            opacity: '0',
            transition: 'all 300ms ease'
        });

        // toast内容样式
        const toastContent = toast.querySelector('.toast-content');
        Object.assign(toastContent.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        });

        const toastIcon = toast.querySelector('.toast-icon');
        Object.assign(toastIcon.style, {
            opacity: '0.7',
            flexShrink: '0'
        });

        const toastMessage = toast.querySelector('.toast-message');
        Object.assign(toastMessage.style, {
            lineHeight: '1.4'
        });

        // 添加到页面
        document.body.appendChild(toast);

        // 显示动画
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0px)';
        });

        // 3秒后自动隐藏
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(-10px)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }


    /**
     * Handle window resize
     */
    handleResize() {
        const newIsMobile = window.innerWidth <= 768;
        
        if (newIsMobile !== this.isMobile) {
            this.isMobile = newIsMobile;
            
            // 重新同步任务显示
            if (this.isMobile) {
                this.syncTasksToMobile();
            }
        }
    }

}

// 应用启动
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});

// 全局错误处理
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('未处理的Promise拒绝:', event.reason);
});