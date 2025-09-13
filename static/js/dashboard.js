/**
 * 任务管理器仪表板组件
 * 负责显示系统概览、快速操作和初始化引导
 */

class TaskManagerDashboard {
    constructor() {
        this.systemStatus = null;
        this.taskStats = { total: 0, immediate: 0 }; // 初始显示0
        this.mcpStatus = undefined; // 初始状态为undefined，表示未开始加载
        this.claudeInfo = {
            version: '1.0.73 (Claude Code)',
            path: null // 将通过API动态获取
        };
        this.agentsCount = 0;
        this.applicationsData = null; // 应用数据，初始为null表示未加载
        this.isInitialized = false;
        
        this.initElements();
        this.initEventListeners();
        this.loadDashboardData();
        
        // 标记需要完整重建 (初始化时)
        this.needsFullRebuild = true;
        
        // 初始化时就检查显示状态
        setTimeout(() => {
            this.updateDisplayState();
        }, 100);
        
        // 延迟再次检查，确保所有组件都已加载
        setTimeout(() => {
            this.updateDisplayState();
        }, 500);
        
        // 监听初始化完成事件
        document.addEventListener('systemInitializationComplete', () => {
            if (window.initGuide) {
                window.initGuide.onInitializationComplete();
            }
            // 重新加载状态
            this.loadDashboardData();
        });
        
    }

    /**
     * 初始化DOM元素引用
     */
    initElements() {
        this.dashboardContainer = document.getElementById('task-manager-dashboard');
        this.sessionHeader = document.querySelector('.session-header');
        this.sessionTabBar = document.querySelector('.session-tab-bar');
        
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
        
        // 监听图标预加载完成事件
        document.addEventListener('iconsPreloaded', () => {
            console.log('Dashboard: Icons preloaded, refreshing display');
            this.updateDashboard();
        });
    }

    /**
     * 处理会话切换
     */
    handleSessionSwitch(sessionData) {
        // 有活跃会话时隐藏仪表板，显示session-header
        this.hideDashboard();
        this.showSessionHeader();
    }

