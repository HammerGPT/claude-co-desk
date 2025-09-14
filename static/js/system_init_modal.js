/**
 * 系统初始化进度弹窗组件
 * 显示初始化过程的实时终端输出和进度
 */

class SystemInitModal {
    constructor() {
        this.isVisible = false;
        this.progress = 0;
        this.isInitializing = false;
        this.initWebSocket = null;
        
        this.initElements();
        this.initEventListeners();
        this.initSteps = [
            '检查系统环境',
            '初始化Claude项目',
            '创建agents目录',
            '部署文档管理员',
            '部署工作助理',
            '部署财务助理',
            '部署信息收集员',
            '部署全栈工程师',
            '验证部署完成',
            '初始化完成'
        ];
        this.currentStep = 0;
    }

    initElements() {
        this.modal = document.getElementById('system-init-modal');
        this.terminal = document.getElementById('init-terminal');
        this.progressText = document.getElementById('init-progress-text');
        this.progressPercent = document.getElementById('init-progress-percent');
        this.progressFill = document.getElementById('init-progress-fill');
        this.closeBtn = document.getElementById('init-modal-close');
        this.cancelBtn = document.getElementById('init-cancel-btn');
    }

    initEventListeners() {
        this.closeBtn?.addEventListener('click', () => this.hide());
        this.cancelBtn?.addEventListener('click', () => this.cancel());
        
        // 点击遮罩关闭（仅在完成后）
        this.modal?.addEventListener('click', (e) => {
            if (e.target === this.modal && !this.isInitializing) {
                this.hide();
            }
        });
    }

    /**
     * 显示初始化弹窗
     */
    show() {
        console.log('SystemInitModal.show() called');
        this.isVisible = true;
        this.isInitializing = true;
        this.progress = 0;
        this.currentStep = 0;
        
        if (this.modal) {
            console.log('✅ Modal元素存在，显示弹窗');
            this.modal.classList.remove('hidden');
            // 确保模态框显示在最顶层
            this.modal.style.zIndex = '9999';
            this.modal.style.display = 'flex';
        } else {
            console.error('❌ Modal元素不存在！');
            return;
        }
        
        // 重置界面
        if (this.terminal) {
            this.terminal.innerHTML = '';
        }
        this.updateProgress(0, '准备初始化...');
        if (this.closeBtn) {
            this.closeBtn.classList.add('hidden');
        }
        if (this.cancelBtn) {
            this.cancelBtn.classList.remove('hidden');
        }
        
        // 开始初始化
        console.log('🔄 开始初始化流程');
        this.startInitialization();
    }

    /**
     * 隐藏弹窗
     */
    hide() {
        this.isVisible = false;
        if (this.modal) {
            this.modal.classList.add('hidden');
        }
        
        // 清理WebSocket连接
        if (this.initWebSocket) {
            this.initWebSocket.close();
            this.initWebSocket = null;
        }
        
        // 如果初始化完成，刷新页面
        if (this.progress === 100) {
            this.refreshEmployeesList();
        }
    }

    /**
     * 取消初始化
     */
    cancel() {
        if (!this.isInitializing) {
            this.hide();
            return;
        }

        const confirmCancel = confirm('确定要取消初始化吗？这将中断系统设置过程。');
        if (confirmCancel) {
            this.isInitializing = false;
            this.addTerminalOutput('❌ 用户取消了初始化过程', 'warning');
            
            // 清理WebSocket连接
            if (this.initWebSocket) {
                this.initWebSocket.close();
                this.initWebSocket = null;
            }
            
            this.updateProgress(this.progress, '初始化已取消');
            this.closeBtn.classList.remove('hidden');
            this.cancelBtn.classList.add('hidden');
        }
    }

