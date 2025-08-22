/**
 * Application Management Component
 * Provides interface for discovering and managing system applications
 * Integrates with MCP server for application control
 * 
 * DEPRECATED: Standalone modal implementation
 * Use ApplicationsSettings class for settings integration instead
 */

class ApplicationsManager {
    constructor() {
        this.applications = {};
        this.mcpServerStatus = 'disconnected';
        this.container = null;
        this.isVisible = false;
        
        this.init();
        
        console.log('Applications Manager initialized');
    }
    
    init() {
        this.createUI();
        this.bindEvents();
        this.loadApplications();
        
        // Register for i18n updates
        if (window.i18n) {
            window.i18n.registerComponent('applications-manager', () => {
                this.updateTexts();
            });
        }
    }
    
    createUI() {
        // Create main container
        this.container = document.createElement('div');
        this.container.id = 'applications-manager';
        this.container.className = 'component-panel applications-manager hidden';
        
        // Ensure visibility with inline styles as fallback
        this.container.style.backgroundColor = '#ffffff';
        this.container.style.border = '1px solid #e5e7eb';
        this.container.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
        
        this.container.innerHTML = `
            <div class="panel-header">
                <h2 data-i18n="apps.management">Application Management</h2>
                <div class="header-actions">
                    <button id="setup-mcp-btn" class="btn btn-secondary" data-i18n-title="apps.configuring">
                        <span data-i18n="apps.configuring">Setup MCP</span>
                    </button>
                    <button id="scan-apps-btn" class="btn btn-primary" data-i18n-title="apps.scanApps">
                        <span data-i18n="apps.refresh">Refresh</span>
                    </button>
                    <button id="close-apps-btn" class="btn btn-close" data-i18n-title="common.close">×</button>
                </div>
            </div>
            
            <div class="panel-content">
                <div class="apps-status">
                    <div class="status-item">
                        <span data-i18n="apps.mcpServer">MCP Server</span>:
                        <span id="mcp-status" class="status-badge status-disconnected" data-i18n="apps.disconnected">Disconnected</span>
                    </div>
                    <div class="status-item">
                        <span data-i18n="apps.discovered">Applications discovered</span>:
                        <span id="apps-count" class="apps-count">0</span>
                    </div>
                </div>
                
                <div class="apps-tabs">
                    <button class="tab-btn active" data-tab="all" data-i18n="common.all">All</button>
                    <button class="tab-btn" data-tab="gui" data-i18n="apps.localApps">Local Apps</button>
                    <button class="tab-btn" data-tab="cli" data-i18n="apps.cliTools">CLI Tools</button>
                </div>
                
                <div class="apps-content">
                    <div id="apps-loading" class="loading-state hidden">
                        <div class="spinner"></div>
                        <span data-i18n="common.loading">Loading...</span>
                    </div>
                    
                    <div id="apps-empty" class="empty-state hidden">
                        <p data-i18n="apps.noApps">No applications found</p>
                        <button class="btn btn-primary" onclick="applicationsManager.scanApplications()" data-i18n="apps.scanApps">Scan Applications</button>
                    </div>
                    
                    <div id="apps-list" class="apps-list"></div>
                </div>
            </div>
        `;
        
        // Append to main container
        const mainContainer = document.querySelector('#main-container') || document.body;
        mainContainer.appendChild(this.container);
        
        // Update initial texts
        this.updateTexts();
    }
    
