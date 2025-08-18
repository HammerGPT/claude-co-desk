/**
 * 路径自动补全组件
 * 为手动输入框添加智能文件搜索功能
 */

class PathInputEnhancer {
    constructor(inputElement, getWorkingDirectory, onPathSelected) {
        this.input = inputElement;
        this.getWorkingDirectory = getWorkingDirectory; // 函数，返回当前工作目录
        this.onPathSelected = onPathSelected; // 回调函数，当路径被选择时调用
        this.dropdown = null;
        this.currentResults = [];
        this.selectedIndex = -1;
        this.searchTimeout = null;
        
        this.init();
    }
    
    init() {
        if (!this.input) return;
        
        this.createDropdown();
        this.setupEventListeners();
    }
    
    createDropdown() {
        // 创建下拉容器
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'path-autocomplete-dropdown';
        this.dropdown.style.display = 'none';
        
        // 插入到输入框后面
        this.input.parentNode.insertBefore(this.dropdown, this.input.nextSibling);
        
        // 添加CSS样式
        this.addStyles();
    }
    
    addStyles() {
        if (document.getElementById('path-autocomplete-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'path-autocomplete-styles';
        style.textContent = `
            .path-autocomplete-dropdown {
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: hsl(var(--card));
                border: 1px solid hsl(var(--border));
                border-top: none;
                border-radius: 0 0 var(--radius) var(--radius);
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                z-index: 1000;
                max-height: 200px;
                overflow-y: auto;
            }
            
            .path-autocomplete-item {
                padding: 8px 12px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
                border-bottom: 1px solid hsl(var(--border));
            }
            
            .path-autocomplete-item:last-child {
                border-bottom: none;
            }
            
            .path-autocomplete-item:hover,
            .path-autocomplete-item.selected {
                background: hsl(var(--accent));
            }
            
            .path-autocomplete-icon {
                width: 16px;
                height: 16px;
                flex-shrink: 0;
                color: hsl(var(--muted-foreground));
            }
            
            .path-autocomplete-content {
                flex: 1;
                min-width: 0;
            }
            
            .path-autocomplete-name {
                font-weight: 500;
                color: hsl(var(--foreground));
            }
            
            .path-autocomplete-path {
                font-size: 12px;
                color: hsl(var(--muted-foreground));
                margin-top: 2px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .path-autocomplete-loading {
                padding: 12px;
                text-align: center;
                color: hsl(var(--muted-foreground));
                font-size: 14px;
            }
            
            .path-autocomplete-empty {
                padding: 12px;
                text-align: center;
                color: hsl(var(--muted-foreground));
                font-size: 14px;
            }
            
            /* 确保父容器有相对定位 */
            .manual-path {
                position: relative;
            }
        `;
        document.head.appendChild(style);
    }
    
    setupEventListeners() {
        // 输入事件
        this.input.addEventListener('input', (e) => {
            this.handleInput(e.target.value);
        });
        
        // 键盘事件
        this.input.addEventListener('keydown', (e) => {
            this.handleKeydown(e);
        });
        
        // 失焦事件（优化时机）
        this.input.addEventListener('blur', (e) => {
            // 恢复原始placeholder（当输入框为空时）
            setTimeout(() => {
                const activeElement = document.activeElement;
                if (!this.dropdown.contains(activeElement) && activeElement !== this.input) {
                    this.hideDropdown();
                    // 如果输入框为空，恢复placeholder
                    if (!this.input.value.trim() && this.originalPlaceholder) {
                        this.input.placeholder = this.originalPlaceholder;
                    }
                }
            }, 200);
        });
        
        // 聚焦事件 - 光标进入时清空placeholder
        this.input.addEventListener('focus', () => {
            // 保存原始placeholder并清空
            if (!this.originalPlaceholder) {
                this.originalPlaceholder = this.input.placeholder;
            }
            this.input.placeholder = '';
            
            if (this.currentResults.length > 0 && this.input.value.trim().length >= 2) {
                this.showDropdown();
            }
        });
        
        // 点击外部关闭（改进检测逻辑）
        document.addEventListener('click', (e) => {
            if (!this.input.contains(e.target) && 
                !this.dropdown.contains(e.target) && 
                this.dropdown.style.display === 'block') {
                this.hideDropdown();
            }
        });
    }
    
    handleInput(value) {
        // 清除之前的搜索定时器
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
        
        const query = value.trim();
        
        // 如果输入为空或太短，隐藏下拉框
        if (query.length < 2) {
            this.hideDropdown();
            return;
        }
        
        // 防抖搜索 - 减少延迟提高响应性
        this.searchTimeout = setTimeout(() => {
            this.performSearch(query);
        }, 150);
    }
    
    async performSearch(query) {
        try {
            // 获取工作目录
            const workingDirectory = this.getWorkingDirectory();
            if (!workingDirectory) {
                console.warn('无法获取工作目录');
                return;
            }
            
            // 显示加载状态
            this.showLoading();
            
            // 调用搜索API - 减少最大结果数到10个
            const response = await fetch(`/api/search-files?query=${encodeURIComponent(query)}&working_directory=${encodeURIComponent(workingDirectory)}&file_types=all&max_results=10`);
            
            if (!response.ok) {
                throw new Error(`搜索请求失败: ${response.status}`);
            }
            
            const data = await response.json();
            this.currentResults = data.results || [];
            this.selectedIndex = -1;
            
            // 显示结果
            this.showResults();
            
        } catch (error) {
            console.error('搜索文件时出错:', error);
            this.showError('搜索失败');
        }
    }
    
    showLoading() {
        this.dropdown.innerHTML = '<div class="path-autocomplete-loading">搜索中...</div>';
        this.showDropdown();
    }
    
    showError(message) {
        this.dropdown.innerHTML = `<div class="path-autocomplete-empty">${message}</div>`;
        this.showDropdown();
    }
    
    showResults() {
        // 添加调试日志
        console.log(`显示搜索结果，共${this.currentResults.length}项`);
        
        if (this.currentResults.length === 0) {
            this.dropdown.innerHTML = '<div class="path-autocomplete-empty">未找到匹配的文件或文件夹</div>';
        } else {
            const html = this.currentResults.map((item, index) => {
                const iconSvg = item.isDirectory ? 
                    `<svg class="path-autocomplete-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                    </svg>` :
                    `<svg class="path-autocomplete-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>`;
                
                return `
                    <div class="path-autocomplete-item" data-index="${index}" data-path="${this.escapeHtml(item.path)}">
                        ${iconSvg}
                        <div class="path-autocomplete-content">
                            <div class="path-autocomplete-name">${this.escapeHtml(item.name)}</div>
                            <div class="path-autocomplete-path">${this.escapeHtml(item.path)}</div>
                        </div>
                    </div>
                `;
            }).join('');
            
            this.dropdown.innerHTML = html;
            
            // 添加点击事件
            this.dropdown.querySelectorAll('.path-autocomplete-item').forEach(item => {
                item.addEventListener('click', () => {
                    const path = item.getAttribute('data-path');
                    this.selectPath(path);
                });
            });
        }
        
        this.showDropdown();
    }
    
    handleKeydown(e) {
        if (!this.dropdown || this.dropdown.style.display === 'none') {
            return;
        }
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.selectedIndex = Math.min(this.selectedIndex + 1, this.currentResults.length - 1);
                this.updateSelection();
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
                this.updateSelection();
                break;
                
            case 'Enter':
                e.preventDefault();
                if (this.selectedIndex >= 0 && this.currentResults[this.selectedIndex]) {
                    this.selectPath(this.currentResults[this.selectedIndex].path);
                }
                break;
                
            case 'Escape':
                this.hideDropdown();
                break;
        }
    }
    
    updateSelection() {
        const items = this.dropdown.querySelectorAll('.path-autocomplete-item');
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === this.selectedIndex);
        });
        
        // 滚动到选中项
        if (this.selectedIndex >= 0 && items[this.selectedIndex]) {
            items[this.selectedIndex].scrollIntoView({ block: 'nearest' });
        }
    }
    
    selectPath(path) {
        // 如果有路径选择回调，直接调用它添加资源
        if (this.onPathSelected && typeof this.onPathSelected === 'function') {
            this.onPathSelected(path);
            // 清空输入框，供下次使用
            this.input.value = '';
            // 恢复placeholder
            if (this.originalPlaceholder) {
                this.input.placeholder = this.originalPlaceholder;
            }
        } else {
            // 回退到原来的行为：填入输入框
            this.input.value = path;
            // 触发change事件，让其他组件知道值已更改
            const changeEvent = new Event('change', { bubbles: true });
            this.input.dispatchEvent(changeEvent);
        }
        
        this.hideDropdown();
        
        // 聚焦回输入框
        this.input.focus();
    }
    
    showDropdown() {
        console.log('显示下拉框');
        this.dropdown.style.display = 'block';
    }
    
    hideDropdown() {
        console.log('隐藏下拉框');
        this.dropdown.style.display = 'none';
        this.selectedIndex = -1;
        this.currentResults = []; // 清空结果，避免状态污染
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    destroy() {
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
        if (this.dropdown && this.dropdown.parentNode) {
            this.dropdown.parentNode.removeChild(this.dropdown);
        }
    }
}

// 导出供其他模块使用
window.PathInputEnhancer = PathInputEnhancer;