/**
 * Icon Preloader - Manages icon caching and prevents loading flickers
 * Ensures all frequently used icons are preloaded into browser cache
 */

class IconPreloader {
    constructor() {
        this.preloadedIcons = new Map();
        this.loadingPromises = new Map();
        this.isInitialized = false;
        
        // Define all frequently used icon paths
        this.iconPaths = [
            // Interface icons
            '/static/assets/icons/interface/zap.png',
            '/static/assets/icons/interface/folder.png',
            '/static/assets/icons/interface/package.png',
            '/static/assets/icons/interface/gui.png',
            '/static/assets/icons/interface/cli.png',
            '/static/assets/icons/interface/browser.png',
            '/static/assets/icons/interface/tools.png',
            '/static/assets/icons/interface/settings.png',
            '/static/assets/icons/interface/menu.png',
            '/static/assets/icons/interface/refresh.png',
            '/static/assets/icons/interface/detect.png',
            '/static/assets/icons/interface/edit.png',
            '/static/assets/icons/interface/info.png',
            '/static/assets/icons/interface/rocket.png',
            '/static/assets/icons/interface/terminal.png',
            '/static/assets/icons/interface/apps.png',
            
            // Status icons
            '/static/assets/icons/status/check.png',
            '/static/assets/icons/status/error.png',
            '/static/assets/icons/status/warning.png',
            
            // System icons
            '/static/assets/icons/system/logo.png',
            '/static/assets/icons/system/favicon.png',
            
            // Social icons (commonly used)
            '/static/assets/icons/social/github-gray.png',
            '/static/assets/icons/social/github-color.png',
            '/static/assets/icons/social/twitter-gray.png',
            '/static/assets/icons/social/twitter-color.png',
            '/static/assets/icons/social/wechat-gray.png',
            '/static/assets/icons/social/wechat-color.png',
            '/static/assets/icons/social/douin-gray.png',
            '/static/assets/icons/social/douyin-color.png'
        ];
    }

    /**
     * Initialize and preload all icons
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }

        console.log('IconPreloader: Starting icon preload...');
        
        try {
            await this.preloadAll();
            this.isInitialized = true;
            console.log(`IconPreloader: Successfully preloaded ${this.preloadedIcons.size} icons`);
            
            // Dispatch event to notify other components
            document.dispatchEvent(new CustomEvent('iconsPreloaded', {
                detail: { count: this.preloadedIcons.size }
            }));
            
        } catch (error) {
            console.error('IconPreloader: Failed to preload icons:', error);
        }
    }

    /**
     * Preload all icons in parallel with batching
     */
    async preloadAll() {
        const batchSize = 6; // Limit concurrent requests
        const batches = [];
        
        // Split icons into batches
        for (let i = 0; i < this.iconPaths.length; i += batchSize) {
            batches.push(this.iconPaths.slice(i, i + batchSize));
        }
        
        // Process batches sequentially, icons within batch in parallel
        for (const batch of batches) {
            const batchPromises = batch.map(path => this.preloadIcon(path));
            await Promise.all(batchPromises);
        }
    }

    /**
     * Preload a single icon
     */
    preloadIcon(iconPath) {
        if (this.preloadedIcons.has(iconPath)) {
            return Promise.resolve(this.preloadedIcons.get(iconPath));
        }

        if (this.loadingPromises.has(iconPath)) {
            return this.loadingPromises.get(iconPath);
        }

        const loadPromise = new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
                this.preloadedIcons.set(iconPath, img);
                this.loadingPromises.delete(iconPath);
                resolve(img);
            };
            
            img.onerror = (error) => {
                console.warn(`IconPreloader: Failed to load icon: ${iconPath}`, error);
                this.loadingPromises.delete(iconPath);
                // Don't reject - continue with other icons
                resolve(null);
            };
            
            img.src = iconPath;
        });

        this.loadingPromises.set(iconPath, loadPromise);
        return loadPromise;
    }

    /**
     * Add new icon path to preload
     */
    addIconPath(iconPath) {
        if (!this.iconPaths.includes(iconPath)) {
            this.iconPaths.push(iconPath);
            
            // If already initialized, preload this icon immediately
            if (this.isInitialized) {
                this.preloadIcon(iconPath);
            }
        }
    }

    /**
     * Check if an icon is preloaded
     */
    isIconPreloaded(iconPath) {
        return this.preloadedIcons.has(iconPath);
    }

    /**
     * Get preloaded icon element (returns cloned image)
     */
    getPreloadedIcon(iconPath) {
        const img = this.preloadedIcons.get(iconPath);
        if (img) {
            return img.cloneNode(true);
        }
        return null;
    }

    /**
     * Create optimized img element with preloaded source
     */
    createOptimizedImg(iconPath, alt = '', width = null, height = null) {
        const img = document.createElement('img');
        
        // Set attributes
        img.src = iconPath;
        img.alt = alt;
        if (width) img.width = width;
        if (height) img.height = height;
        
        // If icon is preloaded, it should display immediately
        if (this.isIconPreloaded(iconPath)) {
            img.style.opacity = '1';
        } else {
            // Fade in when loaded
            img.style.opacity = '0';
            img.style.transition = 'opacity 0.2s ease-in-out';
            
            img.onload = () => {
                img.style.opacity = '1';
            };
            
            // Try to preload if not already done
            this.preloadIcon(iconPath);
        }
        
        return img;
    }

    /**
     * Get optimization stats
     */
    getStats() {
        return {
            totalPaths: this.iconPaths.length,
            preloaded: this.preloadedIcons.size,
            loading: this.loadingPromises.size,
            isInitialized: this.isInitialized
        };
    }

    /**
     * Clear all preloaded icons (for memory management)
     */
    clear() {
        this.preloadedIcons.clear();
        this.loadingPromises.clear();
        this.isInitialized = false;
    }
}

// Icon path constants for consistent usage across components
const ICON_PATHS = {
    // Interface
    ZAP: '/static/assets/icons/interface/zap.png',
    FOLDER: '/static/assets/icons/interface/folder.png',
    PACKAGE: '/static/assets/icons/interface/package.png',
    GUI: '/static/assets/icons/interface/gui.png',
    CLI: '/static/assets/icons/interface/cli.png',
    BROWSER: '/static/assets/icons/interface/browser.png',
    TOOLS: '/static/assets/icons/interface/tools.png',
    SETTINGS: '/static/assets/icons/interface/settings.png',
    MENU: '/static/assets/icons/interface/menu.png',
    REFRESH: '/static/assets/icons/interface/refresh.png',
    DETECT: '/static/assets/icons/interface/detect.png',
    EDIT: '/static/assets/icons/interface/edit.png',
    INFO: '/static/assets/icons/interface/info.png',
    ROCKET: '/static/assets/icons/interface/rocket.png',
    TERMINAL: '/static/assets/icons/interface/terminal.png',
    APPS: '/static/assets/icons/interface/apps.png',
    
    // Status
    CHECK: '/static/assets/icons/status/check.png',
    ERROR: '/static/assets/icons/status/error.png',
    WARNING: '/static/assets/icons/status/warning.png',
    
    // System
    LOGO: '/static/assets/icons/system/logo.png',
    FAVICON: '/static/assets/icons/system/favicon.png'
};

// Create global instance
window.IconPreloader = IconPreloader;
window.ICON_PATHS = ICON_PATHS;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.iconPreloader = new IconPreloader();
        window.iconPreloader.initialize();
    });
} else {
    window.iconPreloader = new IconPreloader();
    window.iconPreloader.initialize();
}