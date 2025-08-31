/**
 * Notification Panel Manager
 * Handles sidebar selector + config panel layout for notifications
 * All selectors are scoped to .notification-layout to prevent global conflicts
 */
class NotificationPanelManager {
    constructor() {
        this.currentPanel = 'email';
        this.notificationContainer = null;
        this.init();
    }

    init() {
        this.notificationContainer = document.querySelector('.notification-layout');
        if (!this.notificationContainer) {
            console.warn('Notification layout container not found');
            return;
        }
        
        this.bindEvents();
        this.loadInitialState();
    }

    bindEvents() {
        // Selector item click events - strictly scoped to notification layout
        const selectorItems = this.notificationContainer.querySelectorAll('.selector-item');
        selectorItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const type = item.getAttribute('data-type');
                this.switchPanel(type);
            });
        });
    }

    switchPanel(type) {
        if (type === this.currentPanel) return;
        if (!this.notificationContainer) return;

        // Update selector items - only within notification layout
        const selectorItems = this.notificationContainer.querySelectorAll('.selector-item');
        selectorItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-type') === type) {
                item.classList.add('active');
            }
        });

        // Update panel content - only within notification layout
        const panelContents = this.notificationContainer.querySelectorAll('.panel-content');
        panelContents.forEach(panel => {
            panel.classList.remove('active');
        });
        
        const targetPanel = document.getElementById(`${type}-panel`);
        if (targetPanel && this.notificationContainer.contains(targetPanel)) {
            targetPanel.classList.add('active');
        }

        this.currentPanel = type;
        console.log(`Switched notification panel to: ${type}`);
    }

    updateStatus(type, isConfigured) {
        if (!this.notificationContainer) return;
        
        const indicator = this.notificationContainer.querySelector(`#${type}-selector-status`);
        if (indicator) {
            indicator.classList.toggle('configured', isConfigured);
        }
    }

    loadInitialState() {
        // Initialize with email panel active
        this.switchPanel('email');
    }
}

// Initialize when DOM is ready - only if notification layout exists
document.addEventListener('DOMContentLoaded', () => {
    const notificationLayout = document.querySelector('.notification-layout');
    if (notificationLayout) {
        window.notificationPanelManager = new NotificationPanelManager();
    }
});