/**
 * 任务管理器仪表板组件
 * 负责显示系统概览、快速操作和初始化引导
 */

class TaskManagerDashboard {
    constructor() {
        console.log('📊 TaskManagerDashboard 初始化开始');
        this.systemStatus = null;
        this.taskStats = { total: 0, immediate: 0 }; // 初始显示0
        this.mcpStatus = undefined; // 初始状态为undefined，表示未开始加载
        this.claudeInfo = {
            version: '1.0.73 (Claude Code)',
            path: '/Users/yuhao/.local/bin/claude'
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
    }

    /**
     * 处理会话切换
     */
    handleSessionSwitch(sessionData) {
        console.log('📊 Dashboard收到会话切换事件:', sessionData);
        // 有活跃会话时隐藏仪表板，显示session-header
        this.hideDashboard();
        this.showSessionHeader();
    }

    /**
     * 显示仪表板
     */
    showDashboard() {
        console.log('📊 显示任务管理器仪表板');
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
            
            // 并行加载所有数据，不阻塞页面显示
            this.loadBasicDataAsync();
            this.loadMCPStatusAsync();
            
        } catch (error) {
            console.error('加载仪表板数据失败:', error);
            this.renderErrorState();
        }
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
                path: '/Users/yuhao/.local/bin/claude'
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
                path: '/Users/yuhao/.local/bin/claude'
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
                    path: '/Users/yuhao/.local/bin/claude'
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
                path: '/Users/yuhao/.local/bin/claude'
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
            return 'MCP工具';
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
        
        return `MCP工具（总数 ${totalCount} 个）`;
    }

    /**
     * 渲染MCP工具列表
     */
    renderMCPToolsList(tools, mode = 'full') {
        // 这个函数只负责渲染实际的工具列表，不处理空状态
        if (!tools || tools.length === 0) {
            return mode === 'compact' ? 
                '<div class="compact-no-tools">无MCP工具</div>' : 
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
                    <div class="mcp-tool-desc">${tool.description || '暂无描述'}</div>
                    <div class="mcp-tool-status">
                        <span class="status-indicator ${tool.enabled ? 'status-enabled' : 'status-disabled'}"></span>
                        ${tool.enabled ? '运行中' : '已禁用'}
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
                    <p>正在加载MCP工具状态...</p>
                    <small>请稍候</small>
                </div>
            `;
        }
        
        if (data === null) {
            return `
                <div class="mcp-loading">
                    <p>无法获取MCP工具状态</p>
                    <small>设置 - MCP工具 可以添加工具</small>
                </div>
            `;
        }

        let html = '';
        
        // 各项目的MCP工具
        data.projectStatuses.forEach(project => {
            html += `
                <div class="project-mcp-section">
                    <h6>📂 ${project.projectName} (${project.mcpStatus.count}个)</h6>
                    <div class="project-path">${project.projectPath.replace('/Users/yuhao/', '~/')}</div>
                    ${this.renderMCPToolsList(project.mcpStatus.tools || [], 'compact')}
                </div>
            `;
        });
        
        html += `
            <div class="mcp-management-tip">
                <small>设置 - MCP工具 可以添加工具</small>
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
                    <h2>欢迎使用 Heliki OS 任务管理器</h2>
                    <p>智能化的数字员工协作平台，让AI为您处理日常工作</p>
                </div>

                <div class="dashboard-grid">
                    <div class="dashboard-card">
                        <h3>系统状态</h3>
                        <div class="system-status">
                            <div class="status-item">
                                <span class="status-label">Claude CLI:</span>
                                <span class="status-value">${this.claudeInfo ? this.claudeInfo.version : '1.0.73 (Claude Code)'}</span>
                            </div>
                            <div class="status-item">
                                <span class="status-label">执行路径:</span>
                                <span class="status-value code">${this.claudeInfo ? this.claudeInfo.path : '/Users/yuhao/.local/bin/claude'}</span>
                            </div>
                            <div class="status-item">
                                <span class="status-label">智能体数量:</span>
                                <span class="status-value">${this.agentsCount || 0} 个</span>
                            </div>
                            <div class="status-item">
                                <span class="status-label">总任务数:</span>
                                <span class="status-value">${this.taskStats ? this.taskStats.total : 0} 个</span>
                            </div>
                            <div class="status-item">
                                <span class="status-label">即时任务:</span>
                                <span class="status-value">${this.taskStats ? this.taskStats.immediate : 0} 个</span>
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
                <div class="dashboard-action-icon">🚀</div>
                <div class="dashboard-action-content">
                    <h4>初始化数字员工系统</h4>
                    <p>配置您的专属AI团队，开始智能化工作流程</p>
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
                <p>使用左侧侧边栏管理任务、数字员工团队和项目</p>
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
        console.log('🚀 从仪表板启动系统初始化');
        
        // 使用员工管理器的初始化功能
        if (window.employeesManager) {
            window.employeesManager.initializeSystem();
        } else {
            console.error('❌ 员工管理器未加载');
            alert('系统组件未加载完成，请刷新页面重试');
        }
    }

    /**
     * 处理管理数字员工
     */
    handleManageAgents() {
        console.log('👥 从仪表板打开数字员工管理');
        
        // 使用员工管理器的显示功能
        if (window.employeesManager) {
            window.employeesManager.showAgentsModal();
        } else {
            console.error('❌ 员工管理器未加载');
            alert('系统组件未加载完成，请刷新页面重试');
        }
    }

    /**
     * 处理创建任务
     */
    handleCreateTask() {
        console.log('📋 从仪表板创建新任务');
        
        // 使用任务管理器的快速添加功能
        if (window.taskManager) {
            window.taskManager.showQuickAddTask();
        } else {
            console.error('❌ 任务管理器未加载');
            alert('任务管理器未加载完成，请刷新页面重试');
        }
    }

    /**
     * 处理浏览项目
     */
    handleViewProjects() {
        console.log('📁 从仪表板浏览项目');
        
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
                    <div class="dashboard-action-icon">🔄</div>
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