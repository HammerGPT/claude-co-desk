/**
 * 增强版侧边栏组件 - 支持项目会话层级结构
 * 移植自claudecodeui/src/components/Sidebar.jsx
 */

class EnhancedSidebar {
    constructor() {
        this.projects = [];
        this.selectedProject = null;
        this.selectedSession = null;
        this.expandedProjects = new Set();
        this.loadingSessions = new Set();
        this.additionalSessions = {}; // 分页加载的额外会话
        this.activeSessions = new Map(); // sessionId -> {project, sessionName, tabElement}
        this.activeSessionId = null;
        this.isLoading = false;
        this.currentTime = new Date();
        this.searchFilter = '';
        
        this.initElements();
        this.initEventListeners();
        this.initSessionStateHandlers();
        this.startTimeUpdater();
    }

    /**
     * 初始化DOM元素引用
     */
    initElements() {
        this.sidebar = document.getElementById('sidebar');
        this.projectsList = document.getElementById('projects-list');
        this.refreshBtn = document.getElementById('refresh-projects');
        this.settingsBtn = document.getElementById('settings-btn');
        this.newProjectBtn = document.getElementById('new-project');
        this.sidebarOverlay = document.getElementById('sidebar-overlay');
        this.mobileMenuBtn = document.getElementById('mobile-menu-btn');
        this.searchInput = this.createSearchInput();
        
        // 新增元素
        this.sessionTabs = document.getElementById('session-tabs');
        this.projectConnectModal = document.getElementById('project-connect-modal');
        this.connectProjectName = document.getElementById('connect-project-name');
        this.connectProjectPath = document.getElementById('connect-project-path');
        this.sessionNameInput = document.getElementById('session-name-input');
        this.projectConnectConfirm = document.getElementById('project-connect-confirm');
        this.projectConnectCancel = document.getElementById('project-connect-cancel');
        this.projectConnectClose = document.getElementById('project-connect-close');
    }

    /**
     * 创建搜索输入框
     */
    createSearchInput() {
        const searchContainer = document.createElement('div');
        searchContainer.className = 'search-container';
        searchContainer.innerHTML = `
            <div class="search-input-wrapper">
                <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                </svg>
                <input type="text" id="project-search" placeholder="搜索项目..." class="search-input">
                <button class="search-clear hidden" type="button">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
        `;
        
        // 插入到项目列表前
        if (this.projectsList && this.projectsList.parentNode) {
            this.projectsList.parentNode.insertBefore(searchContainer, this.projectsList);
        }
        
        const input = searchContainer.querySelector('#project-search');
        const clearBtn = searchContainer.querySelector('.search-clear');
        
        input.addEventListener('input', (e) => {
            this.searchFilter = e.target.value;
            this.renderProjects();
            
            if (e.target.value) {
                clearBtn.classList.remove('hidden');
            } else {
                clearBtn.classList.add('hidden');
            }
        });
        
        clearBtn.addEventListener('click', () => {
            input.value = '';
            this.searchFilter = '';
            clearBtn.classList.add('hidden');
            this.renderProjects();
        });
        
        return input;
    }

