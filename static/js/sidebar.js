/**
 * 侧边栏组件
 * 移植自claudecodeui/src/components/Sidebar.jsx
 */

class Sidebar {
    constructor() {
        this.projects = [];
        this.selectedProject = null;
        this.isLoading = false;
        
        this.initElements();
        this.initEventListeners();
        this.initSessionHandlers();
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
    }

    /**
     * 初始化事件监听器
     */
    initEventListeners() {
        // 刷新项目按钮
        this.refreshBtn?.addEventListener('click', () => {
            this.refreshProjects();
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
                
                // 自动选择第一个项目
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
     * 刷新项目列表
     */
    async refreshProjects() {
        await this.loadProjects();
    }

    /**
     * 渲染项目列表
     */
    renderProjects() {
        if (!this.projectsList) return;

        if (this.projects.length === 0) {
            this.projectsList.innerHTML = `
                <div class="empty-state">
                    <p class="empty-message">暂无项目</p>
                    <p class="empty-hint">请确保 Claude CLI 已正确配置</p>
                </div>
            `;
            return;
        }

        this.projectsList.innerHTML = '';
        
        this.projects.forEach(project => {
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
        
        if (this.selectedProject?.name === project.name) {
            projectEl.classList.add('active');
        }

        // 使用新的样式结构
        projectEl.innerHTML = `
            <div class="project-header">
                <div class="project-icon">
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                    </svg>
                </div>
                <div class="project-info">
                    <div class="project-name">${this.escapeHtml(project.display_name || project.name)}</div>
                </div>
                <div class="project-actions">
                    <button class="project-menu-btn" onclick="event.stopPropagation(); sidebar.showProjectMenu('${project.name}')" title="更多操作">
                        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"/>
                        </svg>
                    </button>
                </div>
            </div>
            ${project.sessions && project.sessions.length > 0 ? this.createSessionsList(project.sessions) : ''}
        `;

        // 添加点击事件
        projectEl.addEventListener('click', () => {
            this.selectProject(project);
        });

        return projectEl;
    }

    /**
     * 创建会话列表
     */
    createSessionsList(sessions) {
        if (!sessions || sessions.length === 0) return '';
        
        const sessionsHtml = sessions.slice(0, 3).map(session => {
            // 检查会话连接状态
            const isActive = window.app?.isSessionActive(session.id) || false;
            const isRecentlyActive = window.app?.isSessionRecentlyActive(session.id) || false;
            const isSelected = window.app?.getSelectedSession()?.id === session.id;
            
            // 构建会话状态类名
            const statusClasses = [];
            if (isSelected) statusClasses.push('selected');
            if (isActive) statusClasses.push('active');
            if (isRecentlyActive) statusClasses.push('recently-active');
            
            // 添加会话类型标识
            const sessionTypeClass = session.isPrimary ? 'primary-session' : 'sub-session';
            const sessionTypeIcon = session.isPrimary ? 
                `<svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>` : 
                `<svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>`;

            return `
                <div class="session-item ${statusClasses.join(' ')} ${sessionTypeClass}" data-session="${session.id}">
                    <div class="session-icon">
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                        </svg>
                    </div>
                    <div class="session-content">
                        <div class="session-title">
                            <span class="session-type-badge ${session.isPrimary ? 'primary' : 'sub'}" title="${session.isPrimary ? '主会话' : '子会话'}">
                                ${sessionTypeIcon}
                            </span>
                            ${this.escapeHtml(session.summary || session.id.substring(0, 8))}
                        </div>
                        <div class="session-time">${this.formatTimeAgo(session.lastActivity)}</div>
                    </div>
                    <div class="session-status">
                        ${isRecentlyActive ? '<div class="activity-indicator"></div>' : ''}
                        ${isSelected ? '<div class="selected-indicator"></div>' : ''}
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="sessions-list">
                ${sessionsHtml}
                ${sessions.length > 3 ? `<div class="session-item show-more">查看全部 ${sessions.length} 个会话</div>` : ''}
            </div>
        `;
    }

    /**
     * 格式化时间显示
     */
    formatTimeAgo(dateString) {
        if (!dateString) return '未知时间';
        
        const now = new Date();
        const date = new Date(dateString);
        const diffMs = now - date;
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffSeconds < 60) return '刚刚';
        if (diffMinutes < 60) return `${diffMinutes}分钟前`;
        if (diffHours < 24) return `${diffHours}小时前`;
        if (diffDays < 7) return `${diffDays}天前`;
        return date.toLocaleDateString();
    }

    /**
     * 选择项目
     */
    selectProject(project) {
        // 更新选中状态
        this.selectedProject = project;
        
        // 更新UI
        const projectItems = this.projectsList?.querySelectorAll('.project-item');
        projectItems?.forEach(item => {
            if (item.getAttribute('data-project') === project.name) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // 通知其他组件
        this.notifyProjectSelection(project);

        // 隐藏移动端侧边栏
        this.hideMobileSidebar();

        console.log('选择项目:', project);
    }

    /**
     * 通知项目选择
     */
    notifyProjectSelection(project) {
        // 通知聊天界面
        if (window.chatInterface) {
            window.chatInterface.setSelectedProject(project);
        }

        // 更新文件页面标题
        this.updateFilePageTitle(project);

        // 触发自定义事件
        const event = new CustomEvent('projectSelected', { 
            detail: { project } 
        });
        document.dispatchEvent(event);
    }

    /**
     * 更新文件页面标题显示项目路径
     */
    updateFilePageTitle(project) {
        const filesHeader = document.querySelector('#files-panel .files-header h3');
        if (filesHeader && project) {
            filesHeader.innerHTML = `项目文件 <span class="project-path-display">${this.escapeHtml(project.path)}</span>`;
        } else if (filesHeader) {
            filesHeader.textContent = '项目文件';
        }
    }

    /**
     * 显示项目菜单
     */
    showProjectMenu(projectName) {
        const project = this.projects.find(p => p.name === projectName);
        if (!project) return;

        // 简单的确认对话框，后续可以替换为更好的UI
        const action = confirm(`项目操作:\n\n${project.display_name}\n${project.path}\n\n选择"确定"打开项目目录，"取消"关闭`);
        
        if (action) {
            // 尝试在系统中打开项目目录
            console.log('打开项目目录:', project.path);
        }
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
     * 切换移动端侧边栏
     */
    toggleMobileSidebar() {
        if (this.sidebar?.classList.contains('open')) {
            this.hideMobileSidebar();
        } else {
            this.showMobileSidebar();
        }
    }

    /**
     * 显示移动端侧边栏
     */
    showMobileSidebar() {
        this.sidebar?.classList.add('open');
        this.sidebarOverlay?.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    /**
     * 隐藏移动端侧边栏
     */
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
            
            // 添加旋转动画
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
                    <button onclick="sidebar.refreshProjects()" class="btn btn-sm btn-primary">重试</button>
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

    // ===== 会话状态管理 - 移植自claudecodeui =====

    /**
     * 初始化会话处理器
     */
    initSessionHandlers() {
        // 监听会话状态变化
        document.addEventListener('sessionStateChanged', (event) => {
            this.updateSessionStates(event.detail);
        });

        // 监听会话选择变化
        document.addEventListener('sessionSelected', (event) => {
            this.handleSessionSelectionChange(event.detail);
        });

        // 添加会话点击事件委托
        if (this.projectsList) {
            this.projectsList.addEventListener('click', (event) => {
                const sessionItem = event.target.closest('.session-item');
                if (sessionItem && !sessionItem.classList.contains('show-more')) {
                    const sessionId = sessionItem.getAttribute('data-session');
                    if (sessionId) {
                        this.handleSessionClick(sessionId);
                    }
                }
            });
        }
    }

    /**
     * 处理会话点击
     */
    handleSessionClick(sessionId) {
        console.log(`🎯 点击会话: ${sessionId}`);
        
        // 构建会话对象
        const session = this.findSessionById(sessionId);
        if (!session) {
            console.warn(`⚠️ 未找到会话: ${sessionId}`);
            return;
        }

        // 使用app的智能会话选择
        if (window.app) {
            const shouldConnect = window.app.handleSessionClick(session);
            
            if (shouldConnect) {
                // 需要建立新连接
                console.log(`🔗 建立新会话连接: ${sessionId}`);
                
                // 通知聊天组件建立连接
                if (window.chatInterface) {
                    window.chatInterface.connectToSession(session);
                }
            } else {
                // 已连接会话，仅切换页签
                console.log(`🔄 切换到已连接会话: ${sessionId}`);
            }
        }
    }

    /**
     * 根据ID查找会话
     */
    findSessionById(sessionId) {
        for (const project of this.projects) {
            if (project.sessions) {
                const session = project.sessions.find(s => s.id === sessionId);
                if (session) {
                    return {
                        ...session,
                        projectName: project.name,
                        projectPath: project.path
                    };
                }
            }
        }
        return null;
    }

    /**
     * 更新会话状态显示
     */
    updateSessionStates(stateData) {
        if (!this.projectsList) return;

        const sessionItems = this.projectsList.querySelectorAll('.session-item[data-session]');
        
        sessionItems.forEach(item => {
            const sessionId = item.getAttribute('data-session');
            const isActive = stateData.activeSessions.includes(sessionId);
            const isSelected = stateData.selectedSession?.id === sessionId;
            const isRecentlyActive = window.app?.isSessionRecentlyActive(sessionId) || false;

            // 更新状态类
            item.classList.toggle('active', isActive);
            item.classList.toggle('selected', isSelected);
            item.classList.toggle('recently-active', isRecentlyActive);

            // 更新状态指示器
            const statusContainer = item.querySelector('.session-status');
            if (statusContainer) {
                statusContainer.innerHTML = `
                    ${isRecentlyActive ? '<div class="activity-indicator"></div>' : ''}
                    ${isSelected ? '<div class="selected-indicator"></div>' : ''}
                `;
            }
        });

        console.log(`🔄 更新会话状态显示: ${stateData.activeSessions.length} 个活跃会话`);
    }

    /**
     * 处理会话选择变化
     */
    handleSessionSelectionChange(changeData) {
        console.log(`🎯 会话选择变化:`, changeData);
        
        // 重新渲染以更新选中状态
        if (changeData.session) {
            this.updateSessionStates({
                activeSessions: Array.from(window.app?.activeSessions || []),
                selectedSession: changeData.session
            });
        }
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
window.sidebar = new Sidebar();