/**
 * 数字员工团队管理器组件
 * 负责员工状态显示、初始化和管理功能
 */

class EmployeesManager {
    constructor() {
        this.employees = [];
        this.systemProjectStatus = null;
        this.refreshInterval = null;
        this.isInitialized = false;
        this.isInitializing = false; // 添加初始化状态标记
        
        // 绑定方法到实例，避免每次重新创建
        this.handleInitClick = this.handleInitClick.bind(this);
        
        this.initElements();
        this.initEventListeners();
        this.loadEmployeesStatus();
        this.startAutoRefresh();
    }

    /**
     * 初始化DOM元素引用
     */
    initElements() {
        // 现在员工管理通过弹窗显示，不再需要固定的DOM元素
        this.agentsTeamBtn = document.getElementById('agents-team-btn');
        
        
    }

    /**
     * 初始化事件监听器
     */
    initEventListeners() {
        // 智能体团队按钮事件将在按钮创建时绑定
        // 这里主要监听全局事件

        // 监听全局系统项目状态更新
        document.addEventListener('systemProjectStatusUpdated', (event) => {
            this.systemProjectStatus = event.detail;
            this.renderAgentsContent();
        });
        
        // 监听数字员工部署完成事件
        this.setupWebSocketListener();
        
        // 注册语言切换刷新方法
        if (window.i18n) {
            window.i18n.registerComponent('employeesManager', () => {
                this.renderAgentsContent();
            });
        }
    }

    /**
     * 加载员工状态
     */
    async loadEmployeesStatus() {
        try {
            // 获取系统项目状态
            const systemResponse = await fetch('/api/system-project/status');
            if (systemResponse.ok) {
                this.systemProjectStatus = await systemResponse.json();
            }

            // 直接获取已部署的智能体信息
            const agentsResponse = await fetch('/api/system-project/agents');
            if (agentsResponse.ok) {
                const agentsData = await agentsResponse.json();
                this.employees = agentsData.agents || []; // 直接使用API返回的数据
                this.isInitialized = this.employees.length > 0;
            }

        } catch (error) {
            console.error('Failed to load employees status:', error);
            this.employees = [];
        }
    }



