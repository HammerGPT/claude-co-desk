/**
 * 任务管理器组件 V2 - 分栏交互版本
 * 负责每日任务的创建、管理和执行
 */

/**
 * 任务字段统一配置 - 驱动新建、详情、编辑的字段一致性
 * 新增字段只需在此添加，自动应用到三个界面
 */
const TASK_FIELD_CONFIG = {
    name: {
        type: 'text',
        label: '任务名称',
        required: true,
        order: 1,
        backendKey: 'name',
        showInDetail: true
    },
    goal: {
        type: 'textarea', 
        label: '任务描述',
        required: true,
        order: 2,
        backendKey: 'goal',
        showInDetail: true
    },
    role: {
        type: 'select',
        label: '选择角色',
        required: false,
        order: 3,
        backendKey: 'role',
        showInDetail: true,
        options: ['info-collector', 'fullstack-engineer', 'ai-product-manager', 'document-manager', 'finance-assistant', 'work-assistant']
    },
    skipPermissions: {
        type: 'checkbox',
        label: '跳过权限检查',
        required: false,
        order: 4,
        backendKey: 'skipPermissions',
        showInDetail: true,
        default: false
    },
    verboseLogs: {
        type: 'checkbox',
        label: '详细日志',
        required: false,
        order: 5,
        backendKey: 'verboseLogs',
        showInDetail: true,
        default: false
    },
    scheduleFrequency: {
        type: 'radio-group',
        label: '执行方式',
        required: true,
        order: 6,
        backendKey: 'scheduleFrequency',
        showInDetail: true,
        options: [
            { value: 'immediate', label: '立即执行' },
            { value: 'daily', label: '每日定时' },
            { value: 'weekly', label: '每周定时' }
        ],
        default: 'immediate'
    },
    scheduleTime: {
        type: 'time',
        label: '定时时间',
        required: false,
        order: 7,
        backendKey: 'scheduleTime',
        showInDetail: true,
        default: '09:00',
        dependsOn: 'scheduleFrequency',
        dependsOnValue: ['daily', 'weekly']
    },
    resources: {
        type: 'file-list',
        label: '资源文件',
        required: false,
        order: 8,
        backendKey: 'resources',
        showInDetail: true,
        default: []
    }
};

class TaskManager {
    constructor() {
        this.tasks = [];
        this.selectedTaskId = null;
        this.currentView = 'empty'; // 'empty', 'detail', 'form'
        this.resources = [];
        this.currentEditingTask = null;
        this.systemConfig = null; // 存储系统配置
        this.notificationStatus = null; // 存储通知配置状态
        
        this.initElements();
        this.initEventListeners();
        
        // 监听任务创建事件（来自SimpleTaskManager）
        document.addEventListener('taskCreated', (event) => {
            this.loadTasks(); // 重新加载任务列表
        });
        
        // Add language change observer
        this.initializeI18nObserver();
        
        // 监听任务更新事件（来自SimpleTaskManager）
        document.addEventListener('taskUpdated', (event) => {
            this.loadTasks(); // 重新加载任务列表
        });
        
        // 初始化时先加载配置，再加载任务列表
        this.init();
        
        // 初始化路径自动补全功能
        this.initPathAutocomplete();
        
    }

    /**
     * 异步初始化 - 加载配置后再加载任务
     */
    async init() {
        try {
            await this.loadConfig();
            await this.loadNotificationStatus();
            this.loadTasks();
        } catch (error) {
            console.error('TaskManager初始化失败:', error);
            this.loadTasks(); // 即使配置加载失败也要加载任务
        }
    }

    /**
     * 加载系统配置
     */
    async loadConfig() {
        try {
            const response = await fetch('/api/config');
            if (response.ok) {
                this.systemConfig = await response.json();
            }
        } catch (error) {
            console.error('加载系统配置失败:', error);
        }
    }

