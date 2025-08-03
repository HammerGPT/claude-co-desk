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
        this.isLoading = false;
        this.starredProjects = this.loadStarredProjects();
        this.currentTime = new Date();
        this.searchFilter = '';
        
        this.initElements();
        this.initEventListeners();
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

        // ESC键关闭移动端侧边栏
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
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
     * 加载星标项目
     */
    loadStarredProjects() {
        try {
            const saved = localStorage.getItem('starredProjects');
            return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch (error) {
            console.error('加载星标项目出错:', error);
            return new Set();
        }
    }

    /**
     * 保存星标项目
     */
    saveStarredProjects() {
        try {
            localStorage.setItem('starredProjects', JSON.stringify([...this.starredProjects]));
        } catch (error) {
            console.error('保存星标项目出错:', error);
        }
    }

    /**
     * 切换项目星标状态
     */
    toggleStarProject(projectName) {
        if (this.starredProjects.has(projectName)) {
            this.starredProjects.delete(projectName);
        } else {
            this.starredProjects.add(projectName);
        }
        this.saveStarredProjects();
        this.renderProjects();
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
                
                // 自动选择第一个项目（如果没有选中的项目）
                if (this.projects.length > 0 && !this.selectedProject) {
                    this.selectProject(this.projects[0]);
                }
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
     * 排序项目（星标优先，然后按名称）
     */
    getSortedProjects() {
        const filtered = this.getFilteredProjects();
        return filtered.sort((a, b) => {
            const aStarred = this.starredProjects.has(a.name);
            const bStarred = this.starredProjects.has(b.name);
            
            // 星标项目优先
            if (aStarred && !bStarred) return -1;
            if (!aStarred && bStarred) return 1;
            
            // 相同星标状态下按显示名称排序
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
    }

    /**
     * 创建项目元素
     */
    createProjectElement(project) {
        const projectEl = document.createElement('div');
        projectEl.className = 'project-item';
        projectEl.setAttribute('data-project', project.name);
        
        const isExpanded = this.expandedProjects.has(project.name);
        const isSelected = this.selectedProject?.name === project.name;
        const isStarred = this.starredProjects.has(project.name);
        
        if (isSelected) {
            projectEl.classList.add('active');
        }
        if (isStarred) {
            projectEl.classList.add('starred');
        }

        const allSessions = this.getAllSessions(project);
        const sessionCount = allSessions.length;
        const hasMore = project.sessionMeta?.hasMore !== false;

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
                            ${project.fullPath !== project.displayName ? 
                                `<span class="project-path">• ${project.fullPath.length > 25 ? '...' + project.fullPath.slice(-22) : project.fullPath}</span>` : 
                                ''
                            }
                        </div>
                    </div>
                </div>
                <div class="project-actions">
                    <button class="star-btn ${isStarred ? 'starred' : ''}" 
                            onclick="event.stopPropagation(); enhancedSidebar.toggleStarProject('${project.name}')" 
                            title="${isStarred ? '取消收藏' : '收藏项目'}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="${isStarred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"></polygon>
                        </svg>
                    </button>
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
                    <button class="new-session-btn" onclick="enhancedSidebar.createNewSession('${project.name}')">
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
            
            sessionsHtml += `
                <div class="session-item ${isActive ? 'active' : ''} ${isRecentlyActive ? 'recently-active' : ''}" 
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

        // 新建会话按钮
        sessionsHtml += `
            <button class="new-session-btn" onclick="enhancedSidebar.createNewSession('${project.name}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                新建会话
            </button>
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
     * 选择项目
     */
    selectProject(project) {
        this.selectedProject = project;
        this.selectedSession = null; // 清除会话选择
        
        // 自动展开项目
        this.expandedProjects.add(project.name);
        
        this.renderProjects();
        this.notifyProjectSelection(project);
        this.hideMobileSidebar();
        
        console.log('选择项目:', project);
    }

    /**
     * 选择会话
     */
    selectSession(projectName, sessionId) {
        const project = this.projects.find(p => p.name === projectName);
        if (!project) return;

        const allSessions = this.getAllSessions(project);
        const session = allSessions.find(s => s.id === sessionId);
        if (!session) return;

        this.selectedProject = project;
        this.selectedSession = session;
        
        this.renderProjects();
        this.notifySessionSelection(project, session);
        this.hideMobileSidebar();
        
        console.log('选择会话:', session);
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
     * 创建新会话
     */
    createNewSession(projectName) {
        const project = this.projects.find(p => p.name === projectName);
        if (!project) return;

        this.selectProject(project);
        this.selectedSession = null; // 清除当前会话选择以创建新会话
        
        // 通知聊天界面创建新会话
        const event = new CustomEvent('newSession', { 
            detail: { project } 
        });
        document.dispatchEvent(event);
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
     * 通知项目选择
     */
    notifyProjectSelection(project) {
        // 通知聊天界面
        if (window.chatInterface) {
            window.chatInterface.setSelectedProject(project);
        }

        // 触发自定义事件
        const event = new CustomEvent('projectSelected', { 
            detail: { project } 
        });
        document.dispatchEvent(event);
    }

    /**
     * 通知会话选择
     */
    notifySessionSelection(project, session) {
        // 通知聊天界面
        if (window.chatInterface) {
            window.chatInterface.setSelectedSession(project, session);
        }

        // 触发自定义事件
        const event = new CustomEvent('sessionSelected', { 
            detail: { project, session } 
        });
        document.dispatchEvent(event);
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