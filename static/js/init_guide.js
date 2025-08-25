/**
 * System Initialization Guide Component
 * Handles first-time user experience and initialization guidance
 */

class InitializationGuide {
    constructor() {
        this.isFirstVisit = false;
        this.needsInit = false;
        this.config = null;
        
        this.init();
    }

    /**
     * Initialize the guide system
     */
    async init() {
        await this.loadConfig();
        await this.checkFirstVisit();
        // 不在这里自动检查系统状态和显示模态窗口
        // 等待主应用完全加载后再由app.js触发
    }

    /**
     * Load system configuration
     */
    async loadConfig() {
        try {
            const response = await fetch('/api/config');
            if (response.ok) {
                this.config = await response.json();
            }
        } catch (error) {
            console.error('Failed to load config:', error);
        }
    }

    /**
     * Check if this is user's first visit
     */
    async checkFirstVisit() {
        const visitKey = 'heliki_first_visit';
        const hasVisited = localStorage.getItem(visitKey);
        
        if (!hasVisited) {
            this.isFirstVisit = true;
            localStorage.setItem(visitKey, 'true');
        }
    }

    /**
     * Check system initialization status
     */
    async checkSystemStatus() {
        try {
            const response = await fetch('/api/system-project/status');
            if (response.ok) {
                const status = await response.json();
                this.needsInit = status.needs_initialization;
                return status;
            }
        } catch (error) {
            console.error('Failed to check system status:', error);
        }
        return null;
    }

    /**
     * Show welcome modal for first-time users
     */
    showWelcomeModal() {
        const modal = document.createElement('div');
        modal.className = 'init-guide-modal';
        modal.id = 'welcome-modal';
        
        modal.innerHTML = `
            <div class="init-guide-content">
                <img src="/static/assets/icons/interface/zap.png" alt="Initialize" class="init-guide-icon">
                <h2>${this.t('initGuide.welcomeTitle', 'Welcome to Claude Co-Desk!')}</h2>
                <p>${this.t('initGuide.welcomeMessage', 'To get started, we need to initialize your system. This will set up your digital workspace and deploy AI agents to help you with various tasks.')}</p>
                <div class="init-guide-actions">
                    <button class="init-guide-btn primary" onclick="initGuide.startInitialization()">
                        ${this.t('initGuide.startInit', 'Start Initialization')}
                    </button>
                    <button class="init-guide-btn secondary" onclick="initGuide.skipForNow()">
                        ${this.t('initGuide.skipForNow', 'Skip for Now')}
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Prevent closing by clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                e.preventDefault();
                e.stopPropagation();
            }
        });
    }

    /**
     * Show banner notification
     */
    showBanner() {
        // Check if banner was recently dismissed
        const dismissKey = 'heliki_banner_dismissed';
        const dismissedTime = localStorage.getItem(dismissKey);
        
        if (dismissedTime) {
            const now = new Date().getTime();
            const dismissTime = parseInt(dismissedTime);
            // Show banner again after 24 hours
            if (now - dismissTime < 24 * 60 * 60 * 1000) {
                return;
            }
        }
        
        const banner = document.createElement('div');
        banner.className = 'init-banner';
        banner.id = 'init-banner';
        
        banner.innerHTML = `
            <div class="init-banner-content">
                <img src="/static/assets/icons/interface/zap.png" alt="Initialize" class="init-banner-icon">
                <div class="init-banner-text">
                    <h4>${this.t('initGuide.bannerTitle', 'System Initialization Required')}</h4>
                    <p>${this.t('initGuide.bannerMessage', 'Complete setup to unlock all features')}</p>
                </div>
            </div>
            <div class="init-banner-actions">
                <button class="init-banner-btn primary" onclick="initGuide.startInitialization()">
                    ${this.t('initGuide.initializeNow', 'Initialize Now')}
                </button>
                <button class="init-banner-btn" onclick="initGuide.remindLater()">
                    ${this.t('initGuide.remindLater', 'Later')}
                </button>
                <button class="init-banner-close" onclick="initGuide.dismissBanner()">×</button>
            </div>
        `;
        
        document.body.appendChild(banner);
        
        // Show banner with animation
        setTimeout(() => {
            banner.classList.add('show');
        }, 100);
        
        // Auto-hide after 30 seconds if no interaction
        setTimeout(() => {
            this.dismissBanner();
        }, 30000);
    }

    /**
     * Start system initialization
     */
    startInitialization() {
        this.hideModal();
        this.hideBanner();
        
        // Use the existing employees manager initialization
        if (window.employeesManager) {
            window.employeesManager.initializeSystem();
        } else {
            console.error('Employees manager not available');
            alert(this.t('initGuide.systemNotReady', 'System not ready. Please refresh and try again.'));
        }
    }

    /**
     * Skip initialization for now
     */
    skipForNow() {
        this.hideModal();
        
        // Set a reminder for next visit
        localStorage.setItem('heliki_init_skipped', new Date().getTime().toString());
    }

    /**
     * Remind user later
     */
    remindLater() {
        this.hideBanner();
        localStorage.setItem('heliki_banner_dismissed', new Date().getTime().toString());
    }

    /**
     * Dismiss banner
     */
    dismissBanner() {
        const banner = document.getElementById('init-banner');
        if (banner) {
            banner.classList.remove('show');
            setTimeout(() => {
                banner.remove();
            }, 300);
        }
        localStorage.setItem('heliki_banner_dismissed', new Date().getTime().toString());
    }

    /**
     * Hide modal
     */
    hideModal() {
        const modal = document.getElementById('welcome-modal');
        if (modal) {
            modal.remove();
        }
    }

    /**
     * Hide banner
     */
    hideBanner() {
        const banner = document.getElementById('init-banner');
        if (banner) {
            banner.classList.remove('show');
            setTimeout(() => {
                banner.remove();
            }, 300);
        }
    }

    /**
     * Translation helper
     */
    t(key, defaultValue) {
        if (window.t && typeof window.t === 'function') {
            return window.t(key);
        }
        return defaultValue;
    }

    /**
     * Handle initialization completion
     */
    onInitializationComplete() {
        this.needsInit = false;
        this.hideModal();
        this.hideBanner();
        
        // Clear any stored dismissal times
        localStorage.removeItem('heliki_banner_dismissed');
        localStorage.removeItem('heliki_init_skipped');
    }

    /**
     * Manual trigger for showing guidance (for testing)
     */
    showGuidance() {
        this.needsInit = true;
        this.showWelcomeModal();
    }

    /**
     * Reset first visit status (for testing)
     */
    resetFirstVisit() {
        localStorage.removeItem('heliki_first_visit');
        localStorage.removeItem('heliki_banner_dismissed');
        localStorage.removeItem('heliki_init_skipped');
        this.isFirstVisit = true;
    }
}

// Global instance
window.InitializationGuide = InitializationGuide;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.initGuide = new InitializationGuide();
    });
} else {
    window.initGuide = new InitializationGuide();
}