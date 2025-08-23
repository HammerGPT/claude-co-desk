/**
 * 文件夹选择器组件
 * 用于"添加新项目"功能的文件夹浏览和选择
 */

class FolderSelector {
    constructor() {
        this.isOpen = false;
        this.selectedPath = '';
        this.folders = [];
        this.expandedDirs = new Set();
        this.existingProjects = [];
        this.loading = false;
        this.searchQuery = '';
        this.allFolders = []; // 保存所有文件夹用于搜索
        this.workingDirectory = null; // 工作目录，从用户环境获取
        this.systemConfig = null; // 系统配置
        
        this.initElements();
        this.initEventListeners();
        this.loadConfig(); // 加载系统配置
    }

    /**
     * 初始化DOM元素
     */
    initElements() {
        // 创建模态框HTML
        this.createModal();
        
        this.modal = document.getElementById('folder-selector-modal');
        this.overlay = document.getElementById('folder-selector-overlay');
        this.folderTree = document.getElementById('folder-tree');
        this.currentPathDisplay = document.getElementById('current-path-display');
        this.confirmBtn = document.getElementById('folder-confirm-btn');
        this.cancelBtn = document.getElementById('folder-cancel-btn');
        this.closeBtn = document.getElementById('folder-close-btn');
        this.searchInput = document.getElementById('folder-search-input');
        this.searchClearBtn = document.getElementById('folder-search-clear');
        
    }

