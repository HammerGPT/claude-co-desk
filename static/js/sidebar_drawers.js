/**
 * 侧边栏抽屉管理器
 * 负责管理任务和项目抽屉的展开/折叠状态
 */

class SidebarDrawers {
    constructor() {
        this.expandedDrawers = new Set(['tasks', 'projects']); // 默认展开任务和项目
        this.drawerConfigs = {
            tasks: { 
                title: '任务', 
                defaultExpanded: true,
                storageKey: 'tasks_drawer_expanded'
            },
            projects: { 
                title: '项目', 
                defaultExpanded: true,
                storageKey: 'projects_drawer_expanded'
            }
        };
        
        this.initElements();
        this.loadStateFromStorage();
        this.initEventListeners();
        this.updateAllDrawers();
        
        // 立即进行一次基于静态内容的高度计算
        this.scheduleImmediateHeightCheck();
        
        // 延迟进行组件协调，确保其他管理器都已初始化
        this.scheduleComponentCoordination();
        
    }

    /**
     * 初始化DOM元素引用
     */
    initElements() {
        this.sidebarContent = document.querySelector('.sidebar-content');
        this.drawerSections = document.querySelectorAll('.drawer-section');
        
    }

    /**
     * 从localStorage加载状态
     */
    loadStateFromStorage() {
        try {
            Object.keys(this.drawerConfigs).forEach(drawerName => {
                const config = this.drawerConfigs[drawerName];
                const stored = localStorage.getItem(config.storageKey);
                
                if (stored !== null) {
                    const isExpanded = stored === 'true';
                    if (isExpanded) {
                        this.expandedDrawers.add(drawerName);
                    } else {
                        this.expandedDrawers.delete(drawerName);
                    }
                }
            });
            
        } catch (error) {
            console.error('Failed to load drawer state:', error);
        }
    }

    /**
     * 保存状态到localStorage
     */
    saveStateToStorage() {
        try {
            Object.keys(this.drawerConfigs).forEach(drawerName => {
                const config = this.drawerConfigs[drawerName];
                const isExpanded = this.expandedDrawers.has(drawerName);
                localStorage.setItem(config.storageKey, isExpanded.toString());
            });
        } catch (error) {
            console.error('❌ 保存抽屉状态失败:', error);
        }
    }