    bindEvents() {
        // Close button
        const closeBtn = this.container.querySelector('#close-apps-btn');
        closeBtn.addEventListener('click', () => this.hide());
        
        // Setup MCP button
        const setupMcpBtn = this.container.querySelector('#setup-mcp-btn');
        setupMcpBtn.addEventListener('click', () => this.setupMCPConfiguration());
        
        // Scan applications button
        const scanBtn = this.container.querySelector('#scan-apps-btn');
        scanBtn.addEventListener('click', () => this.scanApplications());
        
        // Tab switching
        const tabBtns = this.container.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.getAttribute('data-tab');
                this.switchTab(tab);
            });
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }
    
    updateTexts() {
        if (window.i18n) {
            // Update all elements with data-i18n attributes
            window.i18n.updatePageTexts();
        }
    }
    
    async loadApplications() {
        this.showLoading(true);
        
        try {
            // Call backend to get applications
            const response = await fetch('/api/applications');
            const data = await response.json();
            
            if (data.success) {
                this.applications = data.applications || {};
                this.updateApplicationsList();
                this.updateStatus();
                
                console.log(`Loaded ${Object.keys(this.applications).length} applications`);
            } else {
                throw new Error(data.error || 'Failed to load applications');
            }
            
        } catch (error) {
            console.error('Error loading applications:', error);
            this.showError('Failed to load applications');
        } finally {
            this.showLoading(false);
        }
    }
    
    async scanApplications() {
        const scanBtn = this.container.querySelector('#scan-apps-btn');
        const originalText = scanBtn.textContent;
        
        // Update button state
        scanBtn.disabled = true;
        scanBtn.textContent = window.t ? window.t('apps.scanApps') : 'Scanning...';
        
        this.showLoading(true);
        
        try {
            // Call backend to scan applications
            const response = await fetch('/api/applications/scan', {
                method: 'POST'
            });
            const data = await response.json();
            
            if (data.success) {
                this.applications = data.applications || {};
                this.updateApplicationsList();
                this.updateStatus();
                
                // Show success message
                this.showMessage(window.t ? window.t('apps.scanSuccess') : 'Applications scanned successfully', 'success');
                
                console.log(`Scanned and found ${Object.keys(this.applications).length} applications`);
            } else {
                throw new Error(data.error || 'Failed to scan applications');
            }
            
        } catch (error) {
            console.error('Error scanning applications:', error);
            this.showMessage(window.t ? window.t('apps.scanFailed') : 'Failed to scan applications', 'error');
        } finally {
            this.showLoading(false);
            scanBtn.disabled = false;
            scanBtn.textContent = originalText;
        }
    }
    
    async setupMCPConfiguration() {
        const setupBtn = this.container.querySelector('#setup-mcp-btn');
        const originalText = setupBtn.textContent;
        
        // Update button state
        setupBtn.disabled = true;
        setupBtn.textContent = window.t ? window.t('apps.configuring') : 'Configuring...';
        
        try {
            // Call backend to setup MCP configuration
            const response = await fetch('/api/applications/setup-mcp', {
                method: 'POST'
            });
            const data = await response.json();
            
            if (data.success) {
                // Show success message
                this.showMessage(
                    (window.t ? window.t('apps.configSuccess') : 'MCP server configured successfully') + 
                    '. Restart Claude Code to activate.',
                    'success'
                );
                
                // Update MCP status
                this.updateStatus();
                
                console.log('MCP configuration setup successful');
            } else {
                throw new Error(data.error || 'Failed to setup MCP configuration');
            }
            
        } catch (error) {
            console.error('Error setting up MCP configuration:', error);
            this.showMessage(
                window.t ? window.t('apps.configFailed') : 'Failed to configure MCP server',
                'error'
            );
        } finally {
            setupBtn.disabled = false;
            setupBtn.textContent = originalText;
        }
    }
    
    updateApplicationsList(filter = 'all') {
        const appsList = this.container.querySelector('#apps-list');
        const appsEmpty = this.container.querySelector('#apps-empty');
        
        // Filter applications
        let filteredApps = Object.entries(this.applications);
        if (filter === 'gui') {
            filteredApps = filteredApps.filter(([name, app]) => app.type === 'gui');
        } else if (filter === 'cli') {
            filteredApps = filteredApps.filter(([name, app]) => app.type === 'cli');
        }
        
        if (filteredApps.length === 0) {
            appsList.classList.add('hidden');
            appsEmpty.classList.remove('hidden');
            return;
        }
        
        appsList.classList.remove('hidden');
        appsEmpty.classList.add('hidden');
        
        // Group by type for better organization
        const guiApps = filteredApps.filter(([name, app]) => app.type === 'gui');
        const cliApps = filteredApps.filter(([name, app]) => app.type === 'cli');
        
        let html = '';
        
        if (guiApps.length > 0 && filter === 'all') {
            html += `
                <div class="apps-group">
                    <h3 class="group-title" data-i18n="apps.localApps">Local Applications</h3>
                    <div class="apps-grid">
                        ${guiApps.map(([name, app]) => this.createAppCard(name, app)).join('')}
                    </div>
                </div>
            `;
        } else if (guiApps.length > 0) {
            html += `<div class="apps-grid">${guiApps.map(([name, app]) => this.createAppCard(name, app)).join('')}</div>`;
        }
        
        if (cliApps.length > 0 && filter === 'all') {
            html += `
                <div class="apps-group">
                    <h3 class="group-title" data-i18n="apps.cliTools">CLI Tools</h3>
                    <div class="apps-grid">
                        ${cliApps.map(([name, app]) => this.createAppCard(name, app)).join('')}
                    </div>
                </div>
            `;
        } else if (cliApps.length > 0) {
            html += `<div class="apps-grid">${cliApps.map(([name, app]) => this.createAppCard(name, app)).join('')}</div>`;
        }
        
        appsList.innerHTML = html;
        
        // Bind launch buttons
        appsList.querySelectorAll('.launch-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const appName = e.target.getAttribute('data-app');
                this.launchApplication(appName);
            });
        });
        
        // Update texts for dynamic content
        this.updateTexts();
    }
    
    createAppCard(name, app) {
        const typeClass = app.type === 'gui' ? 'app-gui' : 'app-cli';
        const typeText = app.type === 'gui' ? (window.t ? window.t('apps.localApps') : 'GUI') : (window.t ? window.t('apps.cliTools') : 'CLI');
        const platformText = app.platform || 'Unknown';
        
        return `
            <div class="app-card ${typeClass}">
                <div class="app-header">
                    <div class="app-icon">
                        ${app.type === 'gui' ? '🖥️' : '⚙️'}
                    </div>
                    <div class="app-info">
                        <div class="app-name" title="${name}">${name}</div>
                        <div class="app-meta">
                            <span class="app-type">${typeText}</span>
                            <span class="app-platform">${platformText}</span>
                        </div>
                    </div>
                </div>
                <div class="app-path" title="${app.path}">${this.formatPath(app.path)}</div>
                <div class="app-actions">
                    <button class="btn btn-sm btn-primary launch-btn" data-app="${name}" data-i18n-title="apps.launch">
                        <span data-i18n="apps.launch">Launch</span>
                    </button>
                    <button class="btn btn-sm btn-secondary info-btn" data-app="${name}" data-i18n-title="apps.info">
                        <span data-i18n="apps.info">Info</span>
                    </button>
                </div>
            </div>
        `;
    }
    
    formatPath(path) {
        if (!path) return 'Unknown';
        
        // Shorten very long paths
        if (path.length > 60) {
            return '...' + path.slice(-57);
        }
        
        return path;
    }
    
    async launchApplication(appName) {
        if (!appName || !this.applications[appName]) {
            this.showMessage('Application not found', 'error');
            return;
        }
        
        const launchBtn = this.container.querySelector(`.launch-btn[data-app="${appName}"]`);
        const originalText = launchBtn.textContent;
        
        // Update button state
        launchBtn.disabled = true;
        launchBtn.textContent = window.t ? window.t('apps.launching') : 'Launching...';
        
        try {
            const response = await fetch('/api/applications/launch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ app_name: appName })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showMessage(
                    (window.t ? window.t('apps.launchSuccess') : 'Application launched successfully') + `: ${appName}`,
                    'success'
                );
                console.log(`Successfully launched application: ${appName}`);
            } else {
                throw new Error(data.error || 'Failed to launch application');
            }
            
        } catch (error) {
            console.error(`Error launching application ${appName}:`, error);
            this.showMessage(
                (window.t ? window.t('apps.launchFailed') : 'Failed to launch application') + `: ${appName}`,
                'error'
            );
        } finally {
            launchBtn.disabled = false;
            launchBtn.textContent = originalText;
        }
    }
    
    switchTab(tab) {
        // Update active tab
        this.container.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
        });
        
        // Update applications list
        this.updateApplicationsList(tab);
    }
    
    updateStatus() {
        const mcpStatus = this.container.querySelector('#mcp-status');
        const appsCount = this.container.querySelector('#apps-count');
        
        // Update applications count
        const totalApps = Object.keys(this.applications).length;
        appsCount.textContent = totalApps;
        
        // Update MCP status (this would be updated from actual MCP server status)
        // For now, we'll set it based on whether we have applications
        if (totalApps > 0) {
            mcpStatus.className = 'status-badge status-connected';
            mcpStatus.textContent = window.t ? window.t('apps.connected') : 'Connected';
            this.mcpServerStatus = 'connected';
        } else {
            mcpStatus.className = 'status-badge status-disconnected';
            mcpStatus.textContent = window.t ? window.t('apps.disconnected') : 'Disconnected';
            this.mcpServerStatus = 'disconnected';
        }
    }
    
    showLoading(show) {
        const loading = this.container.querySelector('#apps-loading');
        const content = this.container.querySelector('#apps-list');
        
        if (show) {
            loading.classList.remove('hidden');
            content.classList.add('hidden');
        } else {
            loading.classList.add('hidden');
            content.classList.remove('hidden');
        }
    }
    
    showMessage(message, type = 'info') {
        // Create or update message element
        let messageEl = this.container.querySelector('.message-toast');
        
        if (!messageEl) {
            messageEl = document.createElement('div');
            messageEl.className = 'message-toast';
            this.container.appendChild(messageEl);
        }
        
        messageEl.className = `message-toast message-${type}`;
        messageEl.textContent = message;
        messageEl.style.display = 'block';
        
        // Auto hide after 3 seconds
        setTimeout(() => {
            if (messageEl) {
                messageEl.style.display = 'none';
            }
        }, 3000);
    }
    
    showError(message) {
        this.showMessage(message, 'error');
    }
    
    show() {
        this.container.classList.remove('hidden');
        this.isVisible = true;
        
        // Load fresh data when shown
        this.loadApplications();
        
        console.log('Applications Manager shown');
    }
    
    hide() {
        this.container.classList.add('hidden');
        this.isVisible = false;
        
        console.log('Applications Manager hidden');
    }
    
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    destroy() {
        // Unregister from i18n
        if (window.i18n) {
            window.i18n.unregisterComponent('applications-manager');
        }
        
        // Remove DOM element
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        
        console.log('Applications Manager destroyed');
    }
}