    /**
     * 初始化事件监听器
     */
    initEventListeners() {
        // 刷新项目按钮
        this.refreshBtn?.addEventListener('click', async () => {
            await this.refreshProjects();
        });

        // 设置按钮
        this.settingsBtn?.addEventListener('click', () => {
            this.showSettings();
        });

        // 新建项目按钮
        this.newProjectBtn?.addEventListener('click', () => {
            this.showNewProjectDialog();
        });

        // 移动端菜单按钮
        this.mobileMenuBtn?.addEventListener('click', () => {
            this.toggleMobileSidebar();
        });

        // 侧边栏遮罩点击
        this.sidebarOverlay?.addEventListener('click', () => {
            this.hideMobileSidebar();
        });

        // 项目连接对话框事件
        this.projectConnectConfirm?.addEventListener('click', () => {
            this.confirmProjectConnection();
        });
        
        this.projectConnectCancel?.addEventListener('click', () => {
            this.hideProjectConnectModal();
        });
        
        this.projectConnectClose?.addEventListener('click', () => {
            this.hideProjectConnectModal();
        });
        
        // 会话名称输入框回车确认
        this.sessionNameInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.confirmProjectConnection();
            }
        });

        // ESC键关闭对话框和侧边栏
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideProjectConnectModal();
                this.hideMobileSidebar();
            }
        });
    }

    /**
     * 启动时间更新器
     */
    startTimeUpdater() {
        setInterval(() => {
            this.currentTime = new Date();
            // 只更新时间显示，不重新渲染整个列表
            this.updateTimeDisplays();
        }, 60000); // 每分钟更新一次
    }


    /**
     * 加载项目列表
     */
    async loadProjects() {
        this.setLoading(true);
        
        try {
            const response = await fetch('/api/projects');
            if (response.ok) {
                const data = await response.json();
                this.projects = data.projects || [];
                this.renderProjects();
                
                // 通知抽屉管理器更新项目数量
                document.dispatchEvent(new CustomEvent('projectsUpdated', {
                    detail: { projects: this.projects }
                }));
                
                // 项目加载完成，不自动选择项目
            } else {
                console.error('加载项目失败:', response.statusText);
                this.showError('加载项目失败');
            }
        } catch (error) {
            console.error('加载项目错误:', error);
            this.showError('网络错误，无法加载项目');
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * 加载项目会话
     */
    async loadProjectSessions(projectName, limit = 5, offset = 0) {
        if (this.loadingSessions.has(projectName)) {
            return;
        }

        this.loadingSessions.add(projectName);
        
        try {
            const response = await fetch(`/api/projects/${projectName}/sessions?limit=${limit}&offset=${offset}`);
            if (response.ok) {
                const data = await response.json();
                
                if (offset === 0) {
                    // 首次加载，直接设置
                    const project = this.projects.find(p => p.name === projectName);
                    if (project) {
                        project.sessions = data.sessions;
                        project.sessionMeta = {
                            hasMore: data.hasMore,
                            total: data.total
                        };
                    }
                } else {
                    // 分页加载，追加到额外会话
                    if (!this.additionalSessions[projectName]) {
                        this.additionalSessions[projectName] = [];
                    }
                    this.additionalSessions[projectName].push(...data.sessions);
                    
                    // 更新项目元数据
                    const project = this.projects.find(p => p.name === projectName);
                    if (project && project.sessionMeta) {
                        project.sessionMeta.hasMore = data.hasMore;
                    }
                }
                
                this.renderProjects();
            }
        } catch (error) {
            console.error(`加载项目 ${projectName} 会话错误:`, error);
        } finally {
            this.loadingSessions.delete(projectName);
        }
    }

    /**
     * 刷新项目列表
     */
    async refreshProjects() {
        await this.loadProjects();
        // 清除额外会话缓存
        this.additionalSessions = {};
    }

    /**
     * 获取项目的所有会话（包括分页加载的）
     */
    getAllSessions(project) {
        const initialSessions = project.sessions || [];
        const additional = this.additionalSessions[project.name] || [];
        return [...initialSessions, ...additional];
    }

    /**
     * 过滤项目
     */
    getFilteredProjects() {
        if (!this.searchFilter.trim()) {
            return this.projects;
        }

        const searchLower = this.searchFilter.toLowerCase();
        return this.projects.filter(project => {
            const displayName = (project.displayName || project.name).toLowerCase();
            const projectName = project.name.toLowerCase();
            return displayName.includes(searchLower) || projectName.includes(searchLower);
        });
    }

    /**
     * 排序项目（按名称）
     */
    getSortedProjects() {
        const filtered = this.getFilteredProjects();
        return filtered.sort((a, b) => {
            // 按显示名称排序
            const nameA = a.displayName || a.name;
            const nameB = b.displayName || b.name;
            return nameA.localeCompare(nameB);
        });
    }

    /**
     * 渲染项目列表
     */
    renderProjects() {
        if (!this.projectsList) return;

        const sortedProjects = this.getSortedProjects();

        if (this.projects.length === 0) {
            this.projectsList.innerHTML = `
                <div class="empty-state">
                    <p class="empty-message">暂无项目</p>
                    <p class="empty-hint">请确保 Claude CLI 已正确配置</p>
                </div>
            `;
            return;
        }

        if (sortedProjects.length === 0) {
            this.projectsList.innerHTML = `
                <div class="empty-state">
                    <p class="empty-message">未找到匹配的项目</p>
                    <p class="empty-hint">请调整搜索条件</p>
                </div>
            `;
            return;
        }

        this.projectsList.innerHTML = '';
        
        sortedProjects.forEach(project => {
            const projectEl = this.createProjectElement(project);
            this.projectsList.appendChild(projectEl);
        });

        // 渲染完成后，通知抽屉管理器重新计算高度
        console.log('🎯 项目列表渲染完成，通知抽屉管理器重新计算高度');
        this.notifyDrawerHeightUpdate('projects');
    }

    /**
     * 创建项目元素
     */
    createProjectElement(project) {
        const projectEl = document.createElement('div');
        projectEl.className = 'project-item';
        projectEl.setAttribute('data-project', project.name);
        
        const isExpanded = this.expandedProjects.has(project.name);
        const allSessions = this.getAllSessions(project);
        const sessionCount = allSessions.length;
        const hasMore = project.sessionMeta?.hasMore !== false;
        const isSelected = this.selectedProject?.name === project.name;
        
        if (isSelected) {
            projectEl.classList.add('active');
        }

        projectEl.innerHTML = `
            <div class="project-header" onclick="enhancedSidebar.toggleProject('${project.name}')">
                <div class="project-content">
                    <div class="project-icon">
                        ${isExpanded ? 
                            '<svg class="folder-open" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5L20 17H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2"></path></svg>' :
                            '<svg class="folder" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>'
                        }
                    </div>
                    <div class="project-info">
                        <div class="project-name">${this.escapeHtml(project.displayName || project.name)}</div>
                        <div class="project-meta">
                            ${hasMore && sessionCount >= 5 ? `${sessionCount}+` : sessionCount} 个会话
                        </div>
                    </div>
                </div>
                <div class="project-actions">
                    <button class="expand-btn" title="${isExpanded ? '折叠' : '展开'}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="${isExpanded ? '18,15 12,9 6,15' : '9,18 15,12 9,6'}"></polyline>
                        </svg>
                    </button>
                </div>
            </div>
            
            ${isExpanded ? this.createSessionsList(project) : ''}
        `;

        return projectEl;
    }

    /**
     * 创建会话列表
     */
    createSessionsList(project) {
        const allSessions = this.getAllSessions(project);
        const hasMore = project.sessionMeta?.hasMore !== false;
        const isLoading = this.loadingSessions.has(project.name);

        if (allSessions.length === 0 && !isLoading) {
            return `
                <div class="sessions-list">
                    <div class="no-sessions">
                        <p>暂无会话</p>
                    </div>
                    <button class="new-session-btn" onclick="enhancedSidebar.showNewSessionModal('${project.name}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        新建会话
                    </button>
                </div>
            `;
        }

        let sessionsHtml = '<div class="sessions-list">';
        
        allSessions.forEach(session => {
            const isActive = this.selectedSession?.id === session.id;
            const timeAgo = this.formatTimeAgo(session.lastActivity);
            const isRecentlyActive = this.isSessionRecentlyActive(session.lastActivity);
            
            // 检查会话连接状态（合并状态指示器逻辑）
            const isConnected = this.activeSessions.has(session.id);
            const isSelected = this.activeSessionId === session.id; // 使用enhancedSidebar的状态
            
            // 构建状态类名（简化逻辑，只根据连接状态显示）
            const statusClasses = [];
            if (isActive) statusClasses.push('active');
            if (isConnected) statusClasses.push('connected');
            if (isSelected) statusClasses.push('selected');
            
            sessionsHtml += `
                <div class="session-item ${statusClasses.join(' ')}" 
                     onclick="enhancedSidebar.selectSession('${project.name}', '${session.id}')">
                    <div class="session-icon">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                    </div>
                    <div class="session-content">
                        <div class="session-summary">${this.escapeHtml(session.summary || '新会话')}</div>
                        <div class="session-meta">
                            <span class="session-time">${timeAgo}</span>
                            ${session.messageCount > 0 ? 
                                `<span class="message-count">${session.messageCount}</span>` : 
                                ''
                            }
                        </div>
                    </div>
                    <div class="session-status">
                        ${isConnected ? '<div class="activity-indicator"></div>' : ''}
                        ${isSelected ? '<div class="selected-indicator"></div>' : ''}
                    </div>
                    <div class="session-actions">
                        <button class="delete-session-btn" 
                                onclick="event.stopPropagation(); enhancedSidebar.deleteSession('${project.name}', '${session.id}')"
                                title="删除会话">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3,6 5,6 21,6"></polyline>
                                <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        });

        // 加载更多按钮
        if (hasMore && allSessions.length > 0) {
            sessionsHtml += `
                <button class="load-more-btn ${isLoading ? 'loading' : ''}" 
                        onclick="enhancedSidebar.loadMoreSessions('${project.name}')"
                        ${isLoading ? 'disabled' : ''}>
                    ${isLoading ? 
                        '<div class="spinner"></div> 加载中...' : 
                        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6,9 12,15 18,9"></polyline></svg> 加载更多会话'
                    }
                </button>
            `;
        }

        // 会话操作按钮区域
        sessionsHtml += `
            <div class="session-actions-row">
                <button class="new-session-btn" onclick="enhancedSidebar.showNewSessionModal('${project.name}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    新建会话
                </button>
                <button class="continue-session-btn ${allSessions.length === 0 ? 'disabled' : ''}" 
                        onclick="enhancedSidebar.continueLastSession('${project.name}')"
                        ${allSessions.length === 0 ? 'disabled' : ''}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 12l2 2 4-4"></path>
                        <path d="M21 12c0 5-3 9-9 9s-9-4-9-9 3-9 9-9c2.5 0 4.8 1 6.5 2.8"></path>
                        <path d="M21 4v4h-4"></path>
                    </svg>
                    继续上个会话
                </button>
            </div>
        `;

        sessionsHtml += '</div>';
        return sessionsHtml;
    }

    /**
     * 切换项目展开状态
     */
    toggleProject(projectName) {
        if (this.expandedProjects.has(projectName)) {
            this.expandedProjects.delete(projectName);
        } else {
            this.expandedProjects.add(projectName);
            
            // 首次展开时加载会话
            const project = this.projects.find(p => p.name === projectName);
            if (project && (!project.sessions || project.sessions.length === 0)) {
                this.loadProjectSessions(projectName);
            }
        }
        this.renderProjects();
    }


    /**
     * 选择会话（智能会话管理 - 移植自claudecodeui）
     */
    selectSession(projectName, sessionId) {
        const project = this.projects.find(p => p.name === projectName);
        if (!project) return;

        const allSessions = this.getAllSessions(project);
        const session = allSessions.find(s => s.id === sessionId);
        if (!session) return;

        console.log(`🎯 点击会话: ${sessionId}`);

        // 检查会话是否已经活跃（已打开标签）
        if (this.activeSessions.has(sessionId)) {
            console.log(`🔄 切换到已连接的会话: ${sessionId}`);
            
            // 直接切换到已有的会话标签
            this.switchToSession(sessionId);
            return;
        }

        // 使用app的智能会话选择逻辑
        if (window.app) {
            const sessionData = {
                id: sessionId,
                projectName: project.name,
                projectPath: project.path || project.fullPath,
                summary: session.summary
            };
            
            const shouldConnect = window.app.handleSessionClick(sessionData);
            
            if (shouldConnect) {
                // 需要建立新连接，显示连接确认对话框
                console.log(`🔗 建立新会话连接: ${sessionId}`);
                this.showSessionConnectModal(project, session);
            } else {
                // 已连接会话，仅切换页签
                console.log(`🔄 切换到已连接会话: ${sessionId}`);
            }
        } else {
            // 降级处理：直接显示连接对话框
            this.showSessionConnectModal(project, session);
        }
        
        console.log('选择会话:', session);
    }
    
    /**
     * 显示会话连接弹窗
     */
    showSessionConnectModal(project, session) {
        this.connectingProject = project;
        this.connectingSession = session;
        
        if (this.connectProjectName) {
            this.connectProjectName.textContent = project.displayName || project.name;
        }
        if (this.connectProjectPath) {
            this.connectProjectPath.textContent = project.path || project.fullPath || '未知路径';
        }
        if (this.sessionNameInput) {
            this.sessionNameInput.value = session.summary || '现有会话';
            // 焦点到输入框并选中文本
            setTimeout(() => {
                this.sessionNameInput.focus();
                this.sessionNameInput.select();
            }, 100);
        }
        
        if (this.projectConnectModal) {
            this.projectConnectModal.classList.add('active');
        }
    }
    
    /**
     * 显示新建会话弹窗
     */
    showNewSessionModal(projectName) {
        const project = this.projects.find(p => p.name === projectName);
        if (!project) return;
        
        this.connectingProject = project;
        this.connectingSession = null; // 标记为新建会话
        
        if (this.connectProjectName) {
            this.connectProjectName.textContent = project.displayName || project.name;
        }
        if (this.connectProjectPath) {
            this.connectProjectPath.textContent = project.path || project.fullPath || '未知路径';
        }
        if (this.sessionNameInput) {
            this.sessionNameInput.value = '新建会话';
            // 焦点到输入框并选中文本
            setTimeout(() => {
                this.sessionNameInput.focus();
                this.sessionNameInput.select();
            }, 100);
        }
        
        if (this.projectConnectModal) {
            this.projectConnectModal.classList.add('active');
        }
    }
    
    /**
     * 隐藏项目连接弹窗
     */  
    hideProjectConnectModal() {
        if (this.projectConnectModal) {
            this.projectConnectModal.classList.remove('active');
        }
        this.connectingProject = null;
        this.connectingSession = null;
    }

    /**
     * 确认项目连接
     */
    confirmProjectConnection() {
        if (!this.connectingProject) return;
        
        const sessionName = this.sessionNameInput?.value?.trim() || '新建会话';
        
        if (this.connectingSession) {
            // 连接到现有会话
            this.connectToExistingSession(this.connectingProject, this.connectingSession, sessionName);
        } else {
            // 创建新会话
            this.createSession(this.connectingProject, sessionName);
        }
        
        this.hideProjectConnectModal();
    }
    
    /**
     * 连接到现有会话
     */
    connectToExistingSession(project, session, displayName) {
        // 使用原始会话ID作为key，这样防重复连接检查才能生效
        const sessionId = session.id;
        const tabElement = this.createSessionTab(sessionId, project, displayName);
        
        // 保存会话数据，包含原始会话信息
        this.activeSessions.set(sessionId, {
            project: project,
            sessionName: displayName,
            tabElement: tabElement,
            originalSession: session // 保存原始会话信息用于恢复
        });
        
        // 切换到新会话
        this.switchToSession(sessionId);
        
        console.log('连接到现有会话:', sessionId, project.name, displayName, session.id);
    }
    
    /**
     * 删除会话
     */
    async deleteSession(projectName, sessionId) {
        if (!confirm('确定要删除这个会话吗？此操作无法撤销。')) {
            return;
        }

        try {
            const response = await fetch(`/api/projects/${projectName}/sessions/${sessionId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                // 如果删除的是当前选中的会话，清除选择
                if (this.selectedSession?.id === sessionId) {
                    this.selectedSession = null;
                }
                
                // 重新加载项目会话
                await this.loadProjectSessions(projectName);
                
                console.log('会话删除成功');
            } else {
                const error = await response.json();
                alert(error.error || '删除会话失败');
            }
        } catch (error) {
            console.error('删除会话错误:', error);
            alert('网络错误，删除会话失败');
        }
    }

    /**
     * 创建新会话
     */
    createSession(project, sessionName) {
        const sessionId = this.generateSessionId();
        const tabElement = this.createSessionTab(sessionId, project, sessionName);
        
        // 保存会话数据，新会话没有originalSession
        this.activeSessions.set(sessionId, {
            project: project,
            sessionName: sessionName,
            tabElement: tabElement,
            originalSession: null // 新会话没有原始会话信息
        });
        
        // 切换到新会话
        this.switchToSession(sessionId);
        
        // 更新项目列表显示
        this.renderProjects();
        
        console.log('创建会话:', sessionId, project.name, sessionName);
    }

    /**
     * 关闭会话
     */
    closeSession(sessionId) {
        const sessionData = this.activeSessions.get(sessionId);
        if (!sessionData) return;
        
        // 移除页签（查找当前存在的页签元素）
        if (sessionData.tabElement) {
            sessionData.tabElement.remove();
        } else if (this.sessionTabs) {
            // 如果没有保存的tabElement，通过选择器查找
            const tabElement = this.sessionTabs.querySelector(`[data-session-id="${sessionId}"]`);
            if (tabElement) {
                tabElement.remove();
            }
        }
        
        // 从活跃会话中移除
        this.activeSessions.delete(sessionId);
        
        // 如果关闭的是当前会话，切换到其他会话
        if (this.activeSessionId === sessionId) {
            const remainingSessions = Array.from(this.activeSessions.keys());
            if (remainingSessions.length > 0) {
                this.switchToSession(remainingSessions[0]);
            } else {
                this.activeSessionId = null;
                this.showEmptyState();
            }
        }
        
        // 更新项目列表显示
        this.renderProjects();
        
        console.log('关闭会话:', sessionId);
    }

    /**
     * 继续上个会话 - 在项目目录下执行 claude -c 命令
     */
    continueLastSession(projectName) {
        const project = this.projects.find(p => p.name === projectName);
        if (!project) {
            console.error('项目未找到:', projectName);
            return;
        }
        
        const allSessions = this.getAllSessions(project);
        if (allSessions.length === 0) {
            console.warn('项目没有历史会话，无法继续上个会话');
            return;
        }
        
        console.log('继续上个会话 - 项目:', project.name, '路径:', project.path);
        
        // 创建新的终端会话用于继续操作
        const sessionId = this.generateSessionId();
        const sessionName = '继续会话 - ' + (project.displayName || project.name);
        const tabElement = this.createSessionTab(sessionId, project, sessionName);
        
        // 保存会话数据，标记为继续会话类型
        this.activeSessions.set(sessionId, {
            project: project,
            sessionName: sessionName,
            tabElement: tabElement,
            originalSession: null,
            isContinueSession: true, // 标记为继续会话
            initialCommand: 'claude -c' // 指定初始执行命令
        });
        
        // 切换到新会话
        this.switchToSession(sessionId);
        
        // 在终端中执行 claude -c 命令
        this.requestContinueSession(project, sessionId);
        
        console.log('创建继续会话终端:', sessionId, project.name, sessionName);
    }

    /**
     * 发送继续会话请求到后端 - 在终端中执行 claude -c
     */
    async requestContinueSession(project, sessionId) {
        try {
            // 通过终端命令事件在当前会话中执行 claude -c
            const event = new CustomEvent('terminalCommand', {
                detail: {
                    command: 'claude -c',
                    project: project
                }
            });
            document.dispatchEvent(event);
            console.log('在终端中执行继续会话命令: claude -c');
        } catch (error) {
            console.error('执行继续会话命令失败:', error);
            alert('继续会话失败: ' + error.message);
        }
    }

    /**
     * 切换到指定会话
     */
    switchToSession(sessionId) {
        const sessionData = this.activeSessions.get(sessionId);
        if (!sessionData) return;
        
        // 更新当前活跃会话
        this.activeSessionId = sessionId;
        
        // 更新页签状态
        this.updateTabStates();
        
        // 通知其他组件
        this.notifySessionSwitch(sessionData);
        
        // 通知页签状态变化
        this.notifyTabStateChange();
        
        // 更新项目列表显示
        this.renderProjects();
        
        console.log('切换到会话:', sessionId, sessionData.project.name, sessionData.sessionName);
    }

    /**
     * 通知会话切换
     */
    notifySessionSwitch(sessionData) {
        // 更新当前项目和会话信息显示
        const currentProject = document.getElementById('current-project');
        const currentSessionName = document.getElementById('current-session-name');
        
        if (currentProject) {
            currentProject.textContent = sessionData.project.displayName || sessionData.project.name;
        }
        if (currentSessionName) {
            currentSessionName.textContent = sessionData.sessionName;
        }
        
        // 通知app.js更新会话状态（但跳过继续会话类型）
        if (window.app && this.activeSessionId && !sessionData.isContinueSession) {
            const session = {
                id: this.activeSessionId,
                projectName: sessionData.project.name,
                projectPath: sessionData.project.path || sessionData.project.fullPath,
                summary: sessionData.sessionName
            };
            window.app.setSelectedSession(session);
        }
        
        // 触发自定义事件，传递完整的会话信息
        const event = new CustomEvent('sessionSwitch', { 
            detail: { 
                sessionId: this.activeSessionId,
                project: sessionData.project,
                sessionName: sessionData.sessionName,
                originalSession: sessionData.originalSession, // 传递原始会话信息用于恢复
                initialCommand: sessionData.initialCommand // 传递初始命令
            } 
        });
        document.dispatchEvent(event);
    }

    /**
     * 通知页签状态变化
     */
    notifyTabStateChange() {
        const hasActiveSessions = this.activeSessions.size > 0;
        
        document.dispatchEvent(new CustomEvent('tabStateChanged', {
            detail: {
                hasActiveSessions: hasActiveSessions,
                activeSessionCount: this.activeSessions.size,
                activeSessionId: this.activeSessionId
            }
        }));
        
        console.log('📋 通知页签状态变化:', {
            hasActiveSessions,
            activeSessionCount: this.activeSessions.size
        });
    }

    /**
     * 显示空状态
     */
    showEmptyState() {
        const currentProject = document.getElementById('current-project');
        const currentSessionName = document.getElementById('current-session-name');
        
        if (currentProject) {
            currentProject.textContent = '未选择项目';
        }
        if (currentSessionName) {
            currentSessionName.textContent = '';
        }
        
        // 通知页签状态变化，确保dashboard显示
        this.notifyTabStateChange();
    }

    /**
     * 格式化相对时间
     */
    formatTimeAgo(dateString) {
        if (!dateString) return '未知';
        
        const date = new Date(dateString);
        const now = this.currentTime;
        
        if (isNaN(date.getTime())) return '未知';
        
        const diffInMs = now - date;
        const diffInSeconds = Math.floor(diffInMs / 1000);
        const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
        const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
        
        if (diffInSeconds < 60) return '刚刚';
        if (diffInMinutes === 1) return '1分钟前';
        if (diffInMinutes < 60) return `${diffInMinutes}分钟前`;
        if (diffInHours === 1) return '1小时前';
        if (diffInHours < 24) return `${diffInHours}小时前`;
        if (diffInDays === 1) return '1天前';
        if (diffInDays < 7) return `${diffInDays}天前`;
        return date.toLocaleDateString();
    }

    /**
     * 检查会话是否最近活跃
     */
    isSessionRecentlyActive(dateString) {
        if (!dateString) return false;
        
        const date = new Date(dateString);
        const now = this.currentTime;
        const diffInMinutes = Math.floor((now - date) / (1000 * 60));
        
        return diffInMinutes < 10; // 10分钟内算作最近活跃
    }

    /**
     * 更新时间显示
     */
    updateTimeDisplays() {
        const timeElements = this.projectsList?.querySelectorAll('.session-time');
        timeElements?.forEach(el => {
            const sessionItem = el.closest('.session-item');
            const sessionId = sessionItem?.getAttribute('data-session-id');
            if (sessionId) {
                // 重新计算并更新时间显示
                // 这里需要从会话数据中获取时间戳
                // 为了简化，暂时跳过具体实现
            }
        });
    }

    /**
     * 显示新建项目对话框
     */
    showNewProjectDialog() {
        const path = prompt('请输入项目路径:');
        if (path && path.trim()) {
            this.createProject(path.trim());
        }
    }

    /**
     * 创建新项目
     */
    async createProject(path) {
        try {
            const response = await fetch('/api/projects/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ path })
            });

            if (response.ok) {
                const data = await response.json();
                console.log('项目创建成功:', data);
                await this.refreshProjects();
            } else {
                const error = await response.json();
                alert(`创建项目失败: ${error.error || '未知错误'}`);
            }
        } catch (error) {
            console.error('创建项目错误:', error);
            alert('网络错误，无法创建项目');
        }
    }

    /**
     * 显示设置
     */
    showSettings() {
        alert('设置功能正在开发中...');
    }

    /**
     * 移动端侧边栏控制
     */
    toggleMobileSidebar() {
        if (this.sidebar?.classList.contains('open')) {
            this.hideMobileSidebar();
        } else {
            this.showMobileSidebar();
        }
    }

    showMobileSidebar() {
        this.sidebar?.classList.add('open');
        this.sidebarOverlay?.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    hideMobileSidebar() {
        this.sidebar?.classList.remove('open');
        this.sidebarOverlay?.classList.remove('active');
        document.body.style.overflow = '';
    }

    /**
     * 设置加载状态
     */
    setLoading(loading) {
        this.isLoading = loading;
        
        if (this.refreshBtn) {
            this.refreshBtn.disabled = loading;
            
            const icon = this.refreshBtn.querySelector('svg');
            if (icon) {
                if (loading) {
                    icon.style.animation = 'spin 1s linear infinite';
                } else {
                    icon.style.animation = '';
                }
            }
        }
    }

    /**
     * 显示错误
     */
    showError(message) {
        if (this.projectsList) {
            this.projectsList.innerHTML = `
                <div class="error-state">
                    <p class="error-message">❌ ${this.escapeHtml(message)}</p>
                    <button onclick="enhancedSidebar.refreshProjects()" class="btn btn-sm btn-primary">重试</button>
                </div>
            `;
        }
    }

    /**
     * 获取当前选中的项目
     */
    getSelectedProject() {
        return this.selectedProject;
    }

    /**
     * 获取当前选中的会话
     */
    getSelectedSession() {
        return this.selectedSession;
    }

    /**
     * 恢复项目和会话选择状态（配合终端状态恢复）
     */
    async restoreSelection(projectData, sessionData) {
        console.log('🔄 恢复侧边栏选择状态:', {
            project: projectData?.name,
            session: sessionData?.id
        });

        try {
            // 查找对应的项目
            const project = this.projects.find(p => p.name === projectData.name);
            if (!project) {
                console.warn('⚠️ 未找到对应的项目:', projectData.name);
                return false;
            }

            // 设置选中的项目
            this.selectedProject = project;

            // 如果有会话数据，尝试恢复会话选择
            if (sessionData) {
                // 加载项目会话（如果还没有加载）
                if (!project.sessions || project.sessions.length === 0) {
                    await this.loadProjectSessions(project.name);
                }

                // 查找对应的会话
                const session = project.sessions?.find(s => s.id === sessionData.id);
                if (session) {
                    this.selectedSession = session;
                    console.log('✅ 成功恢复会话选择:', session.id);
                } else {
                    // 如果找不到会话，创建一个临时会话对象
                    this.selectedSession = {
                        id: sessionData.id,
                        summary: sessionData.summary || sessionData.id.substring(0, 8),
                        created_at: new Date().toISOString(),
                        last_updated: new Date().toISOString(),
                        restored: true // 标记为恢复的会话
                    };
                    console.log('🔧 创建临时会话对象:', this.selectedSession.id);
                }
            } else {
                this.selectedSession = null;
            }

            // 展开对应的项目
            this.expandedProjects.add(project.name);

            // 重新渲染界面
            this.renderProjects();

            // 发送项目选择事件
            document.dispatchEvent(new CustomEvent('projectSelected', {
                detail: { project: this.selectedProject }
            }));

            // 如果有会话，发送会话选择事件
            if (this.selectedSession) {
                document.dispatchEvent(new CustomEvent('sessionSelected', {
                    detail: { 
                        project: this.selectedProject, 
                        session: this.selectedSession 
                    }
                }));
            }

            console.log('✅ 侧边栏选择状态恢复完成');
            return true;

        } catch (error) {
            console.error('❌ 恢复侧边栏选择状态失败:', error);
            return false;
        }
    }

    /**
     * 生成会话ID
     */
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * 创建会话页签
     */
    createSessionTab(sessionId, project, sessionName) {
        const tabElement = document.createElement('div');
        tabElement.className = 'session-tab';
        tabElement.setAttribute('data-session-id', sessionId);
        
        tabElement.innerHTML = `
            <div class="session-tab-content" onclick="enhancedSidebar.switchToSession('${sessionId}')">
                <span class="session-tab-title">${this.escapeHtml(project.name)}: ${this.escapeHtml(sessionName)}</span>
            </div>
            <button class="session-tab-close" onclick="enhancedSidebar.closeSession('${sessionId}')" title="关闭会话">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;
        
        if (this.sessionTabs) {
            this.sessionTabs.appendChild(tabElement);
        }
        
        return tabElement;
    }

    /**
     * 创建任务页签
     */
    createTaskTab(taskId, taskName, initialCommand = null, workingDirectory = null) {
        // 检查是否已存在相同taskId的页签
        if (this.sessionTabs) {
            const existingTab = this.sessionTabs.querySelector(`[data-task-id="${taskId}"]`);
            if (existingTab) {
                console.log(`⚠️ 任务页签已存在: ${taskId}，切换到现有页签`);
                this.switchToSession(taskId);
                return existingTab;
            }
        }
        
        console.log(`🎯 创建新任务页签: ${taskName} (ID: ${taskId})`);
        
        // 为任务创建伪项目会话数据，以便switchToSession能正常工作
        const taskSessionData = {
            project: {
                name: 'task-execution',
                displayName: '任务执行',
                path: workingDirectory || ''  // 使用传递的工作目录
            },
            sessionId: taskId,
            sessionName: taskName,
            isTask: true,
            initialCommand: initialCommand  // 使用传递的完整任务命令
        };
        
        const tabElement = document.createElement('div');
        tabElement.className = 'session-tab task-tab';
        tabElement.setAttribute('data-session-id', taskId); // 使用taskId作为sessionId
        tabElement.setAttribute('data-task-id', taskId);
        
        tabElement.innerHTML = `
            <div class="session-tab-content" onclick="enhancedSidebar.switchToSession('${taskId}')">
                <span class="session-tab-title">${this.escapeHtml(taskName)}</span>
            </div>
            <button class="session-tab-close" onclick="enhancedSidebar.closeSession('${taskId}')" title="关闭任务">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;
        
        if (this.sessionTabs) {
            this.sessionTabs.appendChild(tabElement);
        }
        
        // 将tabElement引用保存到会话数据中，并注册到活跃会话
        taskSessionData.tabElement = tabElement;
        this.activeSessions.set(taskId, taskSessionData);
        
        // 立即切换到这个任务页签
        this.switchToSession(taskId);
        
        return tabElement;
    }
    
    /**
     * 更新所有页签状态
     */
    updateTabStates() {
        if (!this.sessionTabs) return;
        
        const tabs = this.sessionTabs.querySelectorAll('.session-tab');
        tabs.forEach(tab => {
            const sessionId = tab.getAttribute('data-session-id');
            if (sessionId === this.activeSessionId) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
    }
    
    /**
     * 获取项目的所有会话（包括分页加载的）
     */
    getAllSessions(project) {
        const initialSessions = project.sessions || [];
        const additional = this.additionalSessions[project.name] || [];
        return [...initialSessions, ...additional];
    }
    
    /**
     * 加载更多会话
     */
    async loadMoreSessions(projectName) {
        const project = this.projects.find(p => p.name === projectName);
        if (!project) return;

        const currentSessionCount = this.getAllSessions(project).length;
        await this.loadProjectSessions(projectName, 5, currentSessionCount);
    }
    
    /**
     * 获取项目的活跃会话列表
     */
    getProjectSessions(projectName) {
        const sessions = [];
        for (const [sessionId, sessionData] of this.activeSessions) {
            if (sessionData.project.name === projectName) {
                sessions.push(sessionId);
            }
        }
        return sessions;
    }

    // ===== 会话状态管理 - 移植自claudecodeui =====

    /**
     * 初始化会话状态处理器
     */
    initSessionStateHandlers() {
        // 监听会话状态变化
        document.addEventListener('sessionStateChanged', (event) => {
            this.updateSessionStates(event.detail);
        });

        // 监听会话选择变化
        document.addEventListener('sessionSelected', (event) => {
            this.handleSessionSelectionChange(event.detail);
        });
    }

    /**
     * 更新会话状态显示
     */
    updateSessionStates(stateData) {
        console.log(`🔄 更新会话状态显示: ${stateData.activeSessions.length} 个活跃会话`);
        
        // 重新渲染项目列表以更新状态指示器
        this.renderProjects();
    }

    /**
     * 处理会话选择变化
     */
    handleSessionSelectionChange(changeData) {
        console.log(`🎯 会话选择变化:`, changeData);
        
        // 重新渲染以更新选中状态
        if (changeData.session) {
            this.renderProjects();
        }
    }

    /**
     * 关闭会话页签 - 修复版（避免影响其他会话）
     */
    closeSession(sessionId) {
        console.log('🗙️ [SIDEBAR] 关闭会话页签:', sessionId);
        
        // 1. 从活跃会话中移除
        const sessionData = this.activeSessions.get(sessionId);
        if (!sessionData) {
            console.warn('⚠️ [SIDEBAR] 未找到会话数据:', sessionId);
            return;
        }
        
        // 移除页签 DOM 元素
        if (sessionData.tabElement) {
            sessionData.tabElement.remove();
        }
        this.activeSessions.delete(sessionId);
        
        // 2. 通知会话终端关闭对应的会话
        if (window.sessionTerminal) {
            window.sessionTerminal.closeSession(sessionId);
        }
        
        // 3. 检查是否还有其他活跃会话
        if (this.activeSessions.size === 0) {
            // 所有会话都关闭了，显示空状态
            console.log('🗙️ [SIDEBAR] 所有会话已关闭，显示空状态');
            this.activeSessionId = null;
            this.showEmptyState();
            
            // 通知会话终端显示空状态
            if (window.sessionTerminal) {
                window.sessionTerminal.showEmptyState();
            }
        } else {
            // 还有其他会话，检查是否需要切换
            if (this.activeSessionId === sessionId) {
                // 关闭的是当前活跃会话，切换到其他会话
                const remainingSessions = Array.from(this.activeSessions.keys());
                const switchToSessionId = remainingSessions[remainingSessions.length - 1];
                console.log('🗙️ [SIDEBAR] 当前活跃会话被关闭，切换到:', switchToSessionId);
                this.switchToSession(switchToSessionId);
            } else {
                // 关闭的不是当前活跃会话，只需要更新页签状态
                console.log('🗙️ [SIDEBAR] 关闭非活跃会话，保持当前状态');
            }
        }
        
        // 4. 更新页签状态
        this.updateTabStates();
        
        // 5. 通知页签状态变化
        this.notifyTabStateChange();
        
        // 6. 更新localStorage状态
        this.updateConnectionState();
        
        console.log('✅ [SIDEBAR] 会话页签关闭完成:', {
            sessionId,
            remainingSessions: this.activeSessions.size,
            activeSessionId: this.activeSessionId
        });
    }

    /**
     * 更新连接状态 - 确保 localStorage 与实际状态同步
     */
    updateConnectionState() {
        if (window.sessionTerminal) {
            if (this.activeSessionId && this.activeSessions.has(this.activeSessionId)) {
                // 有活跃会话，更新localStorage
                window.sessionTerminal.saveConnectionState();
            } else {
                // 没有活跃会话，清除localStorage
                window.sessionTerminal.clearConnectionState();
            }
        }
    }

    /**
     * 获取活跃会话数量
     */
    getActiveSessionCount() {
        return this.activeSessions.size;
    }

    /**
     * 检查是否有活跃会话
     */
    hasActiveSessions() {
        return this.activeSessions.size > 0;
    }

    /**
     * 通知抽屉管理器更新高度
     */
    notifyDrawerHeightUpdate(drawerName) {
        // 使用短延迟确保DOM更新完成
        setTimeout(() => {
            if (window.sidebarDrawers) {
                window.sidebarDrawers.recalculateDrawerHeight(drawerName);
                console.log(`🎯 已通知抽屉管理器重新计算 ${drawerName} 抽屉高度`);
            }
        }, 50);
        
        // 二次确认，确保高度计算正确
        setTimeout(() => {
            if (window.sidebarDrawers) {
                window.sidebarDrawers.recalculateDrawerHeight(drawerName);
            }
        }, 200);
    }

    /**
     * 工具函数
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 创建全局实例
window.enhancedSidebar = new EnhancedSidebar();