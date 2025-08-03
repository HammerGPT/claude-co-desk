/**
 * 文件树组件 - 移植自claudecodeui/src/components/FileTree.jsx
 * 支持多视图模式、文件操作和代码编辑器集成
 */

class FileTree {
    constructor() {
        this.selectedProject = null;
        this.files = [];
        this.expandedDirs = new Set();
        this.loading = false;
        this.viewMode = 'detailed'; // 'simple', 'detailed', 'compact'
        this.selectedFile = null;
        this.selectedImage = null;
        
        this.initElements();
        this.initEventListeners();
        this.loadViewMode();
    }

    /**
     * 初始化DOM元素
     */
    initElements() {
        this.container = document.getElementById('file-tree');
        this.filesPanel = document.getElementById('files-panel');
        this.createViewModeToggle();
    }

    /**
     * 创建视图模式切换器
     */
    createViewModeToggle() {
        if (!this.filesPanel) return;

        const header = this.filesPanel.querySelector('.files-header');
        if (!header) return;

        const toggleContainer = document.createElement('div');
        toggleContainer.className = 'view-mode-toggle';
        toggleContainer.innerHTML = `
            <div class="view-toggle-buttons">
                <button class="view-toggle-btn" data-mode="simple" title="简单视图">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="8" y1="6" x2="21" y2="6"></line>
                        <line x1="8" y1="12" x2="21" y2="12"></line>
                        <line x1="8" y1="18" x2="21" y2="18"></line>
                        <line x1="3" y1="6" x2="3.01" y2="6"></line>
                        <line x1="3" y1="12" x2="3.01" y2="12"></line>
                        <line x1="3" y1="18" x2="3.01" y2="18"></line>
                    </svg>
                </button>
                <button class="view-toggle-btn" data-mode="compact" title="紧凑视图">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="1"></circle>
                        <circle cx="19" cy="12" r="1"></circle>
                        <circle cx="5" cy="12" r="1"></circle>
                    </svg>
                </button>
                <button class="view-toggle-btn" data-mode="detailed" title="详细视图">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="9" y1="9" x2="15" y2="9"></line>
                        <line x1="9" y1="15" x2="15" y2="15"></line>
                    </svg>
                </button>
            </div>
        `;

        header.appendChild(toggleContainer);
        this.updateViewModeButtons();
    }