// Global instance
let applicationsManager = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    applicationsManager = new ApplicationsManager();
    // Make it globally accessible
    window.applicationsManager = applicationsManager;
});

/**
 * Applications Settings Component for Settings Modal Integration
 * Handles application management within the settings interface
 */
class ApplicationsSettings {
    constructor() {
        this.applications = {};
        this.currentFilterType = 'all'; // 'all', 'type', 'tag'
        this.currentFilterValue = ''; // '', 'gui', 'cli', or tag name
        this.isInitialized = false;
        
        console.log('Applications Settings initialized');
    }
    
    async initialize() {
        if (this.isInitialized) return;
        
        this.container = document.querySelector('#settings-applications');
        if (!this.container) {
            console.error('Applications settings container not found');
            return;
        }
        
        this.bindEvents();
        this.isInitialized = true;
        
        // Load applications data
        await this.loadApplications();
        
        console.log('Applications Settings fully initialized');
    }
    
    bindEvents() {
        if (!this.container) return;
        
        // Scan applications button
        const scanBtn = this.container.querySelector('#settings-scan-apps-btn');
        if (scanBtn) {
            scanBtn.addEventListener('click', () => this.scanApplications());
        }
        
        // Unified filter switching (will be set up after loading applications)
        this.setupUnifiedFilters();
    }
    