    /**
     * 开始初始化过程
     */
    async startInitialization() {
        console.log('📡 startInitialization() 开始执行');
        this.addTerminalOutput('Starting digital employee team initialization...', 'info');
        this.updateProgress(5, '发送初始化请求...');

        try {
            // 调用初始化API
            console.log('📤 发送初始化API请求');
            this.addTerminalOutput('📡 正在连接初始化服务...', 'info');
            const response = await fetch('/api/system-project/initialize', {
                method: 'POST'
            });

            console.log('📥 收到API响应:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('✅ 初始化API响应:', result);
            
            // 模拟进度步骤显示
            await this.simulateInitProgress();
            
            if (result.success) {
                this.handleInitComplete(true);
            } else {
                throw new Error(result.message || '初始化失败');
            }
            
        } catch (error) {
            console.error('❌ 初始化过程出错:', error);
            this.handleInitError(error);
        }
    }

    /**
     * 模拟初始化进度显示
     */
    async simulateInitProgress() {
        const steps = [
            { progress: 15, message: '检查系统环境...', output: '✅ 环境检查通过' },
            { progress: 25, message: '连接Claude Code服务...', output: '🔗 连接到Claude Code' },
            { progress: 35, message: '在用户主目录初始化Claude项目...', output: '🏗️ 执行 claude /init' },
            { progress: 50, message: '等待Claude项目配置生成...', output: '⚙️ 生成CLAUDE.md配置文件' },
            { progress: 60, message: 'Deploying document manager...', output: 'Deploying document-manager.md' },
            { progress: 70, message: '部署工作助理...', output: '💼 部署 work-assistant.md' },
            { progress: 75, message: '部署财务助理...', output: '💰 部署 finance-assistant.md' },
            { progress: 80, message: 'Deploying info collector...', output: 'Deploying info-collector.md' },
            { progress: 85, message: '部署全栈工程师...', output: '⚡ 部署 fullstack-engineer.md' },
            { progress: 95, message: 'Verifying system initialization...', output: 'Verifying all components are normal' }
        ];

        for (const step of steps) {
            if (!this.isInitializing) break; // 用户取消了
            
            this.updateProgress(step.progress, step.message);
            this.addTerminalOutput(step.output, 'success');
            
            // 模拟处理时间
            await new Promise(resolve => setTimeout(resolve, 800));
        }
    }


    /**
     * 处理初始化完成
     */
    handleInitComplete(success) {
        if (success) {
            this.updateProgress(100, '初始化完成！');
            this.addTerminalOutput('✅ 数字员工团队初始化完成！', 'success');
            this.addTerminalOutput('🎉 您的5位专业员工已就位，随时准备为您服务', 'success');
        } else {
            this.addTerminalOutput('❌ 初始化过程中出现错误', 'error');
            this.updateProgress(this.progress, '初始化失败');
        }
        
        this.isInitializing = false;
        this.closeBtn.classList.remove('hidden');
        this.cancelBtn.classList.add('hidden');
        
        // 3秒后自动关闭
        if (success) {
            setTimeout(() => {
                if (this.isVisible) {
                    this.hide();
                }
            }, 3000);
        }
    }

    /**
     * 处理初始化错误
     */
    handleInitError(error) {
        this.addTerminalOutput(`❌ 初始化失败: ${error.message}`, 'error');
        this.updateProgress(this.progress, '初始化失败');
        this.isInitializing = false;
        this.closeBtn.classList.remove('hidden');
        this.cancelBtn.classList.add('hidden');
    }

    /**
     * 添加终端输出
     */
    addTerminalOutput(text, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const line = document.createElement('div');
        line.className = type;
        line.textContent = `[${timestamp}] ${text}`;
        
        this.terminal.appendChild(line);
        this.terminal.scrollTop = this.terminal.scrollHeight;
    }

    /**
     * 更新进度条
     */
    updateProgress(percent, text) {
        this.progress = Math.max(0, Math.min(100, percent));
        
        if (this.progressFill) {
            this.progressFill.style.width = `${this.progress}%`;
        }
        
        if (this.progressPercent) {
            this.progressPercent.textContent = `${Math.round(this.progress)}%`;
        }
        
        if (this.progressText && text) {
            this.progressText.textContent = text;
        }
    }

    /**
     * 刷新员工列表
     */
    refreshEmployeesList() {
        if (window.employeesManager) {
            window.employeesManager.loadEmployeesStatus();
        }
        
        // 发送全局事件通知系统状态更新
        document.dispatchEvent(new CustomEvent('systemInitCompleted'));
    }
}

// 导出到全局作用域
window.SystemInitModal = SystemInitModal;

// 等待DOM加载完成后创建全局实例
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.systemInitModal = new SystemInitModal();
    });
} else {
    // DOM已经加载完成
    window.systemInitModal = new SystemInitModal();
}