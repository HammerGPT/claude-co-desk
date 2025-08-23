/**
 * 文件抽屉组件 - 右侧滑出的文件管理器
 * 基于原有的file_tree.js重构为抽屉模式
 */

class FilesDrawer {
    constructor() {
        this.isOpen = false;
        this.currentProject = null;
        this.files = [];
        this.expandedDirs = new Set();
        this.loading = false;
        this.systemConfig = null; // 存储系统配置
        
        this.initElements();
        this.initEventListeners();
        this.loadConfig(); // 加载配置
    }

    /**
     * 初始化DOM元素
     */
    initElements() {
        this.drawer = document.getElementById('files-drawer');
        this.drawerContent = document.getElementById('files-drawer-content');
        this.drawerTitle = document.getElementById('files-drawer-title');
        this.drawerCloseBtn = document.getElementById('files-drawer-close');
        this.filesDrawerBtn = document.getElementById('files-drawer-btn');
    }

    /**
     * 初始化事件监听器
     */
    initEventListeners() {
        // 文件按钮点击
        this.filesDrawerBtn?.addEventListener('click', () => {
            this.toggle();
        });

        // 关闭按钮点击
        this.drawerCloseBtn?.addEventListener('click', () => {
            this.close();
        });

        // 点击抽屉外部关闭
        document.addEventListener('click', (e) => {
            if (this.isOpen && !this.drawer?.contains(e.target) && !this.filesDrawerBtn?.contains(e.target)) {
                this.close();
            }
        });

        // ESC键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        // 监听会话切换事件
        document.addEventListener('sessionSwitch', (e) => {
            this.setProject(e.detail.project);
        });

        // 监听语言切换事件
        if (window.i18n) {
            window.i18n.registerComponent('filesDrawer', () => {
                this.updateDrawerTitle();
            });
        }
    }

    /**
     * 切换抽屉状态
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * 打开抽屉
     */
    open() {
        if (!this.currentProject) {
            this.showMessage('请先选择一个项目');
            return;
        }

        this.isOpen = true;
        this.drawer?.classList.add('open');
        
        // 更新按钮状态
        this.filesDrawerBtn?.classList.add('active');
        
        // 加载文件列表
        this.loadFiles();
        
        // 更新抽屉标题
        this.updateDrawerTitle();
        
        console.log('打开文件抽屉:', this.isCurrentTabTaskTab() ? '任务文件' : this.currentProject.name);
    }

    /**
     * 关闭抽屉
     */
    close() {
        this.isOpen = false;
        this.drawer?.classList.remove('open');
        
        // 更新按钮状态
        this.filesDrawerBtn?.classList.remove('active');
        
        console.log('关闭文件抽屉');
    }

    /**
     * 设置当前项目
     */
    setProject(project) {
        this.currentProject = project;
        
        if (this.drawerTitle) {
            if (project) {
                this.drawerTitle.innerHTML = `
                    <div class="project-info">
                        <div class="project-name">${this.escapeHtml(project.displayName || project.name)}</div>
                        <div class="project-path">${this.escapeHtml(project.path || '')}</div>
                    </div>
                `;
            } else {
                this.drawerTitle.textContent = '项目文件';
            }
        }
        
        // 如果抽屉已打开，重新加载文件
        if (this.isOpen) {
            this.loadFiles();
        }
    }

    /**
     * 判断当前活跃页签是否为任务页签
     */
    isCurrentTabTaskTab() {
        // 检查当前页签类型
        const activeTab = document.querySelector('.session-tab.active');
        if (!activeTab) {
            console.log('isCurrentTabTaskTab: 没有找到活跃页签');
            return false;
        }
        
        // 通过页签ID判断是否为任务页签
        const tabId = activeTab.id;
        const isTaskTab = tabId && tabId.startsWith('tab_task_');
        console.log(`isCurrentTabTaskTab: 页签ID=${tabId}, 是否为任务页签=${isTaskTab}`);
        return isTaskTab;
    }
    
    /**
     * 获取当前任务ID
     */
    getCurrentTaskId() {
        const activeTab = document.querySelector('.session-tab.active');
        if (!activeTab) return null;
        
        const tabId = activeTab.id;
        if (tabId && tabId.startsWith('tab_task_')) {
            // 从tab_task_xxx提取任务ID
            return tabId.replace('tab_task_', '');
        }
        return null;
    }
    
