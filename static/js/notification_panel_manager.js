/**
 * Notification Panel Manager
 * Handles sidebar selector + config panel layout for notifications
 */
class NotificationPanelManager {
    constructor() {
        this.currentPanel = 'email';
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadInitialState();
    }

    bindEvents() {
        // Selector item click events
        document.querySelectorAll('.selector-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const type = item.getAttribute('data-type');
                this.switchPanel(type);
            });
        });
    }

    switchPanel(type) {
        if (type === this.currentPanel) return;

        // Update selector items
        document.querySelectorAll('.selector-item').forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-type') === type) {
                item.classList.add('active');
            }
        });

        // Update panel content
        document.querySelectorAll('.panel-content').forEach(panel => {
            panel.classList.remove('active');
        });
        
        const targetPanel = document.getElementById(`${type}-panel`);
        if (targetPanel) {
            targetPanel.classList.add('active');
        }

        this.currentPanel = type;
    }

    updateStatus(type, isConfigured) {
        const indicator = document.getElementById(`${type}-selector-status`);
        if (indicator) {
            indicator.classList.toggle('configured', isConfigured);
        }
    }

    loadInitialState() {
        // Initialize with email panel active
        this.switchPanel('email');
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.notificationPanelManager = new NotificationPanelManager();
});