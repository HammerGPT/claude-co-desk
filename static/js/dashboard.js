/**
 * 任务管理器仪表板组件
 * 负责显示系统概览、快速操作和初始化引导
 */

class TaskManagerDashboard {
    constructor() {
        console.log(' TaskManagerDashboard 初始化开始');
        this.systemStatus = null;
        this.taskStats = { total: 0, immediate: 0 }; // 初始显示0
        this.mcpStatus = undefined; // 初始状态为undefined，表示未开始加载
        this.claudeInfo = {
            version: '1.0.73 (Claude Code)',
            path: null // 将通过API动态获取
        };
        this.agentsCount = 0;
        this.isInitialized = false;
        
        this.initElements();
        this.initEventListeners();
        this.loadDashboardData();
        
        // 初始化时就检查显示状态
        setTimeout(() => {
            this.updateDisplayState();
        }, 100);
        
        // 延迟再次检查，确保所有组件都已加载
        setTimeout(() => {
            this.updateDisplayState();
        }, 500);
        
        console.log('✅ TaskManagerDashboard 初始化完成');
    }

    /**
     * 初始化DOM元素引用
     */
    initElements() {
        this.dashboardContainer = document.getElementById('task-manager-dashboard');
        this.sessionHeader = document.querySelector('.session-header');
        this.sessionTabBar = document.querySelector('.session-tab-bar');
        
        console.log('🔍 Dashboard DOM元素检查:', {
            dashboardContainer: !!this.dashboardContainer,
            sessionHeader: !!this.sessionHeader,
            sessionTabBar: !!this.sessionTabBar
        });
    }

    /**
     * 初始化事件监听器
     */
    initEventListeners() {
        // 监听会话状态变化
        document.addEventListener('sessionSwitch', (event) => {
            this.handleSessionSwitch(event.detail);
        });

        // 监听系统状态更新
        document.addEventListener('systemProjectStatusUpdated', (event) => {
            this.systemStatus = event.detail;
            this.updateDashboard();
        });
        
        // 监听侧边栏页签状态变化
        document.addEventListener('tabStateChanged', (event) => {
            this.updateDisplayState();
        });
        
        // 监听任务数据更新
        document.addEventListener('tasksUpdated', (event) => {
            this.taskStats = {
                total: Array.isArray(event.detail.tasks) ? event.detail.tasks.length : 0,
                immediate: Array.isArray(event.detail.tasks) ? 
                    event.detail.tasks.filter(task => task.scheduleFrequency === 'immediate').length : 0
            };
            this.updateDashboard();
        });
        
        // 注册语言切换刷新方法
        if (window.i18n) {
            window.i18n.registerComponent('dashboard', () => this.updateDashboard());
        }
    }

    /**
     * 处理会话切换
     */
    handleSessionSwitch(sessionData) {
        console.log(' Dashboard收到会话切换事件:', sessionData);
        // 有活跃会话时隐藏仪表板，显示session-header
        this.hideDashboard();
        this.showSessionHeader();
    }

    /**
     * 显示仪表板
     */
    showDashboard() {
        console.log(' 显示任务管理器仪表板');
        if (this.dashboardContainer) {
            this.dashboardContainer.style.display = '';
        }
        this.hideSessionHeader();
        this.hideSessionTabBar();
        this.updateDashboard();
    }

    /**
     * 隐藏仪表板
     */
    hideDashboard() {
        if (this.dashboardContainer) {
            this.dashboardContainer.style.display = 'none';
        }
        this.showSessionTabBar();
    }

    /**
     * 显示session-header
     */
    showSessionHeader() {
        if (this.sessionHeader) {
            this.sessionHeader.style.display = 'flex';
        }
    }

    /**
     * 隐藏session-header
     */
    hideSessionHeader() {
        if (this.sessionHeader) {
            this.sessionHeader.style.display = 'none';
        }
    }

    /**
     * 显示session-tab-bar
     */
    showSessionTabBar() {
        if (this.sessionTabBar) {
            this.sessionTabBar.style.display = 'block';
        }
    }

    /**
     * 隐藏session-tab-bar
     */
    hideSessionTabBar() {
        if (this.sessionTabBar) {
            this.sessionTabBar.style.display = 'none';
        }
    }