    /**
     * 更新抽屉标题
     */
    updateDrawerTitle() {
        if (!this.drawerTitle) return;
        
        if (this.isCurrentTabTaskTab()) {
            this.drawerTitle.textContent = t('files.taskFiles');
        } else if (this.currentProject) {
            this.drawerTitle.textContent = `${this.currentProject.name} ${t('files.projectFiles')}`;
        } else {
            this.drawerTitle.textContent = t('files.browser');
        }
    }

    /**
     * 加载文件列表
     */
    async loadFiles() {
        this.setLoading(true);
        
        try {
            const isTaskTab = this.isCurrentTabTaskTab();
            console.log(`[FILES] 加载文件列表 - 是否为任务页签: ${isTaskTab}`);
            
            if (isTaskTab) {
                // 任务页签 - 加载任务文件
                console.log(' 加载任务文件');
                await this.loadTaskFiles();
            } else {
                // 项目页签 - 加载项目文件
                console.log(' 加载项目文件');
                await this.loadProjectFiles();
            }
        } catch (error) {
            console.error('加载文件错误:', error);
            this.showError(t('files.networkErrorRead'));
        } finally {
            this.setLoading(false);
        }
    }
    
    /**
     * 加载项目文件（原有逻辑）
     */
    async loadProjectFiles() {
        if (!this.currentProject) return;
        
        const response = await fetch(`/api/projects/${this.currentProject.name}/files`);
        if (response.ok) {
            const data = await response.json();
            this.files = data.files || [];
            this.renderFiles();
        } else {
            console.error('加载项目文件失败:', response.statusText);
            this.showError(t('files.loadProjectFilesFailed'));
        }
    }
    
    /**
     * 加载任务文件（新增逻辑）
     */
    async loadTaskFiles() {
        const taskId = this.getCurrentTaskId();
        console.log(` loadTaskFiles: 当前任务ID=${taskId}`);
        
        if (!taskId) {
            console.error(' loadTaskFiles: 无法获取任务ID');
            this.showError(t('files.loadTaskFilesFailed'));
            return;
        }
        
        // 检查是否为MCP管理员会话
        if (taskId.startsWith('mcp-manager-')) {
            console.log(' 检测到MCP管理员会话，显示特殊说明');
            this.showMCPManagerInfo(taskId);
            return;
        }
        
        console.log(` loadTaskFiles: 请求 /api/task-files/${taskId}`);
        const response = await fetch(`/api/task-files/${taskId}`);
        if (response.ok) {
            const data = await response.json();
            console.log(' loadTaskFiles: API响应成功', data);
            this.files = data.files || [];
            this.currentTaskInfo = {
                taskId: data.taskId,
                taskName: data.taskName,
                workDirectory: data.workDirectory
            };
            this.renderFiles();
        } else {
            console.error(' loadTaskFiles: API响应失败', response.status, response.statusText);
            this.showError(t('files.loadTaskFilesFailed'));
        }
    }

    /**
     * 显示MCP管理员会话信息
     */
    showMCPManagerInfo(sessionId) {
        this.files = [];
        this.currentTaskInfo = {
            taskId: sessionId,
            taskName: 'MCP工具管理会话',
            workDirectory: this.getUserHome()
        };
        
        const filesList = document.querySelector('#files-list');
        if (filesList) {
            filesList.innerHTML = `
                <div class="mcp-manager-info">
                    <div class="info-header">
                        <h4>MCP工具管理会话</h4>
                        <p class="info-desc">这是一个MCP工具搜索和管理会话</p>
                    </div>
                    <div class="info-content">
                        <div class="info-item">
                            <strong>会话ID:</strong> ${sessionId}
                        </div>
                        <div class="info-item">
                            <strong>工作目录:</strong> ${this.currentTaskInfo.workDirectory}
                        </div>
                        <div class="info-item">
                            <strong>会话类型:</strong> MCP智能体工具搜索
                        </div>
                        <div class="info-note">
                            <p><strong>说明:</strong></p>
                            <ul>
                                <li>此会话专门用于搜索和推荐MCP工具</li>
                                <li>MCP管理员会通过Claude CLI提供实时交互</li>
                                <li>会话结束后将自动更新工具列表</li>
                                <li>您可以在终端中与MCP助手直接对话</li>
                            </ul>
                        </div>
                    </div>
                </div>
            `;
        }
        
        this.setLoading(false);
    }