    async loadApplications() {
        this.showLoading(true);
        
        try {
            const response = await fetch('/api/applications');
            const data = await response.json();
            
            if (data.success) {
                this.applications = data.applications || {};
                this.updateApplicationsList();
                this.updateStatus();
                
                console.log(`Loaded ${Object.keys(this.applications).length} applications`);
            } else {
                throw new Error(data.error || 'Failed to load applications');
            }
            
        } catch (error) {
            console.error('Error loading applications:', error);
            this.showMessage('Failed to load applications', 'error');
        } finally {
            this.showLoading(false);
            // Update unified filters after loading applications
            this.updateUnifiedFilters();
        }
    }
    
    async scanApplications() {
        const scanBtn = this.container.querySelector('#settings-scan-apps-btn');
        const originalText = scanBtn.textContent;
        
        scanBtn.disabled = true;
        scanBtn.textContent = window.t ? window.t('apps.scanApps') : 'Scanning...';
        
        this.showLoading(true);
        
        try {
            const response = await fetch('/api/applications/scan', {
                method: 'POST'
            });
            const data = await response.json();
            
            if (data.success) {
                this.applications = data.applications || {};
                this.updateApplicationsList();
                this.updateStatus();
                
                this.showMessage(window.t ? window.t('apps.scanSuccess') : 'Applications scanned successfully', 'success');
                console.log(`Scanned and found ${Object.keys(this.applications).length} applications`);
            } else {
                throw new Error(data.error || 'Failed to scan applications');
            }
            
        } catch (error) {
            console.error('Error scanning applications:', error);
            this.showMessage(window.t ? window.t('apps.scanFailed') : 'Failed to scan applications', 'error');
        } finally {
            this.showLoading(false);
            scanBtn.disabled = false;
            scanBtn.textContent = originalText;
        }
    }
    
    async setupMCPConfiguration() {
        const setupBtn = this.container.querySelector('#settings-setup-mcp-btn');
        const originalText = setupBtn.textContent;
        
        setupBtn.disabled = true;
        setupBtn.textContent = window.t ? window.t('apps.configuring') : 'Configuring...';
        
        try {
            const response = await fetch('/api/applications/setup-mcp', {
                method: 'POST'
            });
            const data = await response.json();
            
            if (data.success) {
                this.showMessage(
                    (window.t ? window.t('apps.configSuccess') : 'MCP server configured successfully') + 
                    '. Restart Claude Code to activate.',
                    'success'
                );
                
                this.updateStatus();
                console.log('MCP configuration setup successful');
            } else {
                throw new Error(data.error || 'Failed to setup MCP configuration');
            }
            
        } catch (error) {
            console.error('Error setting up MCP configuration:', error);
            this.showMessage(
                window.t ? window.t('apps.configFailed') : 'Failed to configure MCP server',
                'error'
            );
        } finally {
            setupBtn.disabled = false;
            setupBtn.textContent = originalText;
        }
    }
    