    /**
     * 加载仪表板数据
     */
    async loadDashboardData() {
        try {
            // 立即渲染Dashboard，显示加载状态
            this.updateDashboard();
            
            // 首先加载系统配置
            await this.loadConfigAsync();
            
            // 并行加载所有数据，不阻塞页面显示
            this.loadBasicDataAsync();
            this.loadMCPStatusAsync();
            
        } catch (error) {
            console.error('加载仪表板数据失败:', error);
            this.renderErrorState();
        }
    }

    /**
     * 加载系统配置
     */
    async loadConfigAsync() {
        try {
            const response = await fetch('/api/config');
            if (response.ok) {
                const config = await response.json();
                
                // 更新Claude CLI路径信息
                if (config.claudeCliPath) {
                    this.claudeInfo.path = config.claudeCliPath;
                }
                
                // 保存配置供其他方法使用
                this.systemConfig = config;
                
                console.log('系统配置已加载:', config);
            }
        } catch (error) {
            console.error('加载系统配置失败:', error);
        }
    }

    /**
     * 格式化路径显示（将用户主目录替换为~）
     */
    formatHomePath(path) {
        if (!path || !this.systemConfig?.userHome) {
            return path || '';
        }
        return path.replace(this.systemConfig.userHome, '~');
    }

    /**
     * 异步加载基础数据（不阻塞页面显示）
     */
    async loadBasicDataAsync() {
        try {
            console.log('开始异步加载基础数据...');
            await this.loadBasicData();
            console.log('基础数据加载完成，重新渲染Dashboard');
            // 基础数据加载完成后重新渲染Dashboard
            this.updateDashboard();
        } catch (error) {
            console.error('异步加载基础数据失败:', error);
            // 即使基础数据加载失败，也要更新显示默认状态
            this.systemStatus = null;
            this.taskStats = { total: 0, immediate: 0 };
            this.claudeInfo = {
                version: '1.0.73 (Claude Code)',
                path: this.systemConfig?.claudeCliPath || t('dashboard.claudeNotFound')
            };
            this.agentsCount = 0;
            this.updateDashboard();
        }
    }

    /**
     * 加载基础数据（快速加载）
     */
    async loadBasicData() {
        try {
            // 加载系统状态
            const systemResponse = await fetch('/api/system-project/status');
            if (systemResponse.ok) {
                this.systemStatus = await systemResponse.json();
            }

            // 加载任务统计
            const tasksResponse = await fetch('/api/tasks');
            if (tasksResponse.ok) {
                const tasksData = await tasksResponse.json();
                this.taskStats = {
                    total: Array.isArray(tasksData.tasks) ? tasksData.tasks.length : 0,
                    immediate: Array.isArray(tasksData.tasks) ? 
                        tasksData.tasks.filter(task => task.scheduleFrequency === 'immediate').length : 0
                };
            } else {
                this.taskStats = { total: 0, immediate: 0 };
            }

            // 加载Claude CLI信息和智能体数量
            await this.loadSystemInfo();
            
        } catch (error) {
            console.error('加载基础数据失败:', error);
            // 使用默认值确保页面能够显示
            this.systemStatus = null;
            this.taskStats = { total: 0, immediate: 0 };
            this.claudeInfo = {
                version: '1.0.73 (Claude Code)',
                path: this.systemConfig?.claudeCliPath || t('dashboard.claudeNotFound')
            };
            this.agentsCount = 0;
        }
    }

    /**
     * 异步加载MCP工具状态（不阻塞页面显示）
     */
    async loadMCPStatusAsync() {
        try {
            console.log('开始异步加载MCP状态...');
            await this.loadMCPStatus();
            console.log('MCP状态加载完成，重新渲染Dashboard');
            // MCP数据加载完成后重新渲染Dashboard
            this.updateDashboard();
        } catch (error) {
            console.error('异步加载MCP状态失败:', error);
            // 即使MCP加载失败，也要更新显示错误状态
            this.mcpStatus = null;
            this.updateDashboard();
        }
    }