    /**
     * 渲染文件列表
     */
    renderFiles() {
        if (!this.drawerContent) return;

        // 移除任务信息显示，直接渲染文件列表
        let html = '';

        if (this.files.length === 0) {
            const emptyMessage = this.isCurrentTabTaskTab() ? t('files.noTaskFiles') : t('files.noProjectFiles');
            html += `
                <div class="empty-files">
                    <p>${emptyMessage}</p>
                </div>
            `;
            this.drawerContent.innerHTML = html;
            return;
        }

        html += '<div class="files-tree">';
        html += this.renderFileTree(this.files, '');
        html += '</div>';
        
        this.drawerContent.innerHTML = html;
    }

    /**
     * 递归渲染文件树
     */
    renderFileTree(files, indent) {
        let html = '';
        
        files.forEach(file => {
            const isDir = file.type === 'directory';
            const isExpanded = this.expandedDirs.has(file.path);
            const hasChildren = isDir && file.children && file.children.length > 0;
            
            html += `
                <div class="file-item ${isDir ? 'is-directory' : 'is-file'}" style="padding-left: ${indent}px">
                    <div class="file-content" onclick="filesDrawer.handleFileClick('${file.path}', ${isDir})">
                        <div class="file-icon">
                            ${isDir ? 
                                (isExpanded ? 
                                    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5L20 17H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2"></path></svg>' :
                                    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>'
                                ) :
                                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14,2 14,8 20,8"></polyline></svg>'
                            }
                        </div>
                        <span class="file-name">${this.escapeHtml(file.name)}</span>
                        ${file.size ? `<span class="file-size">${this.formatFileSize(file.size)}</span>` : ''}
                    </div>
                </div>
            `;
            
            // 如果是展开的目录，递归渲染子文件
            if (isDir && isExpanded && hasChildren) {
                html += this.renderFileTree(file.children, indent + 20);
            }
        });
        
        return html;
    }

    /**
     * 处理文件点击
     */
    handleFileClick(filePath, isDirectory) {
        if (isDirectory) {
            this.toggleDirectory(filePath);
        } else {
            this.openFile(filePath);
        }
    }

    /**
     * 切换目录展开状态
     */
    toggleDirectory(dirPath) {
        if (this.expandedDirs.has(dirPath)) {
            this.expandedDirs.delete(dirPath);
        } else {
            this.expandedDirs.add(dirPath);
        }
        this.renderFiles();
    }

    /**
     * 打开文件（先检查文件大小，再决定打开方式）
     */
    async openFile(filePath) {
        if (!this.currentProject) return;
        
        try {
            // 显示加载状态
            this.showFileLoading(filePath);
            
            // 根据是否为任务页签选择正确的项目路径
            const projectPath = this.isCurrentTabTaskTab() && this.currentTaskInfo 
                ? this.currentTaskInfo.workDirectory 
                : this.currentProject.path;
            
            console.log(` openFile: 文件路径=${filePath}, 项目路径=${projectPath}`);
            
            // 先检查文件大小和内容
            const response = await fetch(`/api/files/read?file_path=${encodeURIComponent(filePath)}&project_path=${encodeURIComponent(projectPath)}`);
            
            if (!response.ok) {
                const error = await response.json();
                
                // 检查是否为文件过大错误（10MB限制）
                if (response.status === 413 && error.canOpenWithSystem) {
                    this.hideFileLoading();
                    this.showLargeFileDialog(error, filePath);
                    return;
                }
                
                this.hideFileLoading();
                this.showError(`${t('files.readFileFailed')}: ${error.error || t('error.unknown')}`);
                return;
            }
            
            this.hideFileLoading();
            
            // 文件大小正常，读取文件内容并显示编辑器
            const fileData = await response.json();
            this.showFileEditor(fileData, filePath);
            
            console.log('打开文件编辑器:', filePath);
            
        } catch (error) {
            this.hideFileLoading();
            console.error('读取文件错误:', error);
            this.showError(t('files.networkErrorRead'));
        }
    }

    /**
     * 设置加载状态
     */
    setLoading(loading) {
        this.loading = loading;
        
        if (!this.drawerContent) return;
        
        if (loading) {
            this.drawerContent.innerHTML = `
                <div class="loading-files">
                    <div class="spinner"></div>
                    <p>${t('common.loading')}</p>
                </div>
            `;
        }
    }

    /**
     * 显示错误
     */
    showError(message) {
        if (this.drawerContent) {
            this.drawerContent.innerHTML = `
                <div class="error-files">
                    <p>${this.escapeHtml(message)}</p>
                    <button onclick="filesDrawer.loadFiles()" class="btn btn-sm btn-primary">${t('common.retry')}</button>
                </div>
            `;
        }
    }

    /**
     * 显示消息
     */
    showMessage(message) {
        if (this.drawerContent) {
            this.drawerContent.innerHTML = `
                <div class="message-files">
                    <p>${this.escapeHtml(message)}</p>
                </div>
            `;
        }
    }