    /**
     * 初始化事件监听器
     */
    initEventListeners() {
        // 项目选择事件
        document.addEventListener('projectSelected', (e) => {
            this.setSelectedProject(e.detail.project);
        });

        // 视图模式切换
        document.addEventListener('click', (e) => {
            if (e.target.closest('.view-toggle-btn')) {
                const btn = e.target.closest('.view-toggle-btn');
                const mode = btn.getAttribute('data-mode');
                this.changeViewMode(mode);
            }
        });

        // ESC键关闭编辑器
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeEditor();
                this.closeImageViewer();
            }
        });
    }

    /**
     * 加载视图模式偏好
     */
    loadViewMode() {
        const savedMode = localStorage.getItem('file-tree-view-mode');
        if (savedMode && ['simple', 'detailed', 'compact'].includes(savedMode)) {
            this.viewMode = savedMode;
        }
        this.updateViewModeButtons();
    }

    /**
     * 切换视图模式
     */
    changeViewMode(mode) {
        this.viewMode = mode;
        localStorage.setItem('file-tree-view-mode', mode);
        this.updateViewModeButtons();
        this.renderFiles();
    }

    /**
     * 更新视图模式按钮状态
     */
    updateViewModeButtons() {
        const buttons = document.querySelectorAll('.view-toggle-btn');
        buttons.forEach(btn => {
            const mode = btn.getAttribute('data-mode');
            if (mode === this.viewMode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    /**
     * 设置选中的项目
     */
    setSelectedProject(project) {
        this.selectedProject = project;
        this.fetchFiles();
    }

    /**
     * 获取项目文件
     */
    async fetchFiles() {
        if (!this.selectedProject) return;

        this.setLoading(true);
        
        try {
            const response = await fetch(`/api/projects/${this.selectedProject.name}/files`);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('文件获取失败:', response.status, errorText);
                this.files = [];
                this.showError('获取文件列表失败');
                return;
            }
            
            this.files = await response.json();
            this.renderFiles();
            
        } catch (error) {
            console.error('获取文件错误:', error);
            this.files = [];
            this.showError('网络错误，无法获取文件列表');
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * 切换目录展开状态
     */
    toggleDirectory(path) {
        if (this.expandedDirs.has(path)) {
            this.expandedDirs.delete(path);
        } else {
            this.expandedDirs.add(path);
        }
        this.renderFiles();
    }

    /**
     * 渲染文件列表
     */
    renderFiles() {
        if (!this.container) return;

        if (this.files.length === 0) {
            this.container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                        </svg>
                    </div>
                    <h4>未找到文件</h4>
                    <p>检查项目路径是否可访问</p>
                </div>
            `;
            return;
        }

        // 根据视图模式渲染
        let content = '';
        
        if (this.viewMode === 'detailed') {
            content = this.renderDetailedHeader() + this.renderDetailedView(this.files);
        } else if (this.viewMode === 'compact') {
            content = this.renderCompactView(this.files);
        } else {
            content = this.renderSimpleView(this.files);
        }

        this.container.innerHTML = content;
    }

    /**
     * 渲染详细视图表头
     */
    renderDetailedHeader() {
        return `
            <div class="file-tree-header">
                <div class="file-tree-row header-row">
                    <div class="file-name-col">名称</div>
                    <div class="file-size-col">大小</div>
                    <div class="file-modified-col">修改时间</div>
                    <div class="file-permissions-col">权限</div>
                </div>
            </div>
        `;
    }

    /**
     * 渲染简单视图
     */
    renderSimpleView(items, level = 0) {
        return items.map(item => this.renderSimpleItem(item, level)).join('');
    }

    /**
     * 渲染简单视图项
     */
    renderSimpleItem(item, level) {
        const isExpanded = this.expandedDirs.has(item.path);
        const indent = level * 16;
        
        let html = `
            <div class="file-item simple-item" style="padding-left: ${indent + 12}px">
                <div class="file-item-content" onclick="fileTree.handleItemClick('${item.path}', '${item.type}')">
                    <div class="file-icon">
                        ${this.getFileIcon(item)}
                    </div>
                    <span class="file-name">${this.escapeHtml(item.name)}</span>
                </div>
            </div>
        `;

        // 如果是展开的目录，渲染子项
        if (item.type === 'directory' && isExpanded && item.children) {
            html += this.renderSimpleView(item.children, level + 1);
        }

        return html;
    }

    /**
     * 渲染紧凑视图
     */
    renderCompactView(items, level = 0) {
        return items.map(item => this.renderCompactItem(item, level)).join('');
    }

    /**
     * 渲染紧凑视图项
     */
    renderCompactItem(item, level) {
        const isExpanded = this.expandedDirs.has(item.path);
        const indent = level * 16;
        
        let html = `
            <div class="file-item compact-item" style="padding-left: ${indent + 12}px">
                <div class="file-item-content" onclick="fileTree.handleItemClick('${item.path}', '${item.type}')">
                    <div class="file-main-info">
                        <div class="file-icon">
                            ${this.getFileIcon(item)}
                        </div>
                        <span class="file-name">${this.escapeHtml(item.name)}</span>
                    </div>
                    <div class="file-meta-info">
                        ${item.type === 'file' ? `
                            <span class="file-size">${this.formatFileSize(item.size)}</span>
                            <span class="file-permissions">${item.permissionsRwx}</span>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        // 如果是展开的目录，渲染子项
        if (item.type === 'directory' && isExpanded && item.children) {
            html += this.renderCompactView(item.children, level + 1);
        }

        return html;
    }

    /**
     * 渲染详细视图
     */
    renderDetailedView(items, level = 0) {
        return items.map(item => this.renderDetailedItem(item, level)).join('');
    }

    /**
     * 渲染详细视图项
     */
    renderDetailedItem(item, level) {
        const isExpanded = this.expandedDirs.has(item.path);
        const indent = level * 16;
        
        let html = `
            <div class="file-item detailed-item">
                <div class="file-tree-row" style="padding-left: ${indent + 12}px" onclick="fileTree.handleItemClick('${item.path}', '${item.type}')">
                    <div class="file-name-col">
                        <div class="file-icon">
                            ${this.getFileIcon(item)}
                        </div>
                        <span class="file-name">${this.escapeHtml(item.name)}</span>
                    </div>
                    <div class="file-size-col">
                        ${item.type === 'file' ? this.formatFileSize(item.size) : '-'}
                    </div>
                    <div class="file-modified-col">
                        ${this.formatRelativeTime(item.modified)}
                    </div>
                    <div class="file-permissions-col">
                        ${item.permissionsRwx || '-'}
                    </div>
                </div>
            </div>
        `;

        // 如果是展开的目录，渲染子项
        if (item.type === 'directory' && isExpanded && item.children) {
            html += this.renderDetailedView(item.children, level + 1);
        }

        return html;
    }

    /**
     * 处理项目点击
     */
    handleItemClick(path, type) {
        if (type === 'directory') {
            this.toggleDirectory(path);
        } else if (this.isImageFile(path)) {
            this.openImageViewer(path);
        } else {
            this.openFileEditor(path);
        }
    }

    /**
     * 获取文件图标
     */
    getFileIcon(item) {
        if (item.type === 'directory') {
            const isExpanded = this.expandedDirs.has(item.path);
            return isExpanded ? `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-blue-500">
                    <path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5L20 17H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2"></path>
                </svg>
            ` : `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-muted">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
            `;
        }

        // 根据文件扩展名返回图标
        const ext = item.name.split('.').pop()?.toLowerCase();
        const codeExtensions = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'php', 'rb', 'go', 'rs'];
        const docExtensions = ['md', 'txt', 'doc', 'pdf'];
        const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'];

        if (codeExtensions.includes(ext)) {
            return `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-green-500">
                    <polyline points="16,18 22,12 16,6"></polyline>
                    <polyline points="8,6 2,12 8,18"></polyline>
                </svg>
            `;
        } else if (docExtensions.includes(ext)) {
            return `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-blue-500">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"></path>
                </svg>
            `;
        } else if (imageExtensions.includes(ext)) {
            return `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-purple-500">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="9" cy="9" r="2"></circle>
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>
                </svg>
            `;
        } else {
            return `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-muted">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"></path>
                </svg>
            `;
        }
    }

    /**
     * 检查是否为图片文件
     */
    isImageFile(filename) {
        const ext = filename.split('.').pop()?.toLowerCase();
        const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'];
        return imageExtensions.includes(ext);
    }

    /**
     * 格式化文件大小
     */
    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    /**
     * 格式化相对时间
     */
    formatRelativeTime(timestamp) {
        if (!timestamp) return '-';
        const now = new Date();
        const past = new Date(timestamp * 1000); // 转换为毫秒
        const diffInSeconds = Math.floor((now - past) / 1000);
        
        if (diffInSeconds < 60) return '刚刚';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} 分钟前`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} 小时前`;
        if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} 天前`;
        return past.toLocaleDateString();
    }

    /**
     * 打开文件编辑器
     */
    async openFileEditor(filePath) {
        try {
            const response = await fetch(`/api/files/read?file_path=${encodeURIComponent(filePath)}&project_path=${encodeURIComponent(this.selectedProject.path)}`);
            
            if (!response.ok) {
                const error = await response.json();
                alert(error.error || '读取文件失败');
                return;
            }
            
            const fileData = await response.json();
            this.showFileEditor(fileData);
            
        } catch (error) {
            console.error('读取文件错误:', error);
            alert('网络错误，无法读取文件');
        }
    }

    /**
     * 显示文件编辑器
     */
    showFileEditor(fileData) {
        // 创建编辑器模态框
        const modal = document.createElement('div');
        modal.className = 'file-editor-modal';
        modal.innerHTML = `
            <div class="file-editor-backdrop" onclick="fileTree.closeEditor()"></div>
            <div class="file-editor-container">
                <div class="file-editor-header">
                    <div class="file-editor-title">
                        <span class="file-name">${this.escapeHtml(fileData.path.split('/').pop())}</span>
                        <span class="file-path">${this.escapeHtml(fileData.path)}</span>
                    </div>
                    <div class="file-editor-actions">
                        <button class="btn btn-sm btn-primary" onclick="fileTree.saveFile()">保存</button>
                        <button class="btn btn-sm btn-secondary" onclick="fileTree.closeEditor()">关闭</button>
                    </div>
                </div>
                <div class="file-editor-content">
                    <textarea class="file-editor-textarea" placeholder="文件内容...">${this.escapeHtml(fileData.content)}</textarea>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.selectedFile = fileData;
        
        // 聚焦到编辑器
        const textarea = modal.querySelector('.file-editor-textarea');
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
            const response = await fetch('/api/files/write', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    filePath: this.selectedFile.path,
                    content: textarea.value,
                    projectPath: this.selectedProject.path
                })
            });

            if (response.ok) {
                console.log('文件保存成功');
                this.closeEditor();
            } else {
                const error = await response.json();
                alert(error.error || '保存文件失败');
            }
        } catch (error) {
            console.error('保存文件错误:', error);
            alert('网络错误，无法保存文件');
        }
    }

    /**
     * 关闭编辑器
     */
    closeEditor() {
        const modal = document.querySelector('.file-editor-modal');
        if (modal) {
            modal.remove();
        }
        this.selectedFile = null;
    }

    /**
     * 打开图片查看器
     */
    openImageViewer(filePath) {
        const modal = document.createElement('div');
        modal.className = 'image-viewer-modal';
        modal.innerHTML = `
            <div class="image-viewer-backdrop" onclick="fileTree.closeImageViewer()"></div>
            <div class="image-viewer-container">
                <div class="image-viewer-header">
                    <span class="image-name">${this.escapeHtml(filePath.split('/').pop())}</span>
                    <button class="btn btn-sm btn-secondary" onclick="fileTree.closeImageViewer()">关闭</button>
                </div>
                <div class="image-viewer-content">
                    <img src="file://${filePath}" alt="${this.escapeHtml(filePath.split('/').pop())}" />
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.selectedImage = filePath;
    }

    /**
     * 关闭图片查看器
     */
    closeImageViewer() {
        const modal = document.querySelector('.image-viewer-modal');
        if (modal) {
            modal.remove();
        }
        this.selectedImage = null;
    }

    /**
     * 设置加载状态
     */
    setLoading(loading) {
        this.loading = loading;
        
        if (this.container) {
            if (loading) {
                this.container.innerHTML = `
                    <div class="loading-state">
                        <div class="spinner"></div>
                        <p>加载文件中...</p>
                    </div>
                `;
            }
        }
    }

    /**
     * 显示错误
     */
    showError(message) {
        if (this.container) {
            this.container.innerHTML = `
                <div class="error-state">
                    <p class="error-message">❌ ${this.escapeHtml(message)}</p>
                    <button onclick="fileTree.fetchFiles()" class="btn btn-sm btn-primary">重试</button>
                </div>
            `;
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
window.fileTree = new FileTree();