    /**
     * 初始化事件监听器
     */
    initEventListeners() {
        // 监听任务和项目数据更新
        document.addEventListener('tasksUpdated', (event) => {
            this.updateTasksCount(event.detail);
        });

        document.addEventListener('projectsUpdated', (event) => {
            this.updateProjectsCount(event.detail);
        });

        // 监听DOM内容变化，确保动态内容加载后重新计算高度
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    const targetElement = mutation.target;
                    
                    // 检查是否是任务列表或项目列表的内容变化
                    if (targetElement.classList.contains('tasks-list') || 
                        targetElement.closest('.tasks-list')) {
                        setTimeout(() => this.recalculateDrawerHeight('tasks'), 50);
                    }
                    
                    if (targetElement.classList.contains('projects-list') || 
                        targetElement.closest('.projects-list')) {
                        setTimeout(() => this.recalculateDrawerHeight('projects'), 50);
                    }
                }
            });
        });

        // 观察任务和项目列表的变化
        const tasksListEl = document.getElementById('tasks-list');
        const projectsListEl = document.getElementById('projects-list');
        
        if (tasksListEl) {
            observer.observe(tasksListEl, { 
                childList: true, 
                subtree: true, 
                attributes: false, 
                characterData: true 
            });
        }
        
        if (projectsListEl) {
            observer.observe(projectsListEl, { 
                childList: true, 
                subtree: true, 
                attributes: false, 
                characterData: true 
            });
        }

        // 保存observer引用以便后续清理
        this.contentObserver = observer;
    }

    /**
     * 切换抽屉状态
     */
    toggleDrawer(drawerName) {
        
        if (this.expandedDrawers.has(drawerName)) {
            this.expandedDrawers.delete(drawerName);
        } else {
            this.expandedDrawers.add(drawerName);
        }
        
        this.updateDrawer(drawerName);
        this.saveStateToStorage();
    }

    /**
     * 展开抽屉
     */
    expandDrawer(drawerName) {
        if (!this.expandedDrawers.has(drawerName)) {
            this.expandedDrawers.add(drawerName);
            this.updateDrawer(drawerName);
            this.saveStateToStorage();
        }
    }

    /**
     * 折叠抽屉
     */
    collapseDrawer(drawerName) {
        if (this.expandedDrawers.has(drawerName)) {
            this.expandedDrawers.delete(drawerName);
            this.updateDrawer(drawerName);
            this.saveStateToStorage();
        }
    }

    /**
     * 更新单个抽屉状态
     */
    updateDrawer(drawerName) {
        const drawerSection = document.querySelector(`[data-drawer="${drawerName}"]`);
        if (!drawerSection) return;

        const isExpanded = this.expandedDrawers.has(drawerName);
        const drawerContent = drawerSection.querySelector('.drawer-content');
        
        if (isExpanded) {
            // 展开时：等待内容加载完成后再显示
            this.waitForContentAndShow(drawerSection, drawerContent, drawerName);
        } else {
            // 折叠时：直接移除expanded类
            drawerSection.classList.remove('expanded');
            
            if (drawerContent) {
                drawerContent.style.removeProperty('--drawer-content-height');
            }
        }

        // 更新箭头图标
        const expandIcon = drawerSection.querySelector('.expand-icon');
        if (expandIcon) {
            const points = isExpanded ? '18,15 12,9 6,15' : '6,9 12,15 18,9';
            expandIcon.querySelector('polyline').setAttribute('points', points);
        }

    }

    /**
     * 更新所有抽屉状态
     */
    updateAllDrawers() {
        Object.keys(this.drawerConfigs).forEach(drawerName => {
            this.updateDrawer(drawerName);
        });
    }

    /**
     * 等待内容加载完成后显示抽屉
     */
    waitForContentAndShow(drawerSection, drawerContent, drawerName) {
        if (!drawerContent) return;
        
        // 检查内容是否已加载（包括静态内容和动态内容）
        const contentList = drawerContent.querySelector(drawerName === 'tasks' ? '.tasks-list' : '.projects-list');
        
        // 改进的内容检测逻辑
        const hasStaticContent = contentList && contentList.children.length > 0;
        const hasTaskItems = drawerName === 'tasks' && contentList && 
                             (contentList.querySelectorAll('.task-item').length > 0 || 
                              contentList.querySelector('.empty-tasks'));
        const hasProjectItems = drawerName === 'projects' && contentList && 
                                (contentList.querySelectorAll('.project-item').length > 0 || 
                                 contentList.querySelector('.empty-state'));
        
        const hasValidContent = hasStaticContent || hasTaskItems || hasProjectItems;
        
        if (hasValidContent) {
            // 内容已存在，直接显示并计算高度
            this.showDrawer(drawerSection, drawerContent, drawerName);
        } else {
            // 内容未加载，等待加载完成
            const maxAttempts = 30; // 增加到30次尝试
            let attempts = 0;
            
            const checkInterval = setInterval(() => {
                const updatedContentList = drawerContent.querySelector(drawerName === 'tasks' ? '.tasks-list' : '.projects-list');
                const updatedHasItems = updatedContentList && updatedContentList.children.length > 0;
                const updatedHasTaskItems = drawerName === 'tasks' && updatedContentList && 
                                           (updatedContentList.querySelectorAll('.task-item').length > 0 || 
                                            updatedContentList.querySelector('.empty-tasks'));
                const updatedHasProjectItems = drawerName === 'projects' && updatedContentList && 
                                              (updatedContentList.querySelectorAll('.project-item').length > 0 || 
                                               updatedContentList.querySelector('.empty-state'));
                
                const updatedHasValidContent = updatedHasItems || updatedHasTaskItems || updatedHasProjectItems;
                
                attempts++;
                
                if (updatedHasValidContent || attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    this.showDrawer(drawerSection, drawerContent, drawerName);
                    
                    if (updatedHasValidContent) {
                    } else {
                    }
                }
            }, 100);
        }
    }

    /**
     * 显示抽屉（添加expanded类并计算高度）
     */
    showDrawer(drawerSection, drawerContent, drawerName) {
        // 添加expanded类
        drawerSection.classList.add('expanded');
        
        // Refresh notifications configuration when entering email settings
        if (drawerName === 'notifications' && window.notificationManager) {
            window.notificationManager.refresh();
        }
        
        // 计算并设置高度
        this.calculateDrawerHeight(drawerContent, drawerName);
    }

    /**
     * 计算抽屉高度
     */
    calculateDrawerHeight(drawerContent, drawerName) {
        // 任务板块也需要基本的高度适配
        if (drawerName === 'tasks') {
            this.calculateTasksDrawerHeight(drawerContent);
            return;
        }
        // 使用双重延迟确保DOM完全渲染和样式应用完成
        requestAnimationFrame(() => {
            setTimeout(() => {
            // 临时设置来获取实际内容高度
            const originalMaxHeight = drawerContent.style.maxHeight;
            const originalHeight = drawerContent.style.height;
            const originalOverflow = drawerContent.style.overflow;
            
            drawerContent.style.maxHeight = 'none';
            drawerContent.style.height = 'auto';
            drawerContent.style.overflow = 'visible';
            
            // 强制重排以获取准确的高度
            drawerContent.offsetHeight;
            
            // 获取实际内容高度
            const contentHeight = drawerContent.scrollHeight;
            
            // 恢复原始设置
            drawerContent.style.maxHeight = originalMaxHeight;
            drawerContent.style.height = originalHeight;
            drawerContent.style.overflow = originalOverflow;
            
            // 计算最终高度，智能处理不同内容类型
            const padding = 20;
            let minHeight = 60; // 默认最小高度
            
            // 检查内容类型并设置合适的最小高度
            const hasEmptyTasks = drawerContent.querySelector('.empty-tasks');
            const hasEmptyState = drawerContent.querySelector('.empty-state');
            const hasActualContent = drawerContent.querySelectorAll('.task-item, .project-item').length > 0;
            
            if (hasEmptyTasks) {
                // 空任务状态需要足够空间显示文本和按钮
                minHeight = 100;
            } else if (hasEmptyState) {
                // 空项目状态
                minHeight = 80;
            } else if (hasActualContent) {
                // 有实际内容，使用较小的最小高度，让内容决定
                minHeight = 60;
            }
            
            // 确保最终高度足够显示内容
            const finalHeight = Math.max(contentHeight + padding, minHeight);
            
            
            // 设置CSS自定义属性
            drawerContent.style.setProperty('--drawer-content-height', `${finalHeight}px`);
            
            
            // 如果高度变化显著，可能需要二次确认
            if (Math.abs(contentHeight - finalHeight + padding) > 10) {
                setTimeout(() => {
                    const recheckHeight = drawerContent.scrollHeight;
                    if (Math.abs(recheckHeight - contentHeight) > 5) {
                        const newFinalHeight = Math.max(recheckHeight + padding, minHeight);
                        drawerContent.style.setProperty('--drawer-content-height', `${newFinalHeight}px`);
                    }
                }, 100);
            }
            }, 10); // 添加小延迟确保样式计算准确
        });
    }

    /**
     * 计算任务抽屉高度（简化版本）
     */
    calculateTasksDrawerHeight(drawerContent) {
        // 使用requestAnimationFrame确保DOM更新完成
        requestAnimationFrame(() => {
            setTimeout(() => {
                // 获取任务列表
                const tasksList = drawerContent.querySelector('.tasks-list');
                if (!tasksList) return;
                
                // 计算实际内容高度
                const originalMaxHeight = drawerContent.style.maxHeight;
                const originalHeight = drawerContent.style.height;
                const originalOverflow = drawerContent.style.overflow;
                
                drawerContent.style.maxHeight = 'none';
                drawerContent.style.height = 'auto';
                drawerContent.style.overflow = 'visible';
                
                // 强制重排
                drawerContent.offsetHeight;
                
                const contentHeight = drawerContent.scrollHeight;
                
                // 恢复原始设置
                drawerContent.style.maxHeight = originalMaxHeight;
                drawerContent.style.height = originalHeight;
                drawerContent.style.overflow = originalOverflow;
                
                // 检查任务数量并设置合适的高度
                const taskItems = tasksList.querySelectorAll('.task-item:not([style*="display: none"])');
                const emptyTasks = tasksList.querySelector('.empty-tasks');
                
                let finalHeight;
                const padding = 16;
                
                if (emptyTasks && !emptyTasks.style.display === 'none') {
                    // 空任务状态
                    finalHeight = Math.max(contentHeight + padding, 120);
                } else if (taskItems.length === 1) {
                    // 单个任务
                    finalHeight = Math.max(contentHeight + padding, 80);
                } else if (taskItems.length <= 3) {
                    // 少量任务
                    finalHeight = Math.max(contentHeight + padding, 100);
                } else {
                    // 多个任务，使用默认高度
                    finalHeight = Math.max(contentHeight + padding, 200);
                }
                
                
                // 设置高度
                drawerContent.style.setProperty('--drawer-content-height', `${finalHeight}px`);
            }, 10);
        });
    }

    /**
     * 重新计算抽屉内容高度（当内容动态变化时调用）
     */
    recalculateDrawerHeight(drawerName) {
        // 任务板块也进行高度计算
        if (drawerName === 'tasks') {
        }
        
        if (!this.expandedDrawers.has(drawerName)) return;
        
        const drawerSection = document.querySelector(`[data-drawer="${drawerName}"]`);
        const drawerContent = drawerSection?.querySelector('.drawer-content');
        
        if (drawerContent) {
            // 使用requestAnimationFrame确保DOM更新完成
            requestAnimationFrame(() => {
                this.calculateDrawerHeight(drawerContent, drawerName);
            });
        }
    }

    /**
     * 重新计算所有展开抽屉的高度
     */
    recalculateAllExpandedDrawers() {
        this.expandedDrawers.forEach(drawerName => {
            this.recalculateDrawerHeight(drawerName);
        });
    }

    /**
     * 更新任务数量显示
     */
    updateTasksCount(tasksData) {
        const tasksCountEl = document.getElementById('tasks-count');
        if (tasksCountEl) {
            // 调试信息：记录接收到的数据
            
            if (tasksData) {
                const count = Array.isArray(tasksData.tasks) ? tasksData.tasks.length : 0;
                const activeCount = Array.isArray(tasksData.tasks) ? 
                    tasksData.tasks.filter(task => task.status === 'active').length : 0;
                
                tasksCountEl.textContent = count > 0 ? 
                    `${count} ${t('sidebar.tasksCount')}${activeCount > 0 ? ` (${activeCount} 活跃)` : ''}` : 
                    t('sidebar.noTasks');
                
            } else {
            }
        }
        
        // 任务板块需要重新计算高度以适配内容变化
        setTimeout(() => {
            this.recalculateDrawerHeight('tasks');
            setTimeout(() => this.recalculateDrawerHeight('tasks'), 200);
        }, 150);
    }

    /**
     * 更新项目数量显示
     */
    updateProjectsCount(projectsData) {
        const projectsCountEl = document.getElementById('projects-count');
        if (projectsCountEl && projectsData) {
            const count = Array.isArray(projectsData.projects) ? projectsData.projects.length : 0;
            projectsCountEl.textContent = count > 0 ? `${count} ${t('sidebar.projectsCount')}` : t('sidebar.noProjects');
        }
        
        // 项目数据更新后重新计算抽屉高度，增加延迟确保DOM更新完成  
        setTimeout(() => {
            this.recalculateDrawerHeight('projects');
            // 如果初次计算可能不准确，再次确认
            setTimeout(() => this.recalculateDrawerHeight('projects'), 200);
        }, 150);
    }

    /**
     * 检查抽屉是否展开
     */
    isDrawerExpanded(drawerName) {
        return this.expandedDrawers.has(drawerName);
    }

    /**
     * 获取所有展开的抽屉
     */
    getExpandedDrawers() {
        return Array.from(this.expandedDrawers);
    }

    /**
     * 立即进行高度检查 - 基于静态内容
     */
    scheduleImmediateHeightCheck() {
        // 短延迟确保DOM完全渲染
        setTimeout(() => {
            
            // 任务抽屉也进行立即高度检查
            const tasksDrawer = document.querySelector('[data-drawer="tasks"]');
            if (tasksDrawer && tasksDrawer.classList.contains('expanded')) {
                this.recalculateDrawerHeight('tasks');
            }
            
            // 对项目抽屉进行立即检查
            const projectsDrawer = document.querySelector('[data-drawer="projects"]');
            if (projectsDrawer && projectsDrawer.classList.contains('expanded')) {
                this.recalculateDrawerHeight('projects');
            }
        }, 100);
    }

    /**
     * 组件协调机制 - 确保所有管理器初始化完成后进行最终调整
     */
    scheduleComponentCoordination() {
        // 多层延迟确保所有组件都已完成初始化
        setTimeout(() => {
            this.coordinateWithOtherComponents();
        }, 500);
        
        // 更长延迟的二次确认
        setTimeout(() => {
            this.finalHeightAdjustment();
        }, 1000);
    }

    /**
     * 与其他组件协调
     */
    coordinateWithOtherComponents() {
        
        // 检查任务管理器是否已加载数据
        if (window.taskManagerV2 && window.taskManagerV2.tasks && window.taskManagerV2.tasks.length > 0) {
            this.recalculateDrawerHeight('tasks');
        }
        
        // 检查项目管理器是否已加载数据
        if (window.enhancedSidebar && window.enhancedSidebar.projects && window.enhancedSidebar.projects.length > 0) {
            this.recalculateDrawerHeight('projects');
        }
    }

    /**
     * 最终高度调整
     */
    finalHeightAdjustment() {
        
        // 对所有展开的抽屉进行最终高度计算
        this.expandedDrawers.forEach(drawerName => {
            
            const drawerSection = document.querySelector(`[data-drawer="${drawerName}"]`);
            if (drawerSection && drawerSection.classList.contains('expanded')) {
                this.recalculateDrawerHeight(drawerName);
            }
        });
    }

    /**
     * 重置所有抽屉到默认状态
     */
    resetToDefaults() {
        
        this.expandedDrawers.clear();
        
        Object.keys(this.drawerConfigs).forEach(drawerName => {
            const config = this.drawerConfigs[drawerName];
            if (config.defaultExpanded) {
                this.expandedDrawers.add(drawerName);
            }
        });
        
        this.updateAllDrawers();
        this.saveStateToStorage();
    }
}

// 导出到全局作用域
window.SidebarDrawers = SidebarDrawers;

// 等待DOM加载完成后创建全局实例
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.sidebarDrawers = new SidebarDrawers();
    });
} else {
    // DOM已经加载完成
    window.sidebarDrawers = new SidebarDrawers();
}