    /**
     * 格式化文件大小
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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
     * 显示大文件提示对话框
     */
    showLargeFileDialog(error, filePath) {
        const filename = filePath.split('/').pop();
        
        const modal = document.createElement('div');
        modal.className = 'large-file-dialog-modal';
        modal.innerHTML = `
            <div class="large-file-dialog-backdrop" onclick="filesDrawer.closeLargeFileDialog()"></div>
            <div class="large-file-dialog-container">
                <div class="large-file-dialog-header">
                    <h3>文件过大</h3>
                    <button class="large-file-dialog-close" onclick="filesDrawer.closeLargeFileDialog()">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                <div class="large-file-dialog-content">
                    <p class="file-info">
                        <strong>文件：</strong>${this.escapeHtml(filename)}
                    </p>
                    <p class="file-size-info">
                        <strong>文件大小：</strong>${error.fileSizeFormatted}
                    </p>
                    <p class="size-limit-info">
                        <strong>编辑器限制：</strong>${error.maxSizeFormatted}
                    </p>
                    <div class="warning-message">
                        <span>在Claude中打开此大文件可能会导致性能问题。建议使用系统默认应用打开。</span>
                    </div>
                </div>
                <div class="large-file-dialog-actions">
                    <button class="btn btn-primary" onclick="filesDrawer.openWithSystemApp('${this.escapeHtml(filePath)}')">
                        用系统应用打开
                    </button>
                    <button class="btn btn-warning" onclick="filesDrawer.forceOpenWithClaude('${this.escapeHtml(filePath)}')">
                        仍用Claude打开
                    </button>
                    <button class="btn btn-secondary" onclick="filesDrawer.closeLargeFileDialog()">
                        取消
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    /**
     * 关闭大文件提示对话框
     */
    closeLargeFileDialog() {
        const modal = document.querySelector('.large-file-dialog-modal');
        if (modal) {
            modal.remove();
        }
    }

    /**
     * 用系统应用打开文件
     */
    async openWithSystemApp(filePath) {
        try {
            // 根据是否为任务页签选择正确的项目路径
            const projectPath = this.isCurrentTabTaskTab() && this.currentTaskInfo 
                ? this.currentTaskInfo.workDirectory 
                : this.currentProject.path;
                
            const response = await fetch('/api/files/open-system', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    filePath: filePath,
                    projectPath: projectPath
                })
            });

            const result = await response.json();
            
            if (response.ok) {
                console.log('文件已用系统应用打开:', result.message);
                this.closeLargeFileDialog();
                this.showSuccessMessage('文件已用系统应用打开');
            } else {
                console.error('打开文件失败:', result.error);
                this.showError(result.error || t('files.openFileFailed'));
            }
        } catch (error) {
            console.error('打开文件错误:', error);
            this.showError(t('files.networkErrorOpen'));
        }
    }

    /**
     * 强制用Claude打开大文件
     */
    async forceOpenWithClaude(filePath) {
        this.closeLargeFileDialog();
        
        try {
            // 根据是否为任务页签选择正确的项目路径
            const projectPath = this.isCurrentTabTaskTab() && this.currentTaskInfo 
                ? this.currentTaskInfo.workDirectory 
                : this.currentProject.path;
                
            // 强制读取大文件内容
            const response = await fetch(`/api/files/read?file_path=${encodeURIComponent(filePath)}&project_path=${encodeURIComponent(projectPath)}`);
            
            if (response.ok) {
                const fileData = await response.json();
                this.showFileEditor(fileData, filePath);
                console.log('强制用编辑器打开大文件:', filePath);
            } else {
                this.showError(t('files.readLargeFileFailed'));
            }
        } catch (error) {
            console.error('强制打开大文件错误:', error);
            this.showError(t('files.networkErrorLargeFile'));
        }
    }

    /**
     * 显示文件加载状态
     */
    showFileLoading(filePath) {
        const filename = filePath.split('/').pop();
        
        if (this.drawerContent) {
            const loadingEl = document.createElement('div');
            loadingEl.className = 'file-loading-overlay';
            loadingEl.innerHTML = `
                <div class="file-loading-content">
                    <div class="spinner"></div>
                    <p>${t('files.checkingFile')}: ${this.escapeHtml(filename)}</p>
                </div>
            `;
            this.drawerContent.appendChild(loadingEl);
        }
    }

    /**
     * 隐藏文件加载状态
     */
    hideFileLoading() {
        const loadingEl = document.querySelector('.file-loading-overlay');
        if (loadingEl) {
            loadingEl.remove();
        }
    }

    /**
     * 显示成功消息
     */
    showSuccessMessage(message) {
        // 创建临时成功消息提示
        const toast = document.createElement('div');
        toast.className = 'success-toast';
        toast.innerHTML = `
            <div class="toast-content">
                <svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>${this.escapeHtml(message)}</span>
            </div>
        `;
        document.body.appendChild(toast);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    }

    /**
     * 显示文件编辑器
     */
    showFileEditor(fileData, filePath) {
        const filename = filePath.split('/').pop();
        const language = window.syntaxHighlighter ? 
            window.syntaxHighlighter.getLanguageFromExtension(filename) : 'text';
        const displayName = window.syntaxHighlighter ? 
            window.syntaxHighlighter.getLanguageDisplayName(language) : '文本文件';
        const fileIcon = window.syntaxHighlighter ? 
            window.syntaxHighlighter.getFileTypeIcon(filename) : '';

        // 创建编辑器模态框
        const modal = document.createElement('div');
        modal.className = 'file-editor-modal';
        modal.innerHTML = `
            <div class="file-editor-backdrop" onclick="filesDrawer.closeFileEditor()"></div>
            <div class="file-editor-container">
                <div class="file-editor-header">
                    <div class="file-editor-title">
                        <span class="file-name">
                            ${fileIcon} ${this.escapeHtml(filename)}
                            <span class="file-type-badge">${displayName}</span>
                        </span>
                        <span class="file-path">${this.escapeHtml(filePath)}</span>
                    </div>
                    <div class="file-editor-actions">
                        <button class="btn btn-sm btn-primary" onclick="filesDrawer.saveFile()">保存</button>
                        <button class="btn btn-sm btn-secondary" onclick="filesDrawer.closeFileEditor()">关闭</button>
                    </div>
                </div>
                <div class="file-editor-content">
                    <textarea class="file-editor-textarea" placeholder="文件内容..." data-language="${language}">${this.escapeHtml(fileData.content)}</textarea>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.selectedFile = fileData;
        this.selectedFile.path = filePath; // 确保路径正确
        
        // 获取编辑器元素
        const textarea = modal.querySelector('.file-editor-textarea');
        
        // 应用语法高亮
        if (window.syntaxHighlighter && language !== 'text') {
            // 给容器添加语法高亮类
            const content = modal.querySelector('.file-editor-content');
            content.classList.add('syntax-highlighted');
            
            // 为textarea添加语法高亮增强
            this.syntaxHighlightInstance = window.syntaxHighlighter.enhanceTextarea(textarea, filename);
        }
        
        // 聚焦到编辑器
        textarea.focus();
    }