    /**
     * 加载系统信息
     */
    async loadSystemInfo() {
        try {
            // 获取Claude CLI版本和路径
            const claudeInfoResponse = await fetch('/api/claude-info');
            if (claudeInfoResponse.ok) {
                this.claudeInfo = await claudeInfoResponse.json();
            } else {
                this.claudeInfo = {
                    version: '1.0.73 (Claude Code)',
                    path: this.systemConfig?.claudeCliPath || 'claude'
                };
            }

            // 获取智能体数量
            const agentsResponse = await fetch('/api/system-project/agents');
            if (agentsResponse.ok) {
                const agentsData = await agentsResponse.json();
                this.agentsCount = agentsData.count || 0;
            } else {
                this.agentsCount = 0; // 默认值，如果API失败则显示0
            }
        } catch (error) {
            console.error('加载系统信息失败:', error);
            // 使用默认值
            this.claudeInfo = {
                version: '1.0.73 (Claude Code)',
                path: this.systemConfig?.claudeCliPath || t('dashboard.claudeNotFound')
            };
            this.agentsCount = 0; // 错误时显示0而不是硬编码的5
        }
    }

    /**
     * 加载MCP工具状态
     */
    async loadMCPStatus() {
        try {
            const response = await fetch('/api/mcp/cross-project-status');
            if (response.ok) {
                this.mcpStatus = await response.json();
                console.log('Dashboard MCP状态加载成功:', this.mcpStatus);
            } else {
                console.warn('加载MCP状态失败:', response.status);
                this.mcpStatus = null;
            }
        } catch (error) {
            console.error('加载MCP状态异常:', error);
            this.mcpStatus = null;
        }
    }

    /**
     * 获取MCP工具标题（带动态总数）
     */
    getMCPTitle() {
        if (!this.mcpStatus) {
            return t('dashboard.mcpTools');
        }
        
        // 计算总工具数
        let totalCount = 0;
        
        // 用户全局工具
        if (this.mcpStatus.userHomeStatus && this.mcpStatus.userHomeStatus.count) {
            totalCount += this.mcpStatus.userHomeStatus.count;
        }
        
        // 各项目工具
        if (this.mcpStatus.projectStatuses && Array.isArray(this.mcpStatus.projectStatuses)) {
            this.mcpStatus.projectStatuses.forEach(project => {
                if (project.mcpStatus && project.mcpStatus.count) {
                    totalCount += project.mcpStatus.count;
                }
            });
        }
        
        return `${t('dashboard.mcpTools')} (Total: ${totalCount})`;
    }

    /**
     * 渲染MCP工具列表
     */
    renderMCPToolsList(tools, mode = 'full') {
        // 这个函数只负责渲染实际的工具列表，不处理空状态
        if (!tools || tools.length === 0) {
            return mode === 'compact' ? 
                `<div class="compact-no-tools">${t('mcp.noTools')}</div>` : 
                ''; // 返回空字符串，由调用方决定显示什么
        }
        
        if (mode === 'compact') {
            // 紧凑模式，只显示工具名称和状态
            return `<div class="compact-tools-list">${tools.map(tool => `
                <span class="compact-tool-item">
                    <span class="compact-tool-name">${tool.name || 'Unknown'}</span>
                    <span class="status-indicator ${tool.enabled ? 'status-enabled' : 'status-disabled'}"></span>
                </span>
            `).join('')}</div>`;
        }
        
        // 完整模式 (Dashboard中不使用，但保留兼容性)
        return tools.map(tool => `
            <div class="mcp-tool-item">
                <div class="mcp-tool-info">
                    <div class="mcp-tool-name">${tool.name || 'Unknown Tool'}</div>
                    <div class="mcp-tool-desc">${tool.description || 'No description'}</div>
                    <div class="mcp-tool-status">
                        <span class="status-indicator ${tool.enabled ? 'status-enabled' : 'status-disabled'}"></span>
                        ${tool.enabled ? 'Running' : 'Disabled'}
                    </div>
                </div>
            </div>
        `).join('');
    }