    /**
     * 加载通知配置状态
     */
    async loadNotificationStatus() {
        try {
            const response = await fetch('/api/notifications/status');
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    this.notificationStatus = result.status;
                    console.log('Notification status loaded:', this.notificationStatus);
                    return true;
                }
            }
            console.warn('Failed to load notification status: invalid response');
            return false;
        } catch (error) {
            console.error('加载通知配置状态失败:', error);
            return false;
        }
    }

    /**
     * 获取用户主目录（跨平台兼容）
     */
    getUserHome() {
        // 首选：使用系统配置
        if (this.systemConfig?.userHome) {
            return this.systemConfig.userHome;
        }
        
        // 备选：使用浏览器环境推断
        // 注意：这是前端代码，无法直接获取系统路径
        // 因此必须依赖后端配置API
        console.warn('系统配置未加载，无法获取用户主目录');
        return null;
    }

    /**
     * 初始化DOM元素引用
     */
    initElements() {
        // 模态框相关
        this.modal = document.getElementById('daily-tasks-modal');
        this.modalCloseBtn = document.getElementById('tasks-modal-close');
        
        // 分栏布局相关
        this.tasksList = document.getElementById('tasks-list');
        this.addTaskBtn = document.getElementById('add-task-btn');
        this.taskDetailEmpty = document.getElementById('task-detail-empty');
        this.taskDetailView = document.getElementById('task-detail-view');
        this.addTaskForm = document.getElementById('add-task-form');
        
        // 详情视图相关
        this.detailTaskName = document.getElementById('detail-task-name');
        this.detailTaskGoal = document.getElementById('detail-task-goal');
        this.detailExecutionMode = document.getElementById('detail-execution-mode');
        this.detailResources = document.getElementById('detail-resources');
        this.detailStatus = document.getElementById('detail-status');
        this.editTaskBtn = document.getElementById('edit-task-btn');
        this.executeTaskBtn = document.getElementById('execute-task-btn');
        
        // 表单相关
        this.taskForm = document.getElementById('task-form');
        this.cancelAddTaskBtn = document.getElementById('cancel-add-task');
        this.cancelTaskBtn = document.getElementById('cancel-task');
        this.cancelEditBtn = document.getElementById('cancel-edit');
        
        // 表单字段
        this.taskNameInput = document.getElementById('task-name');
        this.taskDescriptionInput = document.getElementById('task-description');
        this.skipPermissionsCheckbox = document.getElementById('skip-permissions');
        this.verboseLogsCheckbox = document.getElementById('verbose-logs');
        this.resourceList = document.getElementById('resource-list');
        this.executeImmediateRadio = document.getElementById('execute-immediate');
        this.executeScheduledRadio = document.getElementById('execute-scheduled');
        this.scheduleSettings = document.getElementById('schedule-settings');
        this.scheduleFrequency = document.getElementById('schedule-frequency');
        this.scheduleTime = document.getElementById('schedule-time');
        
        // 资源选择相关
        this.browseFilesBtn = document.getElementById('browse-files');
        this.browseFoldersBtn = document.getElementById('browse-folders');
        this.manualPathInput = document.getElementById('manual-path');
        this.addManualPathBtn = document.getElementById('add-manual-path');
        
    }

    /**
     * 初始化事件监听器
     */
    initEventListeners() {
        // 模态框关闭事件
        if (this.modalCloseBtn) {
            this.modalCloseBtn.addEventListener('click', () => {
                this.closeModal();
            });
        }
        
        // Modal overlay click to close removed for better UX - only close button closes modal
        
        // 新增任务按钮
        if (this.addTaskBtn) {
            this.addTaskBtn.addEventListener('click', () => {
                this.showAddTaskForm();
            });
        }
        
        // 详情视图操作按钮
        if (this.editTaskBtn) {
            this.editTaskBtn.addEventListener('click', () => {
                this.editSelectedTask();
            });
        }
        
        if (this.executeTaskBtn) {
            this.executeTaskBtn.addEventListener('click', () => {
                this.executeSelectedTask();
            });
        }
        
        // 表单取消按钮
        const cancelButtons = [this.cancelAddTaskBtn, this.cancelTaskBtn, this.cancelEditBtn];
        cancelButtons.forEach(btn => {
            if (btn) {
                btn.addEventListener('click', () => {
                    this.showEmptyView();
                });
            }
        });
        
        // 表单提交
        if (this.taskForm) {
            this.taskForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveTask();
            });
        }
        
        // 执行方式切换
        if (this.executeImmediateRadio && this.executeScheduledRadio) {
            this.executeImmediateRadio.addEventListener('change', () => {
                this.toggleScheduleSettings();
            });
            
            this.executeScheduledRadio.addEventListener('change', () => {
                this.toggleScheduleSettings();
            });
        }
        
        // 资源文件操作
        if (this.browseFilesBtn) {
            this.browseFilesBtn.addEventListener('click', () => {
                this.browseFiles();
            });
        }
        
        if (this.browseFoldersBtn) {
            this.browseFoldersBtn.addEventListener('click', () => {
                this.browseFolders();
            });
        }
        
        if (this.addManualPathBtn) {
            this.addManualPathBtn.addEventListener('click', () => {
                this.addManualPath();
            });
        }

        // 独立新建任务弹窗事件监听
        this.initStandaloneAddModalListeners();
        
        // 独立任务详情弹窗事件监听
        this.initStandaloneDetailModalListeners();
        
        // 注册语言切换刷新方法
        if (window.i18n) {
            window.i18n.registerComponent('taskManager', () => {
                this.renderTasksList();
                this.renderSidebarTasksList(); // 同时刷新侧边栏任务列表
                // 如果当前显示详情视图，重新渲染详情
                if (this.currentView === 'detail' && this.selectedTaskId) {
                    this.showTaskDetail(this.selectedTaskId);
                }
                // 重新触发任务更新事件，确保Dashboard统计数据正确
                document.dispatchEvent(new CustomEvent('tasksUpdated', {
                    detail: { tasks: this.tasks }
                }));
            });
        }

        // Daily task role selection event listener
        const dailyRoleSelect = document.getElementById('daily-role-select');
        if (dailyRoleSelect) {
            dailyRoleSelect.addEventListener('change', (e) => {
                this.handleRoleChange(e.target.value, 'daily');
            });
        }
    }

    /**
     * 初始化独立新建任务弹窗事件监听器
     */
    initStandaloneAddModalListeners() {
        // 关闭按钮
        const closeBtn = document.getElementById('standalone-add-task-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeStandaloneAddModal();
            });
        }

        // 取消按钮
        const cancelBtn = document.getElementById('standalone-cancel-task');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.closeStandaloneAddModal();
            });
        }

        // 点击外部区域关闭弹窗
        const modal = document.getElementById('standalone-add-task-modal');
        if (modal) {
            // Modal overlay click to close removed for better UX - only close button closes modal
        }

        // 创建按钮
        const createBtn = document.getElementById('standalone-create-task');
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                this.saveStandaloneTask();
            });
        }

        // 表单提交
        const form = document.getElementById('standalone-task-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveStandaloneTask();
            });
        }

        // 执行方式切换
        const immediateRadio = document.getElementById('standalone-execute-immediate');
        const scheduledRadio = document.getElementById('standalone-execute-scheduled');
        if (immediateRadio && scheduledRadio) {
            immediateRadio.addEventListener('change', () => {
                this.toggleStandaloneScheduleSettings();
            });
            
            scheduledRadio.addEventListener('change', () => {
                this.toggleStandaloneScheduleSettings();
            });
        }

        // 资源文件操作
        const browseFilesBtn = document.getElementById('standalone-browse-files');
        if (browseFilesBtn) {
            browseFilesBtn.addEventListener('click', () => {
                this.browseStandaloneFiles();
            });
        }

        const browseFoldersBtn = document.getElementById('standalone-browse-folders');
        if (browseFoldersBtn) {
            browseFoldersBtn.addEventListener('click', () => {
                this.browseStandaloneFolders();
            });
        }

        const addPathBtn = document.getElementById('standalone-add-manual-path');
        if (addPathBtn) {
            addPathBtn.addEventListener('click', () => {
                this.addStandaloneManualPath();
            });
        }

        // 延迟初始化通知选项，确保在加载完成后执行
        setTimeout(() => {
            this.renderNotificationOptions('standalone');
            this.renderNotificationOptions('standalone-edit');
        }, 500);

        // Role selection event listener
        const roleSelect = document.getElementById('standalone-role-select');
        if (roleSelect) {
            roleSelect.addEventListener('change', (e) => {
                this.handleRoleChange(e.target.value, 'standalone');
            });
        }

    }

    /**
     * 初始化独立任务详情弹窗事件监听器
     */
    initStandaloneDetailModalListeners() {
        // 关闭按钮
        const closeBtn = document.getElementById('standalone-task-detail-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeStandaloneDetailModal();
            });
        }

        // 点击外部区域关闭弹窗
        const modal = document.getElementById('standalone-task-detail-modal');
        if (modal) {
            // Modal overlay click to close removed for better UX - only close button closes modal
        }

        // 详情视图的编辑按钮
        const editBtn = document.getElementById('standalone-edit-task-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                const task = this.tasks.find(t => t.id === this.selectedTaskId);
                if (task) {
                    this.showStandaloneEditForm(task);
                }
            });
        }

        // 详情视图的执行按钮
        const executeBtn = document.getElementById('standalone-execute-task-btn');
        if (executeBtn) {
            executeBtn.addEventListener('click', () => {
                this.executeStandaloneTask();
            });
        }

        // 详情视图的删除按钮
        const deleteBtn = document.getElementById('standalone-delete-task-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (this.selectedTaskId) {
                    this.deleteTask(this.selectedTaskId).then(() => {
                        // 删除成功后关闭详情面板
                        this.closeStandaloneDetailModal();
                    });
                }
            });
        }

        // 详情页脚关闭按钮
        const cancelDetailBtn = document.getElementById('standalone-cancel-detail');
        if (cancelDetailBtn) {
            cancelDetailBtn.addEventListener('click', () => {
                this.closeStandaloneDetailModal();
            });
        }

        // 编辑页脚取消按钮
        const cancelEditBtn = document.getElementById('standalone-cancel-edit');
        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', () => {
                const task = this.tasks.find(t => t.id === this.selectedTaskId);
                if (task) {
                    this.showStandaloneTaskDetail(task);
                }
            });
        }

        // 编辑页脚保存按钮
        const saveEditBtn = document.getElementById('standalone-save-edit');
        if (saveEditBtn) {
            saveEditBtn.addEventListener('click', () => {
                this.saveStandaloneEditTask();
            });
        }

        // 编辑表单提交
        const editForm = document.getElementById('standalone-edit-form');
        if (editForm) {
            editForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveStandaloneEditTask();
            });
        }

        // 编辑表单执行方式切换
        const editImmediateRadio = document.getElementById('standalone-edit-execute-immediate');
        const editScheduledRadio = document.getElementById('standalone-edit-execute-scheduled');
        if (editImmediateRadio && editScheduledRadio) {
            editImmediateRadio.addEventListener('change', () => {
                this.toggleStandaloneEditScheduleSettings();
            });
            
            editScheduledRadio.addEventListener('change', () => {
                this.toggleStandaloneEditScheduleSettings();
            });
        }

        // 编辑表单资源文件操作
        const editBrowseFilesBtn = document.getElementById('standalone-edit-browse-files');
        if (editBrowseFilesBtn) {
            editBrowseFilesBtn.addEventListener('click', () => {
                this.browseStandaloneEditFiles();
            });
        }

        const editBrowseFoldersBtn = document.getElementById('standalone-edit-browse-folders');
        if (editBrowseFoldersBtn) {
            editBrowseFoldersBtn.addEventListener('click', () => {
                this.browseStandaloneEditFolders();
            });
        }

        const editAddPathBtn = document.getElementById('standalone-edit-add-manual-path');
        if (editAddPathBtn) {
            editAddPathBtn.addEventListener('click', () => {
                this.addStandaloneEditManualPath();
            });
        }

    }

    /**
     * 加载任务列表
     */
    async loadTasks() {
        try {
            const response = await fetch('/api/tasks');
            if (response.ok) {
                const data = await response.json();
                // 后端返回格式是 {tasks: [...]}，需要提取tasks数组
                this.tasks = Array.isArray(data.tasks) ? data.tasks : (Array.isArray(data) ? data : []);
                
                
                // 详细检查每个任务的sessionId
                this.tasks.forEach((task, index) => {
                    console.log(`🔍 任务${index + 1} [${task.id}] ${task.name}:`, {
                        sessionId: task.sessionId,
                        hasSessionId: !!task.sessionId,
                        lastRun: task.lastRun,
                        workDirectory: task.workDirectory
                    });
                });
                
                this.renderTasksList();
                this.renderSidebarTasksList();
                
                // 通知抽屉管理器更新任务数量
                document.dispatchEvent(new CustomEvent('tasksUpdated', {
                    detail: { tasks: this.tasks }
                }));
            } else {
                console.error('加载任务失败:', response.statusText);
                this.tasks = [];
                this.renderEmptyTasksList();
                this.renderSidebarTasksList();
                
                // 通知抽屉管理器更新任务数量（即使是空列表）
                document.dispatchEvent(new CustomEvent('tasksUpdated', {
                    detail: { tasks: this.tasks }
                }));
            }
        } catch (error) {
            console.error('加载任务失败:', error);
            this.tasks = [];
            this.renderEmptyTasksList();
            this.renderSidebarTasksList();
            
            // 通知抽屉管理器更新任务数量（即使是空列表）
            document.dispatchEvent(new CustomEvent('tasksUpdated', {
                detail: { tasks: this.tasks }
            }));
        }
    }

    /**
     * 渲染任务列表
     */
    renderTasksList() {
        if (!this.tasksList) return;
        
        if (this.tasks.length === 0) {
            this.renderEmptyTasksList();
            return;
        }
        
        this.tasksList.innerHTML = this.tasks.map(task => {
            // 确保任务对象有完整的属性，适配后端驼峰命名
            const safeTask = {
                id: task.id || '',
                name: task.name || t('task.unnamed'),
                goal: task.goal || '',
                enabled: task.enabled !== false,
                schedule_frequency: task.scheduleFrequency || 'immediate',  // 后端返回驼峰命名
                resources: Array.isArray(task.resources) ? task.resources : []
            };
            
            const taskStatus = this.getTaskStatus(safeTask);
            
            return `
                <div class="task-item" data-task-id="${safeTask.id}" onclick="taskManager.selectTask('${safeTask.id}')">
                    <div class="task-item-header">
                        <div class="task-item-name">${this.escapeHtml(safeTask.name)}</div>
                        <div class="task-item-actions">
                            <span class="task-item-status ${taskStatus.class}">
                                ${taskStatus.text}
                            </span>
                            <button class="delete-task-btn" onclick="event.stopPropagation(); taskManager.deleteTask('${safeTask.id}')" title="删除任务">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14ZM10 11v6M14 11v6"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    ${safeTask.goal && safeTask.goal !== safeTask.name ? `<div class="task-item-goal">${this.escapeHtml(safeTask.goal)}</div>` : ''}
                    <div class="task-item-meta">
                        ${safeTask.resources.length > 0 ? `<span>${safeTask.resources.length} ${t('task.resourceFiles')}</span>` : `<span>${t('task.noResourceFiles')}</span>`}
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * 获取任务状态
     */
    getTaskStatus(task) {
        // 检查是否有对应的页签在运行
        if (this.isTaskRunning(task.id)) {
            return {
                text: t('task.inProgress'),
                class: 'running'
            };
        }
        
        // 定时任务显示"定时"
        if (task.schedule_frequency !== 'immediate') {
            return {
                text: t('task.scheduled'),
                class: 'scheduled'
            };
        }
        
        // 立即执行任务且无页签则显示"完成"
        return {
            text: t('task.completed'),
            class: 'completed'
        };
    }

    /**
     * 构建任务状态信息HTML
     */
    buildStatusInfo(safeTask) {
        const taskStatus = this.getTaskStatus(safeTask);
        
        // 构建执行状态部分
        const statusHTML = `<div class="status-item">
            <span class="task-item-status ${taskStatus.class}">
                ${taskStatus.text}
            </span>
        </div>`;
        
        // 构建执行选项部分
        const optionsHTML = [];
        
        if (safeTask.skip_permissions) {
            optionsHTML.push(`<span class="status-option auto-mode">${t('task.autoMode')}</span>`);
        }
        
        if (safeTask.verbose_logs) {
            optionsHTML.push(`<span class="status-option verbose-logs">${t('task.verboseLogsMode')}</span>`);
        }
        
        const optionsSection = optionsHTML.length > 0 
            ? `<div class="status-options">${optionsHTML.join('')}</div>`
            : '';
        
        return `<div class="status-info-container">
            ${statusHTML}
            ${optionsSection}
        </div>`;
    }

    /**
     * 检查任务是否正在运行（通过页签判断）
     */
    isTaskRunning(taskId) {
        // 查找是否有对应的任务页签
        const taskTab = document.querySelector(`#tab_task_${taskId}`);
        return taskTab !== null;
    }

    /**
     * 删除任务
     */
    async deleteTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) {
            console.error(t('task.deleteNotFound'));
            return;
        }

        // 确认对话框
        if (!confirm(`确定要删除任务"${task.name}"吗？`)) {
            return;
        }

        try {
            const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                // 重新加载任务列表
                this.loadTasks();
            } else {
                const errorData = await response.json();
                console.error('❌ 删除任务失败:', errorData.error);
                alert(`删除失败: ${errorData.error}`);
            }
        } catch (error) {
            console.error('❌ 删除任务出错:', error);
            alert(t('task.networkError'));
        }
    }

    /**
     * 渲染空任务列表
     */
    renderEmptyTasksList() {
        if (!this.tasksList) return;
        
        this.tasksList.innerHTML = `
            <div class="empty-tasks">
                <div class="empty-icon">📝</div>
                <p>尚未设置任何任务</p>
                <p class="text-muted">${t('task.addFirst')}</p>
            </div>
        `;
    }

    /**
     * 渲染侧边栏任务列表
     */
    renderSidebarTasksList() {
        const sidebarTasksList = document.getElementById('tasks-list');
        if (!sidebarTasksList) return;

        if (this.tasks.length === 0) {
            sidebarTasksList.innerHTML = `
                <div class="empty-tasks">
                    <p>${t('task.noTasksEmpty')}</p>
                    <button class="create-first-task-btn" onclick="window.taskManager && window.taskManager.showQuickAddTask()">${t('task.createFirst')}</button>
                </div>
            `;
        } else {
            // 显示所有任务
            const displayTasks = this.tasks;
            
            sidebarTasksList.innerHTML = displayTasks.map(task => {
                const safeTask = {
                    id: task.id || '',
                    name: task.name || t('task.unnamed'),
                    goal: task.goal || '',
                    enabled: task.enabled !== false,
                    status: task.status || 'pending',
                    schedule_frequency: task.scheduleFrequency || 'immediate',
                    resources: Array.isArray(task.resources) ? task.resources : []
                };

                const taskStatus = this.getTaskStatus(safeTask);

                return `
                    <div class="task-item" data-task-id="${safeTask.id}" onclick="window.taskManager && window.taskManager.showTaskDetails('${safeTask.id}')">
                        <div class="task-item-header">
                            <div class="task-item-name">${this.escapeHtml(safeTask.name)}</div>
                            <div class="task-item-actions">
                                <span class="task-item-status ${taskStatus.class}">
                                    ${taskStatus.text}
                                </span>
                                <button class="delete-task-btn" onclick="event.stopPropagation(); taskManager.deleteTask('${safeTask.id}')" title="删除任务">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14ZM10 11v6M14 11v6"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        ${safeTask.goal && safeTask.goal !== safeTask.name ? `<div class="task-item-goal">${this.escapeHtml(safeTask.goal)}</div>` : ''}
                        <div class="task-item-meta">
                            ${safeTask.resources.length > 0 ? `<span>${safeTask.resources.length} ${t('task.resourceFiles')}</span>` : `<span>${t('task.noResourceFiles')}</span>`}
                        </div>
                    </div>
                `;
            }).join('');
        }

        // 任务板块不再使用动态高度控制，改为CSS默认布局
    }

    /**
     * 通知抽屉管理器更新高度
     */
    notifyDrawerHeightUpdate(drawerName) {
        // 使用短延迟确保DOM更新完成
        setTimeout(() => {
            if (window.sidebarDrawers) {
                window.sidebarDrawers.recalculateDrawerHeight(drawerName);
                console.log(` 已通知抽屉管理器重新计算 ${drawerName} 抽屉高度`);
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
     * 选择任务
     */
    selectTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        
        this.selectedTaskId = taskId;
        this.updateTaskSelection();
        this.showTaskDetail(task);
    }

    /**
     * 更新任务选中状态
     */
    updateTaskSelection() {
        const taskItems = this.tasksList.querySelectorAll('.task-item');
        taskItems.forEach(item => {
            if (item.dataset.taskId === this.selectedTaskId) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    /**
     * 显示任务详情
     */
    showTaskDetail(task) {
        this.currentView = 'detail';
        this.updateViewVisibility();
        
        // 使用标准化方法确保数据一致性
        const safeTask = this.normalizeTaskData(task);
        safeTask.name = safeTask.name || '未命名任务';
        safeTask.goal = safeTask.goal || t('task.noDescription');
        
        if (this.detailTaskName) this.detailTaskName.textContent = safeTask.name;
        if (this.detailTaskRole) this.detailTaskRole.textContent = safeTask.role || t('task.noRole', '无角色');
        if (this.detailTaskGoal) this.detailTaskGoal.textContent = safeTask.goal;
        
        // 添加目标设定显示
        const detailGoalConfig = document.getElementById('detail-goal-config');
        if (detailGoalConfig) {
            detailGoalConfig.textContent = safeTask.goal_config || t('task.noGoalConfig', '未设置专业目标');
        }
        if (this.detailExecutionMode) {
            this.detailExecutionMode.textContent = safeTask.schedule_frequency === 'immediate' 
                ? t('task.immediate') 
                : `${t('task.scheduledExecution')} ${safeTask.schedule_frequency === 'daily' ? t('task.scheduleDaily') : t('task.scheduleWeekly')} ${safeTask.schedule_time}`;
        }
        if (this.detailResources) {
            this.detailResources.innerHTML = safeTask.resources.length > 0 
                ? safeTask.resources.map(resource => `<div class="detail-value code">${this.escapeHtml(resource)}</div>`).join('')
                : `<span class="text-muted">${t('task.noResourceFiles')}</span>`;
        }
        if (this.detailStatus) {
            this.detailStatus.innerHTML = this.buildStatusInfo(safeTask);
        }
    }

    /**
     * 构建任务状态信息 - 基于字段配置动态生成
     * 新增方法，修复缺失的buildStatusInfo调用
     */
    buildStatusInfo(task) {
        const statusItems = [];
        
        // 角色信息
        const roleDisplay = this.getRoleDisplayName(task.role);
        statusItems.push(`<div class="status-item"><strong>${t('task.roleLabel', '选择角色')}:</strong> ${roleDisplay}</div>`);
        
        // 执行模式
        let executionText = task.schedule_frequency === 'immediate' 
            ? t('task.immediate', '立即执行')
            : `${t('task.scheduledExecution', '定时执行')} ${task.schedule_time}`;
        statusItems.push(`<div class="status-item"><strong>${t('task.executionModeLabel', '执行方式')}:</strong> ${executionText}</div>`);
        
        // 权限设置
        const skipPermText = task.skip_permissions ? t('common.yes', '是') : t('common.no', '否');
        statusItems.push(`<div class="status-item"><strong>${t('task.skipPermissionsLabel', '跳过权限检查')}:</strong> ${skipPermText}</div>`);
        
        // 日志设置
        const verboseText = task.verbose_logs ? t('common.enabled', '启用') : t('common.disabled', '关闭');
        statusItems.push(`<div class="status-item"><strong>${t('task.verboseLogsLabel', '详细日志')}:</strong> ${verboseText}</div>`);
        
        // 任务状态
        const enabledText = task.enabled !== false ? t('common.enabled', '启用') : t('common.disabled', '禁用');
        statusItems.push(`<div class="status-item"><strong>${t('task.statusLabel', '任务状态')}:</strong> ${enabledText}</div>`);
        
        return statusItems.join('');
    }

    /**
     * 获取角色显示名称
     * 将角色ID映射为对应的本地化名称
     */
    getRoleDisplayName(roleId) {
        if (!roleId) return t('task.noRole', '无角色');
        
        // 角色ID到国际化键的映射
        const roleI18nKeyMap = {
            'info-collector': 'roles.infoCollector',
            'sales-specialist': 'roles.salesSpecialist',
            'content-operations': 'roles.contentOperations',
            'customer-service': 'roles.customerService',
            'market-researcher': 'roles.marketResearcher',
            'data-analyst': 'roles.dataAnalyst',
            'ai-product-manager': 'roles.productManager',
            'finance-assistant': 'roles.financeAssistant',
            'work-assistant': 'roles.workAssistant',
            'fullstack-engineer': 'roles.fullstackEngineer',
            'document-manager': 'roles.documentManager',
            'mcp-manager': 'roles.mcpManager',
            'work-verifier': 'roles.workVerifier'
        };
        
        const i18nKey = roleI18nKeyMap[roleId];
        return i18nKey ? t(i18nKey, roleId) : roleId;
    }

    /**
     * 数据标准化方法 - 统一字段命名约定
     * 将后端驼峰命名转换为前端处理需要的格式
     */
    normalizeTaskData(task) {
        if (!task) return {};
        
        return {
            // 保持原有字段名
            id: task.id,
            name: task.name || '',
            goal: task.goal || '',
            role: task.role || '',
            goal_config: task.goal_config || '',
            enabled: task.enabled !== false,
            createdAt: task.createdAt,
            lastRun: task.lastRun,
            workDirectory: task.workDirectory,
            sessionId: task.sessionId,
            
            // 标准化驼峰命名字段
            skipPermissions: task.skipPermissions || false,
            verboseLogs: task.verboseLogs || false,
            scheduleFrequency: task.scheduleFrequency || 'immediate',
            scheduleTime: task.scheduleTime || '09:00',
            executionMode: task.executionMode || 'immediate',
            resources: Array.isArray(task.resources) ? task.resources : [],
            
            // 同时保留下划线命名以兼容现有代码
            skip_permissions: task.skipPermissions || false,
            verbose_logs: task.verboseLogs || false,
            schedule_frequency: task.scheduleFrequency || 'immediate',
            schedule_time: task.scheduleTime || '09:00'
        };
    }

    /**
     * 将前端表单数据转换为后端API期望的格式
     * 确保发送给后端的数据使用正确的驼峰命名
     */
    normalizeForBackend(formData) {
        return {
            name: formData.name,
            goal: formData.goal,
            role: formData.role || '',
            goal_config: formData.goal_config || '',
            skipPermissions: formData.skipPermissions || false,          // 后端期望驼峰命名
            verboseLogs: formData.verboseLogs || false,                  // 后端期望驼峰命名
            scheduleFrequency: formData.scheduleFrequency || 'immediate', // 后端期望驼峰命名
            scheduleTime: formData.scheduleTime || '09:00',              // 后端期望驼峰命名
            executionMode: formData.executionMode || 'immediate',
            resources: formData.resources || [],
            enabled: formData.enabled !== false
        };
    }

    /**
     * 显示新增任务表单
     */
    showAddTaskForm() {
        this.currentEditingTask = null;
        this.currentView = 'form';
        this.updateViewVisibility();
        this.resetForm();
        
        // 更新表单标题和按钮文本
        const formTitle = document.getElementById('form-title');
        if (formTitle) formTitle.textContent = '新增每日任务';
        
        const submitBtn = document.getElementById('create-task');
        if (submitBtn) submitBtn.textContent = '确定创建';
        
        // 聚焦到任务名称输入框
        if (this.taskNameInput) {
            setTimeout(() => this.taskNameInput.focus(), 100);
        }
    }

    /**
     * 编辑选中的任务
     */
    editSelectedTask() {
        const task = this.tasks.find(t => t.id === this.selectedTaskId);
        if (!task) return;
        
        this.currentEditingTask = task;
        this.currentView = 'form';
        this.updateViewVisibility();
        this.fillFormWithTask(task);
        
        // 更新表单标题和按钮文本
        const formTitle = document.getElementById('form-title');
        if (formTitle) formTitle.textContent = '编辑任务';
        
        const submitBtn = document.getElementById('create-task');
        if (submitBtn) submitBtn.textContent = '保存修改';
    }

    /**
     * 显示空视图
     */
    showEmptyView() {
        this.currentView = 'empty';
        this.selectedTaskId = null;
        this.updateViewVisibility();
        this.updateTaskSelection();
    }

    /**
     * 更新视图可见性
     */
    updateViewVisibility() {
        // 隐藏所有视图
        if (this.taskDetailEmpty) this.taskDetailEmpty.classList.add('hidden');
        if (this.taskDetailView) this.taskDetailView.classList.add('hidden');
        if (this.addTaskForm) this.addTaskForm.classList.add('hidden');
        
        // 显示当前视图
        switch (this.currentView) {
            case 'empty':
                if (this.taskDetailEmpty) this.taskDetailEmpty.classList.remove('hidden');
                break;
            case 'detail':
                if (this.taskDetailView) this.taskDetailView.classList.remove('hidden');
                break;
            case 'form':
                if (this.addTaskForm) this.addTaskForm.classList.remove('hidden');
                break;
        }
    }

    /**
     * 用任务数据填充表单
     */
    fillFormWithTask(task) {
        // 使用标准化方法确保数据一致性
        const safeTask = this.normalizeTaskData(task);
        
        if (this.taskNameInput) this.taskNameInput.value = safeTask.name;
        if (this.taskDescriptionInput) this.taskDescriptionInput.value = safeTask.goal;
        
        // 设置角色选择
        const roleSelect = document.getElementById('daily-role-select');
        if (roleSelect && safeTask.role) {
            roleSelect.value = safeTask.role;
        }
        
        // 设置目标配置
        const goalConfigTextarea = document.getElementById('daily-goal-config');
        if (goalConfigTextarea) {
            goalConfigTextarea.value = safeTask.goal_config || '';
        }
        
        if (this.skipPermissionsCheckbox) this.skipPermissionsCheckbox.checked = safeTask.skip_permissions;
        if (this.verboseLogsCheckbox) this.verboseLogsCheckbox.checked = safeTask.verbose_logs || false;
        
        // 设置执行方式
        if (safeTask.schedule_frequency === 'immediate') {
            if (this.executeImmediateRadio) this.executeImmediateRadio.checked = true;
        } else {
            if (this.executeScheduledRadio) this.executeScheduledRadio.checked = true;
            if (this.scheduleFrequency) this.scheduleFrequency.value = safeTask.schedule_frequency;
            if (this.scheduleTime) this.scheduleTime.value = safeTask.schedule_time;
        }
        
        this.toggleScheduleSettings();
        
        // 设置资源文件
        this.resources = [...safeTask.resources];
        this.renderResourceList();
    }

    /**
     * 重置表单
     */
    resetForm() {
        if (this.taskForm) this.taskForm.reset();
        this.resources = [];
        this.renderResourceList();
        this.toggleScheduleSettings();
    }

    /**
     * 切换定时设置显示
     */
    toggleScheduleSettings() {
        if (!this.scheduleSettings) return;
        
        const isScheduled = this.executeScheduledRadio && this.executeScheduledRadio.checked;
        this.scheduleSettings.style.display = isScheduled ? 'block' : 'none';
    }

    /**
     * 渲染资源列表
     */
    renderResourceList() {
        if (!this.resourceList) return;
        
        if (this.resources.length === 0) {
            this.resourceList.innerHTML = `<div class="text-muted">${t('task.noResources')}</div>`;
            return;
        }
        
        this.resourceList.innerHTML = this.resources.map((resource, index) => `
            <div class="resource-item">
                <span class="resource-path">${this.escapeHtml(resource)}</span>
                <button type="button" class="btn-link" onclick="taskManager.removeResource(${index})">
                    移除
                </button>
            </div>
        `).join('');
    }

    /**
     * 添加手动路径
     */
    addManualPath() {
        if (!this.manualPathInput) return;
        
        const path = this.manualPathInput.value.trim();
        if (path && !this.resources.includes(path)) {
            this.resources.push(path);
            this.renderResourceList();
            this.manualPathInput.value = '';
        }
    }

    /**
     * 移除资源
     */
    removeResource(index) {
        this.resources.splice(index, 1);
        this.renderResourceList();
    }

    /**
     * 浏览文件
     */
    browseFiles() {
        // 创建隐藏的文件输入元素
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.style.display = 'none';
        
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            files.forEach(file => {
                // 对于单个文件选择，只能获取文件名（浏览器安全限制）
                const path = file.name;
                console.log(`添加文件: ${file.name} (仅文件名，如需完整路径请手动输入)`);
                
                if (!this.resources.includes(path)) {
                    this.resources.push(path);
                }
            });
            this.renderResourceList();
            // 清理DOM元素
            if (document.body.contains(fileInput)) {
                document.body.removeChild(fileInput);
            }
        });
        
        // 添加到DOM并触发点击
        document.body.appendChild(fileInput);
        fileInput.click();
    }

    /**
     * 浏览文件夹
     */
    async browseFolders() {
        try {
            // 优先使用现代File System Access API
            if ('showDirectoryPicker' in window) {
                const dirHandle = await window.showDirectoryPicker();
                // 尝试构建相对路径，如果无法获取完整路径，提示用户手动输入
                const folderName = dirHandle.name;
                console.log('选择的文件夹:', folderName);
                
                // 因为浏览器安全限制，无法直接获取完整路径
                // 提示用户确认路径或手动输入完整路径
                const userConfirm = confirm(`已选择文件夹: "${folderName}"\n\n由于浏览器安全限制，请确认：\n1. 如果文件夹在当前工作目录下，点击确定\n2. 如果需要输入完整路径，点击取消后手动输入`);
                
                if (userConfirm) {
                    if (!this.resources.includes(folderName)) {
                        this.resources.push(folderName);
                        this.renderResourceList();
                    }
                }
            } else {
                // 回退到webkitdirectory API
                const folderInput = document.createElement('input');
                folderInput.type = 'file';
                folderInput.webkitdirectory = true;
                folderInput.multiple = true;
                folderInput.style.display = 'none';
                
                folderInput.addEventListener('change', (e) => {
                    const files = Array.from(e.target.files);
                    if (files.length > 0) {
                        // 获取完整的相对路径
                        const firstFile = files[0];
                        let folderPath = '';
                        
                        if (firstFile.webkitRelativePath) {
                            // 从第一个文件的路径提取文件夹路径
                            const pathParts = firstFile.webkitRelativePath.split('/');
                            console.log('webkitRelativePath:', firstFile.webkitRelativePath);
                            console.log('pathParts:', pathParts);
                            
                            if (pathParts.length > 1) {
                                // 移除文件名，保留文件夹路径
                                pathParts.pop();
                                folderPath = pathParts.join('/');
                            } else {
                                folderPath = pathParts[0];
                            }
                            console.log('提取的文件夹路径:', folderPath);
                        } else {
                            // 如果无法获取路径，使用文件夹名
                            folderPath = firstFile.name || 'selected_folder';
                            console.log('无法获取webkitRelativePath，使用默认:', folderPath);
                        }
                        
                        if (folderPath && !this.resources.includes(folderPath)) {
                            this.resources.push(folderPath);
                            this.renderResourceList();
                        }
                    }
                    // 清理DOM元素
                    if (document.body.contains(folderInput)) {
                        document.body.removeChild(folderInput);
                    }
                });
                
                // 添加到DOM并触发点击
                document.body.appendChild(folderInput);
                folderInput.click();
            }
        } catch (error) {
            // 用户取消选择或出现错误，静默处理
            console.log('文件夹选择被取消或出现错误');
        }
    }

    /**
     * 保存任务
     */
    async saveTask() {
        const taskData = this.collectTaskData();
        if (!taskData) return;
        
        try {
            const isEdit = !!this.currentEditingTask;
            const url = isEdit ? `/api/tasks/${this.currentEditingTask.id}` : '/api/tasks';
            const method = isEdit ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(taskData)
            });
            
            if (response.ok) {
                const savedTask = await response.json();
                console.log('任务保存成功:', savedTask);
                
                // 更新任务列表
                // 确保this.tasks是数组
                if (!Array.isArray(this.tasks)) {
                    this.tasks = [];
                }
                
                if (isEdit) {
                    const index = this.tasks.findIndex(t => t.id === this.currentEditingTask.id);
                    if (index !== -1) {
                        this.tasks[index] = savedTask;
                    }
                } else {
                    this.tasks.push(savedTask);
                }
                
                this.renderTasksList();
                this.renderSidebarTasksList();
                this.selectTask(savedTask.id);
                
                // 通知仪表板更新任务统计
                document.dispatchEvent(new CustomEvent('tasksUpdated', {
                    detail: { tasks: this.tasks }
                }));
                
            } else {
                const error = await response.json();
                alert(t('task.saveFailed') + ': ' + (error.error || t('error.unknown')));
            }
        } catch (error) {
            console.error('保存任务失败:', error);
            alert(t('task.saveFailed') + ': ' + error.message);
        }
    }

    /**
     * 收集表单数据
     */
    collectTaskData() {
        const name = this.taskNameInput?.value?.trim();
        const description = this.taskDescriptionInput?.value?.trim();
        
        if (!name || !description) {
            alert(t('task.fillNameAndGoal'));
            return null;
        }
        
        const skipPermissions = this.skipPermissionsCheckbox?.checked || false;
        const verboseLogs = this.verboseLogsCheckbox?.checked || false;
        const isImmediate = this.executeImmediateRadio?.checked || false;
        
        // Collect role and goal configuration
        const roleSelect = document.getElementById('daily-role-select');
        const goalConfigTextarea = document.getElementById('daily-goal-config');
        const selectedRole = roleSelect?.value || '';
        const goalConfig = goalConfigTextarea?.value?.trim() || '';
        
        // 使用后端期望的驼峰命名格式
        return {
            name: name,
            goal: description,
            role: selectedRole,
            goal_config: goalConfig,
            skipPermissions: skipPermissions,                    // 改为驼峰命名
            verboseLogs: verboseLogs,                           // 新增verbose字段
            resources: [...this.resources],
            scheduleFrequency: isImmediate ? 'immediate' : (this.scheduleFrequency?.value || 'daily'),  // 改为驼峰命名
            scheduleTime: isImmediate ? '' : (this.scheduleTime?.value || '09:00'),                    // 改为驼峰命名
            executionMode: isImmediate ? 'immediate' : 'scheduled',                                    // 新增字段
            enabled: true
        };
    }

    /**
     * 执行选中的任务
     */
    async executeSelectedTask() {
        const task = this.tasks.find(t => t.id === this.selectedTaskId);
        if (!task) {
            console.error('❌ 任务不存在:', this.selectedTaskId);
            alert(t('task.taskNotFound'));
            return;
        }
        
        // 检查任务是否启用
        if (!task.enabled) {
            console.warn('⚠️ 尝试执行已禁用的任务:', task.name);
            if (!confirm(`任务"${task.name}"当前已禁用，是否要启用并执行？`)) {
                return;
            }
            task.enabled = true;
        }
        
        console.log(' 执行任务:', task.name);
        
        // 验证资源文件
        if (task.resources && task.resources.length > 0) {
            console.log('[TASK] 任务资源文件:', task.resources);
        }
        
        // 检查WebSocket连接
        if (!window.websocketManager || !window.websocketManager.isConnected) {
            console.error('❌ WebSocket连接未建立');
            alert(t('task.systemConnectionError'));
            return;
        }
        
        try {
            // 更新最后执行时间
            task.lastRun = new Date().toISOString();
            // V2版本使用API存储，不需要手动保存到localStorage
            this.renderTasksList();
            
            // 构建Claude CLI命令
            const command = this.buildClaudeCommand(task);
            console.log('📝 构建的命令:', command);
            
            // 通过WebSocket通知后端创建新页签执行任务
            const sessionData = {
                type: 'new-task-session',
                taskId: task.id,
                taskName: task.name,
                command: command,
                skipPermissions: task.skip_permissions,
                verboseLogs: task.verbose_logs,
                role: task.role || '',
                goal_config: task.goal_config || '',
                resources: task.resources
            };
            
            console.log('📡 发送任务执行请求:', sessionData);
            console.log('🔔 WebSocket发送的完整命令:', sessionData.command);
            window.websocketManager.sendMessage(sessionData);
            
            // 显示执行反馈
            this.showExecutionFeedback(task.name);
            
            // 关闭模态框
            this.closeModal();
            
        } catch (error) {
            console.error('❌ 任务执行失败:', error);
            alert(t('task.executionFailedWithError') + error.message);
        }
    }
    
    /**
     * 构建Claude CLI命令
     */
    buildClaudeCommand(task) {
        let parts = [];
        
        // 1. 先添加文件引用（使用@语法）
        if (task.resources && task.resources.length > 0) {
            task.resources.forEach(resource => {
                // 使用@语法直接引用文件，Claude能直接读取文件内容
                parts.push(`@${resource}`);
            });
        }
        
        // 2. 添加空行分隔符
        if (parts.length > 0) {
            parts.push('');
        }
        
        // 3. 添加任务目标描述
        parts.push(task.goal);
        
        
        const finalCommand = parts.join(' ');
        return finalCommand;
    }
    
    /**
     * 显示执行反馈
     */
    showExecutionFeedback(taskName) {
        // 创建临时通知元素
        const notification = document.createElement('div');
        notification.className = 'task-execution-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon"></span>
                <span class="notification-text">${t('task.executing')}${this.escapeHtml(taskName)}</span>
            </div>
        `;
        
        // 添加样式
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 12px 16px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            z-index: 10000;
            animation: slideInRight 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease-out';
                setTimeout(() => {
                    notification.remove();
                }, 300);
            }
        }, 3000);
    }

    /**
     * 关闭模态框
     */
    closeModal() {
        if (this.modal) {
            this.modal.classList.remove('active');
            this.modal.classList.add('hidden');
            this.showEmptyView();
        }
    }

    /**
     * 快速添加任务（从侧边栏触发）
     */
    showQuickAddTask() {
        console.log(' 从侧边栏快速添加任务');
        
        // 打开独立的新建任务弹窗
        const modal = document.getElementById('standalone-add-task-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('active');
            this.resetStandaloneAddForm();
            
            // 聚焦到任务名称输入框
            const taskNameInput = document.getElementById('standalone-task-name');
            if (taskNameInput) {
                setTimeout(() => taskNameInput.focus(), 100);
            }
        }
    }

    /**
     * 显示任务详情（从侧边栏触发）
     */
    showTaskDetails(taskId) {
        console.log(' 从侧边栏查看任务详情:', taskId);
        
        // 查找任务数据
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) {
            console.warn('任务不存在:', taskId);
            return;
        }
        
        // 打开独立的任务详情弹窗
        const modal = document.getElementById('standalone-task-detail-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('active');
            
            // 设置当前编辑的任务ID
            this.selectedTaskId = taskId;
            
            // 显示任务详情视图
            this.showStandaloneTaskDetail(task);
        }
    }

    /**
     * 显示所有任务（从侧边栏触发）
     */
    showAllTasks() {
        console.log(' 从侧边栏查看所有任务');
        
        // 打开任务管理弹窗
        const modal = document.getElementById('daily-tasks-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('active');
            this.loadTasks(); // 刷新任务列表
        }
    }

    /**
     * 重置独立新建任务表单
     */
    resetStandaloneAddForm() {
        const form = document.getElementById('standalone-task-form');
        if (form) form.reset();
        
        // 重置资源列表
        this.standaloneResources = [];
        this.renderStandaloneResourceList();
        
        // 重置定时设置显示
        this.toggleStandaloneScheduleSettings();
    }

    /**
     * 显示独立任务详情
     */
    showStandaloneTaskDetail(task) {
        // 显示详情视图，隐藏编辑表单
        const detailView = document.getElementById('standalone-task-detail-view');
        const editForm = document.getElementById('standalone-edit-form');
        const detailFooter = document.getElementById('standalone-detail-footer');
        const editFooter = document.getElementById('standalone-edit-footer');
        
        if (detailView) detailView.classList.remove('hidden');
        if (editForm) editForm.classList.add('hidden');
        if (detailFooter) detailFooter.classList.remove('hidden');
        if (editFooter) editFooter.classList.add('hidden');
        
        // 填充详情数据
        const safeTask = {
            name: task.name || '未命名任务',
            goal: task.goal || t('task.noDescription'),
            role: task.role || '',
            goal_config: task.goal_config || task.goalConfig || '',
            schedule_frequency: task.scheduleFrequency || task.schedule_frequency || 'immediate',
            schedule_time: task.scheduleTime || task.schedule_time || '09:00',
            resources: Array.isArray(task.resources) ? task.resources : [],
            enabled: task.enabled !== false,
            skip_permissions: task.skipPermissions || task.skip_permissions || false,
            verbose_logs: task.verboseLogs || task.verbose_logs || false,
            session_id: task.sessionId || task.session_id || null
        };
        
        const nameEl = document.getElementById('standalone-detail-task-name');
        const goalEl = document.getElementById('standalone-detail-task-goal');
        const roleEl = document.getElementById('standalone-detail-task-role');
        const goalConfigEl = document.getElementById('standalone-detail-goal-config');
        const modeEl = document.getElementById('standalone-detail-execution-mode');
        const resourcesEl = document.getElementById('standalone-detail-resources');
        const statusEl = document.getElementById('standalone-detail-status');
        
        // Debug logging to check data values
        console.log('Task data for standalone detail:', {
            originalTask: task,
            safeTask: safeTask,
            roleValue: task.role,
            goalConfigValue: task.goal_config
        });
        
        if (nameEl) nameEl.textContent = safeTask.name;
        if (goalEl) goalEl.textContent = safeTask.goal;
        if (roleEl) roleEl.textContent = this.getRoleDisplayName(task.role);
        if (goalConfigEl) goalConfigEl.textContent = task.goal_config || '未设置专业目标';
        if (modeEl) {
            modeEl.textContent = safeTask.schedule_frequency === 'immediate' 
                ? t('task.immediate') 
                : `${t('task.scheduledExecution')} ${safeTask.schedule_frequency === 'daily' ? t('task.scheduleDaily') : t('task.scheduleWeekly')} ${safeTask.schedule_time}`;
        }
        if (resourcesEl) {
            resourcesEl.innerHTML = safeTask.resources.length > 0 
                ? safeTask.resources.map(resource => `<div class="detail-value code">${this.escapeHtml(resource)}</div>`).join('')
                : `<span class="text-muted">${t('task.noResourceFiles')}</span>`;
        }
        if (statusEl) {
            statusEl.innerHTML = this.buildStatusInfo(safeTask);
        }
        
        // 动态更新执行按钮文本
        const executeBtn = document.getElementById('standalone-execute-task-btn');
        if (executeBtn) {
            // 添加详细调试日志
            console.log('🔍 按钮更新调试:', {
                taskId: task.id,
                taskName: task.name,
                originalSessionId: task.sessionId,
                safeTaskSessionId: safeTask.session_id,
                taskFullData: task
            });
            
            if (safeTask.session_id) {
                executeBtn.textContent = t('task.continueTask');
                executeBtn.title = t('task.continueTaskTitle');
                console.log('✅ 按钮设置为"继续任务"，sessionId:', safeTask.session_id);
            } else {
                executeBtn.textContent = t('task.reExecute');
                executeBtn.title = t('task.reExecuteTitle');
                console.log('❌ 按钮设置为"重新执行"，无sessionId');
            }
        }
    }

    /**
     * 显示独立编辑表单
     */
    showStandaloneEditForm(task) {
        // 显示编辑表单，隐藏详情视图
        const detailView = document.getElementById('standalone-task-detail-view');
        const editForm = document.getElementById('standalone-edit-form');
        const detailFooter = document.getElementById('standalone-detail-footer');
        const editFooter = document.getElementById('standalone-edit-footer');
        
        if (detailView) detailView.classList.add('hidden');
        if (editForm) editForm.classList.remove('hidden');
        if (detailFooter) detailFooter.classList.add('hidden');
        if (editFooter) editFooter.classList.remove('hidden');
        
        // 填充表单数据
        this.fillStandaloneEditForm(task);
    }

    /**
     * 填充独立编辑表单
     */
    fillStandaloneEditForm(task) {
        const safeTask = {
            name: task.name || '',
            goal: task.goal || '',
            role: task.role || '',
            goal_config: task.goal_config || task.goalConfig || '',
            skip_permissions: task.skipPermissions || task.skip_permissions || false,
            verbose_logs: task.verboseLogs || task.verbose_logs || false,
            schedule_frequency: task.scheduleFrequency || task.schedule_frequency || 'immediate',
            schedule_time: task.scheduleTime || task.schedule_time || '09:00',
            resources: Array.isArray(task.resources) ? task.resources : []
        };
        
        const nameInput = document.getElementById('standalone-edit-task-name');
        const goalInput = document.getElementById('standalone-edit-task-goal');
        const roleSelect = document.getElementById('standalone-edit-role-select');
        const goalConfigInput = document.getElementById('standalone-edit-goal-config');
        const skipInput = document.getElementById('standalone-edit-skip-permissions');
        const verboseInput = document.getElementById('standalone-edit-verbose-logs');
        const immediateRadio = document.getElementById('standalone-edit-execute-immediate');
        const scheduledRadio = document.getElementById('standalone-edit-execute-scheduled');
        const frequencySelect = document.getElementById('standalone-edit-schedule-frequency');
        const timeInput = document.getElementById('standalone-edit-schedule-time');
        
        // Debug logging for edit form
        console.log('Task data for edit form:', {
            originalTask: task,
            roleValue: task.role,
            goalConfigValue: task.goal_config
        });
        
        if (nameInput) nameInput.value = safeTask.name;
        if (goalInput) goalInput.value = safeTask.goal;
        if (roleSelect) roleSelect.value = task.role || '';
        if (goalConfigInput) goalConfigInput.value = task.goal_config || '';
        if (skipInput) skipInput.checked = safeTask.skip_permissions;
        if (verboseInput) verboseInput.checked = safeTask.verbose_logs || false;
        
        // 设置执行方式
        if (safeTask.schedule_frequency === 'immediate') {
            if (immediateRadio) immediateRadio.checked = true;
        } else {
            if (scheduledRadio) scheduledRadio.checked = true;
            if (frequencySelect) frequencySelect.value = safeTask.schedule_frequency;
            if (timeInput) timeInput.value = safeTask.schedule_time;
        }
        
        this.toggleStandaloneEditScheduleSettings();
        
        // 设置资源文件
        this.standaloneEditResources = [...safeTask.resources];
        this.renderStandaloneEditResourceList();
        
        // 设置通知配置
        const notificationSettings = task.notificationSettings || { enabled: false, methods: [] };
        setTimeout(() => {
            let selectedType = 'none';
            if (notificationSettings.enabled && notificationSettings.methods.length > 0) {
                selectedType = notificationSettings.methods[0]; // 取第一个方法
            }
            
            const radio = document.querySelector(`input[name="standalone-edit-notification-type"][value="${selectedType}"]`);
            if (radio && !radio.disabled) {
                radio.checked = true;
            }
        }, 200);
    }

    /**
     * 渲染独立新建任务的资源列表
     */
    renderStandaloneResourceList() {
        const resourceList = document.getElementById('standalone-resource-list');
        if (!resourceList) return;
        
        if (!this.standaloneResources || this.standaloneResources.length === 0) {
            resourceList.innerHTML = `<div class="text-muted">${t('task.noResources')}</div>`;
            return;
        }
        
        resourceList.innerHTML = this.standaloneResources.map((resource, index) => `
            <div class="resource-item">
                <span class="resource-path">${this.escapeHtml(resource)}</span>
                <button type="button" class="btn-link" onclick="taskManager.removeStandaloneResource(${index})">
                    移除
                </button>
            </div>
        `).join('');
    }

    /**
     * 渲染独立编辑任务的资源列表
     */
    renderStandaloneEditResourceList() {
        const resourceList = document.getElementById('standalone-edit-resource-list');
        if (!resourceList) return;
        
        if (!this.standaloneEditResources || this.standaloneEditResources.length === 0) {
            resourceList.innerHTML = `<div class="text-muted">${t('task.noResources')}</div>`;
            return;
        }
        
        resourceList.innerHTML = this.standaloneEditResources.map((resource, index) => `
            <div class="resource-item">
                <span class="resource-path">${this.escapeHtml(resource)}</span>
                <button type="button" class="btn-link" onclick="taskManager.removeStandaloneEditResource(${index})">
                    移除
                </button>
            </div>
        `).join('');
    }

    /**
     * 切换独立新建任务的定时设置显示
     */
    toggleStandaloneScheduleSettings() {
        const scheduleSettings = document.getElementById('standalone-schedule-settings');
        const scheduledRadio = document.getElementById('standalone-execute-scheduled');
        if (!scheduleSettings) return;
        
        const isScheduled = scheduledRadio && scheduledRadio.checked;
        scheduleSettings.style.display = isScheduled ? 'block' : 'none';
    }

    /**
     * 切换独立编辑任务的定时设置显示
     */
    toggleStandaloneEditScheduleSettings() {
        const scheduleSettings = document.getElementById('standalone-edit-schedule-settings');
        const scheduledRadio = document.getElementById('standalone-edit-execute-scheduled');
        if (!scheduleSettings) return;
        
        const isScheduled = scheduledRadio && scheduledRadio.checked;
        scheduleSettings.style.display = isScheduled ? 'block' : 'none';
    }

    /**
     * 移除独立新建任务的资源
     */
    removeStandaloneResource(index) {
        if (!this.standaloneResources) this.standaloneResources = [];
        this.standaloneResources.splice(index, 1);
        this.renderStandaloneResourceList();
    }

    /**
     * 移除独立编辑任务的资源
     */
    removeStandaloneEditResource(index) {
        if (!this.standaloneEditResources) this.standaloneEditResources = [];
        this.standaloneEditResources.splice(index, 1);
        this.renderStandaloneEditResourceList();
    }

    /**
     * 添加独立新建任务的手动路径
     */
    addStandaloneManualPath() {
        const pathInput = document.getElementById('standalone-manual-path');
        if (!pathInput) return;
        
        const path = pathInput.value.trim();
        if (path) {
            if (!this.standaloneResources) this.standaloneResources = [];
            if (!this.standaloneResources.includes(path)) {
                this.standaloneResources.push(path);
                this.renderStandaloneResourceList();
                pathInput.value = '';
            }
        }
    }

    /**
     * 添加独立编辑任务的手动路径
     */
    addStandaloneEditManualPath() {
        const pathInput = document.getElementById('standalone-edit-manual-path');
        if (!pathInput) return;
        
        const path = pathInput.value.trim();
        if (path) {
            if (!this.standaloneEditResources) this.standaloneEditResources = [];
            if (!this.standaloneEditResources.includes(path)) {
                this.standaloneEditResources.push(path);
                this.renderStandaloneEditResourceList();
                pathInput.value = '';
            }
        }
    }

    /**
     * 保存独立新建任务
     */
    async saveStandaloneTask() {
        const taskData = this.collectStandaloneTaskData();
        if (!taskData) return;
        
        try {
            const response = await fetch('/api/tasks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(taskData)
            });
            
            if (response.ok) {
                const savedTask = await response.json();
                console.log('任务保存成功:', savedTask);
                
                // 关闭弹窗
                this.closeStandaloneAddModal();
                
                // 刷新任务列表
                this.loadTasks();
                
                // 显示成功提示
                this.showExecutionFeedback(`${t('task.createSuccess')}: "${savedTask.name}"`);
                
            } else {
                const error = await response.json();
                alert(t('task.saveFailed') + ': ' + (error.error || t('error.unknown')));
            }
        } catch (error) {
            console.error('保存任务失败:', error);
            alert(t('task.saveFailed') + ': ' + error.message);
        }
    }

    /**
     * 保存独立编辑任务
     */
    async saveStandaloneEditTask() {
        const taskData = this.collectStandaloneEditTaskData();
        if (!taskData) return;
        
        try {
            const response = await fetch(`/api/tasks/${this.selectedTaskId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(taskData)
            });
            
            if (response.ok) {
                const savedTask = await response.json();
                console.log('任务修改成功:', savedTask);
                
                // 刷新任务列表
                this.loadTasks();
                
                // 更新详情显示
                this.showStandaloneTaskDetail(savedTask);
                
                // 显示成功提示
                this.showExecutionFeedback(`${t('task.updateSuccess')}: "${savedTask.name}"`);
                
            } else {
                const error = await response.json();
                alert(t('task.saveFailed') + ': ' + (error.error || t('error.unknown')));
            }
        } catch (error) {
            console.error('保存任务失败:', error);
            alert(t('task.saveFailed') + ': ' + error.message);
        }
    }

    /**
     * 收集独立新建任务表单数据
     */
    collectStandaloneTaskData() {
        const nameInput = document.getElementById('standalone-task-name');
        const descriptionInput = document.getElementById('standalone-task-description');
        
        const name = nameInput?.value?.trim();
        const description = descriptionInput?.value?.trim();
        
        if (!name || !description) {
            alert(t('task.fillNameAndGoal'));
            return null;
        }
        
        const skipInput = document.getElementById('standalone-skip-permissions');
        const verboseInput = document.getElementById('standalone-verbose-logs');
        const immediateRadio = document.getElementById('standalone-execute-immediate');
        const frequencySelect = document.getElementById('standalone-schedule-frequency');
        const timeInput = document.getElementById('standalone-schedule-time');
        
        const skipPermissions = skipInput?.checked || false;
        const verboseLogs = verboseInput?.checked || false;
        const isImmediate = immediateRadio?.checked || false;
        
        // Collect role and goal configuration
        const roleSelect = document.getElementById('standalone-role-select');
        const goalConfigTextarea = document.getElementById('standalone-goal-config');
        const selectedRole = roleSelect?.value || '';
        const goalConfig = goalConfigTextarea?.value?.trim() || '';
        
        // 收集通知设置
        const notificationTypeRadio = document.querySelector('input[name="standalone-notification-type"]:checked');
        const notificationType = notificationTypeRadio?.value || 'none';
        const notificationEnabled = notificationType !== 'none';
        const notificationMethods = notificationEnabled ? [notificationType] : [];
        
        // Debug logging for role and goal_config collection
        console.log('🔍 Task data collection debug:', {
            name: name,
            description: description,
            selectedRole: selectedRole,
            goalConfig: goalConfig,
            roleSelectElement: roleSelect,
            goalConfigElement: goalConfigTextarea,
            notificationType: notificationType,
            notificationEnabled: notificationEnabled,
            notificationMethods: notificationMethods
        });
        
        return {
            name: name,
            goal: description,
            role: selectedRole,
            goal_config: goalConfig,
            skipPermissions: skipPermissions,
            verboseLogs: verboseLogs,
            resources: this.standaloneResources || [],
            scheduleFrequency: isImmediate ? 'immediate' : (frequencySelect?.value || 'daily'),
            scheduleTime: isImmediate ? '' : (timeInput?.value || '09:00'),
            executionMode: isImmediate ? 'immediate' : 'scheduled',
            enabled: true,
            notificationSettings: {
                enabled: notificationEnabled,
                methods: notificationMethods
            }
        };
    }

    /**
     * 收集独立编辑任务表单数据
     */
    collectStandaloneEditTaskData() {
        const nameInput = document.getElementById('standalone-edit-task-name');
        const goalInput = document.getElementById('standalone-edit-task-goal');
        
        const name = nameInput?.value?.trim();
        const goal = goalInput?.value?.trim();
        
        if (!name || !goal) {
            alert(t('task.fillNameAndGoal'));
            return null;
        }
        
        const skipInput = document.getElementById('standalone-edit-skip-permissions');
        const verboseInput = document.getElementById('standalone-edit-verbose-logs');
        const immediateRadio = document.getElementById('standalone-edit-execute-immediate');
        const frequencySelect = document.getElementById('standalone-edit-schedule-frequency');
        const timeInput = document.getElementById('standalone-edit-schedule-time');
        
        const skipPermissions = skipInput?.checked || false;
        const verboseLogs = verboseInput?.checked || false;
        const isImmediate = immediateRadio?.checked || false;
        
        // Collect role and goal configuration for edit form
        const roleSelect = document.getElementById('standalone-edit-role-select');
        const goalConfigTextarea = document.getElementById('standalone-edit-goal-config');
        const selectedRole = roleSelect?.value || '';
        const goalConfig = goalConfigTextarea?.value?.trim() || '';
        
        // 收集通知设置
        const notificationTypeRadio = document.querySelector('input[name="standalone-edit-notification-type"]:checked');
        const notificationType = notificationTypeRadio?.value || 'none';
        const notificationEnabled = notificationType !== 'none';
        const notificationMethods = notificationEnabled ? [notificationType] : [];
        
        // Debug logging
        console.log('🔔 Edit notification data collection:', {
            notificationTypeRadio,
            notificationType,
            notificationEnabled,
            notificationMethods
        });
        
        return {
            name: name,
            goal: goal,
            role: selectedRole,
            goal_config: goalConfig,
            skipPermissions: skipPermissions,
            verboseLogs: verboseLogs,
            resources: this.standaloneEditResources || [],
            scheduleFrequency: isImmediate ? 'immediate' : (frequencySelect?.value || 'daily'),
            scheduleTime: isImmediate ? '' : (timeInput?.value || '09:00'),
            executionMode: isImmediate ? 'immediate' : 'scheduled',
            enabled: true,
            notificationSettings: {
                enabled: notificationEnabled,
                methods: notificationMethods
            }
        };
    }

    /**
     * 执行独立详情弹窗中的任务
     */
    async executeStandaloneTask() {
        const task = this.tasks.find(t => t.id === this.selectedTaskId);
        if (!task) {
            console.error('任务不存在:', this.selectedTaskId);
            alert(t('task.taskNotFound'));
            return;
        }
        
        // 检查任务是否启用
        if (!task.enabled) {
            if (!confirm(`任务"${task.name}"当前已禁用，是否要启用并执行？`)) {
                return;
            }
            task.enabled = true;
        }
        
        console.log(' 执行任务:', task.name);
        
        // 检查WebSocket连接
        if (!window.websocketManager || !window.websocketManager.isConnected) {
            alert(t('task.systemConnectionError'));
            return;
        }
        
        try {
            // 更新最后执行时间
            task.lastRun = new Date().toISOString();
            
            let sessionData;
            
            if (task.sessionId) {
                // 继续任务：使用恢复会话机制
                console.log('🔄 继续任务，使用session_id:', task.sessionId);
                sessionData = {
                    type: 'resume-task-session',
                    taskId: task.id,
                    taskName: task.name,
                    sessionId: task.sessionId,
                    workDirectory: this.getUserHome()  // 使用跨平台兼容的用户主目录
                };
                this.showExecutionFeedback(`继续任务: ${task.name}`);
            } else {
                // 重新执行：使用原有逻辑
                console.log(' 重新执行任务');
                const command = this.buildClaudeCommand(task);
                console.log('📝 构建的命令:', command);
                
                sessionData = {
                    type: 'new-task-session',
                    taskId: task.id,
                    taskName: task.name,
                    command: command,
                    skipPermissions: task.skip_permissions,
                    verboseLogs: task.verbose_logs,
                    role: task.role || '',
                    goal_config: task.goal_config || '',
                    resources: task.resources
                };
                this.showExecutionFeedback(t('task.reExecutingTask') + task.name);
            }
            
            console.log('📡 发送任务执行请求:', sessionData);
            console.log('🔔 WebSocket发送的完整命令(重新执行):', sessionData.command);
            window.websocketManager.sendMessage(sessionData);
            
            // 延迟刷新任务数据，以便获取更新后的session_id
            setTimeout(async () => {
                console.log('🔄 刷新任务数据以获取最新session_id');
                await this.loadTasks();
                
                // 如果当前显示的就是这个任务，重新显示详情以更新按钮状态
                if (this.selectedTaskId === task.id) {
                    const updatedTask = this.tasks.find(t => t.id === task.id);
                    if (updatedTask) {
                        console.log('🔄 更新任务详情显示，sessionId:', updatedTask.sessionId);
                        this.showStandaloneTaskDetail(updatedTask);
                    }
                }
            }, 3000); // 3秒后刷新，给文件监控足够时间捕获session_id
            
            // 关闭弹窗
            this.closeStandaloneDetailModal();
            
        } catch (error) {
            console.error('❌ 任务执行失败:', error);
            alert(t('task.executionFailedWithError') + error.message);
        }
    }

    /**
     * 检查新建任务表单是否有未保存的更改
     */
    hasUnsavedChangesInAddForm() {
        const taskName = document.getElementById('standalone-task-name')?.value?.trim() || '';
        const taskGoal = document.getElementById('standalone-task-goal')?.value?.trim() || '';
        return taskName.length > 0 || taskGoal.length > 0;
    }

    /**
     * 检查任务详情编辑表单是否有未保存的更改
     */
    hasUnsavedChangesInDetailForm() {
        // 检查是否在编辑模式
        const editForm = document.getElementById('standalone-edit-form');
        const detailView = document.getElementById('standalone-task-detail-view');
        
        if (!editForm || !detailView || !editForm.classList.contains('hidden')) {
            // 在编辑模式下，检查表单内容
            const taskName = document.getElementById('standalone-edit-task-name')?.value?.trim() || '';
            const taskGoal = document.getElementById('standalone-edit-task-goal')?.value?.trim() || '';
            return taskName.length > 0 || taskGoal.length > 0;
        }
        return false;
    }

    /**
     * 处理新建任务弹窗的外部点击关闭
     */
    handleStandaloneAddModalClose() {
        if (this.hasUnsavedChangesInAddForm()) {
            if (confirm('表单中有未保存的内容，确定要关闭吗？')) {
                this.closeStandaloneAddModal();
            }
        } else {
            this.closeStandaloneAddModal();
        }
    }

    /**
     * 处理任务详情弹窗的外部点击关闭
     */
    handleStandaloneDetailModalClose() {
        if (this.hasUnsavedChangesInDetailForm()) {
            if (confirm('表单中有未保存的内容，确定要关闭吗？')) {
                this.closeStandaloneDetailModal();
            }
        } else {
            this.closeStandaloneDetailModal();
        }
    }

    /**
     * 关闭独立新建任务弹窗
     */
    closeStandaloneAddModal() {
        const modal = document.getElementById('standalone-add-task-modal');
        if (modal) {
            modal.classList.remove('active');
            modal.classList.add('hidden');
        }
    }

    /**
     * 独立新建任务浏览文件
     */
    browseStandaloneFiles() {
        // 创建隐藏的文件输入元素
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.style.display = 'none';
        
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            files.forEach(file => {
                // 对于单个文件选择，只能获取文件名（浏览器安全限制）
                const path = file.name;
                console.log(`添加文件: ${file.name} (仅文件名，如需完整路径请手动输入)`);
                
                if (!this.standaloneResources) this.standaloneResources = [];
                if (!this.standaloneResources.includes(path)) {
                    this.standaloneResources.push(path);
                }
            });
            this.renderStandaloneResourceList();
            // 清理DOM元素
            if (document.body.contains(fileInput)) {
                document.body.removeChild(fileInput);
            }
        });
        
        // 添加到DOM并触发点击
        document.body.appendChild(fileInput);
        fileInput.click();
    }

    /**
     * 独立新建任务浏览文件夹
     */
    async browseStandaloneFolders() {
        try {
            // 优先使用现代File System Access API
            if ('showDirectoryPicker' in window) {
                const dirHandle = await window.showDirectoryPicker();
                const folderName = dirHandle.name;
                console.log('选择的文件夹:', folderName);
                
                const userConfirm = confirm(`已选择文件夹: "${folderName}"\n\n由于浏览器安全限制，请确认：\n1. 如果文件夹在当前工作目录下，点击确定\n2. 如果需要输入完整路径，点击取消后手动输入`);
                
                if (userConfirm) {
                    if (!this.standaloneResources) this.standaloneResources = [];
                    if (!this.standaloneResources.includes(folderName)) {
                        this.standaloneResources.push(folderName);
                        this.renderStandaloneResourceList();
                    }
                }
            } else {
                // 回退到webkitdirectory API
                const folderInput = document.createElement('input');
                folderInput.type = 'file';
                folderInput.webkitdirectory = true;
                folderInput.multiple = true;
                folderInput.style.display = 'none';
                
                folderInput.addEventListener('change', (e) => {
                    const files = Array.from(e.target.files);
                    if (files.length > 0) {
                        const firstFile = files[0];
                        let folderPath = '';
                        
                        if (firstFile.webkitRelativePath) {
                            const pathParts = firstFile.webkitRelativePath.split('/');
                            console.log('独立新建-webkitRelativePath:', firstFile.webkitRelativePath);
                            console.log('独立新建-pathParts:', pathParts);
                            
                            if (pathParts.length > 1) {
                                pathParts.pop();
                                folderPath = pathParts.join('/');
                            } else {
                                folderPath = pathParts[0];
                            }
                            console.log('独立新建-提取的文件夹路径:', folderPath);
                        } else {
                            folderPath = firstFile.name || 'selected_folder';
                            console.log('独立新建-无法获取webkitRelativePath，使用默认:', folderPath);
                        }
                        
                        if (folderPath) {
                            if (!this.standaloneResources) this.standaloneResources = [];
                            if (!this.standaloneResources.includes(folderPath)) {
                                this.standaloneResources.push(folderPath);
                                this.renderStandaloneResourceList();
                            }
                        }
                    }
                    // 清理DOM元素
                    if (document.body.contains(folderInput)) {
                        document.body.removeChild(folderInput);
                    }
                });
                
                // 添加到DOM并触发点击
                document.body.appendChild(folderInput);
                folderInput.click();
            }
        } catch (error) {
            console.log('文件夹选择被取消或出现错误');
        }
    }

    /**
     * 独立编辑任务浏览文件
     */
    browseStandaloneEditFiles() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.style.display = 'none';
        
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            files.forEach(file => {
                // 对于单个文件选择，只能获取文件名（浏览器安全限制）
                const path = file.name;
                console.log(`添加文件: ${file.name} (仅文件名，如需完整路径请手动输入)`);
                
                if (!this.standaloneEditResources) this.standaloneEditResources = [];
                if (!this.standaloneEditResources.includes(path)) {
                    this.standaloneEditResources.push(path);
                }
            });
            this.renderStandaloneEditResourceList();
            if (document.body.contains(fileInput)) {
                document.body.removeChild(fileInput);
            }
        });
        
        document.body.appendChild(fileInput);
        fileInput.click();
    }

    /**
     * 独立编辑任务浏览文件夹
     */
    async browseStandaloneEditFolders() {
        try {
            if ('showDirectoryPicker' in window) {
                const dirHandle = await window.showDirectoryPicker();
                const folderName = dirHandle.name;
                
                const userConfirm = confirm(`已选择文件夹: "${folderName}"\n\n由于浏览器安全限制，请确认：\n1. 如果文件夹在当前工作目录下，点击确定\n2. 如果需要输入完整路径，点击取消后手动输入`);
                
                if (userConfirm) {
                    if (!this.standaloneEditResources) this.standaloneEditResources = [];
                    if (!this.standaloneEditResources.includes(folderName)) {
                        this.standaloneEditResources.push(folderName);
                        this.renderStandaloneEditResourceList();
                    }
                }
            } else {
                const folderInput = document.createElement('input');
                folderInput.type = 'file';
                folderInput.webkitdirectory = true;
                folderInput.multiple = true;
                folderInput.style.display = 'none';
                
                folderInput.addEventListener('change', (e) => {
                    const files = Array.from(e.target.files);
                    if (files.length > 0) {
                        const firstFile = files[0];
                        let folderPath = '';
                        
                        if (firstFile.webkitRelativePath) {
                            const pathParts = firstFile.webkitRelativePath.split('/');
                            if (pathParts.length > 1) {
                                pathParts.pop();
                                folderPath = pathParts.join('/');
                            } else {
                                folderPath = pathParts[0];
                            }
                        } else {
                            folderPath = firstFile.name || 'selected_folder';
                        }
                        
                        if (folderPath) {
                            if (!this.standaloneEditResources) this.standaloneEditResources = [];
                            if (!this.standaloneEditResources.includes(folderPath)) {
                                this.standaloneEditResources.push(folderPath);
                                this.renderStandaloneEditResourceList();
                            }
                        }
                    }
                    if (document.body.contains(folderInput)) {
                        document.body.removeChild(folderInput);
                    }
                });
                
                document.body.appendChild(folderInput);
                folderInput.click();
            }
        } catch (error) {
            console.log('文件夹选择被取消或出现错误');
        }
    }

    /**
     * 关闭独立任务详情弹窗
     */
    closeStandaloneDetailModal() {
        const modal = document.getElementById('standalone-task-detail-modal');
        if (modal) {
            modal.classList.remove('active');
            modal.classList.add('hidden');
        }
        this.selectedTaskId = null;
    }

    /**
     * 初始化路径自动补全功能
     */
    initPathAutocomplete() {
        if (typeof PathInputEnhancer === 'undefined') {
            console.warn('PathInputEnhancer 未定义，跳过路径自动补全初始化');
            return;
        }
        
        // 工作目录获取函数
        const getWorkingDirectory = () => {
            // 使用跨平台兼容的用户主目录，任务基于此目录执行
            return this.getUserHome();
        };
        
        // 为主任务表单的手动输入框添加自动补全
        const mainPathInput = document.getElementById('manual-path');
        if (mainPathInput) {
            const onPathSelected = (path) => {
                // 直接添加到主任务表单的资源列表
                if (!this.resources.includes(path)) {
                    this.resources.push(path);
                    this.renderResourceList();
                }
            };
            new PathInputEnhancer(mainPathInput, getWorkingDirectory, onPathSelected);
        }
        
        // 为独立新建任务的手动输入框添加自动补全
        const standalonePathInput = document.getElementById('standalone-manual-path');
        if (standalonePathInput) {
            const onPathSelected = (path) => {
                // 直接添加到独立新建任务的资源列表
                if (!this.standaloneResources) this.standaloneResources = [];
                if (!this.standaloneResources.includes(path)) {
                    this.standaloneResources.push(path);
                    this.renderStandaloneResourceList();
                }
            };
            new PathInputEnhancer(standalonePathInput, getWorkingDirectory, onPathSelected);
        }
        
        // 为独立编辑任务的手动输入框添加自动补全
        const standaloneEditPathInput = document.getElementById('standalone-edit-manual-path');
        if (standaloneEditPathInput) {
            const onPathSelected = (path) => {
                // 直接添加到独立编辑任务的资源列表
                if (!this.standaloneEditResources) this.standaloneEditResources = [];
                if (!this.standaloneEditResources.includes(path)) {
                    this.standaloneEditResources.push(path);
                    this.renderStandaloneEditResourceList();
                }
            };
            new PathInputEnhancer(standaloneEditPathInput, getWorkingDirectory, onPathSelected);
        }
    }

    /**
     * 渲染通知选项（单选框模式）
     */
    renderNotificationOptions(formPrefix) {
        const container = document.getElementById(`${formPrefix}-notification-options`);
        if (!container) return;

        // 使用默认状态渲染，后续异步更新
        const options = [];
        
        // 不通知选项
        options.push(`
            <div class="notification-option">
                <label>
                    <input type="radio" name="${formPrefix}-notification-type" value="none" checked>
                    <span data-i18n="task.noNotifications">${this.getText('task.noNotifications')}</span>
                </label>
            </div>
        `);

        // 邮件通知选项
        options.push(`
            <div class="notification-option" id="${formPrefix}-email-option">
                <label>
                    <input type="radio" name="${formPrefix}-notification-type" value="email">
                    <img src="/static/assets/icons/interface/email_notification.png" width="16" height="16" alt="">
                    <span data-i18n="notifications.email">${this.getText('notifications.email')}</span>
                    <span class="status-text" data-i18n="common.loading">${this.getText('common.loading')}</span>
                </label>
            </div>
        `);

        // 微信通知选项
        options.push(`
            <div class="notification-option" id="${formPrefix}-wechat-option">
                <label>
                    <input type="radio" name="${formPrefix}-notification-type" value="wechat">
                    <img src="/static/assets/icons/social/wechat-color.png" width="16" height="16" alt="">
                    <span data-i18n="notifications.wechat">${this.getText('notifications.wechat')}</span>
                    <span class="status-text" data-i18n="common.loading">${this.getText('common.loading')}</span>
                </label>
            </div>
        `);

        container.innerHTML = options.join('');

        // 异步更新状态
        this.updateNotificationOptionsStatus(formPrefix);
    }

    /**
     * 更新通知选项状态
     */
    async updateNotificationOptionsStatus(formPrefix) {
        const emailOption = document.getElementById(`${formPrefix}-email-option`);
        const wechatOption = document.getElementById(`${formPrefix}-wechat-option`);
        
        if (!emailOption || !wechatOption) return;

        const emailStatus = emailOption.querySelector('.status-text');
        const wechatStatus = wechatOption.querySelector('.status-text');
        
        // Show loading state while fetching status
        if (emailStatus) {
            emailStatus.textContent = this.getText('common.loading');
            emailStatus.className = 'status-text status-loading';
        }
        if (wechatStatus) {
            wechatStatus.textContent = this.getText('common.loading');
            wechatStatus.className = 'status-text status-loading';
        }

        // Always load fresh status to ensure accuracy
        const statusLoaded = await this.loadNotificationStatus();
        
        if (!statusLoaded || !this.notificationStatus) {
            // Status loading failed, show default state
            console.warn('Failed to load notification status, showing default state');
            if (emailStatus) {
                emailStatus.textContent = this.getText('notifications.statusUnknown');
                emailStatus.className = 'status-text status-unknown';
                emailStatus.removeAttribute('data-i18n');
            }
            if (wechatStatus) {
                wechatStatus.textContent = this.getText('notifications.statusUnknown');
                wechatStatus.className = 'status-text status-unknown';
                wechatStatus.removeAttribute('data-i18n');
            }
            return;
        }

        // 更新邮件选项状态
        const emailConfigured = this.notificationStatus?.email?.configured;
        const emailRadio = emailOption.querySelector('input[type="radio"]');
        
        if (emailConfigured) {
            if (emailRadio) emailRadio.disabled = false;
            emailOption.classList.remove('disabled');
            if (emailStatus) {
                emailStatus.textContent = this.getText('notifications.configured');
                emailStatus.className = 'status-text status-ok';
                emailStatus.removeAttribute('data-i18n');
            }
        } else {
            if (emailRadio) emailRadio.disabled = true;
            emailOption.classList.add('disabled');
            if (emailStatus) {
                emailStatus.textContent = this.getText('notifications.needConfigInSettings');
                emailStatus.className = 'status-text status-need-config';
                emailStatus.removeAttribute('data-i18n');
            }
        }

        // 更新微信选项状态
        const wechatBound = this.notificationStatus?.wechat?.bound;
        const wechatRadio = wechatOption.querySelector('input[type="radio"]');
        
        if (wechatBound) {
            if (wechatRadio) wechatRadio.disabled = false;
            wechatOption.classList.remove('disabled');
            if (wechatStatus) {
                wechatStatus.textContent = this.getText('notifications.bound');
                wechatStatus.className = 'status-text status-ok';
                wechatStatus.removeAttribute('data-i18n');
            }
        } else {
            if (wechatRadio) wechatRadio.disabled = true;
            wechatOption.classList.add('disabled');
            if (wechatStatus) {
                wechatStatus.textContent = this.getText('notifications.needBindInSettings');
                wechatStatus.className = 'status-text status-need-config';
                wechatStatus.removeAttribute('data-i18n');
            }
        }
    }

    /**
     * 获取国际化文本
     */
    getText(key) {
        return window.i18n ? window.i18n.t(key) : key;
    }

    /**
     * 打开设置页面到通知配置
     */
    openSettingsToNotifications(event) {
        event.preventDefault();
        // 触发设置按钮点击，打开设置弹窗
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.click();
            // 切换到通知配置页面
            setTimeout(() => {
                const notificationsTab = document.querySelector('.settings-menu-item[data-section="notifications"]');
                if (notificationsTab) {
                    notificationsTab.click();
                }
            }, 100);
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
     * Handle role selection change
     */
    handleRoleChange(selectedRole, formType) {
        const goalSettingsId = formType === 'standalone' ? 'standalone-goal-settings' : 'goal-settings';
        const goalSettingsContainer = document.getElementById(goalSettingsId);
        
        if (!goalSettingsContainer) {
            console.warn(`Goal settings container not found: ${goalSettingsId}`);
            return;
        }

        if (selectedRole && selectedRole !== '') {
            // Show goal settings area
            goalSettingsContainer.style.display = 'block';
            
            // Populate role-specific goal templates
            this.populateRoleGoalTemplate(selectedRole, formType);
        } else {
            // Hide goal settings area when no role is selected
            goalSettingsContainer.style.display = 'none';
        }
    }

    /**
     * Populate role-specific goal templates and friendly examples
     */
    populateRoleGoalTemplate(role, formType) {
        const goalTextareaId = formType === 'standalone' ? 'standalone-goal-config' : 'daily-goal-config';
        const goalExampleId = formType === 'standalone' ? 'standalone-goal-example' : 'daily-goal-example';
        const goalTextarea = document.getElementById(goalTextareaId);
        const goalExampleContainer = document.getElementById(goalExampleId);
        
        if (!goalTextarea) {
            console.warn(`Goal textarea not found: ${goalTextareaId}`);
            return;
        }

        // Role-specific goal templates for textarea
        const roleTemplates = {
            'finance-assistant': 'Goal: Complete financial analysis and expense tracking\nKPIs: Accuracy rate, Processing speed, Cost optimization recommendations\nDeliverables: Financial reports, Budget analysis, Risk assessment',
            'work-assistant': 'Goal: Optimize work processes and task coordination\nKPIs: Task completion rate, Communication efficiency, Time saved\nDeliverables: Work plans, Status reports, Process improvements',
            'ai-product-manager': 'Goal: Analyze product requirements and create implementation roadmap\nKPIs: Feature specification accuracy, Market fit assessment, Development timeline\nDeliverables: Product requirements document, User stories, Technical specifications',
            'document-manager': 'Goal: Organize and manage document workflow\nKPIs: Organization efficiency, Document accessibility, Version control accuracy\nDeliverables: Document structure, File organization system, Access management',
            'info-collector': 'Goal: Research and compile comprehensive information\nKPIs: Information accuracy, Coverage completeness, Source reliability\nDeliverables: Research reports, Data analysis, Competitive intelligence',
            'fullstack-engineer': 'Goal: Develop and implement technical solutions\nKPIs: Code quality, Performance optimization, Bug resolution rate\nDeliverables: Working code, Technical documentation, Test coverage',
            'mcp-manager': 'Goal: Manage MCP services and integrations\nKPIs: Service uptime, Integration efficiency, Configuration accuracy\nDeliverables: Service configurations, Integration reports, Performance metrics',
            'sales-specialist': 'Goal: Drive revenue growth through effective sales strategies\nKPIs: Conversion rate, Average deal size, Sales cycle length, Customer satisfaction\nDeliverables: Sales strategy report, Prospect database, Performance analytics',
            'content-operations': 'Goal: Create and optimize content for audience engagement\nKPIs: Content engagement rate, SEO performance, Content production efficiency\nDeliverables: Content calendar, Published content, Performance dashboard',
            'customer-service': 'Goal: Provide exceptional customer support and satisfaction\nKPIs: Response time, Resolution rate, Customer satisfaction score, Issue escalation rate\nDeliverables: Service report, Resolution documentation, Customer feedback analysis',
            'market-researcher': 'Goal: Provide data-driven market insights and competitive intelligence\nKPIs: Research accuracy, Insight actionability, Report timeliness, Stakeholder satisfaction\nDeliverables: Market research report, Competitive analysis, Strategic recommendations',
            'data-analyst': 'Goal: Transform data into actionable business insights\nKPIs: Analysis accuracy, Model performance, Report clarity, Business impact\nDeliverables: Analytics report, Data visualizations, Statistical models',
            'work-verifier': 'Goal: Ensure work quality and compliance with professional standards\nKPIs: Quality score, Compliance rate, Verification accuracy, Process improvement suggestions\nDeliverables: Verification report, Quality certificate, Improvement recommendations'
        };

        // Friendly examples for each role to guide users
        const roleExamples = {
            'finance-assistant': `
                <div class="goal-example">
                    <h6>Professional Goal Examples:</h6>
                    <div class="example-item bad">
                        <strong>Instead of:</strong> "Help me analyze financial data"
                    </div>
                    <div class="example-item good">
                        <strong>Professional Goal:</strong> "Analyze Q3 expense data to identify cost-saving opportunities with 15% reduction target and detailed vendor analysis"
                    </div>
                    <div class="example-item good">
                        <strong>With KPIs:</strong> "Process 500+ transactions with 99%+ accuracy, identify top 5 cost optimization areas, complete analysis within 24 hours"
                    </div>
                </div>`,
            'sales-specialist': `
                <div class="goal-example">
                    <h6>Professional Goal Examples:</h6>
                    <div class="example-item bad">
                        <strong>Instead of:</strong> "Help me with sales strategy"
                    </div>
                    <div class="example-item good">
                        <strong>Professional Goal:</strong> "Develop Q4 sales strategy to achieve 25% revenue growth targeting enterprise clients in fintech sector"
                    </div>
                    <div class="example-item good">
                        <strong>With Metrics:</strong> "Generate 50+ qualified leads, achieve 20% conversion rate, reduce sales cycle to 45 days average"
                    </div>
                </div>`,
            'data-analyst': `
                <div class="goal-example">
                    <h6>Professional Goal Examples:</h6>
                    <div class="example-item bad">
                        <strong>Instead of:</strong> "Help me analyze some data"
                    </div>
                    <div class="example-item good">
                        <strong>Professional Goal:</strong> "Analyze user behavior data to identify conversion bottlenecks and recommend 3 actionable improvements"
                    </div>
                    <div class="example-item good">
                        <strong>With Deliverables:</strong> "Statistical analysis with 95% confidence level, interactive dashboard, A/B testing recommendations"
                    </div>
                </div>`,
            'market-researcher': `
                <div class="goal-example">
                    <h6>Professional Goal Examples:</h6>
                    <div class="example-item bad">
                        <strong>Instead of:</strong> "Research the market for me"
                    </div>
                    <div class="example-item good">
                        <strong>Professional Goal:</strong> "Research AI productivity tools market to identify top 3 competitors and market entry opportunities"
                    </div>
                    <div class="example-item good">
                        <strong>With Analysis:</strong> "Market size estimation, competitive positioning analysis, SWOT assessment, go-to-market recommendations"
                    </div>
                </div>`,
            'content-operations': `
                <div class="goal-example">
                    <h6>Professional Goal Examples:</h6>
                    <div class="example-item bad">
                        <strong>Instead of:</strong> "Write some content"
                    </div>
                    <div class="example-item good">
                        <strong>Professional Goal:</strong> "Create 4-week content calendar for LinkedIn targeting SaaS executives with engagement rate target of 5%+"
                    </div>
                    <div class="example-item good">
                        <strong>With Strategy:</strong> "16 posts optimized for LinkedIn algorithm, SEO keywords research, engagement tracking setup"
                    </div>
                </div>`,
            'customer-service': `
                <div class="goal-example">
                    <h6>Professional Goal Examples:</h6>
                    <div class="example-item bad">
                        <strong>Instead of:</strong> "Help with customer support"
                    </div>
                    <div class="example-item good">
                        <strong>Professional Goal:</strong> "Design customer support workflow to achieve <2hr response time and 95% satisfaction score"
                    </div>
                    <div class="example-item good">
                        <strong>With System:</strong> "Support ticket classification, escalation procedures, customer feedback analysis, team training materials"
                    </div>
                </div>`,
            'ai-product-manager': `
                <div class="goal-example">
                    <h6>Professional Goal Examples:</h6>
                    <div class="example-item bad">
                        <strong>Instead of:</strong> "Help me plan a product"
                    </div>
                    <div class="example-item good">
                        <strong>Professional Goal:</strong> "Create product roadmap for AI chatbot feature targeting 40% user adoption in 6 months"
                    </div>
                    <div class="example-item good">
                        <strong>With Specifications:</strong> "User stories, technical requirements, MVP scope, competitive analysis, success metrics framework"
                    </div>
                </div>`,
            'work-assistant': `
                <div class="goal-example">
                    <h6>Professional Goal Examples:</h6>
                    <div class="example-item bad">
                        <strong>Instead of:</strong> "Help me organize work"
                    </div>
                    <div class="example-item good">
                        <strong>Professional Goal:</strong> "Optimize team workflow to reduce project delivery time by 30% and improve task completion rate to 95%"
                    </div>
                    <div class="example-item good">
                        <strong>With System:</strong> "Process documentation, task templates, progress tracking system, team collaboration guidelines"
                    </div>
                </div>`,
            'fullstack-engineer': `
                <div class="goal-example">
                    <h6>Professional Goal Examples:</h6>
                    <div class="example-item bad">
                        <strong>Instead of:</strong> "Build me an app"
                    </div>
                    <div class="example-item good">
                        <strong>Professional Goal:</strong> "Develop MVP web application with user authentication and dashboard, supporting 1000+ concurrent users"
                    </div>
                    <div class="example-item good">
                        <strong>With Technical Specs:</strong> "React frontend, Node.js backend, PostgreSQL database, 99% uptime, <200ms response time"
                    </div>
                </div>`,
            'document-manager': `
                <div class="goal-example">
                    <h6>Professional Goal Examples:</h6>
                    <div class="example-item bad">
                        <strong>Instead of:</strong> "Organize my documents"
                    </div>
                    <div class="example-item good">
                        <strong>Professional Goal:</strong> "Create document management system reducing file search time by 80% and ensuring 100% version control"
                    </div>
                    <div class="example-item good">
                        <strong>With Structure:</strong> "Folder hierarchy, naming conventions, access permissions, backup procedures, search optimization"
                    </div>
                </div>`,
            'info-collector': `
                <div class="goal-example">
                    <h6>Professional Goal Examples:</h6>
                    <div class="example-item bad">
                        <strong>Instead of:</strong> "Research information for me"
                    </div>
                    <div class="example-item good">
                        <strong>Professional Goal:</strong> "Gather comprehensive intelligence on fintech regulations across 5 major markets with compliance timeline"
                    </div>
                    <div class="example-item good">
                        <strong>With Sources:</strong> "Government publications, industry reports, expert interviews, regulatory databases, compliance checklists"
                    </div>
                </div>`,
            'finance-assistant': `
                <div class="goal-example">
                    <h6>Professional Goal Examples:</h6>
                    <div class="example-item bad">
                        <strong>Instead of:</strong> "Help me with finances"
                    </div>
                    <div class="example-item good">
                        <strong>Professional Goal:</strong> "Analyze monthly expenses to identify 20% cost reduction opportunities and create automated budgeting system"
                    </div>
                    <div class="example-item good">
                        <strong>With Metrics:</strong> "Expense categorization, variance analysis, cash flow projections, ROI calculations, budget alerts"
                    </div>
                </div>`,
            'work-verifier': `
                <div class="goal-example">
                    <h6>Professional Goal Examples:</h6>
                    <div class="example-item bad">
                        <strong>Instead of:</strong> "Check my work quality"
                    </div>
                    <div class="example-item good">
                        <strong>Professional Goal:</strong> "Conduct comprehensive quality audit of project deliverables against ISO standards with 95% accuracy"
                    </div>
                    <div class="example-item good">
                        <strong>With Framework:</strong> "Quality checklist, compliance verification, risk assessment, improvement recommendations, certification report"
                    </div>
                </div>`
        };

        // Clear any existing value when switching roles
        goalTextarea.value = '';

        // Show friendly examples with internationalization support
        if (goalExampleContainer) {
            if (roleExamples[role]) {
                goalExampleContainer.innerHTML = this.getLocalizedRoleExample(role);
                goalExampleContainer.style.display = 'block';
            } else {
                goalExampleContainer.innerHTML = this.getDefaultGoalExample();
                goalExampleContainer.style.display = 'block';
            }
        }
    }

    /**
     * Get localized role example based on current language
     */
    getLocalizedRoleExample(role) {
        const currentLang = window.CURRENT_LANGUAGE || 'zh';
        
        if (currentLang === 'zh') {
            return this.getChineseRoleExamples()[role] || this.getDefaultGoalExample();
        } else {
            return this.getEnglishRoleExamples()[role] || this.getDefaultGoalExample();
        }
    }

    /**
     * Get Chinese role examples
     */
    getChineseRoleExamples() {
        return {
            'finance-assistant': `
                <div class="goal-example">
                    <h6>专业目标示例：</h6>
                    <div class="example-item bad">
                        <strong>避免模糊表述：</strong> "帮我分析财务数据"
                    </div>
                    <div class="example-item good">
                        <strong>专业目标：</strong> "分析Q3费用数据，识别15%成本节约机会，包含供应商详细分析"
                    </div>
                    <div class="example-item good">
                        <strong>关键指标：</strong> "处理500+交易记录，99%+准确率，识别前5大成本优化领域，24小时内完成分析"
                    </div>
                </div>`,
            'sales-specialist': `
                <div class="goal-example">
                    <h6>专业目标示例：</h6>
                    <div class="example-item bad">
                        <strong>避免模糊表述：</strong> "帮我制定销售策略"
                    </div>
                    <div class="example-item good">
                        <strong>专业目标：</strong> "制定Q4销售策略，针对金融科技企业客户实现25%收入增长"
                    </div>
                    <div class="example-item good">
                        <strong>关键指标：</strong> "生成50+优质潜在客户，20%转化率，平均销售周期45天"
                    </div>
                </div>`,
            'data-analyst': `
                <div class="goal-example">
                    <h6>专业目标示例：</h6>
                    <div class="example-item bad">
                        <strong>避免模糊表述：</strong> "帮我分析一些数据"
                    </div>
                    <div class="example-item good">
                        <strong>专业目标：</strong> "分析用户行为数据识别转化瓶颈，提供3个可操作改进建议"
                    </div>
                    <div class="example-item good">
                        <strong>关键交付：</strong> "95%置信水平统计分析，交互式数据看板，A/B测试建议"
                    </div>
                </div>`,
            'market-researcher': `
                <div class="goal-example">
                    <h6>专业目标示例：</h6>
                    <div class="example-item bad">
                        <strong>避免模糊表述：</strong> "帮我调研市场"
                    </div>
                    <div class="example-item good">
                        <strong>专业目标：</strong> "调研AI生产力工具市场，识别前3大竞争对手和市场机会"
                    </div>
                    <div class="example-item good">
                        <strong>分析内容：</strong> "市场规模估算，竞争定位分析，SWOT评估，进入市场策略建议"
                    </div>
                </div>`,
            'content-operations': `
                <div class="goal-example">
                    <h6>专业目标示例：</h6>
                    <div class="example-item bad">
                        <strong>避免模糊表述：</strong> "写一些内容"
                    </div>
                    <div class="example-item good">
                        <strong>专业目标：</strong> "制作4周LinkedIn内容日历，针对SaaS高管，目标5%+互动率"
                    </div>
                    <div class="example-item good">
                        <strong>具体策略：</strong> "16篇LinkedIn算法优化内容，SEO关键词研究，互动跟踪设置"
                    </div>
                </div>`,
            'customer-service': `
                <div class="goal-example">
                    <h6>专业目标示例：</h6>
                    <div class="example-item bad">
                        <strong>避免模糊表述：</strong> "帮忙处理客服"
                    </div>
                    <div class="example-item good">
                        <strong>专业目标：</strong> "设计客服工作流程，实现<2小时响应时间，95%满意度评分"
                    </div>
                    <div class="example-item good">
                        <strong>系统建设：</strong> "工单分类系统，升级流程，客户反馈分析，团队培训材料"
                    </div>
                </div>`,
            'ai-product-manager': `
                <div class="goal-example">
                    <h6>专业目标示例：</h6>
                    <div class="example-item bad">
                        <strong>避免模糊表述：</strong> "帮我规划产品"
                    </div>
                    <div class="example-item good">
                        <strong>专业目标：</strong> "创建AI聊天机器人功能产品路线图，6个月内达到40%用户采用率"
                    </div>
                    <div class="example-item good">
                        <strong>具体规范：</strong> "用户故事，技术需求，MVP范围，竞争分析，成功指标框架"
                    </div>
                </div>`,
            'work-assistant': `
                <div class="goal-example">
                    <h6>专业目标示例：</h6>
                    <div class="example-item bad">
                        <strong>避免模糊表述：</strong> "帮我组织工作"
                    </div>
                    <div class="example-item good">
                        <strong>专业目标：</strong> "优化团队工作流程，减少30%项目交付时间，95%任务完成率"
                    </div>
                    <div class="example-item good">
                        <strong>系统建设：</strong> "流程文档，任务模板，进度跟踪系统，团队协作指南"
                    </div>
                </div>`,
            'fullstack-engineer': `
                <div class="goal-example">
                    <h6>专业目标示例：</h6>
                    <div class="example-item bad">
                        <strong>避免模糊表述：</strong> "帮我开发应用"
                    </div>
                    <div class="example-item good">
                        <strong>专业目标：</strong> "开发MVP网页应用，用户认证+仪表板，支持1000+并发用户"
                    </div>
                    <div class="example-item good">
                        <strong>技术规范：</strong> "React前端，Node.js后端，PostgreSQL数据库，99%正常运行时间，<200ms响应"
                    </div>
                </div>`,
            'document-manager': `
                <div class="goal-example">
                    <h6>专业目标示例：</h6>
                    <div class="example-item bad">
                        <strong>避免模糊表述：</strong> "整理我的文档"
                    </div>
                    <div class="example-item good">
                        <strong>专业目标：</strong> "创建文档管理系统，减少80%文件搜索时间，确保100%版本控制"
                    </div>
                    <div class="example-item good">
                        <strong>系统架构：</strong> "文件夹层次，命名规范，访问权限，备份程序，搜索优化"
                    </div>
                </div>`,
            'info-collector': `
                <div class="goal-example">
                    <h6>专业目标示例：</h6>
                    <div class="example-item bad">
                        <strong>避免模糊表述：</strong> "帮我收集信息"
                    </div>
                    <div class="example-item good">
                        <strong>专业目标：</strong> "收集5个主要市场的金融科技法规情报，包含合规时间线"
                    </div>
                    <div class="example-item good">
                        <strong>信息来源：</strong> "政府出版物，行业报告，专家访谈，监管数据库，合规检查清单"
                    </div>
                </div>`,
            'mcp-manager': `
                <div class="goal-example">
                    <h6>专业目标示例：</h6>
                    <div class="example-item bad">
                        <strong>避免模糊表述：</strong> "帮我管理MCP"
                    </div>
                    <div class="example-item good">
                        <strong>专业目标：</strong> "配置MCP服务集群，实现99.9%正常运行时间和自动故障转移"
                    </div>
                    <div class="example-item good">
                        <strong>系统指标：</strong> "服务监控，性能优化，配置管理，集成测试，运维文档"
                    </div>
                </div>`,
            'work-verifier': `
                <div class="goal-example">
                    <h6>专业目标示例：</h6>
                    <div class="example-item bad">
                        <strong>避免模糊表述：</strong> "检查我的工作质量"
                    </div>
                    <div class="example-item good">
                        <strong>专业目标：</strong> "按ISO标准全面审计项目交付物，95%准确率质量认证"
                    </div>
                    <div class="example-item good">
                        <strong>验证框架：</strong> "质量检查清单，合规验证，风险评估，改进建议，认证报告"
                    </div>
                </div>`
        };
    }

    /**
     * Get English role examples  
     */
    getEnglishRoleExamples() {
        return {
            'finance-assistant': `
                <div class="goal-example">
                    <h6>Professional Goal Examples:</h6>
                    <div class="example-item bad">
                        <strong>Instead of:</strong> "Help me analyze financial data"
                    </div>
                    <div class="example-item good">
                        <strong>Professional Goal:</strong> "Analyze Q3 expense data to identify cost-saving opportunities with 15% reduction target and detailed vendor analysis"
                    </div>
                    <div class="example-item good">
                        <strong>With KPIs:</strong> "Process 500+ transactions with 99%+ accuracy, identify top 5 cost optimization areas, complete analysis within 24 hours"
                    </div>
                </div>`,
            'sales-specialist': `
                <div class="goal-example">
                    <h6>Professional Goal Examples:</h6>
                    <div class="example-item bad">
                        <strong>Instead of:</strong> "Help me with sales strategy"
                    </div>
                    <div class="example-item good">
                        <strong>Professional Goal:</strong> "Develop Q4 sales strategy to achieve 25% revenue growth targeting enterprise clients in fintech sector"
                    </div>
                    <div class="example-item good">
                        <strong>With Metrics:</strong> "Generate 50+ qualified leads, achieve 20% conversion rate, reduce sales cycle to 45 days average"
                    </div>
                </div>`,
            'data-analyst': `
                <div class="goal-example">
                    <h6>Professional Goal Examples:</h6>
                    <div class="example-item bad">
                        <strong>Instead of:</strong> "Help me analyze some data"
                    </div>
                    <div class="example-item good">
                        <strong>Professional Goal:</strong> "Analyze user behavior data to identify conversion bottlenecks and recommend 3 actionable improvements"
                    </div>
                    <div class="example-item good">
                        <strong>With Deliverables:</strong> "Statistical analysis with 95% confidence level, interactive dashboard, A/B testing recommendations"
                    </div>
                </div>`,
            'market-researcher': `
                <div class="goal-example">
                    <h6>Professional Goal Examples:</h6>
                    <div class="example-item bad">
                        <strong>Instead of:</strong> "Research the market for me"
                    </div>
                    <div class="example-item good">
                        <strong>Professional Goal:</strong> "Research AI productivity tools market to identify top 3 competitors and market entry opportunities"
                    </div>
                    <div class="example-item good">
                        <strong>With Analysis:</strong> "Market size estimation, competitive positioning analysis, SWOT assessment, go-to-market recommendations"
                    </div>
                </div>`,
            'content-operations': `
                <div class="goal-example">
                    <h6>Professional Goal Examples:</h6>
                    <div class="example-item bad">
                        <strong>Instead of:</strong> "Write some content"
                    </div>
                    <div class="example-item good">
                        <strong>Professional Goal:</strong> "Create 4-week content calendar for LinkedIn targeting SaaS executives with engagement rate target of 5%+"
                    </div>
                    <div class="example-item good">
                        <strong>With Strategy:</strong> "16 posts optimized for LinkedIn algorithm, SEO keywords research, engagement tracking setup"
                    </div>
                </div>`,
            'customer-service': `
                <div class="goal-example">
                    <h6>Professional Goal Examples:</h6>
                    <div class="example-item bad">
                        <strong>Instead of:</strong> "Help with customer support"
                    </div>
                    <div class="example-item good">
                        <strong>Professional Goal:</strong> "Design customer support workflow to achieve <2hr response time and 95% satisfaction score"
                    </div>
                    <div class="example-item good">
                        <strong>With System:</strong> "Support ticket classification, escalation procedures, customer feedback analysis, team training materials"
                    </div>
                </div>`,
            'ai-product-manager': `
                <div class="goal-example">
                    <h6>Professional Goal Examples:</h6>
                    <div class="example-item bad">
                        <strong>Instead of:</strong> "Help me plan a product"
                    </div>
                    <div class="example-item good">
                        <strong>Professional Goal:</strong> "Create product roadmap for AI chatbot feature targeting 40% user adoption in 6 months"
                    </div>
                    <div class="example-item good">
                        <strong>With Specifications:</strong> "User stories, technical requirements, MVP scope, competitive analysis, success metrics framework"
                    </div>
                </div>`,
            'work-assistant': `
                <div class="goal-example">
                    <h6>Professional Goal Examples:</h6>
                    <div class="example-item bad">
                        <strong>Instead of:</strong> "Help me organize work"
                    </div>
                    <div class="example-item good">
                        <strong>Professional Goal:</strong> "Optimize team workflow to reduce project delivery time by 30% and improve task completion rate to 95%"
                    </div>
                    <div class="example-item good">
                        <strong>With System:</strong> "Process documentation, task templates, progress tracking system, team collaboration guidelines"
                    </div>
                </div>`,
            'fullstack-engineer': `
                <div class="goal-example">
                    <h6>Professional Goal Examples:</h6>
                    <div class="example-item bad">
                        <strong>Instead of:</strong> "Build me an app"
                    </div>
                    <div class="example-item good">
                        <strong>Professional Goal:</strong> "Develop MVP web application with user authentication and dashboard, supporting 1000+ concurrent users"
                    </div>
                    <div class="example-item good">
                        <strong>With Technical Specs:</strong> "React frontend, Node.js backend, PostgreSQL database, 99% uptime, <200ms response time"
                    </div>
                </div>`,
            'document-manager': `
                <div class="goal-example">
                    <h6>Professional Goal Examples:</h6>
                    <div class="example-item bad">
                        <strong>Instead of:</strong> "Organize my documents"
                    </div>
                    <div class="example-item good">
                        <strong>Professional Goal:</strong> "Create document management system reducing file search time by 80% and ensuring 100% version control"
                    </div>
                    <div class="example-item good">
                        <strong>With Structure:</strong> "Folder hierarchy, naming conventions, access permissions, backup procedures, search optimization"
                    </div>
                </div>`,
            'info-collector': `
                <div class="goal-example">
                    <h6>Professional Goal Examples:</h6>
                    <div class="example-item bad">
                        <strong>Instead of:</strong> "Research information for me"
                    </div>
                    <div class="example-item good">
                        <strong>Professional Goal:</strong> "Gather comprehensive intelligence on fintech regulations across 5 major markets with compliance timeline"
                    </div>
                    <div class="example-item good">
                        <strong>With Sources:</strong> "Government publications, industry reports, expert interviews, regulatory databases, compliance checklists"
                    </div>
                </div>`
        };
    }

    /**
     * Get default goal example
     */
    getDefaultGoalExample() {
        const currentLang = window.CURRENT_LANGUAGE || 'zh';
        
        if (currentLang === 'zh') {
            return `
                <div class="goal-example">
                    <h6>专业目标指南：</h6>
                    <div class="example-item bad">
                        <strong>避免模糊请求如：</strong> "帮我分析一些东西" 或 "做一些调研"
                    </div>
                    <div class="example-item good">
                        <strong>提供具体目标：</strong> 明确目标，可量化的KPI，以及预期交付成果
                    </div>
                    <div class="example-item good">
                        <strong>示例格式：</strong> "通过[具体指标]实现[特定结果]，交付[具体成果]"
                    </div>
                </div>`;
        } else {
            return `
                <div class="goal-example">
                    <h6>Professional Goal Guidelines:</h6>
                    <div class="example-item bad">
                        <strong>Instead of vague requests like:</strong> "Help me analyze something" or "Do some research"
                    </div>
                    <div class="example-item good">
                        <strong>Provide specific objectives:</strong> Clear goals, measurable KPIs, and expected deliverables
                    </div>
                    <div class="example-item good">
                        <strong>Example format:</strong> "Achieve [specific outcome] with [measurable metrics] by delivering [concrete outputs]"
                    </div>
                </div>`;
        }
    }

    /**
     * Initialize i18n observer to update goal examples when language changes
     */
    initializeI18nObserver() {
        if (window.i18n) {
            window.i18n.addObserver((lang) => {
                // Update CURRENT_LANGUAGE global variable
                window.CURRENT_LANGUAGE = lang;
                
                // Refresh goal examples if they are currently displayed
                this.refreshGoalExamples();
            });
        }
    }

    /**
     * Refresh goal examples for currently selected roles
     */
    refreshGoalExamples() {
        // Refresh standalone form goal example
        const standaloneRoleSelect = document.getElementById('standalone-role-select');
        if (standaloneRoleSelect && standaloneRoleSelect.value) {
            this.populateRoleGoalTemplate(standaloneRoleSelect.value, 'standalone');
        }

        // Refresh daily form goal example  
        const dailyRoleSelect = document.getElementById('daily-role-select');
        if (dailyRoleSelect && dailyRoleSelect.value) {
            this.populateRoleGoalTemplate(dailyRoleSelect.value, 'daily');
        }

        // Refresh notification status text
        this.refreshNotificationStatus();
    }

    /**
     * Refresh notification status text when language changes
     */
    refreshNotificationStatus() {
        if (!this.notificationStatus) return;

        // Refresh email notification status
        const emailStatus = document.querySelector('.notification-option input[value="email"] ~ .status-text');
        if (emailStatus) {
            const emailConfigured = this.notificationStatus?.email?.configured;
            if (emailConfigured) {
                emailStatus.textContent = this.getText('notifications.configured');
            } else {
                emailStatus.textContent = this.getText('notifications.needConfigInSettings');
            }
        }

        // Refresh WeChat notification status
        const wechatStatus = document.querySelector('.notification-option input[value="wechat"] ~ .status-text');
        if (wechatStatus) {
            const wechatBound = this.notificationStatus?.wechat?.bound;
            if (wechatBound) {
                wechatStatus.textContent = this.getText('notifications.bound');
            } else {
                wechatStatus.textContent = this.getText('notifications.needBindInSettings');
            }
        }
    }
}

// 导出到全局作用域
window.TaskManager = TaskManager;