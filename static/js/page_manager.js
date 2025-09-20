/**
 * Page Manager - Page-level session isolation system
 * Manages unique page identifiers for message routing isolation
 */
class PageManager {
    constructor() {
        this.pageId = this.getOrCreatePageId();
        this.connectionId = null; // Will be set when WebSocket connects
        this.isInitialized = false;
        this.initializePageManager();
    }

    /**
     * Get or create a unique page identifier
     * Page ID persists across page refreshes but is unique per browser tab
     */
    getOrCreatePageId() {
        // Try to get existing pageId from sessionStorage (tab-specific)
        let pageId = sessionStorage.getItem('claude_page_id');

        if (!pageId) {
            // Generate new pageId with timestamp and random string
            pageId = 'page_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('claude_page_id', pageId);
            console.log('Generated new pageId:', pageId);
        } else {
            console.log('Using existing pageId:', pageId);
        }

        return pageId;
    }

    /**
     * Initialize page manager and set up page identifier display
     */
    initializePageManager() {
        this.isInitialized = true;

        // Add page identifier to page for debugging (in development mode)
        if (window.location.hostname === 'localhost') {
            this.addPageIdDebugInfo();
        }

        console.log('PageManager initialized with pageId:', this.pageId);
    }

    /**
     * Set connection ID when WebSocket connects
     */
    setConnectionId(connectionId) {
        this.connectionId = connectionId;
        console.log('PageManager: Set connectionId:', connectionId);
    }

    /**
     * Get page routing context for message sending
     */
    getRoutingContext() {
        return {
            pageId: this.pageId,
            connectionId: this.connectionId,
            timestamp: Date.now()
        };
    }

    /**
     * Add debug information to page (development only)
     */
    addPageIdDebugInfo() {
        // Create debug info element
        const debugElement = document.createElement('div');
        debugElement.id = 'page-debug-info';
        debugElement.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 12px;
            font-family: monospace;
            z-index: 10000;
            pointer-events: none;
        `;
        debugElement.textContent = `PageID: ${this.pageId.substring(5, 15)}...`;

        // Add to page
        document.body.appendChild(debugElement);
    }

    /**
     * Reset page ID (for testing purposes)
     */
    resetPageId() {
        sessionStorage.removeItem('claude_page_id');
        this.pageId = this.getOrCreatePageId();
        console.log('PageManager: Reset to new pageId:', this.pageId);

        // Update debug info if exists
        const debugElement = document.getElementById('page-debug-info');
        if (debugElement) {
            debugElement.textContent = `PageID: ${this.pageId.substring(5, 15)}...`;
        }

        return this.pageId;
    }

    /**
     * Get page statistics for debugging
     */
    getDebugInfo() {
        return {
            pageId: this.pageId,
            connectionId: this.connectionId,
            isInitialized: this.isInitialized,
            sessionStorageKey: 'claude_page_id',
            createdAt: sessionStorage.getItem('claude_page_created_at') || 'unknown'
        };
    }
}

// Create global page manager instance
window.pageManager = new PageManager();

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PageManager;
}