    /**
     * 保存文件
     */
    async saveFile() {
        if (!this.selectedFile) return;

        const modal = document.querySelector('.file-editor-modal');
        const textarea = modal?.querySelector('.file-editor-textarea');
        
        if (!textarea) return;

        try {
            // 根据是否为任务页签选择正确的项目路径
            const projectPath = this.isCurrentTabTaskTab() && this.currentTaskInfo 
                ? this.currentTaskInfo.workDirectory 
                : this.currentProject.path;
                
            const response = await fetch('/api/files/write', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    filePath: this.selectedFile.path,
                    content: textarea.value,
                    projectPath: projectPath
                })
            });

            if (response.ok) {
                console.log('文件保存成功');
                this.showSuccessMessage('文件保存成功');
                this.closeFileEditor();
            } else {
                const error = await response.json();
                this.showError(error.error || t('files.saveFileFailed'));
            }
        } catch (error) {
            console.error('保存文件错误:', error);
            this.showError(t('files.networkErrorSave'));
        }
    }

    /**
     * 关闭文件编辑器
     */
    closeFileEditor() {
        // 清理语法高亮实例
        if (this.syntaxHighlightInstance && this.syntaxHighlightInstance.destroy) {
            this.syntaxHighlightInstance.destroy();
            this.syntaxHighlightInstance = null;
        }
        
        const modal = document.querySelector('.file-editor-modal');
        if (modal) {
            modal.remove();
        }
        this.selectedFile = null;
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
            console.error('FilesDrawer failed to load system config:', error);
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
        
        // 前端无法直接获取系统路径，必须依赖后端配置API
        console.warn('FilesDrawer系统配置未加载，无法获取用户主目录');
        return null;
    }
}

// 创建全局实例
window.filesDrawer = new FilesDrawer();