    updateApplicationsList(filter = null) {
        const currentFilter = filter || this.currentFilter;
        this.currentFilter = currentFilter;
        
        const appsList = this.container.querySelector('#settings-apps-list');
        const appsEmpty = this.container.querySelector('#settings-apps-empty');
        
        if (!appsList || !appsEmpty) return;
        
        // Filter applications
        let filteredApps = Object.entries(this.applications);
        
        // Filter by type
        if (currentFilter === 'gui') {
            filteredApps = filteredApps.filter(([name, app]) => app.type === 'gui');
        } else if (currentFilter === 'cli') {
            filteredApps = filteredApps.filter(([name, app]) => app.type === 'cli');
        }
        
        // Filter by tag
        if (this.currentTagFilter) {
            filteredApps = filteredApps.filter(([name, app]) => 
                app.tags && app.tags.includes(this.currentTagFilter)
            );
        }
        
        if (filteredApps.length === 0) {
            appsList.classList.add('hidden');
            appsEmpty.classList.remove('hidden');
            return;
        }
        
        appsList.classList.remove('hidden');
        appsEmpty.classList.add('hidden');
        
        // Group by type
        const guiApps = filteredApps.filter(([name, app]) => app.type === 'gui');
        const cliApps = filteredApps.filter(([name, app]) => app.type === 'cli');
        
        let html = '';
        
        if (guiApps.length > 0 && currentFilter === 'all') {
            html += `
                <div class="apps-group-settings">
                    <h4 class="group-title" data-i18n="apps.localApps">Local Applications</h4>
                    <div class="apps-grid-settings">
                        ${guiApps.map(([name, app]) => this.createAppCardSettings(name, app)).join('')}
                    </div>
                </div>
            `;
        } else if (guiApps.length > 0) {
            html += `<div class="apps-grid-settings">${guiApps.map(([name, app]) => this.createAppCardSettings(name, app)).join('')}</div>`;
        }
        
        if (cliApps.length > 0 && currentFilter === 'all') {
            html += `
                <div class="apps-group-settings">
                    <h4 class="group-title" data-i18n="apps.cliTools">CLI Tools</h4>
                    <div class="apps-grid-settings">
                        ${cliApps.map(([name, app]) => this.createAppCardSettings(name, app)).join('')}
                    </div>
                </div>
            `;
        } else if (cliApps.length > 0) {
            html += `<div class="apps-grid-settings">${cliApps.map(([name, app]) => this.createAppCardSettings(name, app)).join('')}</div>`;
        }
        
        appsList.innerHTML = html;
        
        // Bind launch buttons
        appsList.querySelectorAll('.launch-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent triggering card click
                const appName = e.target.closest('.launch-btn').getAttribute('data-app');
                this.launchApplication(appName);
            });
        });
        
        // Bind edit tags to app card click
        appsList.querySelectorAll('.editable-app-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't trigger if clicking on launch button or its children
                if (e.target.closest('.launch-btn')) {
                    return;
                }
                const appName = card.getAttribute('data-app');
                console.log('App card clicked (old method):', appName);
                console.log('Applications data (old method):', this.applications);
                this.editApplicationTags(appName);
            });
        });
        
        // Update i18n texts
        if (window.i18n) {
            window.i18n.updatePageTexts();
        }
    }
    
    createAppCardSettings(name, app) {
        const typeClass = app.type === 'gui' ? 'app-gui' : 'app-cli';
        const typeText = app.type === 'gui' ? (window.t ? window.t('apps.localApps') : 'GUI') : (window.t ? window.t('apps.cliTools') : 'CLI');
        
        // Format tags for display
        const tags = app.tags || [];
        const tagsHtml = tags.length > 0 
            ? tags.map(tag => `<span class="app-tag">${tag}</span>`).join('')
            : '<span class="app-no-tags">No tags</span>';
        
        return `
            <div class="app-card-settings ${typeClass} editable-app-card" data-app="${name}" title="Click to edit tags">
                <div class="app-icon">
                    ${app.type === 'gui' ? '🖥️' : '⚙️'}
                </div>
                <div class="app-info">
                    <div class="app-name" title="${name}">${name}</div>
                    <div class="app-type">${typeText}</div>
                    <div class="app-tags">
                        ${tagsHtml}
                    </div>
                </div>
                <div class="app-actions">
                    <button class="btn btn-sm btn-primary launch-btn" data-app="${name}" data-i18n-title="apps.launch" onclick="event.stopPropagation()">
                        <span data-i18n="apps.launch">Launch</span>
                    </button>
                </div>
            </div>
        `;
    }
    
    async launchApplication(appName) {
        if (!appName || !this.applications[appName]) {
            this.showMessage('Application not found', 'error');
            return;
        }
        
        const launchBtn = this.container.querySelector(`.launch-btn[data-app="${appName}"]`);
        const originalText = launchBtn.textContent;
        
        launchBtn.disabled = true;
        launchBtn.textContent = window.t ? window.t('apps.launching') : 'Launching...';
        
        try {
            const response = await fetch('/api/applications/launch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ app_name: appName })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showMessage(
                    (window.t ? window.t('apps.launchSuccess') : 'Application launched successfully') + `: ${appName}`,
                    'success'
                );
                console.log(`Successfully launched application: ${appName}`);
            } else {
                throw new Error(data.error || 'Failed to launch application');
            }
            
        } catch (error) {
            console.error(`Error launching application ${appName}:`, error);
            this.showMessage(
                (window.t ? window.t('apps.launchFailed') : 'Failed to launch application') + `: ${appName}`,
                'error'
            );
        } finally {
            launchBtn.disabled = false;
            launchBtn.textContent = originalText;
        }
    }
    
    switchTab(tab) {
        // Update active tab
        this.container.querySelectorAll('.apps-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
        });
        
        // Update applications list
        this.updateApplicationsList(tab);
    }
    
    setupTagFilters() {
        // This will be called after loading applications
        const tagFilterContainer = this.container.querySelector('#tag-filter-tabs');
        if (tagFilterContainer) {
            // Add event listener for tag filter buttons
            tagFilterContainer.addEventListener('click', (e) => {
                if (e.target.classList.contains('tag-filter-btn')) {
                    const tag = e.target.getAttribute('data-tag');
                    this.switchTagFilter(tag);
                }
            });
        }
    }
    
    updateTagFilters() {
        const tagFilterContainer = this.container.querySelector('#tag-filter-tabs');
        if (!tagFilterContainer) return;
        
        // Collect all unique tags from applications
        const allTags = new Set();
        Object.values(this.applications).forEach(app => {
            if (app.tags && Array.isArray(app.tags)) {
                app.tags.forEach(tag => allTags.add(tag));
            }
        });
        
        // Create tag filter buttons
        const tagButtons = ['<button class="tag-filter-btn active" data-tag="">All Apps</button>'];
        
        // Sort tags and create buttons
        Array.from(allTags).sort().forEach(tag => {
            const count = this.getTagCount(tag);
            tagButtons.push(`<button class="tag-filter-btn" data-tag="${tag}">${tag} (${count})</button>`);
        });
        
        tagFilterContainer.innerHTML = tagButtons.join('');
        
        // Update active state
        this.updateTagFilterState();
    }
    
    getTagCount(tag) {
        return Object.values(this.applications).filter(app => 
            app.tags && app.tags.includes(tag)
        ).length;
    }
    
    switchTagFilter(tag) {
        this.currentTagFilter = tag;
        this.updateTagFilterState();
        this.updateApplicationsList();
    }
    
    updateTagFilterState() {
        const tagFilterContainer = this.container.querySelector('#tag-filter-tabs');
        if (!tagFilterContainer) return;
        
        tagFilterContainer.querySelectorAll('.tag-filter-btn').forEach(btn => {
            const btnTag = btn.getAttribute('data-tag');
            btn.classList.toggle('active', btnTag === this.currentTagFilter);
        });
    }
    
    updateStatus() {
        // Application count is now shown in the filter buttons
        // No separate count display needed
    }
    
    showLoading(show) {
        const loading = this.container.querySelector('#settings-apps-loading');
        const content = this.container.querySelector('#settings-apps-list');
        
        if (!loading || !content) return;
        
        if (show) {
            loading.classList.remove('hidden');
            content.classList.add('hidden');
        } else {
            loading.classList.add('hidden');
            content.classList.remove('hidden');
        }
    }
    
    async editApplicationTags(appName) {
        
        const app = this.applications[appName];
        if (!app) {
            console.error('Application not found:', appName);
            this.showMessage('Application not found', 'error');
            return;
        }
        
        // Get current tags
        const currentTags = app.tags || [];
        
        // Create tag editor modal
        this.showTagEditor(appName, currentTags);
    }
    
    showTagEditor(appName, currentTags) {
        // Remove any existing tag editor
        const existingEditor = document.querySelector('#tag-editor-modal');
        if (existingEditor) {
            existingEditor.remove();
        }
        
        // Predefined common tags
        const commonTags = ['development', 'design', 'browser', 'office', 'media', 'system', 'utility'];
        
        // Create modal
        const modal = document.createElement('div');
        modal.id = 'tag-editor-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content tag-editor">
                <div class="modal-header">
                    <h3><span data-i18n="apps.editTagsFor">Edit Tags for</span> ${appName}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="current-tags">
                        <label data-i18n="apps.currentTags">Current Tags:</label>
                        <div class="tags-container" id="current-tags-container">
                            ${currentTags.map(tag => `
                                <span class="tag-chip" data-tag="${tag}">
                                    ${tag}
                                    <button class="tag-remove">&times;</button>
                                </span>
                            `).join('')}
                            ${currentTags.length === 0 ? '<span class="no-tags" data-i18n="apps.noTags">No tags</span>' : ''}
                        </div>
                    </div>
                    
                    <div class="tag-input-section">
                        <label data-i18n="apps.addTag">Add Tag:</label>
                        <div class="tag-input-container">
                            <input type="text" id="tag-input" data-i18n-placeholder="apps.enterTagName" placeholder="Enter tag name..." />
                            <button id="add-tag-btn" class="btn btn-sm btn-secondary" data-i18n="apps.add">Add</button>
                        </div>
                    </div>
                    
                    <div class="common-tags">
                        <label data-i18n="apps.commonTags">Common Tags:</label>
                        <div class="common-tags-container">
                            ${commonTags.map(tag => `
                                <button class="tag-suggestion ${currentTags.includes(tag) ? 'active' : ''}" 
                                        data-tag="${tag}">${tag}</button>
                            `).join('')}
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="save-tags-btn" class="btn btn-primary" data-i18n="apps.saveTags">Save Tags</button>
                    <button id="cancel-tags-btn" class="btn btn-secondary" data-i18n="common.cancel">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add some styling to make sure it's visible
        modal.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: rgba(0, 0, 0, 0.5) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            z-index: 999999 !important;
            pointer-events: auto !important;
            opacity: 1 !important;
            visibility: visible !important;
        `;
        
        // Style the modal content
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.style.cssText = `
                background: white !important;
                border-radius: 12px !important;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1) !important;
                width: 90% !important;
                max-width: 500px !important;
                max-height: 80vh !important;
                overflow: auto !important;
                display: flex !important;
                flex-direction: column !important;
                position: relative !important;
                z-index: 1000000 !important;
                opacity: 1 !important;
                visibility: visible !important;
            `;
        }
        
        // Bind events
        this.bindTagEditorEvents(modal, appName, currentTags);
        
        // Update i18n texts for modal
        if (window.i18n) {
            window.i18n.updatePageTexts();
        }
        
        // Focus on input
        const tagInput = modal.querySelector('#tag-input');
        if (tagInput) {
            tagInput.focus();
        }
    }
    
    bindTagEditorEvents(modal, appName, originalTags) {
        let currentTags = [...originalTags];
        
        // Close modal events
        const closeModal = () => modal.remove();
        modal.querySelector('.modal-close').addEventListener('click', closeModal);
        modal.querySelector('#cancel-tags-btn').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        // Add tag from input
        const addTagFromInput = () => {
            const tagInput = modal.querySelector('#tag-input');
            const newTag = tagInput.value.trim().toLowerCase();
            
            if (newTag && !currentTags.includes(newTag)) {
                currentTags.push(newTag);
                this.updateTagsDisplay(modal, currentTags);
                tagInput.value = '';
            }
        };
        
        modal.querySelector('#add-tag-btn').addEventListener('click', addTagFromInput);
        modal.querySelector('#tag-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addTagFromInput();
            }
        });
        
        // Common tag suggestions
        modal.querySelectorAll('.tag-suggestion').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tag = e.target.getAttribute('data-tag');
                if (currentTags.includes(tag)) {
                    // Remove tag
                    currentTags = currentTags.filter(t => t !== tag);
                } else {
                    // Add tag
                    currentTags.push(tag);
                }
                this.updateTagsDisplay(modal, currentTags);
            });
        });
        
        // Remove tag chips
        this.bindTagRemoveEvents(modal, currentTags);
        
        // Save tags
        modal.querySelector('#save-tags-btn').addEventListener('click', async () => {
            await this.saveApplicationTags(appName, currentTags);
            closeModal();
        });
    }
    
    bindTagRemoveEvents(modal, currentTags) {
        modal.querySelectorAll('.tag-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tagChip = e.target.closest('.tag-chip');
                const tag = tagChip.getAttribute('data-tag');
                const index = currentTags.indexOf(tag);
                if (index > -1) {
                    currentTags.splice(index, 1);
                    this.updateTagsDisplay(modal, currentTags);
                }
            });
        });
    }
    
    updateTagsDisplay(modal, currentTags) {
        const container = modal.querySelector('#current-tags-container');
        
        if (currentTags.length === 0) {
            container.innerHTML = '<span class="no-tags">No tags</span>';
        } else {
            container.innerHTML = currentTags.map(tag => `
                <span class="tag-chip" data-tag="${tag}">
                    ${tag}
                    <button class="tag-remove">&times;</button>
                </span>
            `).join('');
        }
        
        // Re-bind remove events
        this.bindTagRemoveEvents(modal, currentTags);
        
        // Update common tag buttons
        modal.querySelectorAll('.tag-suggestion').forEach(btn => {
            const tag = btn.getAttribute('data-tag');
            btn.classList.toggle('active', currentTags.includes(tag));
        });
    }
    
    async saveApplicationTags(appName, tags) {
        try {
            const response = await fetch('/api/applications/update-tags', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    app_name: appName,
                    tags: tags
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Update local application data
                if (this.applications[appName]) {
                    this.applications[appName].tags = tags;
                }
                
                // Refresh the applications list to show updated tags
                this.updateApplicationsList();
                
                this.showMessage(`Tags updated for ${appName}`, 'success');
                console.log(`Updated tags for ${appName}:`, tags);
            } else {
                throw new Error(data.error || 'Failed to update tags');
            }
            
        } catch (error) {
            console.error(`Error updating tags for ${appName}:`, error);
            this.showMessage(`Failed to update tags for ${appName}`, 'error');
        }
    }
    
    showMessage(message, type = 'info') {
        // Use global message system if available
        if (window.showMessage) {
            window.showMessage(message, type);
            return;
        }
        
        // Fallback to console
        console.log(`[${type.toUpperCase()}] ${message}`);
    }
}

// Global instances
let applicationsSettings = null;

// Initialize settings component when needed
function initializeApplicationsSettings() {
    if (!applicationsSettings) {
        applicationsSettings = new ApplicationsSettings();
        window.applicationsSettings = applicationsSettings;
    }
    return applicationsSettings.initialize();
}

// Make function globally accessible
window.initializeApplicationsSettings = initializeApplicationsSettings;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ApplicationsManager, ApplicationsSettings };
}

// New Unified Filter System for ApplicationsSettings
ApplicationsSettings.prototype.setupUnifiedFilters = function() {
    const filterContainer = this.container.querySelector('#unified-filter-tabs');
    if (filterContainer) {
        filterContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-tab-btn')) {
                const filterType = e.target.getAttribute('data-filter-type');
                const filterValue = e.target.getAttribute('data-filter-value');
                this.switchUnifiedFilter(filterType, filterValue);
            }
        });
    }
};

ApplicationsSettings.prototype.updateUnifiedFilters = function() {
    const filterContainer = this.container.querySelector('#unified-filter-tabs');
    if (!filterContainer) return;
    
    // Collect all unique tags from applications
    const allTags = new Set();
    Object.values(this.applications).forEach(app => {
        if (app.tags && Array.isArray(app.tags)) {
            app.tags.forEach(tag => allTags.add(tag));
        }
    });
    
    // Get total app count
    const totalApps = Object.keys(this.applications).length;
    const guiCount = Object.values(this.applications).filter(app => app.type === 'gui').length;
    const cliCount = Object.values(this.applications).filter(app => app.type === 'cli').length;
    
    // Build filter buttons HTML with counts
    let filterButtons = `
        <button class="filter-tab-btn active" data-filter-type="all" data-filter-value="">All Apps (${totalApps})</button>
        <button class="filter-tab-btn" data-filter-type="type" data-filter-value="gui">GUI Apps (${guiCount})</button>
        <button class="filter-tab-btn" data-filter-type="type" data-filter-value="cli">CLI Tools (${cliCount})</button>
    `;
    
    // Add tag filter buttons
    Array.from(allTags).sort().forEach(tag => {
        const count = this.getTagCount(tag);
        filterButtons += `<button class="filter-tab-btn" data-filter-type="tag" data-filter-value="${tag}">${tag} (${count})</button>`;
    });
    
    filterContainer.innerHTML = filterButtons;
    
    // Update i18n texts
    if (window.i18n) {
        window.i18n.updatePageTexts();
    }
};

ApplicationsSettings.prototype.switchUnifiedFilter = function(filterType, filterValue) {
    this.currentFilterType = filterType;
    this.currentFilterValue = filterValue;
    this.updateUnifiedFilterState();
    this.updateApplicationsList();
};

ApplicationsSettings.prototype.updateUnifiedFilterState = function() {
    const filterContainer = this.container.querySelector('#unified-filter-tabs');
    if (!filterContainer) return;
    
    filterContainer.querySelectorAll('.filter-tab-btn').forEach(btn => {
        const btnType = btn.getAttribute('data-filter-type');
        const btnValue = btn.getAttribute('data-filter-value');
        btn.classList.toggle('active', 
            btnType === this.currentFilterType && btnValue === this.currentFilterValue);
    });
};

// Override updateApplicationsList to use unified filter
ApplicationsSettings.prototype.updateApplicationsList = function() {
    const appsList = this.container.querySelector('#settings-apps-list');
    if (!appsList) return;
    
    const apps = Object.entries(this.applications);
    
    // Apply unified filter
    const filteredApps = apps.filter(([name, app]) => {
        if (this.currentFilterType === 'all') {
            return true;
        } else if (this.currentFilterType === 'type') {
            return app.type === this.currentFilterValue;
        } else if (this.currentFilterType === 'tag') {
            return app.tags && app.tags.includes(this.currentFilterValue);
        }
        return true;
    });
    
    if (filteredApps.length === 0) {
        appsList.innerHTML = `<div class="empty-state"><p>No applications found for selected filter</p></div>`;
        return;
    }
    
    // Group applications by type for display
    const guiApps = filteredApps.filter(([name, app]) => app.type === 'gui');
    const cliApps = filteredApps.filter(([name, app]) => app.type === 'cli');
    
    let html = '';
    
    // Show GUI apps
    if (guiApps.length > 0) {
        if (this.currentFilterType === 'all') {
            html += `
                <div class="apps-group-settings">
                    <h4 class="group-title" data-i18n="apps.localApps">GUI Applications</h4>
                    <div class="apps-grid-settings">
                        ${guiApps.map(([name, app]) => this.createAppCardSettings(name, app)).join('')}
                    </div>
                </div>
            `;
        } else {
            html += `<div class="apps-grid-settings">${guiApps.map(([name, app]) => this.createAppCardSettings(name, app)).join('')}</div>`;
        }
    }
    
    // Show CLI apps
    if (cliApps.length > 0) {
        if (this.currentFilterType === 'all') {
            html += `
                <div class="apps-group-settings">
                    <h4 class="group-title" data-i18n="apps.cliTools">CLI Tools</h4>
                    <div class="apps-grid-settings">
                        ${cliApps.map(([name, app]) => this.createAppCardSettings(name, app)).join('')}
                    </div>
                </div>
            `;
        } else {
            html += `<div class="apps-grid-settings">${cliApps.map(([name, app]) => this.createAppCardSettings(name, app)).join('')}</div>`;
        }
    }
    
    appsList.innerHTML = html;
    
    // Bind launch buttons
    appsList.querySelectorAll('.launch-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering card click
            const appName = e.target.closest('.launch-btn').getAttribute('data-app');
            this.launchApplication(appName);
        });
    });
    
    // Bind edit tags to app card click
    appsList.querySelectorAll('.editable-app-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Don't trigger if clicking on launch button or its children
            if (e.target.closest('.launch-btn')) {
                return;
            }
            const appName = card.getAttribute('data-app');
            console.log('App card clicked:', appName);
            console.log('Applications data:', this.applications);
            this.editApplicationTags(appName);
        });
    });
    
    // Update i18n texts
    if (window.i18n) {
        window.i18n.updatePageTexts();
    }
};

// Force browser cache refresh - timestamp: 2025-08-22T05:05:00Z