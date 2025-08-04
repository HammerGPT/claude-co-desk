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
        
        this.initElements();
        this.initEventListeners();
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
        
        console.log('打开文件抽屉:', this.currentProject.name);
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
            this.drawerTitle.textContent = project ? `${project.displayName || project.name} - 文件` : '项目文件';
        }
        
        // 如果抽屉已打开，重新加载文件
        if (this.isOpen) {
            this.loadFiles();
        }
    }

    /**
     * 加载文件列表
     */
    async loadFiles() {
        if (!this.currentProject) return;
        
        this.setLoading(true);
        
        try {
            const response = await fetch(`/api/projects/${this.currentProject.name}/files`);
            if (response.ok) {
                const data = await response.json();
                this.files = data.files || [];
                this.renderFiles();
            } else {
                console.error('加载文件失败:', response.statusText);
                this.showError('加载文件失败');
            }
        } catch (error) {
            console.error('加载文件错误:', error);
            this.showError('网络错误，无法加载文件');
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * 渲染文件列表
     */
    renderFiles() {
        if (!this.drawerContent) return;

        if (this.files.length === 0) {
            this.drawerContent.innerHTML = `
                <div class="empty-files">
                    <p>此项目暂无文件</p>
                </div>
            `;
            return;
        }

        let html = '<div class="files-tree">';
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
     * 打开文件（在终端中执行claude命令）
     */
    async openFile(filePath) {
        if (!this.currentProject) return;
        
        // 通过终端执行claude命令打开文件
        const event = new CustomEvent('terminalCommand', {
            detail: {
                command: `claude "${filePath}"`,
                project: this.currentProject
            }
        });
        document.dispatchEvent(event);
        
        // 关闭抽屉
        this.close();
        
        console.log('打开文件:', filePath);
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
                    <p>加载文件中...</p>
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
                    <p>❌ ${this.escapeHtml(message)}</p>
                    <button onclick="filesDrawer.loadFiles()" class="btn btn-sm btn-primary">重试</button>
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
}

// 创建全局实例
window.filesDrawer = new FilesDrawer();