    /**
     * 渲染MCP工具分布内容
     */
    renderMCPDistribution(data) {
        // 检查加载状态
        if (data === undefined) {
            return `
                <div class="mcp-loading">
                    <p>${t('dashboard.mcpLoading')}</p>
                    <small>Please wait...</small>
                </div>
            `;
        }
        
        if (data === null) {
            return `
                <div class="mcp-loading">
                    <p>${t('dashboard.mcpLoadFailed')}</p>
                    <small>${t('dashboard.mcpManageTip')}</small>
                </div>
            `;
        }

        let html = '';
        
        // 用户家目录的MCP工具（优先显示）
        if (data.userHomeStatus && data.userHomeStatus.count > 0) {
            html += `
                <div class="project-mcp-section">
                    <h6><img src="/static/assets/icons/interface/folder.png" width="16" height="16" alt=""> ${t('dashboard.workingDirectory')} (${data.userHomeStatus.count})</h6>
                    <div class="project-path">${this.formatHomePath(data.userHomeStatus.projectPath)}</div>
                    ${this.renderMCPToolsList(data.userHomeStatus.tools || [], 'compact')}
                </div>
            `;
        }
        
        // 各项目的MCP工具
        data.projectStatuses.forEach(project => {
            html += `
                <div class="project-mcp-section">
                    <h6><img src="/static/assets/icons/interface/folder.png" width="16" height="16" alt=""> ${project.projectName} (${project.mcpStatus.count})</h6>
                    <div class="project-path">${this.formatHomePath(project.projectPath)}</div>
                    ${this.renderMCPToolsList(project.mcpStatus.tools || [], 'compact')}
                </div>
            `;
        });
        
        html += `
            <div class="mcp-management-tip">
                <small>${t('dashboard.mcpManageTip')}</small>
            </div>
        `;
        
        return html;
    }

    /**
     * 更新仪表板内容
     */
    updateDashboard() {
        if (!this.dashboardContainer) return;

        const needsInitialization = this.systemStatus && this.systemStatus.needs_initialization;
        
        this.dashboardContainer.innerHTML = `
            <div class="dashboard-content-wrapper">
                <div class="dashboard-welcome">
                    <h2>${t('dashboard.welcome')}</h2>
                    <p>${t('dashboard.subtitle')}</p>
                </div>

                <div class="dashboard-grid">
                    <div class="dashboard-card">
                        <h3>${t('dashboard.systemStatus')}</h3>
                        <div class="system-status">
                            <div class="status-item">
                                <span class="status-label">${t('dashboard.claudeCli')}:</span>
                                <span class="status-value">${this.claudeInfo ? this.claudeInfo.version : '1.0.73 (Claude Code)'}</span>
                            </div>
                            <div class="status-item">
                                <span class="status-label">${t('dashboard.executionPath')}:</span>
                                <span class="status-value code">${this.claudeInfo ? this.claudeInfo.path : (this.systemConfig?.claudeCliPath || t('dashboard.claudeNotFound'))}</span>
                            </div>
                            <div class="status-item">
                                <span class="status-label">${t('dashboard.agentsCount')}:</span>
                                <span class="status-value">${this.agentsCount || 0}</span>
                            </div>
                            <div class="status-item">
                                <span class="status-label">${t('dashboard.totalTasks')}:</span>
                                <span class="status-value">${this.taskStats ? this.taskStats.total : 0}</span>
                            </div>
                            <div class="status-item">
                                <span class="status-label">${t('dashboard.immediateTasks')}:</span>
                                <span class="status-value">${this.taskStats ? this.taskStats.immediate : 0}</span>
                            </div>
                        </div>
                    </div>

                    <div class="dashboard-card mcp-overview-card">
                        <h3>${this.getMCPTitle()}</h3>
                        <div class="mcp-dashboard-content">
                            ${this.renderMCPDistribution(this.mcpStatus)}
                        </div>
                    </div>
                </div>

                <div class="dashboard-actions">
                    ${needsInitialization ? this.renderInitializationAction() : this.renderNormalActions()}
                </div>

                ${this.renderSocialIcons()}
            </div>
        `;

        this.bindActionEvents();
    }

    /**
     * 渲染初始化操作
     */
    renderInitializationAction() {
        return `
            <div class="dashboard-action-btn init-system-highlight" id="init-system-action">
                <div class="dashboard-action-icon"></div>
                <div class="dashboard-action-content">
                    <h4>${t('dashboard.initializeSystem')}</h4>
                    <p>${t('dashboard.initializeDesc')}</p>
                </div>
            </div>
        `;
    }

    /**
     * 渲染正常操作
     */
    renderNormalActions() {
        return `
            <div class="dashboard-welcome-info">
                <p>${t('dashboard.welcomeInfo')}</p>
            </div>
        `;
    }

