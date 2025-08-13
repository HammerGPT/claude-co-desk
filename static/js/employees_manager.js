/**
 * 数字员工团队管理器组件
 * 负责员工状态显示、初始化和管理功能
 */

class EmployeesManager {
    constructor() {
        console.log('🧑‍💼 EmployeesManager 初始化开始');
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
        console.log('✅ EmployeesManager 初始化完成');
    }

    /**
     * 初始化DOM元素引用
     */
    initElements() {
        // 现在员工管理通过弹窗显示，不再需要固定的DOM元素
        this.agentsTeamBtn = document.getElementById('agents-team-btn');
        
        console.log('🔍 DOM元素检查:', {
            agentsTeamBtn: !!this.agentsTeamBtn
        });
        
        console.log('✅ DOM元素初始化成功');
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
            this.renderEmployees();
        });
        
        // 监听数字员工部署完成事件
        this.setupWebSocketListener();
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

            // 如果系统已初始化，获取员工状态
            if (this.systemProjectStatus && !this.systemProjectStatus.needs_initialization) {
                const agentsResponse = await fetch('/api/system-project/agents');
                if (agentsResponse.ok) {
                    const agentsData = await agentsResponse.json();
                    this.employees = this.processEmployeesData(agentsData);
                    this.isInitialized = true;
                }
            }

            // 员工数据已加载完成，不需要渲染到侧边栏
            console.log('✅ 员工数据加载完成:', this.employees.length, '个员工');
        } catch (error) {
            console.error('加载员工状态失败:', error);
            // renderError不再需要，因为没有固定的显示区域
        }
    }

    /**
     * 处理员工数据
     */
    processEmployeesData(agentsData) {
        const employeeConfigs = [
            {
                id: 'document-manager',
                name: '文档管理员',
                role: '专业文件整理专家',
                avatar: '📁'
            },
            {
                id: 'work-assistant', 
                name: '工作助理',
                role: '专业行政助理',
                avatar: '💼'
            },
            {
                id: 'finance-assistant',
                name: '财务助理', 
                role: '专业财务管理专家',
                avatar: '💰'
            },
            {
                id: 'info-collector',
                name: '信息收集员',
                role: '专业情报分析师',
                avatar: '🔍'
            },
            {
                id: 'fullstack-engineer',
                name: '全栈工程师',
                role: '高级软件工程师',
                avatar: '⚡'
            }
        ];

        return employeeConfigs.map(config => {
            const agentData = agentsData.agents && agentsData.agents.find(a => a.id === config.id);
            return {
                ...config,
                status: this.determineEmployeeStatus(agentData),
                deployed: agentData?.deployed || false,
                lastActive: agentData?.lastActive || null
            };
        });
    }

    /**
     * 确定员工状态
     */
    determineEmployeeStatus(agentData) {
        if (!agentData || !agentData.deployed) {
            return 'offline';
        }
        
        // 这里可以根据实际需求扩展状态逻辑
        // 目前简化为已部署=在线，未部署=离线
        return 'online';
    }

    /**
     * 显示智能体团队管理弹窗
     */
    showAgentsModal() {
        console.log('👥 显示智能体团队管理弹窗');
        
        // 创建弹窗容器
        const modal = document.createElement('div');
        modal.className = 'modal-overlay agents-modal';
        modal.id = 'agents-management-modal';
        
        modal.innerHTML = `
            <div class="modal-content large-modal">
                <div class="modal-header">
                    <h3>数字员工团队管理</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div id="agents-modal-content" class="agents-modal-content">
                        ${this.renderAgentsContent()}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">关闭</button>
                    ${this.systemProjectStatus && this.systemProjectStatus.needs_initialization ? 
                        '<button class="btn btn-primary" onclick="employeesManager.initializeSystem()">初始化系统</button>' : ''}
                </div>
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
                    <div class="icon">👥</div>
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

        // 渲染员工列表
        return `
            <div class="agents-grid">
                ${this.employees.map(employee => `
                    <div class="agent-card" data-employee-id="${employee.id}">
                        <div class="agent-avatar">${employee.avatar}</div>
                        <div class="agent-info">
                            <div class="agent-name">${employee.name}</div>
                            <div class="agent-role">${employee.role}</div>
                        </div>
                        <div class="agent-status">
                            <div class="status-indicator ${employee.status}"></div>
                            <div class="status-text">${this.getStatusText(employee.status)}</div>
                        </div>
                        <div class="agent-actions">
                            <button class="btn btn-sm btn-outline" onclick="employeesManager.viewAgentDetails('${employee.id}')">详情</button>
                            <button class="btn btn-sm btn-primary" onclick="employeesManager.startAgentChat('${employee.id}')">对话</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * 查看智能体详情
     */
    viewAgentDetails(agentId) {
        const agent = this.employees.find(emp => emp.id === agentId);
        if (!agent) return;

        console.log('查看智能体详情:', agent.name);
        
        // 这里可以扩展为显示详细的智能体信息
        alert(`${agent.avatar} ${agent.name}\n\n职责: ${agent.role}\n状态: ${this.getStatusText(agent.status)}`);
    }

    /**
     * 开始与智能体对话
     */
    startAgentChat(agentId) {
        const agent = this.employees.find(emp => emp.id === agentId);
        if (!agent) return;

        console.log('开始与智能体对话:', agent.name);
        
        // 这里可以扩展为启动专门的智能体对话会话
        // 例如：创建一个专门与该智能体对话的页签
        alert(`即将启动与 ${agent.avatar} ${agent.name} 的对话会话\n\n该功能将在后续版本中实现`);
    }

    /**
     * 处理初始化按钮点击事件
     */
    handleInitClick(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('🎯 初始化按钮被点击');
        
        // 防重复点击
        if (this.isInitializing) {
            console.warn('⚠️ 初始化正在进行中，忽略重复点击');
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
                <div class="icon">⚠️</div>
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
     * 获取状态文本
     */
    getStatusText(status) {
        const statusTexts = {
            'online': '在线',
            'offline': '离线',
            'working': '工作中',
            'idle': '待机'
        };
        return statusTexts[status] || '未知';
    }

    /**
     * 添加员工点击事件监听器
     */
    addEmployeeClickListeners() {
        const employeeItems = this.employeesList.querySelectorAll('.employee-item');
        employeeItems.forEach(item => {
            item.addEventListener('click', () => {
                const employeeId = item.dataset.employeeId;
                this.handleEmployeeClick(employeeId);
            });
        });
    }

    /**
     * 处理员工点击事件
     */
    handleEmployeeClick(employeeId) {
        const employee = this.employees.find(emp => emp.id === employeeId);
        if (!employee) return;

        // 显示员工详情或启动与该员工的对话
        console.log('点击员工:', employee.name);
        
        // 这里可以扩展为显示员工详情面板或启动专门的对话会话
        // 例如：启动一个专门与该员工对话的聊天窗口
    }

    /**
     * 处理系统状态按钮点击
     */
    handleDailyTasksClick() {
        console.log('🎯 打开每日任务管理界面');
        // 显示每日任务管理模态框
        const modal = document.getElementById('daily-tasks-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('active');
            // 初始化任务管理器
            if (!window.taskManager) {
                window.taskManager = new TaskManager();
            }
            window.taskManager.loadTasks();
        }
    }

    /**
     * 初始化系统 - 使用页签机制
     */
    async initializeSystem() {
        console.log('🚀 initializeSystem() 被调用 - 使用页签机制');
        
        // 设置正在初始化状态
        this.isInitializing = true;
        
        try {
            // 生成会话ID（用于hook标识）
            const sessionId = this.generateSessionId();
            console.log('🔑 生成会话ID:', sessionId);
            
            // 设置临时hook监听初始化完成
            await this.setupInitializationHook(sessionId);
            // 检查系统项目状态
            if (!this.systemProjectStatus) {
                console.error('❌ 系统项目状态未加载');
                alert('系统状态未加载，请稍后重试');
                return;
            }
            
            // 检查 enhancedSidebar 是否可用
            if (!window.enhancedSidebar) {
                console.error('❌ enhancedSidebar 未初始化');
                alert('页签系统未加载，请刷新页面重试');
                return;
            }
            
            // 构造系统项目对象
            const systemProject = {
                name: '系统根目录',
                displayName: '🏠 系统根目录',
                path: this.systemProjectStatus.root_directory,
                fullPath: this.systemProjectStatus.root_directory
            };
            
            console.log('🏗️ 准备创建系统初始化会话:', systemProject);
            
            // 创建专用的初始化会话页签（使用已生成的sessionId）
            const sessionName = '🚀 系统初始化';
            
            // 构建完整的初始化命令 - 直接使用Claude CLI组合命令  
            const guidanceText = `你现在要初始化用户电脑的根目录/主目录 (~/)，包含用户的全部数字生活内容，可能会包含：

- 各种应用程序和工具
- 工作文档和项目文件  
- 财务数据和个人文档
- 代码项目和开发环境
- 媒体文件和个人资料
- 系统配置和环境设置

请按照以下标准流程执行：

1. 创建TodoList追踪进度：
   - 分析主目录整体结构和文件分布
   - 识别开发项目、工作文档、个人文件分类  
   - 检测系统配置和开发环境
   - 必须创建CLAUDE.md系统初始化文件
   - 建立智能管理规则

2. 系统分析步骤：
   - 使用系统命令分析主目录结构
   - 查找关键文件类型（*.py, *.js, *.json等）
   - 检测开发环境配置（Python, Node.js, Git等）
   - 读取系统配置文件(.zshrc, .bash_profile等）
	   
3. 配置文件创建：
   - 创建详细的CLAUDE.md系统初始化文件，包含目录映射、工作流程、你分析系统资源等信息推理出来的系统用户画像、可能的潜在工作等
   - 生成系统分析报告

4. 完成标志：
   - 所有TodoList项目标记为完成
   - 生成最终的初始化总结报告
   - 确认系统已AI化并准备就绪

严格按照上述流程完成初始化。`;
            
            // 对引导文字进行转义，处理引号问题
            const escapedGuidanceText = guidanceText.replace(/"/g, '\\"');
            const initialCommand = `claude "${escapedGuidanceText}"`;
            
            console.log('🚀 构建初始化命令:', {
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
            
            console.log('✅ 系统初始化会话已创建:', sessionId);
            
            // 显示通知
            this.showInitializationNotification();
            
        } catch (error) {
            console.error('❌ 创建初始化会话失败:', error);
            alert('创建初始化会话失败: ' + error.message);
            
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
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span>🚀</span>
                    <span style="font-weight: 600;">系统初始化已启动</span>
                </div>
                <div style="font-size: 12px; opacity: 0.9; margin-bottom: 8px;">
                    新页签已创建，将直接启动Claude并发送初始化指令
                </div>
                <button id="manual-send-guidance" style="
                    background: rgba(255,255,255,0.2);
                    border: 1px solid rgba(255,255,255,0.3);
                    color: white;
                    padding: 6px 12px;
                    border-radius: 4px;
                    font-size: 11px;
                    cursor: pointer;
                    transition: all 0.2s;
                    align-self: flex-start;
                " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                    手动发送引导（备用）
                </button>
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
        
        // 添加手动发送按钮事件
        const manualSendBtn = notification.querySelector('#manual-send-guidance');
        if (manualSendBtn) {
            manualSendBtn.addEventListener('click', () => {
                this._manualSendGuidance();
                // 点击后立即移除通知
                notification.remove();
                style.remove();
            });
        }
        
        // 8秒后自动移除通知（延长显示时间）
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideIn 0.3s ease reverse';
                setTimeout(() => {
                    notification.remove();
                    style.remove();
                }, 300);
            }
        }, 8000);
    }

    /**
     * 手动发送初始化引导（备用方案）
     */
    _manualSendGuidance() {
        // 获取当前活跃的会话终端
        const sessionTerminal = window.sessionTerminal;
        if (!sessionTerminal || !sessionTerminal.activeSessionId) {
            alert('未找到活跃的终端会话，请确保初始化页签已打开');
            return;
        }

        const sessionId = sessionTerminal.activeSessionId;
        const connection = sessionTerminal.connections.get(sessionId);
        
        if (!connection || connection.readyState !== WebSocket.OPEN) {
            alert('终端连接不可用，请检查Claude Code是否正常启动');
            return;
        }

        // 发送完整的引导文字
        const guidanceText = `你现在要初始化用户电脑的根目录/主目录 (~/)，包含用户的全部数字生活内容：

- 各种应用程序和工具
- 工作文档和项目文件  
- 财务数据和个人文档
- 代码项目和开发环境
- 媒体文件和个人资料
- 系统配置和环境设置

请按照以下标准流程执行：

1. 创建TodoList追踪进度：
   - 分析主目录整体结构和文件分布
   - 识别开发项目、工作文档、个人文件分类  
   - 检测系统配置和开发环境
   - 创建CLAUDE.md配置文件
   - 建立智能管理规则

2. 系统分析步骤：
   - 使用LS(.)命令分析主目录结构
   - 使用Glob命令查找关键文件类型（*.py, *.js, *.json等）
   - 检测开发环境配置（Python, Node.js, Git等）
   - 读取系统配置文件(.zshrc, .bash_profile等）

3. 配置文件创建：
   - 创建详细的CLAUDE.md配置文件，包含目录映射和工作流程
   - 创建智能管理脚本claude_system_manager.py
   - 生成系统分析报告

4. 完成标志：
   - 所有TodoList项目标记为完成
   - 生成最终的初始化总结报告
   - 确认系统已AI化并准备就绪

请直接执行 /init 命令开始分析，并严格按照上述流程完成初始化。`;

        console.log('📤 手动发送初始化引导文字:', sessionId);
        
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
                <span>✅</span>
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
        console.log('🔧 开始设置员工管理器WebSocket监听器...');
        
        // 监听全局WebSocket消息
        if (window.websocketManager) {
            console.log('✅ WebSocket管理器已存在，直接注册监听器');
            // 如果WebSocket管理器存在，直接注册监听器
            this.registerWebSocketHandler();
        } else {
            console.log('⏳ WebSocket管理器不存在，等待初始化...');
            // 等待WebSocket管理器初始化
            let attempts = 0;
            const maxAttempts = 50; // 5秒超时
            const checkWebSocketManager = () => {
                attempts++;
                console.log(`🔍 尝试查找WebSocket管理器... (第${attempts}次)`);
                
                if (window.websocketManager) {
                    console.log('✅ WebSocket管理器已找到，注册监听器');
                    this.registerWebSocketHandler();
                } else if (attempts < maxAttempts) {
                    setTimeout(checkWebSocketManager, 100);
                } else {
                    console.error('❌ WebSocket管理器初始化超时，将使用备用事件监听');
                }
            };
            checkWebSocketManager();
        }
        
        // 也可以通过全局事件监听（备用方案）
        document.addEventListener('websocketMessage', (event) => {
            const message = event.detail;
            console.log('📨 员工管理器收到全局WebSocket事件:', message);
            if (message.type === 'agents_deployed') {
                console.log('✅ 检测到agents_deployed消息，准备处理');
                this.handleAgentsDeployed(message);
            }
        });
    }
    
    /**
     * 注册WebSocket处理器
     */
    registerWebSocketHandler() {
        console.log('📡 注册数字员工部署WebSocket监听器');
        console.log('🔍 WebSocket管理器状态:', {
            exists: !!window.websocketManager,
            hasOnMessage: !!(window.websocketManager && window.websocketManager.onMessage),
            isConnected: window.websocketManager ? window.websocketManager.isConnected : false
        });
        
        // 通过WebSocket管理器注册消息处理器
        if (window.websocketManager && window.websocketManager.onMessage) {
            window.websocketManager.onMessage('agents_deployed', (message) => {
                console.log('🎯 WebSocket管理器收到agents_deployed消息:', message);
                this.handleAgentsDeployed(message);
            });
            console.log('✅ WebSocket监听器注册成功');
        } else {
            console.warn('⚠️ WebSocket管理器不可用，使用备用方案');
        }
    }
    
    /**
     * 处理数字员工部署完成消息
     */
    handleAgentsDeployed(message) {
        console.log('🎉 收到数字员工部署完成通知:', message);
        console.log('📊 消息内容分析:', {
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
            console.log('🔄 开始重新加载员工状态...');
            this.loadEmployeesStatus().then(() => {
                console.log('✅ 员工状态重新加载完成');
            }).catch((error) => {
                console.error('❌ 员工状态重新加载失败:', error);
            });
        }, 1000); // 延迟1秒确保文件已完全部署
    }
    
    /**
     * 显示部署成功通知
     */
    showDeploymentSuccessNotification(message) {
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
        const agentNames = [
            '📁 文档管理员',
            '💼 工作助理', 
            '💰 财务助理',
            '🔍 信息收集员',
            '⚡ 全栈工程师'
        ];
        
        notification.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 24px;">🎉</span>
                    <div>
                        <div style="font-weight: 600; font-size: 16px;">数字员工团队部署成功！</div>
                        <div style="font-size: 12px; opacity: 0.9;">已部署 ${agentCount} 个专业数字员工</div>
                    </div>
                </div>
                
                <div style="background: rgba(255, 255, 255, 0.1); padding: 12px; border-radius: 8px;">
                    <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px;">可用员工：</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px;">
                        ${agentNames.map(name => `<div>${name}</div>`).join('')}
                    </div>
                </div>
                
                <div style="font-size: 11px; opacity: 0.8; text-align: center; margin-top: 8px;">
                    现在可以通过Claude Code直接调用这些数字员工了！
                </div>
            </div>
        `;
        
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
            console.log('🔧 设置初始化hook，会话ID:', sessionId);
            
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
                console.log('✅ 初始化hook设置成功:', result);
            } else {
                const error = await response.json();
                console.error('❌ 初始化hook设置失败:', error);
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
            console.log('🧹 清理初始化hook...');
            
            const response = await fetch('/api/hooks/remove-temporary', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ 初始化hook清理成功:', result);
            } else {
                const error = await response.json();
                console.error('❌ 初始化hook清理失败:', error);
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