    /**
     * 显示智能体团队管理弹窗
     */
    showAgentsModal() {
        
        // 创建弹窗容器
        const modal = document.createElement('div');
        modal.className = 'modal-overlay agents-modal';
        modal.id = 'agents-management-modal';
        
        modal.innerHTML = `
            <div class="modal-content large-modal">
                <div class="modal-header">
                    <h3>${t('agents.teamManagement')}</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                ${this.renderAgentsContent()}
            </div>
        `;
        
        // 添加到页面
        document.body.appendChild(modal);
        
        // 显示弹窗
        modal.classList.add('active');
        
        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    /**
     * 渲染智能体内容
     */
    renderAgentsContent() {
        // 如果系统需要初始化
        if (this.systemProjectStatus && this.systemProjectStatus.needs_initialization) {
            return `
                <div class="system-init-prompt">
                    <div class="icon"></div>
                    <div class="title">数字员工团队未初始化</div>
                    <div class="description">
                        将在您的主目录初始化Claude项目，
                        5位专业数字员工将能够管理您的整个系统
                    </div>
                </div>
            `;
        }

        // 如果没有员工数据，显示加载状态
        if (!this.employees.length) {
            return `
                <div class="loading-employees">
                    <div class="loading-text">正在加载员工团队...</div>
                </div>
            `;
        }

        // 渲染智能体左右分栏布局 - 直接返回sidebar和detail，不需要包装容器
        return `
            <div class="agents-sidebar">
                <div class="agents-list">
                    ${this.employees.map(agent => `
                        <div class="agent-item" data-agent-id="${agent.id}" onclick="employeesManager.selectAgent('${agent.id}')">
                            <div class="agent-header">
                                <div class="agent-name">${agent.name || agent.id}</div>
                                <div class="agent-status-indicator ${agent.color || 'default'}"></div>
                            </div>
                            <div class="agent-description">${agent.description || 'No description available'}</div>
                            ${agent.model ? `<div class="agent-model">Model: ${agent.model}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="agents-detail">
                <div class="agent-detail-placeholder">
                    <div class="placeholder-icon"></div>
                    <div class="placeholder-text">Select an agent to view details</div>
                </div>
            </div>
        `;
    }

    /**
     * 选择智能体并显示详情
     */
    selectAgent(agentId) {
        const agent = this.employees.find(emp => emp.id === agentId);
        if (!agent) return;

        
        // 更新选中状态
        document.querySelectorAll('.agent-item').forEach(item => {
            item.classList.remove('selected');
        });
        document.querySelector(`[data-agent-id="${agentId}"]`).classList.add('selected');
        
        // 渲染详情区域
        this.renderAgentDetail(agent);
    }

    /**
     * 渲染智能体详情区域
     */
    renderAgentDetail(agent) {
        const detailContainer = document.querySelector('.agents-detail');
        if (!detailContainer) return;

        // 直接显示文件内容
        this.loadAndDisplayAgentFile(agent, detailContainer);
    }

    /**
     * 加载并显示智能体文件内容
     */
    async loadAndDisplayAgentFile(agent, container) {
        if (!agent || !agent.file_path) {
            container.innerHTML = `
                <div class="agent-detail-placeholder">
                    <div class="placeholder-icon"></div>
                    <div class="placeholder-text">No file path available for this agent</div>
                </div>
            `;
            return;
        }

        // 显示加载状态
        container.innerHTML = `
            <div class="agent-detail-placeholder">
                <div class="placeholder-icon">⏳</div>
                <div class="placeholder-text">Loading agent documentation...</div>
            </div>
        `;

        try {
            // 使用现有的文件读取API
            const response = await fetch(`/api/files/read?file_path=${encodeURIComponent(agent.file_path)}&project_path=${encodeURIComponent(agent.file_path)}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const fileData = await response.json();
            
            // 渲染文件内容
            this.renderFileContent(agent, fileData.content, container);
            
        } catch (error) {
            console.error('Failed to read agent file:', error);
            container.innerHTML = `
                <div class="agent-detail-placeholder">
                    <div class="placeholder-icon"></div>
                    <div class="placeholder-text">Failed to load agent documentation</div>
                    <div style="font-size: 12px; margin-top: 8px; opacity: 0.7;">Error: ${error.message}</div>
                </div>
            `;
        }
    }

    /**
     * 渲染文件内容
     */
    renderFileContent(agent, content, container) {
        const filename = agent.file_path.split('/').pop();
        
        // 获取语法高亮器
        const language = window.syntaxHighlighter ? 
            window.syntaxHighlighter.getLanguageFromExtension(filename) : 'markdown';
        
        container.innerHTML = `
            <div class="agent-file-viewer">
                <div class="agent-file-header">
                    <div class="file-info">
                        <div class="file-name"> ${filename}</div>
                        <div class="agent-info">
                            <span class="agent-name">${agent.name || agent.id}</span>
                            ${agent.color ? `<span class="agent-color-dot" style="background-color: ${agent.color}"></span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="agent-file-content">
                    <pre><code class="language-${language}">${this.escapeHtml(content)}</code></pre>
                </div>
            </div>
        `;

        // 应用语法高亮
        if (window.syntaxHighlighter && window.syntaxHighlighter.highlightElement) {
            const codeElement = container.querySelector('code');
            if (codeElement) {
                window.syntaxHighlighter.highlightElement(codeElement);
            }
        }
    }

    /**
     * HTML转义
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }


    /**
     * 处理初始化按钮点击事件
     */
    handleInitClick(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // 防重复点击
        if (this.isInitializing) {
            console.warn('初始化正在进行中，忽略重复点击');
            return;
        }
        
        this.initializeSystem();
    }


    /**
     * 渲染错误状态
     */
    renderError() {
        if (!this.employeesList) return;
        
        this.employeesList.innerHTML = `
            <div class="system-init-prompt">
                <div class="icon"></div>
                <div class="title">加载失败</div>
                <div class="description">
                    无法加载员工团队状态，请检查系统连接
                </div>
                <button class="init-system-btn" id="retry-load-btn">
                    重新加载
                </button>
            </div>
        `;

        const retryBtn = document.getElementById('retry-load-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => this.loadEmployeesStatus());
        }
    }



    /**
     * 初始化系统 - 使用页签机制
     */
    async initializeSystem() {
        
        // 设置正在初始化状态
        this.isInitializing = true;
        
        try {
            // 生成会话ID（用于hook标识）
            const sessionId = this.generateSessionId();
            console.log(' 生成会话ID:', sessionId);
            
            // 设置临时hook监听初始化完成
            await this.setupInitializationHook(sessionId);
            // 检查系统项目状态
            if (!this.systemProjectStatus) {
                console.error('系统项目状态未加载');
                alert(t('agents.systemNotLoaded'));
                return;
            }
            
            // 检查 enhancedSidebar 是否可用
            if (!window.enhancedSidebar) {
                console.error('enhancedSidebar 未初始化');
                alert(t('agents.tabSystemNotLoaded'));
                return;
            }
            
            // 构造系统项目对象
            const systemProject = {
                name: t('agents.systemRoot'),
                displayName: ' 系统根目录',
                path: this.systemProjectStatus.root_directory,
                fullPath: this.systemProjectStatus.root_directory
            };
            
            console.log(' 准备创建系统初始化会话:', systemProject);
            
            // 创建专用的初始化会话页签（使用已生成的sessionId）
            const sessionName = t('agents.systemInitialization');
            
            // 构建完整的初始化命令 - 直接使用Claude CLI组合命令  
            const guidanceText = `You are now initializing the user's home directory (~) containing all their digital life content, which may include:

- Various applications and tools
- Work documents and project files  
- Financial data and personal documents
- Code projects and development environment
- Media files and personal data
- System configurations and environment settings

**IMPORTANT INSTRUCTIONS:**
- Always respond to users in the same language they use when asking questions
- Utilize all available MCP tools and system applications to complete tasks effectively
- Leverage the system's existing applications and resources for comprehensive analysis

Please follow this standard process:

1. Create TodoList to track progress:
   - Analyze home directory structure and file distribution
   - Identify development projects, work documents, personal file categories  
   - Detect system configuration and development environment
   - Must create CLAUDE.md system initialization file
   - Establish intelligent management rules

2. System analysis steps:
   - Use system commands to analyze home directory structure
   - Search for key file types (*.py, *.js, *.json, etc.)
   - Detect development environment configuration (Python, Node.js, Git, etc.)
   - Read system configuration files (.zshrc, .bash_profile, etc.)
	   
3. Configuration file creation:
   - Create detailed CLAUDE.md system initialization file, including directory mapping, workflows, system user profile inferred from your system resource analysis, and potential work areas
   - **IMPORTANT**: Include all analysis results directly in CLAUDE.md file:
     * System analysis report
     * Initialization completion report
     * Intelligent management rules
     * User profile analysis
     * Potential work areas identification
   - Do NOT create separate .md files - consolidate everything into the single CLAUDE.md file

4. Completion criteria:
   - All TodoList items marked as completed
   - All analysis results integrated into CLAUDE.md file
   - Confirm system is AI-ready and prepared

Follow the above process strictly to complete initialization.`;
            
            // 对引导文字进行转义，处理引号问题
            const escapedGuidanceText = guidanceText.replace(/"/g, '\\"');
            const initialCommand = `claude "${escapedGuidanceText}" --dangerously-skip-permissions`;
            
            console.log('构建初始化命令:', {
                guidanceTextLength: guidanceText.length,
                escapedTextLength: escapedGuidanceText.length,
                commandLength: initialCommand.length,
                commandPreview: initialCommand.substring(0, 100) + '...'
            });
            
            // 使用 enhancedSidebar 的现有机制创建会话
            const tabElement = window.enhancedSidebar.createSessionTab(sessionId, systemProject, sessionName);
            
            // 保存会话数据，使用组合命令直接启动
            window.enhancedSidebar.activeSessions.set(sessionId, {
                project: systemProject,
                sessionName: sessionName,
                tabElement: tabElement,
                originalSession: null,
                isInitSession: true, // 标记为初始化会话
                initialCommand: initialCommand // 使用组合命令
            });
            
            // 切换到新会话
            window.enhancedSidebar.switchToSession(sessionId);
            
            console.log(' 系统初始化会话已创建:', sessionId);
            
            // 显示通知
            this.showInitializationNotification();
            
        } catch (error) {
            console.error('创建初始化会话失败:', error);
            alert(t('agents.initializationFailed') + error.message);
            
            // 如果初始化失败，清理hook设置
            try {
                await this.cleanupInitializationHook();
            } catch (hookError) {
                console.error('清理hook时出错:', hookError);
            }
        } finally {
            // 重置初始化状态
            this.isInitializing = false;
        }
    }
    
    /**
     * 生成会话ID
     */
    generateSessionId() {
        return 'init-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * 显示初始化开始通知
     */
    showInitializationNotification() {
        // 创建一个简单的通知，告知用户操作步骤
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 16px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-size: 14px;
            animation: slideIn 0.3s ease;
            max-width: 350px;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 18px;">⚡</span>
                <span style="font-weight: 600;">${t('agents.doNotCloseTab')}</span>
            </div>
        `;
        
        // 添加CSS动画
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(notification);
        
        // 为通知添加唯一标识以便后续清理
        notification.id = 'init-notification';
        
        // 初始化通知持续显示，不自动关闭
    }

    /**
     * 手动发送初始化引导（备用方案）
     */
    _manualSendGuidance() {
        // 获取当前活跃的会话终端
        const sessionTerminal = window.sessionTerminal;
        if (!sessionTerminal || !sessionTerminal.activeSessionId) {
            alert(t('agents.noActiveTerminal'));
            return;
        }

        const sessionId = sessionTerminal.activeSessionId;
        const connection = sessionTerminal.connections.get(sessionId);
        
        if (!connection || connection.readyState !== WebSocket.OPEN) {
            alert(t('agents.terminalUnavailable'));
            return;
        }

        // 发送完整的引导文字
        const guidanceText = `You are now initializing the user's home directory (~) containing all their digital life content:

- Various applications and tools
- Work documents and project files  
- Financial data and personal documents
- Code projects and development environment
- Media files and personal data
- System configurations and environment settings

**IMPORTANT INSTRUCTIONS:**
- Always respond to users in the same language they use when asking questions
- Utilize all available MCP tools and system applications to complete tasks effectively
- Leverage the system's existing applications and resources for comprehensive analysis

Please follow this standard process:

1. Create TodoList to track progress:
   - Analyze home directory structure and file distribution
   - Identify development projects, work documents, personal file categories  
   - Detect system configuration and development environment
   - Create CLAUDE.md configuration file
   - Establish intelligent management rules

2. System analysis steps:
   - Use LS(.) command to analyze home directory structure
   - Use Glob command to find key file types (*.py, *.js, *.json, etc.)
   - Detect development environment configuration (Python, Node.js, Git, etc.)
   - Read system configuration files (.zshrc, .bash_profile, etc.)

3. Configuration file creation:
   - Create detailed CLAUDE.md configuration file, including directory mapping and workflows
   - **IMPORTANT**: Include all analysis results directly in CLAUDE.md file:
     * System analysis report
     * Initialization completion report
     * Intelligent management rules
     * User profile analysis
     * Potential work areas identification
   - Do NOT create separate .md files or .py files - consolidate everything into the single CLAUDE.md file

4. Completion criteria:
   - All TodoList items marked as completed
   - All analysis results integrated into CLAUDE.md file
   - Confirm system is AI-ready and prepared

Please execute /init command directly to start analysis, and follow the above process strictly to complete initialization.`;

        console.log(' 手动发送初始化引导文字:', sessionId);
        
        connection.send(JSON.stringify({
            type: 'input',
            data: guidanceText + '\r'
        }));

        // 显示成功提示
        this._showManualSendSuccess();
    }

    /**
     * 显示手动发送成功提示
     */
    _showManualSendSuccess() {
        const successNotification = document.createElement('div');
        successNotification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #059669;
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            font-size: 13px;
            z-index: 10001;
            animation: slideIn 0.3s ease;
        `;
        
        successNotification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span></span>
                <span>引导文字已手动发送</span>
            </div>
        `;

        document.body.appendChild(successNotification);
        
        // 2秒后移除
        setTimeout(() => {
            successNotification.remove();
        }, 2000);
    }

    /**
     * 开始自动刷新
     */
    startAutoRefresh() {
        // 每30秒刷新一次员工状态
        this.refreshInterval = setInterval(() => {
            if (this.isInitialized) {
                this.loadEmployeesStatus();
            }
        }, 30000);
    }

    /**
     * 停止自动刷新
     */
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    /**
     * 设置WebSocket监听器
     */
    setupWebSocketListener() {
        
        // 监听全局WebSocket消息
        if (window.websocketManager) {
            // 如果WebSocket管理器存在，直接注册监听器
            this.registerWebSocketHandler();
        } else {
            // 等待WebSocket管理器初始化
            let attempts = 0;
            const maxAttempts = 50; // 5秒超时
            const checkWebSocketManager = () => {
                attempts++;
                console.log(` 尝试查找WebSocket管理器... (第${attempts}次)`);
                
                if (window.websocketManager) {
                    console.log(' WebSocket管理器已找到，注册监听器');
                    this.registerWebSocketHandler();
                } else if (attempts < maxAttempts) {
                    setTimeout(checkWebSocketManager, 100);
                } else {
                    console.error('WebSocket管理器初始化超时，将使用备用事件监听');
                }
            };
            checkWebSocketManager();
        }
        
        // 也可以通过全局事件监听（备用方案）
        document.addEventListener('websocketMessage', (event) => {
            const message = event.detail;
            console.log('员工管理器收到全局WebSocket事件:', message);
            if (message.type === 'agents_deployed') {
                console.log(' 检测到agents_deployed消息，准备处理');
                this.handleAgentsDeployed(message);
            }
        });
    }
    
    /**
     * 注册WebSocket处理器
     */
    registerWebSocketHandler() {
        
        // 通过WebSocket管理器注册消息处理器
        if (window.websocketManager && window.websocketManager.onMessage) {
            window.websocketManager.onMessage('agents_deployed', (message) => {
                console.log('WebSocket管理器收到agents_deployed消息:', message);
                this.handleAgentsDeployed(message);
            });
        } else {
            console.warn('WebSocket管理器不可用，使用备用方案');
        }
    }
    
    /**
     * 处理数字员工部署完成消息
     */
    handleAgentsDeployed(message) {
        console.log('收到数字员工部署完成通知:', message);
        console.log(' 消息内容分析:', {
            type: message.type,
            status: message.status,
            agentCount: message.agent_count,
            hasDeployedAgents: !!message.deployed_agents,
            deployedAgentsCount: message.deployed_agents ? message.deployed_agents.length : 0
        });
        
        // 显示部署成功提示
        console.log('🎨 显示部署成功通知...');
        this.showDeploymentSuccessNotification(message);
        
        // 重新加载员工状态
        setTimeout(() => {
            console.log('开始重新加载员工状态...');
            this.loadEmployeesStatus().then(() => {
                console.log(' 员工状态重新加载完成');
            }).catch((error) => {
                console.error('员工状态重新加载失败:', error);
            });
        }, 1000); // 延迟1秒确保文件已完全部署
    }
    
    /**
     * 显示部署成功通知
     */
    showDeploymentSuccessNotification(message) {
        // 清理之前的初始化通知
        const existingInitNotification = document.getElementById('init-notification');
        if (existingInitNotification) {
            existingInitNotification.remove();
        }
        
        // 清理之前的成功通知
        const existingSuccessNotification = document.getElementById('success-notification');
        if (existingSuccessNotification) {
            existingSuccessNotification.remove();
        }
        
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            padding: 20px 24px;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(16, 185, 129, 0.4);
            z-index: 10000;
            font-size: 14px;
            animation: slideInBounce 0.5s ease;
            max-width: 400px;
            border: 1px solid rgba(255, 255, 255, 0.2);
        `;
        
        const agentCount = message.agent_count || message.deployed_agents?.length || 5;
        const deployedAgents = message.deployed_agents || ['document-manager', 'work-assistant', 'finance-assistant', 'info-collector', 'fullstack-engineer'];
        const employeeNames = t('agents.employeeNames');
        const agentNames = deployedAgents.map(agentKey => employeeNames[agentKey] || agentKey);
        
        notification.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 24px;">✅</span>
                    <div>
                        <div style="font-weight: 600; font-size: 16px;">${t('agents.deploymentSuccess')}</div>
                        <div style="font-size: 12px; opacity: 0.9;">${t('agents.deploymentCount').replace('{count}', agentCount)}</div>
                    </div>
                </div>
                
                <div style="background: rgba(255, 255, 255, 0.1); padding: 12px; border-radius: 8px;">
                    <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px;">${t('agents.availableEmployees')}</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px;">
                        ${agentNames.map(name => `<div>• ${name}</div>`).join('')}
                    </div>
                </div>
                
                <div style="font-size: 11px; opacity: 0.8; text-align: center; margin-top: 8px;">
                    ${t('agents.deploymentComplete')}
                </div>
            </div>
        `;
        
        // 为通知添加唯一标识
        notification.id = 'success-notification';
        
        // 添加弹性动画
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInBounce {
                0% { 
                    transform: translateX(100%) scale(0.8); 
                    opacity: 0; 
                }
                60% { 
                    transform: translateX(-10px) scale(1.05); 
                    opacity: 1; 
                }
                100% { 
                    transform: translateX(0) scale(1); 
                    opacity: 1; 
                }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(notification);
        
        // 触发dashboard刷新以隐藏初始化按钮
        if (window.dashboard && typeof window.dashboard.loadDashboardData === 'function') {
            console.log('🔄 触发dashboard刷新以更新初始化状态');
            window.dashboard.loadDashboardData();
        }
        
        // 12秒后自动移除通知
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideInBounce 0.4s ease reverse';
                setTimeout(() => {
                    notification.remove();
                    style.remove();
                }, 400);
            }
        }, 12000);
        
        // 点击关闭
        notification.addEventListener('click', () => {
            notification.style.animation = 'slideInBounce 0.3s ease reverse';
            setTimeout(() => {
                notification.remove();
                style.remove();
            }, 300);
        });
        
        notification.style.cursor = 'pointer';
        notification.title = '点击关闭';
    }

    /**
     * 设置初始化hook
     */
    async setupInitializationHook(sessionId) {
        try {
            console.log('设置初始化hook，会话ID:', sessionId);
            
            const response = await fetch('/api/hooks/setup-temporary', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId: sessionId
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log(' 初始化hook设置成功:', result);
            } else {
                const error = await response.json();
                console.error('初始化hook设置失败:', error);
                throw new Error(error.error || '设置hook失败');
            }
            
        } catch (error) {
            console.error('设置初始化hook时出错:', error);
            throw error;
        }
    }
    
    /**
     * 清理初始化hook
     */
    async cleanupInitializationHook() {
        try {
            console.log('清理初始化hook...');
            
            const response = await fetch('/api/hooks/remove-temporary', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log(' 初始化hook清理成功:', result);
            } else {
                const error = await response.json();
                console.error('初始化hook清理失败:', error);
            }
            
        } catch (error) {
            console.error('清理初始化hook时出错:', error);
        }
    }
    
    /**
     * 检查hook状态
     */
    async checkHookStatus() {
        try {
            const response = await fetch('/api/hooks/status');
            
            if (response.ok) {
                const result = await response.json();
                return result.status;
            } else {
                console.error('检查hook状态失败');
                return null;
            }
            
        } catch (error) {
            console.error('检查hook状态时出错:', error);
            return null;
        }
    }

    /**
     * 销毁组件
     */
    destroy() {
        this.stopAutoRefresh();
        
        // 清理hook设置
        this.cleanupInitializationHook().catch(error => {
            console.error('销毁时清理hook失败:', error);
        });
        
        // 移除事件监听器等清理工作
    }
}

// 导出到全局作用域
window.EmployeesManager = EmployeesManager;

// 等待DOM加载完成后创建全局实例
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.employeesManager = new EmployeesManager();
    });
} else {
    // DOM已经加载完成
    window.employeesManager = new EmployeesManager();
}