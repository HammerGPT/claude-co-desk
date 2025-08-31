/**
 * WeChat Notification Manager
 * Manages WeChat notification binding and configuration
 */

class WeChatNotificationManager {
    constructor() {
        // 单例模式检查
        if (WeChatNotificationManager.instance) {
            console.warn('WeChatNotificationManager already exists, returning existing instance');
            return WeChatNotificationManager.instance;
        }
        
        WeChatNotificationManager.instance = this;
        
        this.bindingStatus = {
            bound: false,
            userInfo: null,
            boundAt: null
        };
        this.qrCode = {
            url: null,
            expireTime: null,
            checkInterval: null
        };
        this.initialized = false;
        this.init();
    }
    
    getText(key) {
        // Use the global i18n system
        return window.i18n ? window.i18n.t(key) : key;
    }
    
    init() {
        if (this.initialized) {
            console.log('WeChatNotificationManager already initialized');
            return;
        }
        
        console.log('Initializing WeChatNotificationManager instance');
        this.bindEvents();
        this.loadBindingStatus();
        this.initialized = true;
    }
    
    // Public method to refresh configuration when entering the page
    refresh() {
        this.loadBindingStatus();
    }
    
    bindEvents() {
        // Bind WeChat button
        const bindWeChatBtn = document.getElementById('bind-wechat-btn');
        if (bindWeChatBtn) {
            console.log('WeChat bind button found, adding event listener');
            bindWeChatBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('WeChat bind button clicked');
                this.showBindingModal();
            });
        } else {
            console.warn('WeChat bind button not found: bind-wechat-btn');
        }
        
        // Test WeChat notification button
        const testWeChatBtn = document.getElementById('test-wechat-notification');
        if (testWeChatBtn) {
            testWeChatBtn.addEventListener('click', () => this.testWeChatNotification());
        }
        
        // Unbind WeChat button
        const unbindWeChatBtn = document.getElementById('unbind-wechat-btn');
        if (unbindWeChatBtn) {
            unbindWeChatBtn.addEventListener('click', () => this.unbindWeChat());
        }
        
        // Modal close buttons
        const bindingCloseBtn = document.getElementById('wechat-binding-close');
        const bindingCancelBtn = document.getElementById('wechat-binding-cancel');
        if (bindingCloseBtn) {
            bindingCloseBtn.addEventListener('click', () => this.hideBindingModal());
        }
        if (bindingCancelBtn) {
            bindingCancelBtn.addEventListener('click', () => this.hideBindingModal());
        }
        
        // Retry QR code generation
        const retryQrBtn = document.getElementById('retry-qr-btn');
        if (retryQrBtn) {
            retryQrBtn.addEventListener('click', () => this.generateQRCode());
        }
        
        // Refresh binding status
        const refreshStatusBtn = document.getElementById('refresh-binding-status');
        if (refreshStatusBtn) {
            refreshStatusBtn.addEventListener('click', () => this.checkBindingStatus());
        }
    }
    
    async loadBindingStatus() {
        try {
            console.log('Loading WeChat binding status on page init...');
            const response = await fetch('/api/wechat/binding-status');
            const result = await response.json();
            
            if (result.success && result.bound) {
                console.log('User already bound to WeChat', result.userInfo);
                this.updateBindingStatus(true, result.userInfo);
            } else {
                console.log('User not bound to WeChat');
                this.updateBindingStatus(false, null);
            }
        } catch (error) {
            console.error('Failed to load WeChat binding status:', error);
            this.updateBindingStatus(false, null);
        }
    }
    
    updateBindingStatus(bound, userInfo = null) {
        this.bindingStatus = {
            bound,
            userInfo,
            boundAt: userInfo?.boundAt || null
        };
        
        const notBoundEl = document.getElementById('wechat-not-bound');
        const boundEl = document.getElementById('wechat-bound');
        const statusIndicator = document.getElementById('wechat-status-indicator');
        const statusText = document.getElementById('wechat-status-text');
        
        if (bound && userInfo) {
            // Show bound status
            if (notBoundEl) notBoundEl.style.display = 'none';
            if (boundEl) boundEl.style.display = 'block';
            
            // Update bound user info
            const userNameEl = document.getElementById('bound-user-name');
            const boundTimeEl = document.getElementById('bound-time');
            
            if (userNameEl) {
                userNameEl.textContent = userInfo.nickname || this.getText('notifications.wechatUser');
            }
            if (boundTimeEl) {
                const boundTime = userInfo.boundAt ? 
                    new Date(userInfo.boundAt).toLocaleString() : 
                    this.getText('common.unknown');
                boundTimeEl.textContent = `${this.getText('notifications.boundTime')}${boundTime}`;
            }
            
            // Update status indicator
            if (statusIndicator) statusIndicator.className = 'status-indicator bound';
            if (statusText) statusText.textContent = this.getText('notifications.wechatBound');
            
        } else {
            // Show not bound status
            if (notBoundEl) notBoundEl.style.display = 'block';
            if (boundEl) boundEl.style.display = 'none';
            
            // Update status indicator
            if (statusIndicator) statusIndicator.className = 'status-indicator';
            if (statusText) statusText.textContent = this.getText('notifications.wechatNotBound');
        }
    }
    
    showBindingModal() {
        console.log('Showing WeChat binding modal');
        const modal = document.getElementById('wechat-binding-modal');
        if (modal) {
            console.log('Modal found, adding active class and removing hidden class');
            modal.classList.remove('hidden');
            modal.classList.add('active');
            this.generateQRCode();
            this.startBindingStatusCheck();
        } else {
            console.error('WeChat binding modal not found: wechat-binding-modal');
        }
    }
    
    hideBindingModal() {
        const modal = document.getElementById('wechat-binding-modal');
        if (modal) {
            console.log('Hiding WeChat binding modal');
            modal.classList.remove('active');
            modal.classList.add('hidden');
            this.stopBindingStatusCheck();
        }
    }
    
    async generateQRCode() {
        const qrContainer = document.getElementById('wechat-qr-container');
        const qrLoading = document.getElementById('qr-loading');
        const qrDisplay = document.getElementById('qr-code-display');
        const qrError = document.getElementById('qr-error');
        
        // Show loading state
        if (qrLoading) qrLoading.style.display = 'block';
        if (qrDisplay) qrDisplay.style.display = 'none';
        if (qrError) qrError.style.display = 'none';
        
        try {
            const response = await fetch('/api/wechat/generate-qr', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const result = await response.json();
            
            if (result.success && result.qrCodeUrl) {
                // Show QR code
                this.qrCode = {
                    url: result.qrCodeUrl,
                    expireTime: Date.now() + (5 * 60 * 1000) // 5 minutes from now
                };
                
                const qrImage = document.getElementById('qr-code-image');
                if (qrImage) {
                    qrImage.src = result.qrCodeUrl;
                }
                
                if (qrLoading) qrLoading.style.display = 'none';
                if (qrDisplay) qrDisplay.style.display = 'block';
                
                this.startQRExpireCountdown();
                
            } else {
                throw new Error(result.error || 'Failed to generate QR code');
            }
            
        } catch (error) {
            console.error('Failed to generate QR code:', error);
            
            // Show error state
            if (qrLoading) qrLoading.style.display = 'none';
            if (qrError) {
                qrError.style.display = 'block';
                const errorMessage = document.getElementById('qr-error-message');
                if (errorMessage) {
                    errorMessage.textContent = error.message || this.getText('notifications.qrGenerateError');
                }
            }
        }
    }
    
    startQRExpireCountdown() {
        const expireInfoEl = document.getElementById('qr-expire-info');
        if (!expireInfoEl || !this.qrCode.expireTime) return;
        
        const updateCountdown = () => {
            const remaining = Math.max(0, this.qrCode.expireTime - Date.now());
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            
            if (remaining > 0) {
                expireInfoEl.textContent = `${this.getText('notifications.qrExpireIn')} ${minutes}:${seconds.toString().padStart(2, '0')}`;
            } else {
                expireInfoEl.textContent = this.getText('notifications.qrExpired');
                expireInfoEl.style.color = '#dc3545';
            }
        };
        
        updateCountdown();
        this.qrExpireInterval = setInterval(updateCountdown, 1000);
    }
    
    startBindingStatusCheck() {
        // Only start checking if not already checking and modal is visible
        if (this.bindingCheckInterval) return;
        
        console.log('Starting binding status check interval');
        // Check binding status every 3 seconds
        this.bindingCheckInterval = setInterval(() => {
            this.checkBindingStatus(false);
        }, 3000);
    }
    
    stopBindingStatusCheck() {
        if (this.bindingCheckInterval) {
            console.log('Stopping binding status check interval');
            clearInterval(this.bindingCheckInterval);
            this.bindingCheckInterval = null;
        }
        if (this.qrExpireInterval) {
            clearInterval(this.qrExpireInterval);
            this.qrExpireInterval = null;
        }
    }
    
    async checkBindingStatus(showMessage = true) {
        try {
            console.log('Checking WeChat binding status...');
            const response = await fetch('/api/wechat/binding-status');
            const result = await response.json();
            
            if (result.success && result.bound) {
                // Binding successful - stop polling immediately
                console.log('Binding successful, stopping status check');
                this.stopBindingStatusCheck();
                this.updateBindingStatus(true, result.userInfo);
                this.hideBindingModal();
                
                if (showMessage) {
                    this.showTestResult(true, this.getText('notifications.bindingSuccess'));
                }
                
                return true;
            }
            
            return false;
            
        } catch (error) {
            console.error('Failed to check binding status:', error);
            return false;
        }
    }
    
    async testWeChatNotification() {
        const testButton = document.getElementById('test-wechat-notification');
        
        if (!testButton) return;
        
        // Show loading state
        const originalText = testButton.textContent;
        testButton.textContent = this.getText('common.sending');
        testButton.disabled = true;
        
        try {
            // Get current language setting
            const currentLanguage = window.i18n ? window.i18n.getCurrentLanguage() : 'zh-CN';
            
            const response = await fetch('/api/wechat/test-notification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    language: currentLanguage
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showTestResult(true, this.getText('notifications.testWeChatSuccess'));
            } else {
                this.showTestResult(false, `${this.getText('notifications.testWeChatFailed')}: ${result.error || this.getText('error.unknown')}`);
            }
            
        } catch (error) {
            console.error('WeChat notification test error:', error);
            this.showTestResult(false, `${this.getText('notifications.networkError')}: ${error.message}`);
        } finally {
            testButton.textContent = originalText;
            testButton.disabled = false;
        }
    }
    
    async unbindWeChat() {
        if (!confirm(this.getText('notifications.confirmUnbind'))) {
            return;
        }
        
        try {
            const response = await fetch('/api/wechat/unbind', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const result = await response.json();
            
            if (result.success) {
                // 立即更新绑定状态为未绑定
                this.updateBindingStatus(false, null);
                
                // 停止任何正在进行的状态检查轮询
                this.stopBindingStatusCheck();
                
                // 强制刷新绑定状态以确保同步
                setTimeout(() => {
                    this.loadBindingStatus();
                }, 1000);
                
                this.showTestResult(true, this.getText('notifications.unbindSuccess'));
            } else {
                this.showTestResult(false, `${this.getText('notifications.unbindFailed')}: ${result.error || this.getText('error.unknown')}`);
            }
            
        } catch (error) {
            console.error('WeChat unbind error:', error);
            this.showTestResult(false, `${this.getText('notifications.networkError')}: ${error.message}`);
        }
    }
    
    showTestResult(success, message) {
        const testResult = document.getElementById('wechat-test-result');
        const resultIcon = document.getElementById('wechat-test-result-icon');
        const resultMessage = document.getElementById('wechat-test-result-message');
        
        if (!testResult || !resultIcon || !resultMessage) return;
        
        resultMessage.textContent = message;
        
        if (success) {
            resultIcon.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #28a745;">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22,4 12,14.01 9,11.01"/>
                </svg>
            `;
            testResult.className = 'test-result success';
        } else {
            resultIcon.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #dc3545;">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
            `;
            testResult.className = 'test-result error';
        }
        
        testResult.style.display = 'block';
        
        // Auto hide after 5 seconds for success messages
        if (success) {
            setTimeout(() => {
                testResult.style.display = 'none';
            }, 5000);
        }
    }
}

// Static method to get or create instance
WeChatNotificationManager.getInstance = function() {
    if (!WeChatNotificationManager.instance) {
        WeChatNotificationManager.instance = new WeChatNotificationManager();
    }
    return WeChatNotificationManager.instance;
};

// Initialize WeChat notification manager when DOM is ready
function initWeChatNotificationManager() {
    // Prevent multiple initializations
    if (window.wechatNotificationManager) {
        console.log('WeChat notification manager already exists');
        return;
    }
    
    // Add a small delay to ensure all DOM elements are rendered
    setTimeout(() => {
        console.log('Initializing WeChat notification manager');
        window.wechatNotificationManager = WeChatNotificationManager.getInstance();
        console.log('WeChat notification manager initialized');
    }, 100);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWeChatNotificationManager);
} else {
    initWeChatNotificationManager();
}