    /**
     * 显示仪表板
     */
    showDashboard() {
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
            this.loadApplicationsDataAsync();
            
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
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
                
            }
        } catch (error) {
            console.error('Failed to load system config:', error);
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
            await this.loadBasicData();
            // 基础数据加载完成后重新渲染Dashboard
            this.updateDashboard();
        } catch (error) {
            console.error('[DASHBOARD] Failed to load basic data asynchronously:', error);
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
            console.error('[DASHBOARD] Failed to load basic data:', error);
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
            await this.loadMCPStatus();
            // MCP数据加载完成后重新渲染Dashboard
            this.updateDashboard();
        } catch (error) {
            console.error('[DASHBOARD] Failed to load MCP status asynchronously:', error);
            // 即使MCP加载失败，也要更新显示错误状态
            this.mcpStatus = null;
            this.updateDashboard();
        }
    }

    /**
     * 异步加载应用数据（不阻塞页面显示）
     */
    async loadApplicationsDataAsync() {
        try {
            await this.loadApplicationsData();
            // 应用数据加载完成后重新渲染Dashboard
            this.updateDashboard();
        } catch (error) {
            console.error('[DASHBOARD] Failed to load application data asynchronously:', error);
            // 即使应用数据加载失败，也要更新显示错误状态
            this.applicationsData = null;
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
            console.error('[DASHBOARD] Failed to load system info:', error);
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
            } else {
                console.warn('[DASHBOARD] Failed to load MCP status:', response.status);
                this.mcpStatus = null;
            }
        } catch (error) {
            console.error('[DASHBOARD] MCP status loading error:', error);
            this.mcpStatus = null;
        }
    }

    /**
     * 加载应用数据
     */
    async loadApplicationsData() {
        try {
            const response = await fetch('/api/applications');
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    // 过滤掉utility标签的应用
                    this.applicationsData = this.filterNonUtilityApps(data.applications);
                } else {
                    console.warn('[DASHBOARD] Failed to load application data:', data.error);
                    this.applicationsData = null;
                }
            } else {
                console.warn('[DASHBOARD] Application data API request failed:', response.status);
                this.applicationsData = null;
            }
        } catch (error) {
            console.error('[DASHBOARD] Application data loading error:', error);
            this.applicationsData = null;
        }
    }

    /**
     * 过滤掉utility标签的应用
     */
    filterNonUtilityApps(applications) {
        if (!applications) return {};
        
        const filtered = {};
        Object.entries(applications).forEach(([name, app]) => {
            // 如果应用没有tags或者tags中不包含'utility'，则保留
            if (!app.tags || !app.tags.includes('utility')) {
                filtered[name] = app;
            }
        });
        
        return filtered;
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
        
        
        return html;
    }

    /**
     * 渲染应用卡片
     */
    renderApplicationsCard() {
        // 检查加载状态
        if (this.applicationsData === null) {
            return `
                <div class="dashboard-card applications-overview-card">
                    <h3>${t('dashboard.systemApps')}</h3>
                    <div class="applications-dashboard-content">
                        <div class="applications-content-wrapper">
                            <div class="applications-loading">
                                <p>${t('dashboard.appsLoading')}</p>
                                <small>Scanning applications...</small>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        if (!this.applicationsData || Object.keys(this.applicationsData).length === 0) {
            return `
                <div class="dashboard-card applications-overview-card">
                    <h3>${t('dashboard.systemApps')}</h3>
                    <div class="applications-dashboard-content">
                        <div class="applications-content-wrapper">
                            <div class="applications-empty">
                                <p>${t('dashboard.noAppsFound')}</p>
                                <small>${t('dashboard.appsManageTip')}</small>
                            </div>
                        </div>
                        <div class="apps-management-tip">
                            <button id="manage-more-apps-btn" class="btn-link">${t('dashboard.manageMoreApps')}</button>
                        </div>
                    </div>
                </div>
            `;
        }

        // 按类型分组应用
        const guiApps = [];
        const cliApps = [];
        
        Object.entries(this.applicationsData).forEach(([name, app]) => {
            if (app.type === 'gui') {
                guiApps.push([name, app]);
            } else if (app.type === 'cli') {
                cliApps.push([name, app]);
            }
        });

        let appSectionsHtml = '';
        
        // GUI应用部分
        if (guiApps.length > 0) {
            const displayApps = guiApps.slice(0, 5); // 最多显示5个
            appSectionsHtml += `
                <div class="apps-section">
                    <h6><img src="/static/assets/icons/interface/gui.png" width="16" height="16" alt=""> ${t('dashboard.guiApps')} (${guiApps.length})</h6>
                    <div class="apps-list">
                        ${displayApps.map(([name, app]) => this.renderAppItem(name, app)).join('')}
                        ${guiApps.length > 5 ? `<div class="more-apps">...</div>` : ''}
                    </div>
                </div>
            `;
        }

        // CLI工具部分
        if (cliApps.length > 0) {
            const displayApps = cliApps.slice(0, 5); // 最多显示5个
            appSectionsHtml += `
                <div class="apps-section">
                    <h6><img src="/static/assets/icons/interface/cli.png" width="16" height="16" alt=""> ${t('dashboard.cliTools')} (${cliApps.length})</h6>
                    <div class="apps-list">
                        ${displayApps.map(([name, app]) => this.renderAppItem(name, app)).join('')}
                        ${cliApps.length > 5 ? `<div class="more-apps">...</div>` : ''}
                    </div>
                </div>
            `;
        }

        return `
            <div class="dashboard-card applications-overview-card">
                <h3>${t('dashboard.systemApps')}</h3>
                <div class="applications-dashboard-content">
                    <div class="applications-content-wrapper">
                        ${appSectionsHtml}
                    </div>
                    <div class="apps-management-tip">
                        <button id="manage-more-apps-btn" class="btn-link">${t('dashboard.manageMoreApps')}</button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 渲染单个应用项目
     */
    renderAppItem(name, app) {
        const iconType = this.getAppIcon(app);
        return `
            <div class="app-item">
                <div class="app-info">
                    <img src="/static/assets/icons/interface/${iconType}.png" width="16" height="16" alt="${app.type}">
                    <span class="app-name" title="${name}">${name}</span>
                </div>
            </div>
        `;
    }

    /**
     * 获取应用图标类型
     */
    getAppIcon(app) {
        // 检查是否有browser标签
        if (app.tags && app.tags.includes('browser')) {
            return 'browser';
        }
        // 默认基于类型的图标
        return app.type === 'gui' ? 'gui' : 'cli';
    }

    /**
     * 更新仪表板内容
     */
    updateDashboard() {
        if (!this.dashboardContainer) return;

        const needsInitialization = this.systemStatus && this.systemStatus.needs_initialization;
        
        // 如果容器为空或结构发生重大变化，进行完整重建
        if (!this.dashboardContainer.querySelector('.dashboard-content-wrapper') || 
            this.needsFullRebuild) {
            this.fullRebuildDashboard(needsInitialization);
            this.needsFullRebuild = false;
            return;
        }

        // 否则进行选择性更新
        this.selectiveUpdateDashboard(needsInitialization);
    }

    /**
     * 完整重建仪表板 (仅在必要时使用)
     */
    fullRebuildDashboard(needsInitialization) {
        this.dashboardContainer.innerHTML = `
            <div class="dashboard-content-wrapper">
                <div class="dashboard-welcome">
                    <h2 class="dashboard-welcome-title">${t('dashboard.welcome')}</h2>
                    <p class="dashboard-welcome-subtitle">${t('dashboard.subtitle')}</p>
                </div>

                <div class="dashboard-grid">
                    <div class="dashboard-card system-status-card">
                        <h3>${t('dashboard.systemStatus')}</h3>
                        <div class="system-status">
                            <div class="status-item">
                                <span class="status-label">${t('dashboard.claudeCli')}:</span>
                                <span class="status-value claude-version">${this.claudeInfo ? this.claudeInfo.version : '1.0.73 (Claude Code)'}</span>
                            </div>
                            <div class="status-item">
                                <span class="status-label">${t('dashboard.executionPath')}:</span>
                                <span class="status-value code claude-path">${this.formatHomePath(this.claudeInfo ? this.claudeInfo.path : (this.systemConfig?.claudeCliPath || t('dashboard.claudeNotFound')))}</span>
                            </div>
                            <div class="status-item">
                                <span class="status-label">${t('dashboard.agentsCount')}:</span>
                                <span class="status-value agents-count">${this.agentsCount || 0}</span>
                            </div>
                            <div class="status-item">
                                <span class="status-label">${t('dashboard.totalTasks')}:</span>
                                <span class="status-value total-tasks">${this.taskStats ? this.taskStats.total : 0}</span>
                            </div>
                            <div class="status-item">
                                <span class="status-label">${t('dashboard.immediateTasks')}:</span>
                                <span class="status-value immediate-tasks">${this.taskStats ? this.taskStats.immediate : 0}</span>
                            </div>
                            <div class="status-item">
                                <span class="status-label">${t('dashboard.networkAccess')}:</span>
                                <span class="status-value code network-url">${this.systemConfig?.localUrl || 'Loading...'}</span>
                            </div>
                            <div class="status-item public-link-section">
                                <span class="status-label">${t('dashboard.publicAccess')}:</span>
                                <div class="public-link-controls">
                                    <button id="get-public-link-btn" class="btn-small">${t('dashboard.getPublicLink')}</button>
                                    <span class="public-link-display" style="display: none;"></span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="applications-card-container">
                        ${this.renderApplicationsCard()}
                    </div>

                    <div class="dashboard-card mcp-overview-card">
                        <h3 class="mcp-title">${this.getMCPTitle()}</h3>
                        <div class="mcp-dashboard-content">
                            ${this.renderMCPDistribution(this.mcpStatus)}
                        </div>
                        <div class="mcp-management-tip">
                            <button id="manage-mcp-tools-btn" class="btn-link">${t('dashboard.manageMcpTools')}</button>
                        </div>
                    </div>
                </div>

                <div class="dashboard-actions">
                    ${needsInitialization ? this.renderInitializationAction() : this.renderNormalActions()}
                </div>

                <div class="social-icons-container">
                    ${this.renderSocialIcons()}
                </div>
            </div>
        `;

        this.bindActionEvents();
        
        // 检查现有隧道状态
        setTimeout(() => this.checkTunnelStatus(), 1000);
    }

    /**
     * 选择性更新仪表板内容 (保持图标不重新加载)
     */
    selectiveUpdateDashboard(needsInitialization) {
        try {
            // 更新欢迎文本
            this.updateElement('.dashboard-welcome-title', t('dashboard.welcome'));
            this.updateElement('.dashboard-welcome-subtitle', t('dashboard.subtitle'));

            // 更新系统状态文本 (不重建HTML结构)
            this.updateElement('.claude-version', this.claudeInfo ? this.claudeInfo.version : '1.0.73 (Claude Code)');
            this.updateElement('.claude-path', this.formatHomePath(this.claudeInfo ? this.claudeInfo.path : (this.systemConfig?.claudeCliPath || t('dashboard.claudeNotFound'))));
            this.updateElement('.agents-count', this.agentsCount || 0);
            this.updateElement('.total-tasks', this.taskStats ? this.taskStats.total : 0);
            this.updateElement('.immediate-tasks', this.taskStats ? this.taskStats.immediate : 0);
            this.updateElement('.network-url', this.systemConfig?.localUrl || 'Loading...');
            
            // Update public link controls if they exist
            const publicLinkBtn = this.dashboardContainer.querySelector('#get-public-link-btn');
            if (publicLinkBtn) {
                publicLinkBtn.textContent = t('dashboard.getPublicLink');
            }

            // 更新MCP标题
            this.updateElement('.mcp-title', this.getMCPTitle());

            // 更新应用卡片 (这里需要重新渲染，但尽量保持图标)
            const applicationsContainer = this.dashboardContainer.querySelector('.applications-card-container');
            if (applicationsContainer) {
                applicationsContainer.innerHTML = this.renderApplicationsCard();
            }

            // 更新MCP内容
            const mcpContent = this.dashboardContainer.querySelector('.mcp-dashboard-content');
            if (mcpContent) {
                mcpContent.innerHTML = this.renderMCPDistribution(this.mcpStatus);
            }

            // 更新按钮文本
            this.updateElement('#manage-mcp-tools-btn', t('dashboard.manageMcpTools'));

            // 更新操作区域
            const actionsContainer = this.dashboardContainer.querySelector('.dashboard-actions');
            if (actionsContainer) {
                actionsContainer.innerHTML = needsInitialization ? this.renderInitializationAction() : this.renderNormalActions();
                this.bindActionEvents();
            }

        } catch (error) {
            console.warn('Dashboard: Selective update failed, falling back to full rebuild:', error);
            this.fullRebuildDashboard(needsInitialization);
        }
    }

    /**
     * 更新单个元素内容的辅助方法
     */
    updateElement(selector, content) {
        const element = this.dashboardContainer.querySelector(selector);
        if (element && element.textContent !== content) {
            element.textContent = content;
        }
    }

    /**
     * 标记需要完整重建
     */
    markForFullRebuild() {
        this.needsFullRebuild = true;
    }

    /**
     * 渲染初始化操作
     */
    renderInitializationAction() {
        return `
            <div class="dashboard-action-btn init-system-highlight" id="init-system-action">
                <div class="dashboard-action-icon">
                    <img src="/static/assets/icons/interface/zap.png" alt="Initialize System" />
                </div>
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

        // 应用启动按钮功能已移除，仅用于查看

        // 管理更多应用按钮
        const manageMoreAppsBtn = document.getElementById('manage-more-apps-btn');
        if (manageMoreAppsBtn) {
            manageMoreAppsBtn.addEventListener('click', () => this.handleManageMoreApps());
        }

        // 管理MCP工具按钮
        const manageMcpToolsBtn = document.getElementById('manage-mcp-tools-btn');
        if (manageMcpToolsBtn) {
            manageMcpToolsBtn.addEventListener('click', () => this.handleManageMcpTools());
        }

        // 获取公网链接按钮
        const getPublicLinkBtn = document.getElementById('get-public-link-btn');
        if (getPublicLinkBtn) {
            getPublicLinkBtn.addEventListener('click', () => this.handleGetPublicLink());
        }
    }

    /**
     * 处理初始化系统
     */
    handleInitializeSystem() {
        
        // 使用员工管理器的初始化功能
        if (window.employeesManager) {
            window.employeesManager.initializeSystem();
        } else {
            console.error('[DASHBOARD] Employee manager not loaded');
            alert(t('dashboard.systemNotReady'));
        }
    }

    /**
     * 处理管理数字员工
     */
    handleManageAgents() {
        
        // 使用员工管理器的显示功能
        if (window.employeesManager) {
            window.employeesManager.showAgentsModal();
        } else {
            console.error('[DASHBOARD] Employee manager not loaded');
            alert(t('dashboard.systemNotReady'));
        }
    }

    /**
     * 处理启动应用
     */
    async handleLaunchApplication(appName) {
        if (!appName) return;
        
        
        // 找到对应的启动按钮
        const launchBtn = this.dashboardContainer.querySelector(`.app-launch-btn[data-app="${appName}"]`);
        if (launchBtn) {
            const originalTitle = launchBtn.title;
            launchBtn.disabled = true;
            launchBtn.title = t('dashboard.launching');
        }
        
        try {
            const response = await fetch('/api/applications/launch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ app_name: appName })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // 可以在这里添加成功提示
            } else {
                console.error(`[DASHBOARD] Application ${appName} launch failed:`, data.error);
                alert(t('dashboard.launchFailed') + ': ' + appName);
            }
        } catch (error) {
            console.error(`[DASHBOARD] Error launching application ${appName}:`, error);
            alert(t('dashboard.launchFailed') + ': ' + appName);
        } finally {
            // 恢复按钮状态
            if (launchBtn) {
                launchBtn.disabled = false;
                launchBtn.title = t('dashboard.launch');
            }
        }
    }

    /**
     * 处理管理更多应用
     */
    handleManageMoreApps() {
        console.log('[DASHBOARD] Opening application management from dashboard');
        
        // 打开设置模态窗口并切换到应用管理标签
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.click();
            
            // 等待模态窗口打开后切换到应用管理标签
            setTimeout(() => {
                const applicationsTab = document.querySelector('.settings-menu-item[data-section="applications"]');
                if (applicationsTab) {
                    applicationsTab.click();
                }
            }, 100);
        } else {
            console.error('[DASHBOARD] Settings button not found');
        }
    }

    /**
     * 处理管理MCP工具
     */
    handleManageMcpTools() {
        console.log('[DASHBOARD] Opening MCP tools management from dashboard');
        
        // 打开设置模态窗口并切换到MCP工具标签
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.click();
            
            // 等待模态窗口打开后切换到MCP工具标签
            setTimeout(() => {
                const mcpTab = document.querySelector('.settings-menu-item[data-section="mcp-tools"]');
                if (mcpTab) {
                    mcpTab.click();
                }
            }, 100);
        } else {
            console.error('[DASHBOARD] Settings button not found');
        }
    }


    /**
     * 检查现有隧道状态
     */
    async checkTunnelStatus() {
        try {
            const response = await fetch('/api/tunnel/status');
            const data = await response.json();
            
            if (data.active && data.public_url) {
                // 隧道已存在，直接显示
                const btn = document.getElementById('get-public-link-btn');
                const display = document.querySelector('.public-link-display');
                if (btn && display) {
                    btn.style.display = 'none';
                    display.style.display = 'inline';
                    display.innerHTML = `
                        <div class="public-url-container">
                            <span class="code public-url-text" title="${data.public_url}">${data.public_url}</span>
                            <button class="copy-url-btn" onclick="copyUrlToClipboard('${data.public_url}', this)">Copy</button>
                        </div>
                    `;
                }
            }
        } catch (error) {
            console.log('Tunnel status check failed:', error);
        }
    }

    /**
     * 处理获取公网链接
     */
    async handleGetPublicLink() {
        console.log('[DASHBOARD] Getting public access link');
        
        const btn = document.getElementById('get-public-link-btn');
        const display = document.querySelector('.public-link-display');
        if (!btn || !display) return;
        
        // 显示加载状态
        const originalText = btn.textContent;
        btn.textContent = t('dashboard.gettingPublicLink');
        btn.disabled = true;
        
        try {
            const response = await fetch('/api/tunnel/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                // 隐藏按钮，显示公网链接
                btn.style.display = 'none';
                display.style.display = 'inline';
                display.innerHTML = `
                    <div class="public-url-container">
                        <span class="code public-url-text" title="${data.public_url}">${data.public_url}</span>
                        <button class="copy-url-btn" onclick="copyUrlToClipboard('${data.public_url}', this)">Copy</button>
                    </div>
                `;
            } else {
                alert(t('dashboard.publicLinkFailed') + ': ' + data.message);
                btn.textContent = originalText;
                btn.disabled = false;
            }
        } catch (error) {
            console.error('[DASHBOARD] Failed to get public link:', error);
            alert(t('dashboard.publicLinkError'));
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }


    /**
     * 处理创建任务
     */
    handleCreateTask() {
        console.log('[DASHBOARD] Creating new task from dashboard');
        
        // 使用任务管理器的快速添加功能
        if (window.taskManager) {
            window.taskManager.showQuickAddTask();
        } else {
            console.error('[DASHBOARD] Task manager not loaded');
            alert(t('dashboard.taskManagerNotReady'));
        }
    }

    /**
     * 处理浏览项目
     */
    handleViewProjects() {
        console.log('[DASHBOARD] Browsing projects from dashboard');
        
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
                    <div class="dashboard-action-icon">
                        <img src="static/assets/icons/interface/refresh.png" alt="Reload" />
                    </div>
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

// 全局复制URL功能
window.copyUrlToClipboard = function(url, button) {
    try {
        // 首先尝试现代 Clipboard API
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(() => {
                showCopyFeedback(button);
            }).catch(() => {
                fallbackCopy(url, button);
            });
        } else {
            fallbackCopy(url, button);
        }
    } catch (error) {
        console.error('Copy failed:', error);
        fallbackCopy(url, button);
    }
};

// 备用复制方法
function fallbackCopy(url, button) {
    try {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
            showCopyFeedback(button);
        } else {
            console.error('Fallback copy failed');
            alert('Copy failed. Please manually select and copy the URL.');
        }
    } catch (error) {
        console.error('Fallback copy error:', error);
        alert('Copy not supported. Please manually select and copy the URL.');
    }
}

// 显示复制成功反馈
function showCopyFeedback(button) {
    const originalText = button.textContent;
    button.textContent = 'Copied!';
    button.style.background = '#28a745';
    setTimeout(() => {
        button.textContent = originalText;
        button.style.background = '';
    }, 1500);
}

// 等待DOM加载完成后创建全局实例
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.dashboard = new TaskManagerDashboard();
    });
} else {
    // DOM已经加载完成
    window.dashboard = new TaskManagerDashboard();
}