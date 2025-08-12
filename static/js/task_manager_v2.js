/**
 * 任务管理器组件 V2 - 分栏交互版本
 * 负责每日任务的创建、管理和执行
 */

class TaskManager {
    constructor() {
        console.log('📋 TaskManager V2 初始化开始');
        this.tasks = [];
        this.selectedTaskId = null;
        this.currentView = 'empty'; // 'empty', 'detail', 'form'
        this.resources = [];
        this.currentEditingTask = null;
        
        this.initElements();
        this.initEventListeners();
        
        // 监听任务创建事件（来自SimpleTaskManager）
        document.addEventListener('taskCreated', (event) => {
            console.log('📋 收到任务创建事件:', event.detail.task);
            this.loadTasks(); // 重新加载任务列表
        });
        
        // 监听任务更新事件（来自SimpleTaskManager）
        document.addEventListener('taskUpdated', (event) => {
            console.log('📋 收到任务更新事件:', event.detail.task);
            this.loadTasks(); // 重新加载任务列表
        });
        
        // 初始化时加载任务列表
        this.loadTasks();
        
        console.log('✅ TaskManager V2 初始化完成');
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
        this.taskGoalInput = document.getElementById('task-goal');
        this.skipPermissionsCheckbox = document.getElementById('skip-permissions');
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
        
        console.log('🔍 TaskManager DOM元素检查:', {
            modal: !!this.modal,
            tasksList: !!this.tasksList,
            addTaskBtn: !!this.addTaskBtn,
            taskDetailEmpty: !!this.taskDetailEmpty,
            taskDetailView: !!this.taskDetailView,
            addTaskForm: !!this.addTaskForm
        });
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
        
        // 点击模态框背景关闭
        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.closeModal();
                }
            });
        }
        
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

        // 点击模态框背景关闭
        const modal = document.getElementById('standalone-add-task-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeStandaloneAddModal();
                }
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

        // 点击模态框背景关闭
        const modal = document.getElementById('standalone-task-detail-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeStandaloneDetailModal();
                }
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
            }
        } catch (error) {
            console.error('加载任务失败:', error);
            this.tasks = [];
            this.renderEmptyTasksList();
            this.renderSidebarTasksList();
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
                name: task.name || '未命名任务',
                goal: task.goal || '',
                enabled: task.enabled !== false,
                schedule_frequency: task.scheduleFrequency || 'immediate',  // 后端返回驼峰命名
                resources: Array.isArray(task.resources) ? task.resources : []
            };
            
            return `
                <div class="task-item" data-task-id="${safeTask.id}" onclick="taskManager.selectTask('${safeTask.id}')">
                    <div class="task-item-header">
                        <div class="task-item-name">${this.escapeHtml(safeTask.name)}</div>
                        <span class="task-item-status ${safeTask.enabled ? 'enabled' : 'disabled'}">
                            ${safeTask.enabled ? '启用' : '禁用'}
                        </span>
                    </div>
                    <div class="task-item-goal">${this.escapeHtml(safeTask.goal)}</div>
                    <div class="task-item-meta">
                        <span>${safeTask.schedule_frequency === 'immediate' ? '立即执行' : '定时执行'}</span>
                        ${safeTask.resources.length > 0 ? `<span>${safeTask.resources.length} 个资源</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');
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
                <p class="text-muted">点击"新增任务"来创建第一个任务</p>
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
                    <p>暂无任务</p>
                    <button class="create-first-task-btn" onclick="window.taskManager && window.taskManager.showQuickAddTask()">创建新任务</button>
                </div>
            `;
            return;
        }

        // 只显示前5个任务，保持侧边栏简洁
        const displayTasks = this.tasks.slice(0, 5);
        
        sidebarTasksList.innerHTML = displayTasks.map(task => {
            const safeTask = {
                id: task.id || '',
                name: task.name || '未命名任务',
                goal: task.goal || '',
                enabled: task.enabled !== false,
                status: task.status || 'pending'
            };

            return `
                <div class="task-item ${safeTask.enabled ? 'enabled' : 'disabled'} ${safeTask.status}" 
                     data-task-id="${safeTask.id}" 
                     onclick="window.taskManager && window.taskManager.showTaskDetails('${safeTask.id}')">
                    <div class="task-name">${this.escapeHtml(safeTask.name)}</div>
                    <div class="task-status">
                        <span class="status-dot ${safeTask.status}"></span>
                        ${safeTask.enabled ? '启用' : '禁用'}
                    </div>
                </div>
            `;
        }).join('');

        // 如果任务数量超过5个，显示"查看更多"
        if (this.tasks.length > 5) {
            sidebarTasksList.innerHTML += `
                <div class="view-more-tasks">
                    <button class="view-more-btn" onclick="window.taskManager && window.taskManager.showAllTasks()">
                        查看全部 ${this.tasks.length} 个任务
                    </button>
                </div>
            `;
        }
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
        
        // 确保任务对象有完整的属性，适配后端驼峰命名
        const safeTask = {
            name: task.name || '未命名任务',
            goal: task.goal || '无描述',
            schedule_frequency: task.scheduleFrequency || 'immediate',        // 后端返回驼峰命名
            schedule_time: task.scheduleTime || '09:00',                      // 后端返回驼峰命名
            resources: Array.isArray(task.resources) ? task.resources : [],
            enabled: task.enabled !== false,
            skip_permissions: task.skipPermissions || false                   // 后端返回驼峰命名
        };
        
        if (this.detailTaskName) this.detailTaskName.textContent = safeTask.name;
        if (this.detailTaskGoal) this.detailTaskGoal.textContent = safeTask.goal;
        if (this.detailExecutionMode) {
            this.detailExecutionMode.textContent = safeTask.schedule_frequency === 'immediate' 
                ? '立即执行' 
                : `定时执行 - ${safeTask.schedule_frequency === 'daily' ? '每日' : '每周'} ${safeTask.schedule_time}`;
        }
        if (this.detailResources) {
            this.detailResources.innerHTML = safeTask.resources.length > 0 
                ? safeTask.resources.map(resource => `<div class="detail-value code">${this.escapeHtml(resource)}</div>`).join('')
                : '<span class="text-muted">未设置资源文件</span>';
        }
        if (this.detailStatus) {
            this.detailStatus.innerHTML = `
                <span class="task-item-status ${safeTask.enabled ? 'enabled' : 'disabled'}">
                    ${safeTask.enabled ? '启用' : '禁用'}
                </span>
                ${safeTask.skip_permissions ? '<span class="detail-value code">危险权限跳过模式</span>' : ''}
            `;
        }
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
        // 确保任务对象有完整的属性，适配后端驼峰命名
        const safeTask = {
            name: task.name || '',
            goal: task.goal || '',
            skip_permissions: task.skipPermissions || false,                 // 后端返回驼峰命名
            schedule_frequency: task.scheduleFrequency || 'immediate',       // 后端返回驼峰命名
            schedule_time: task.scheduleTime || '09:00',                     // 后端返回驼峰命名
            resources: Array.isArray(task.resources) ? task.resources : []
        };
        
        if (this.taskNameInput) this.taskNameInput.value = safeTask.name;
        if (this.taskGoalInput) this.taskGoalInput.value = safeTask.goal;
        if (this.skipPermissionsCheckbox) this.skipPermissionsCheckbox.checked = safeTask.skip_permissions;
        
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
            this.resourceList.innerHTML = '<div class="text-muted">未添加资源文件</div>';
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
                // 只获取文件名作为路径，用户可以后续手动修改为完整路径
                const path = file.name;
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
                            if (pathParts.length > 1) {
                                // 移除文件名，保留文件夹路径
                                pathParts.pop();
                                folderPath = pathParts.join('/');
                            } else {
                                folderPath = pathParts[0];
                            }
                        } else {
                            // 如果无法获取路径，使用文件夹名
                            folderPath = firstFile.name || 'selected_folder';
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
                alert('保存任务失败: ' + (error.error || '未知错误'));
            }
        } catch (error) {
            console.error('保存任务失败:', error);
            alert('保存任务失败: ' + error.message);
        }
    }

    /**
     * 收集表单数据
     */
    collectTaskData() {
        const name = this.taskNameInput?.value?.trim();
        const goal = this.taskGoalInput?.value?.trim();
        
        if (!name || !goal) {
            alert('请填写任务名称和目标');
            return null;
        }
        
        const skipPermissions = this.skipPermissionsCheckbox?.checked || false;
        const isImmediate = this.executeImmediateRadio?.checked || false;
        
        // 使用后端期望的驼峰命名格式
        return {
            name: name,
            goal: goal,
            skipPermissions: skipPermissions,                    // 改为驼峰命名
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
            alert('任务不存在，请刷新页面重试');
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
        
        console.log('🚀 执行任务:', task.name);
        
        // 验证资源文件
        if (task.resources && task.resources.length > 0) {
            console.log('📁 任务资源文件:', task.resources);
        }
        
        // 检查WebSocket连接
        if (!window.websocketManager || !window.websocketManager.isConnected) {
            console.error('❌ WebSocket连接未建立');
            alert('系统连接异常，请刷新页面重试');
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
                skipPermissions: task.skipPermissions,
                resources: task.resources
            };
            
            console.log('📡 发送任务执行请求:', sessionData);
            window.websocketManager.sendMessage(sessionData);
            
            // 显示执行反馈
            this.showExecutionFeedback(task.name);
            
            // 关闭模态框
            this.closeModal();
            
        } catch (error) {
            console.error('❌ 任务执行失败:', error);
            alert(`任务执行失败: ${error.message}`);
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
        
        return parts.join(' ');
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
                <span class="notification-icon">🚀</span>
                <span class="notification-text">正在执行任务: ${this.escapeHtml(taskName)}</span>
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
        console.log('📋 从侧边栏快速添加任务');
        
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
        console.log('📋 从侧边栏查看任务详情:', taskId);
        
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
        console.log('📋 从侧边栏查看所有任务');
        
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
        const editForm = document.getElementById('standalone-edit-task-form');
        const detailFooter = document.getElementById('standalone-detail-footer');
        const editFooter = document.getElementById('standalone-edit-footer');
        
        if (detailView) detailView.classList.remove('hidden');
        if (editForm) editForm.classList.add('hidden');
        if (detailFooter) detailFooter.classList.remove('hidden');
        if (editFooter) editFooter.classList.add('hidden');
        
        // 填充详情数据
        const safeTask = {
            name: task.name || '未命名任务',
            goal: task.goal || '无描述',
            schedule_frequency: task.scheduleFrequency || 'immediate',
            schedule_time: task.scheduleTime || '09:00',
            resources: Array.isArray(task.resources) ? task.resources : [],
            enabled: task.enabled !== false,
            skip_permissions: task.skipPermissions || false
        };
        
        const nameEl = document.getElementById('standalone-detail-task-name');
        const goalEl = document.getElementById('standalone-detail-task-goal');
        const modeEl = document.getElementById('standalone-detail-execution-mode');
        const resourcesEl = document.getElementById('standalone-detail-resources');
        const statusEl = document.getElementById('standalone-detail-status');
        
        if (nameEl) nameEl.textContent = safeTask.name;
        if (goalEl) goalEl.textContent = safeTask.goal;
        if (modeEl) {
            modeEl.textContent = safeTask.schedule_frequency === 'immediate' 
                ? '立即执行' 
                : `定时执行 - ${safeTask.schedule_frequency === 'daily' ? '每日' : '每周'} ${safeTask.schedule_time}`;
        }
        if (resourcesEl) {
            resourcesEl.innerHTML = safeTask.resources.length > 0 
                ? safeTask.resources.map(resource => `<div class="detail-value code">${this.escapeHtml(resource)}</div>`).join('')
                : '<span class="text-muted">未设置资源文件</span>';
        }
        if (statusEl) {
            statusEl.innerHTML = `
                <span class="task-item-status ${safeTask.enabled ? 'enabled' : 'disabled'}">
                    ${safeTask.enabled ? '启用' : '禁用'}
                </span>
                ${safeTask.skip_permissions ? '<span class="detail-value code">危险权限跳过模式</span>' : ''}
            `;
        }
    }

    /**
     * 显示独立编辑表单
     */
    showStandaloneEditForm(task) {
        // 显示编辑表单，隐藏详情视图
        const detailView = document.getElementById('standalone-task-detail-view');
        const editForm = document.getElementById('standalone-edit-task-form');
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
            skip_permissions: task.skipPermissions || false,
            schedule_frequency: task.scheduleFrequency || 'immediate',
            schedule_time: task.scheduleTime || '09:00',
            resources: Array.isArray(task.resources) ? task.resources : []
        };
        
        const nameInput = document.getElementById('standalone-edit-task-name');
        const goalInput = document.getElementById('standalone-edit-task-goal');
        const skipInput = document.getElementById('standalone-edit-skip-permissions');
        const immediateRadio = document.getElementById('standalone-edit-execute-immediate');
        const scheduledRadio = document.getElementById('standalone-edit-execute-scheduled');
        const frequencySelect = document.getElementById('standalone-edit-schedule-frequency');
        const timeInput = document.getElementById('standalone-edit-schedule-time');
        
        if (nameInput) nameInput.value = safeTask.name;
        if (goalInput) goalInput.value = safeTask.goal;
        if (skipInput) skipInput.checked = safeTask.skip_permissions;
        
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
    }

    /**
     * 渲染独立新建任务的资源列表
     */
    renderStandaloneResourceList() {
        const resourceList = document.getElementById('standalone-resource-list');
        if (!resourceList) return;
        
        if (!this.standaloneResources || this.standaloneResources.length === 0) {
            resourceList.innerHTML = '<div class="text-muted">未添加资源文件</div>';
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
            resourceList.innerHTML = '<div class="text-muted">未添加资源文件</div>';
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
                this.showExecutionFeedback(`任务"${savedTask.name}"创建成功`);
                
            } else {
                const error = await response.json();
                alert('保存任务失败: ' + (error.error || '未知错误'));
            }
        } catch (error) {
            console.error('保存任务失败:', error);
            alert('保存任务失败: ' + error.message);
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
                this.showExecutionFeedback(`任务"${savedTask.name}"修改成功`);
                
            } else {
                const error = await response.json();
                alert('保存任务失败: ' + (error.error || '未知错误'));
            }
        } catch (error) {
            console.error('保存任务失败:', error);
            alert('保存任务失败: ' + error.message);
        }
    }

    /**
     * 收集独立新建任务表单数据
     */
    collectStandaloneTaskData() {
        const nameInput = document.getElementById('standalone-task-name');
        const goalInput = document.getElementById('standalone-task-goal');
        
        const name = nameInput?.value?.trim();
        const goal = goalInput?.value?.trim();
        
        if (!name || !goal) {
            alert('请填写任务名称和目标');
            return null;
        }
        
        const skipInput = document.getElementById('standalone-skip-permissions');
        const immediateRadio = document.getElementById('standalone-execute-immediate');
        const frequencySelect = document.getElementById('standalone-schedule-frequency');
        const timeInput = document.getElementById('standalone-schedule-time');
        
        const skipPermissions = skipInput?.checked || false;
        const isImmediate = immediateRadio?.checked || false;
        
        return {
            name: name,
            goal: goal,
            skipPermissions: skipPermissions,
            resources: this.standaloneResources || [],
            scheduleFrequency: isImmediate ? 'immediate' : (frequencySelect?.value || 'daily'),
            scheduleTime: isImmediate ? '' : (timeInput?.value || '09:00'),
            executionMode: isImmediate ? 'immediate' : 'scheduled',
            enabled: true
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
            alert('请填写任务名称和目标');
            return null;
        }
        
        const skipInput = document.getElementById('standalone-edit-skip-permissions');
        const immediateRadio = document.getElementById('standalone-edit-execute-immediate');
        const frequencySelect = document.getElementById('standalone-edit-schedule-frequency');
        const timeInput = document.getElementById('standalone-edit-schedule-time');
        
        const skipPermissions = skipInput?.checked || false;
        const isImmediate = immediateRadio?.checked || false;
        
        return {
            name: name,
            goal: goal,
            skipPermissions: skipPermissions,
            resources: this.standaloneEditResources || [],
            scheduleFrequency: isImmediate ? 'immediate' : (frequencySelect?.value || 'daily'),
            scheduleTime: isImmediate ? '' : (timeInput?.value || '09:00'),
            executionMode: isImmediate ? 'immediate' : 'scheduled',
            enabled: true
        };
    }

    /**
     * 执行独立详情弹窗中的任务
     */
    async executeStandaloneTask() {
        const task = this.tasks.find(t => t.id === this.selectedTaskId);
        if (!task) {
            console.error('任务不存在:', this.selectedTaskId);
            alert('任务不存在，请刷新页面重试');
            return;
        }
        
        // 检查任务是否启用
        if (!task.enabled) {
            if (!confirm(`任务"${task.name}"当前已禁用，是否要启用并执行？`)) {
                return;
            }
            task.enabled = true;
        }
        
        console.log('🚀 执行任务:', task.name);
        
        // 检查WebSocket连接
        if (!window.websocketManager || !window.websocketManager.isConnected) {
            alert('系统连接异常，请刷新页面重试');
            return;
        }
        
        try {
            // 更新最后执行时间
            task.lastRun = new Date().toISOString();
            
            // 构建Claude CLI命令
            const command = this.buildClaudeCommand(task);
            console.log('📝 构建的命令:', command);
            
            // 通过WebSocket通知后端创建新页签执行任务
            const sessionData = {
                type: 'new-task-session',
                taskId: task.id,
                taskName: task.name,
                command: command,
                skipPermissions: task.skipPermissions,
                resources: task.resources
            };
            
            console.log('📡 发送任务执行请求:', sessionData);
            window.websocketManager.sendMessage(sessionData);
            
            // 显示执行反馈
            this.showExecutionFeedback(task.name);
            
            // 关闭弹窗
            this.closeStandaloneDetailModal();
            
        } catch (error) {
            console.error('❌ 任务执行失败:', error);
            alert(`任务执行失败: ${error.message}`);
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
                const path = file.name;
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
                const path = file.name;
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
     * HTML转义
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 导出到全局作用域
window.TaskManager = TaskManager;