    /**
     * 渲染社交图标区域
     */
    renderSocialIcons() {
        return `
            <div class="flex justify-center items-center gap-6">
                <!-- GitHub -->
                <a target="_blank" href="https://github.com/HammerGPT/claude-co-desk" class="social-icon-link">
                    <img src="/static/assets/icons/social/github-gray.png" alt="GitHub" class="normal-icon">
                    <img src="/static/assets/icons/social/github-color.png" alt="GitHub" class="hover-icon">
                </a>

                <!-- X/Twitter -->
                <a target="_blank" href="https://x.com/GptHammer3309" class="social-icon-link">
                    <img src="/static/assets/icons/social/twitter-gray.png" alt="Twitter" class="normal-icon">
                    <img src="/static/assets/icons/social/twitter-color.png" alt="Twitter" class="hover-icon">
                </a>

                <!-- Douyin -->
                <a target="_blank" href="https://www.douyin.com/user/MS4wLjABAAAA3b9nQ5Ow1s0mOTERBjmQyVn0-WCvyT_FAK_LdMyVQuY" class="social-icon-link">
                    <img src="/static/assets/icons/social/douin-gray.png" alt="douyin" class="normal-icon">
                    <img src="/static/assets/icons/social/douyin-color.png" alt="douyin" class="hover-icon">
                </a>

                <!-- WeChat container HTML -->
                <div class="social-icon-link wechat-container">
                    <img src="/static/assets/icons/social/wechat-gray.png" alt="WeChat" class="normal-icon">
                    <img src="/static/assets/icons/social/wechat-color.png" alt="WeChat" class="hover-icon">
                    <div class="wechat-qr">
                        <img src="/static/assets/icons/social/wechat_qrcode.jpg" alt="WeChat QR Code" class="qr-image">
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 绑定操作按钮事件
     */
    bindActionEvents() {
        // 初始化系统按钮
        const initBtn = document.getElementById('init-system-action');
        if (initBtn) {
            initBtn.addEventListener('click', () => this.handleInitializeSystem());
        }
    }

    /**
     * 处理初始化系统
     */
    handleInitializeSystem() {
        console.log('从仪表板启动系统初始化');
        
        // 使用员工管理器的初始化功能
        if (window.employeesManager) {
            window.employeesManager.initializeSystem();
        } else {
            console.error('❌ 员工管理器未加载');
            alert(t('dashboard.systemNotReady'));
        }
    }

    /**
     * 处理管理数字员工
     */
    handleManageAgents() {
        console.log('从仪表板打开数字员工管理');
        
        // 使用员工管理器的显示功能
        if (window.employeesManager) {
            window.employeesManager.showAgentsModal();
        } else {
            console.error('❌ 员工管理器未加载');
            alert(t('dashboard.systemNotReady'));
        }
    }

    /**
     * 处理创建任务
     */
    handleCreateTask() {
        console.log('从仪表板创建新任务');
        
        // 使用任务管理器的快速添加功能
        if (window.taskManager) {
            window.taskManager.showQuickAddTask();
        } else {
            console.error('❌ 任务管理器未加载');
            alert(t('dashboard.taskManagerNotReady'));
        }
    }

    /**
     * 处理浏览项目
     */
    handleViewProjects() {
        console.log('[DASHBOARD] 从仪表板浏览项目');
        
        // 展开项目抽屉
        if (window.sidebarDrawers) {
            window.sidebarDrawers.expandDrawer('projects');
        }
    }

    /**
     * 渲染错误状态
     */
    renderErrorState() {
        if (!this.dashboardContainer) return;

        this.dashboardContainer.innerHTML = `
            <div class="dashboard-welcome">
                <h2>加载失败</h2>
                <p>无法加载系统状态，请检查网络连接</p>
            </div>
            
            <div class="dashboard-actions">
                <div class="dashboard-action-btn" onclick="dashboard.loadDashboardData()">
                    <div class="dashboard-action-icon"></div>
                    <div class="dashboard-action-content">
                        <h4>重新加载</h4>
                        <p>重新获取系统状态信息</p>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 检查是否应该显示仪表板
     */
    shouldShowDashboard() {
        // 检查是否有活跃会话
        const hasActiveSessions = window.enhancedSidebar && window.enhancedSidebar.hasActiveSessions();
        return !hasActiveSessions;
    }

    /**
     * 更新显示状态
     */
    updateDisplayState() {
        if (this.shouldShowDashboard()) {
            this.showDashboard();
        } else {
            this.hideDashboard();
            this.showSessionHeader();
        }
    }
}

// 导出到全局作用域
window.TaskManagerDashboard = TaskManagerDashboard;

// 等待DOM加载完成后创建全局实例
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.dashboard = new TaskManagerDashboard();
    });
} else {
    // DOM已经加载完成
    window.dashboard = new TaskManagerDashboard();
}