    /**
     * 创建模态框HTML结构
     */
    createModal() {
        const modalHTML = `
            <div id="folder-selector-overlay" class="folder-selector-overlay">
                <div id="folder-selector-modal" class="folder-selector-modal">
                    <div class="folder-selector-header">
                        <h3><img src="/static/assets/icons/interface/folder.png" width="20" height="20" alt=""> ${t('project.selectFolder')}</h3>
                        <button id="folder-close-btn" class="folder-close-btn">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    
                    <div class="folder-search-container">
                        <div class="folder-search-input-wrapper">
                            <svg class="folder-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="11" cy="11" r="8"></circle>
                                <path d="m21 21-4.35-4.35"></path>
                            </svg>
                            <input type="text" id="folder-search-input" placeholder="${t('project.searchFolders')}" class="folder-search-input">
                            <button id="folder-search-clear" class="folder-search-clear hidden" type="button">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                    </div>
                    
                    <div class="folder-selector-content">
                        <div id="folder-tree" class="folder-tree">
                            <div class="loading-spinner">${t('project.loading')}</div>
                        </div>
                    </div>
                    
                    <div class="folder-selector-footer">
                        <div id="current-path-display" class="current-path">
                            <span class="path-label">${t('project.currentSelection')}</span>
                            <span class="path-value">${t('project.notSelected')}</span>
                        </div>
                        <div class="folder-selector-buttons">
                            <button id="folder-cancel-btn" class="btn btn-secondary">${t('project.cancel')}</button>
                            <button id="folder-confirm-btn" class="btn btn-primary" disabled>${t('project.confirmAdd')}</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    /**
     * 初始化事件监听器
     */
    initEventListeners() {
        // 关闭按钮
        this.closeBtn?.addEventListener('click', () => {
            this.close();
        });

        // 取消按钮
        this.cancelBtn?.addEventListener('click', () => {
            this.close();
        });

        // 确认按钮
        this.confirmBtn?.addEventListener('click', () => {
            this.confirmSelection();
        });

        // 点击遮罩关闭
        this.overlay?.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });

        // ESC键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        // 搜索功能
        this.searchInput?.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });

        // 清除搜索
        this.searchClearBtn?.addEventListener('click', () => {
            this.clearSearch();
        });
        
        // 注册语言切换刷新方法
        if (window.i18n) {
            window.i18n.registerComponent('folderSelector', () => {
                // 重新渲染文件夹树（如果已加载）
                if (this.folders.length > 0) {
                    this.renderFolders();
                }
            });
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
            console.error('Folder selector failed to load system config:', error);
        }
    }

    /**
     * 获取工作目录
     */
    async getWorkingDirectory() {
        if (this.workingDirectory) {
            return this.workingDirectory;
        }
        
        try {
            // 从环境信息获取工作目录
            const response = await fetch('/api/environment');
            if (response.ok) {
                const data = await response.json();
                this.workingDirectory = data.homeDirectory || data.workingDirectory;
            }
        } catch (error) {
            console.error('获取工作目录失败:', error);
        }
        
        // 备用方案 - 使用系统配置
        if (!this.workingDirectory && this.systemConfig?.userHome) {
            this.workingDirectory = this.systemConfig.userHome;
        }
        
        // 最终备用方案 - 如果系统配置也未加载
        if (!this.workingDirectory) {
            console.warn('无法获取用户主目录，使用系统根目录');
            this.workingDirectory = '/';
        }
        
        return this.workingDirectory;
    }

    /**
     * 打开文件夹选择器
     */
    async open() {
        this.isOpen = true;
        this.selectedPath = '';
        this.expandedDirs.clear();
        
        // 显示模态框
        this.overlay?.classList.add('open');
        document.body.classList.add('modal-open');
        
        // 获取工作目录
        const workingDir = await this.getWorkingDirectory();
        
        // 加载已有项目列表
        await this.loadExistingProjects();
        
        // 加载文件夹树
        await this.loadFolders(workingDir);
    }

    /**
     * 关闭文件夹选择器
     */
    close() {
        this.isOpen = false;
        this.selectedPath = '';
        
        // 隐藏模态框
        this.overlay?.classList.remove('open');
        document.body.classList.remove('modal-open');
        
        // 更新UI状态
        this.updateSelection('');
    }

    /**
     * 加载已有项目列表
     */
    async loadExistingProjects() {
        try {
            const response = await fetch('/api/projects');
            if (response.ok) {
                const data = await response.json();
                this.existingProjects = data.projects || [];
            }
        } catch (error) {
            console.error('加载现有项目失败:', error);
            this.existingProjects = [];
        }
    }

    /**
     * 加载文件夹树
     */
    async loadFolders(path) {
        this.setLoading(true);
        
        try {
            const response = await fetch(`/api/browse-folders?path=${encodeURIComponent(path)}&max_depth=2`);
            if (response.ok) {
                const data = await response.json();
                this.folders = data.folders || [];
                this.renderFolders();
            } else {
                console.error('加载文件夹失败:', response.statusText);
                this.showError(t('files.loadFoldersFailed'));
            }
        } catch (error) {
            console.error('加载文件夹错误:', error);
            this.showError(t('files.networkErrorFolders'));
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * 动态加载子文件夹
     */
    async loadSubfolders(parentPath) {
        try {
            const response = await fetch(`/api/browse-folders?path=${encodeURIComponent(parentPath)}&max_depth=1`);
            if (response.ok) {
                const data = await response.json();
                const subfolders = data.folders || [];
                
                // 找到父文件夹并更新其children
                this.updateFolderChildren(this.folders, parentPath, subfolders);
            }
        } catch (error) {
            console.error('加载子文件夹错误:', error);
        }
    }

    /**
     * 递归更新文件夹的children
     */
    updateFolderChildren(folders, targetPath, newChildren) {
        for (let folder of folders) {
            if (folder.path === targetPath) {
                folder.children = newChildren;
                return true;
            }
            if (folder.children && folder.children.length > 0) {
                if (this.updateFolderChildren(folder.children, targetPath, newChildren)) {
                    return true;
                }
            }
        }
        return false;
    }


    /**
     * 渲染文件夹树
     */
    renderFolders() {
        if (!this.folderTree) return;

        let html = '';
        
        // 根据搜索条件过滤文件夹
        const displayFolders = this.searchQuery ? 
            this.searchFolders(this.folders, this.searchQuery) : 
            this.folders;
        
        if (displayFolders.length === 0) {
            const emptyMessage = this.searchQuery ? 
                `未找到包含 "${this.searchQuery}" 的文件夹` : 
                t('project.noFolders');
            html = `
                <div class="empty-folders">
                    <p>${emptyMessage}</p>
                </div>
            `;
        } else {
            html = this.renderFolderItems(displayFolders, 0);
        }
        
        this.folderTree.innerHTML = html;
    }

    /**
     * 递归渲染文件夹项
     */
    renderFolderItems(folders, indent = 0) {
        let html = '';
        
        folders.forEach(folder => {
            const isExpanded = this.expandedDirs.has(folder.path);
            const hasChildren = (folder.children && folder.children.length > 0) || folder.hasChildren;
            const isSelected = this.selectedPath === folder.path;
            const isExistingProject = this.isExistingProject(folder.path);
            
            html += `
                <div class="folder-item ${isSelected ? 'selected' : ''} ${isExistingProject ? 'existing-project' : ''}" 
                     style="padding-left: ${indent * 20 + 8}px">
                    ${hasChildren ? 
                        `<span class="expand-arrow ${isExpanded ? 'expanded' : ''}" 
                              onclick="folderSelector.handleExpandClick('${folder.path}', event)">
                            ${isExpanded ? '▼' : '▶'}
                         </span>` : 
                        `<span class="expand-placeholder"></span>`
                    }
                    <div class="folder-content" 
                         onclick="folderSelector.handleFolderClick('${folder.path}', ${hasChildren})">
                        <div class="folder-icon">
                            ${isExpanded ? 
                                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5L20 17H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2"></path></svg>' :
                                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>'
                            }
                        </div>
                        <span class="folder-name">${folder.name}</span>
                        ${isExistingProject ? '<span class="existing-badge">已存在项目</span>' : ''}
                    </div>
                </div>
            `;
            
            // 如果展开且有子文件夹，递归渲染
            if (isExpanded && hasChildren) {
                html += this.renderFolderItems(folder.children, indent + 1);
            }
        });
        
        return html;
    }

    /**
     * 处理文件夹点击事件
     */
    async handleFolderClick(folderPath, hasChildren) {
        // 选择文件夹
        this.selectFolder(folderPath);
    }

    /**
     * 处理展开箭头点击事件
     */
    async handleExpandClick(folderPath, event) {
        event.stopPropagation(); // 阻止触发文件夹选择
        
        if (this.expandedDirs.has(folderPath)) {
            // 收起
            this.expandedDirs.delete(folderPath);
        } else {
            // 展开，动态加载子文件夹
            this.expandedDirs.add(folderPath);
            await this.loadSubfolders(folderPath);
        }
        
        this.renderFolders();
    }

    /**
     * 选择文件夹
     */
    selectFolder(folderPath) {
        this.selectedPath = folderPath;
        this.updateSelection(folderPath);
        this.renderFolders(); // 重新渲染以显示选中状态
    }

    /**
     * 更新选择状态显示
     */
    updateSelection(path) {
        if (!this.currentPathDisplay || !this.confirmBtn) return;
        
        const pathValue = this.currentPathDisplay.querySelector('.path-value');
        if (pathValue) {
            pathValue.textContent = path || t('project.notSelected');
        }
        
        // 启用/禁用确认按钮
        this.confirmBtn.disabled = !path || this.isExistingProject(path);
    }

    /**
     * 检查是否为已存在的项目
     */
    isExistingProject(folderPath) {
        return this.existingProjects.some(project => project.path === folderPath);
    }

    /**
     * 确认选择
     */
    async confirmSelection() {
        if (!this.selectedPath) {
            return;
        }
        
        if (this.isExistingProject(this.selectedPath)) {
            alert(t('project.alreadyExists'));
            return;
        }
        
        
        // 保存选中的路径，因为close()会清空selectedPath
        const selectedPath = this.selectedPath;
        
        // 关闭选择器
        this.close();
        
        // 创建新项目会话
        this.createNewProjectSession(selectedPath);
    }

    /**
     * 创建新项目会话
     */
    createNewProjectSession(folderPath) {
        // 生成唯一的任务ID
        const timestamp = Date.now();
        const taskId = `new-project-${timestamp}`;
        const taskName = t('project.newProjectSession');
        
        
        // 使用现有的创建任务页签机制
        if (window.enhancedSidebar && typeof window.enhancedSidebar.createTaskTab === 'function') {
            window.enhancedSidebar.createTaskTab(
                taskId,
                taskName,
                '', // 空的初始命令，直接启动claude
                folderPath
            );
        } else {
            console.error('无法找到 enhancedSidebar.createTaskTab 方法');
            alert(t('project.createFailed'));
        }
    }

    /**
     * 处理搜索
     */
    handleSearch(query) {
        this.searchQuery = query.toLowerCase().trim();
        
        // 显示/隐藏清除按钮
        if (this.searchClearBtn) {
            if (this.searchQuery) {
                this.searchClearBtn.classList.remove('hidden');
            } else {
                this.searchClearBtn.classList.add('hidden');
            }
        }
        
        this.renderFolders();
    }

    /**
     * 清除搜索
     */
    clearSearch() {
        if (this.searchInput) {
            this.searchInput.value = '';
        }
        this.searchQuery = '';
        if (this.searchClearBtn) {
            this.searchClearBtn.classList.add('hidden');
        }
        this.renderFolders();
    }

    /**
     * 递归搜索文件夹
     */
    searchFolders(folders, query) {
        if (!query) return folders;
        
        const results = [];
        
        for (const folder of folders) {
            // 检查文件夹名称是否匹配
            const nameMatches = folder.name.toLowerCase().includes(query);
            
            // 递归搜索子文件夹
            let childResults = [];
            if (folder.children && folder.children.length > 0) {
                childResults = this.searchFolders(folder.children, query);
            }
            
            // 如果当前文件夹匹配或有子文件夹匹配，就包含它
            if (nameMatches || childResults.length > 0) {
                const folderCopy = {
                    ...folder,
                    children: childResults
                };
                results.push(folderCopy);
            }
        }
        
        return results;
    }

    /**
     * 设置加载状态
     */
    setLoading(loading) {
        this.loading = loading;
        if (!this.folderTree) return;
        
        if (loading) {
            this.folderTree.innerHTML = `<div class="loading-spinner">${t('common.loading')}</div>`;
        }
    }

    /**
     * 显示错误信息
     */
    showError(message) {
        if (!this.folderTree) return;
        
        this.folderTree.innerHTML = `
            <div class="error-message">
                <p>${message}</p>
                <button onclick="folderSelector.loadFolders()" class="btn btn-sm btn-primary">${t('common.retry')}</button>
            </div>
        `;
    }
}

// 创建全局实例，确保DOM已加载
document.addEventListener('DOMContentLoaded', () => {
    window.folderSelector = new FolderSelector();
});

// 如果DOM已经加载完成，立即初始化
if (document.readyState !== 'loading') {
    window.folderSelector = new FolderSelector();
}