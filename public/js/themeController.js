/**
 * ThemeController - Manages automatic theme detection and switching
 * Handles system preference detection, theme persistence, and smooth transitions
 */
class ThemeController {
    constructor() {
        this.themes = {
            LIGHT: 'light',
            DARK: 'dark',
            AUTO: 'auto'
        };
        
        this.currentTheme = null;
        this.userPreference = null;
        this.mediaQueryListener = null;
        this.transitionDuration = 300; // milliseconds
        
        // Storage keys
        this.STORAGE_KEY = 'theme-preference';
        this.THEME_ATTRIBUTE = 'data-theme';
        
        // Error handling and fallback state
        this.hasJavaScript = true;
        this.storageAvailable = this.checkStorageAvailability();
        this.fallbackTheme = this.themes.LIGHT;
        this.errorCount = 0;
        this.maxErrors = 5;
        
        // Initialize with error handling
        try {
            this.init();
        } catch (error) {
            console.error('ThemeController initialization failed:', error);
            this.initializeFallback();
        }
    }
    
    /**
     * Initialize the theme controller
     */
    init() {
        this.loadUserPreference();
        this.createSmoothTransition();
        this.handleSystemPreferenceChange();
        this.applyInitialTheme();
        this.validateAndRepair();
    }
    
    /**
     * Detect system color scheme preference
     * @returns {string} 'light' or 'dark'
     */
    detectSystemPreference() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return this.themes.DARK;
        }
        return this.themes.LIGHT;
    }
    
    /**
     * Set up media query listener for system preference changes
     */
    setupMediaQueryListener() {
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            
            // Create listener function
            this.mediaQueryListener = (e) => {
                if (this.userPreference === this.themes.AUTO) {
                    const newTheme = e.matches ? this.themes.DARK : this.themes.LIGHT;
                    this.applyTheme(newTheme, true);
                }
            };
            
            // Add listener for real-time changes
            if (mediaQuery.addListener) {
                mediaQuery.addListener(this.mediaQueryListener);
            } else if (mediaQuery.addEventListener) {
                mediaQuery.addEventListener('change', this.mediaQueryListener);
            }
        }
    }
    
    /**
     * Check if localStorage is available and functional
     * @returns {boolean} True if storage is available
     */
    checkStorageAvailability() {
        try {
            const testKey = '__theme_storage_test__';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            return true;
        } catch (error) {
            console.warn('localStorage not available, using fallback storage:', error);
            return false;
        }
    }
    
    /**
     * Initialize fallback mode when main initialization fails
     */
    initializeFallback() {
        console.warn('Initializing theme controller in fallback mode');
        this.userPreference = this.fallbackTheme;
        this.currentTheme = this.fallbackTheme;
        this.applyTheme(this.fallbackTheme, false);
        this.addNoJSFallback();
    }
    
    /**
     * Add CSS fallback for when JavaScript is disabled or fails
     */
    addNoJSFallback() {
        // Add fallback styles that work without JavaScript
        if (!document.getElementById('theme-fallback-styles')) {
            const style = document.createElement('style');
            style.id = 'theme-fallback-styles';
            style.textContent = `
                /* Fallback styles when JavaScript fails */
                html:not([data-theme]) {
                    /* Default to light theme */
                    background-color: #FFFFFF;
                    color: #6B7280;
                }
                
                html:not([data-theme]) body {
                    background-color: #FFFFFF;
                    color: #6B7280;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                
                /* Respect system preference when possible */
                @media (prefers-color-scheme: dark) {
                    html:not([data-theme]) {
                        background-color: #1a1a1a;
                        color: #e5e5e5;
                    }
                    
                    html:not([data-theme]) body {
                        background-color: #1a1a1a;
                        color: #e5e5e5;
                    }
                }
                
                /* Ensure readability in all cases */
                html:not([data-theme]) * {
                    border-color: currentColor;
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    /**
     * Load user theme preference with comprehensive error handling
     */
    loadUserPreference() {
        try {
            if (this.storageAvailable) {
                const stored = localStorage.getItem(this.STORAGE_KEY);
                if (stored && Object.values(this.themes).includes(stored)) {
                    this.userPreference = stored;
                } else {
                    this.userPreference = this.themes.AUTO;
                }
            } else {
                // Use fallback storage (session storage or memory)
                this.userPreference = this.loadFallbackPreference();
            }
        } catch (error) {
            console.warn('Failed to load theme preference:', error);
            this.handleError('loadUserPreference', error);
            this.userPreference = this.themes.AUTO;
        }
    }
    
    /**
     * Load preference from fallback storage methods
     * @returns {string} Theme preference
     */
    loadFallbackPreference() {
        try {
            // Try sessionStorage first
            const sessionStored = sessionStorage.getItem(this.STORAGE_KEY);
            if (sessionStored && Object.values(this.themes).includes(sessionStored)) {
                return sessionStored;
            }
        } catch (error) {
            console.warn('SessionStorage also unavailable:', error);
        }
        
        // Try reading from meta tag or data attribute
        const metaTheme = document.querySelector('meta[name="theme-preference"]');
        if (metaTheme && Object.values(this.themes).includes(metaTheme.content)) {
            return metaTheme.content;
        }
        
        // Final fallback to auto
        return this.themes.AUTO;
    }
    
    /**
     * Save user theme preference with fallback storage methods
     * @param {string} theme - Theme preference to save
     */
    saveUserPreference(theme) {
        try {
            if (this.storageAvailable) {
                localStorage.setItem(this.STORAGE_KEY, theme);
                this.userPreference = theme;
            } else {
                this.saveFallbackPreference(theme);
            }
        } catch (error) {
            console.warn('Failed to save theme preference:', error);
            this.handleError('saveUserPreference', error);
            this.saveFallbackPreference(theme);
        }
    }
    
    /**
     * Save preference using fallback storage methods
     * @param {string} theme - Theme preference to save
     */
    saveFallbackPreference(theme) {
        try {
            // Try sessionStorage first
            sessionStorage.setItem(this.STORAGE_KEY, theme);
            this.userPreference = theme;
        } catch (error) {
            console.warn('SessionStorage save failed, using memory storage:', error);
            // Keep in memory only
            this.userPreference = theme;
            
            // Try to save to meta tag for persistence across page loads
            this.saveToMetaTag(theme);
        }
    }
    
    /**
     * Save theme preference to meta tag as fallback
     * @param {string} theme - Theme preference to save
     */
    saveToMetaTag(theme) {
        try {
            let metaTheme = document.querySelector('meta[name="theme-preference"]');
            if (!metaTheme) {
                metaTheme = document.createElement('meta');
                metaTheme.name = 'theme-preference';
                document.head.appendChild(metaTheme);
            }
            metaTheme.content = theme;
        } catch (error) {
            console.warn('Failed to save to meta tag:', error);
        }
    }
    
    /**
     * Handle errors with recovery mechanisms
     * @param {string} operation - Operation that failed
     * @param {Error} error - Error object
     */
    handleError(operation, error) {
        this.errorCount++;
        console.error(`ThemeController error in ${operation}:`, error);
        
        if (this.errorCount >= this.maxErrors) {
            console.error('Too many theme controller errors, switching to safe mode');
            this.enterSafeMode();
        }
    }
    
    /**
     * Enter safe mode with minimal functionality
     */
    enterSafeMode() {
        try {
            // Disable all advanced features
            this.disableTransitions();
            this.cleanupListeners();
            
            // Apply basic theme without animations
            this.currentTheme = this.fallbackTheme;
            document.documentElement.setAttribute(this.THEME_ATTRIBUTE, this.fallbackTheme);
            
            console.warn('Theme controller in safe mode - limited functionality');
        } catch (error) {
            console.error('Failed to enter safe mode:', error);
        }
    }
    
    /**
     * Disable transitions for performance/error recovery
     */
    disableTransitions() {
        try {
            const style = document.createElement('style');
            style.id = 'theme-safe-mode-styles';
            style.textContent = `
                * {
                    transition: none !important;
                    animation: none !important;
                }
            `;
            document.head.appendChild(style);
        } catch (error) {
            console.warn('Failed to disable transitions:', error);
        }
    }
    
    /**
     * Clean up event listeners to prevent memory leaks
     */
    cleanupListeners() {
        try {
            if (this.mediaQueryListener && window.matchMedia) {
                const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
                
                if (mediaQuery.removeListener) {
                    mediaQuery.removeListener(this.mediaQueryListener);
                } else if (mediaQuery.removeEventListener) {
                    mediaQuery.removeEventListener('change', this.mediaQueryListener);
                }
            }
            this.mediaQueryListener = null;
        } catch (error) {
            console.warn('Failed to cleanup listeners:', error);
        }
    }
    
    /**
     * Apply initial theme based on user preference
     */
    applyInitialTheme() {
        let themeToApply;
        
        if (this.userPreference === this.themes.AUTO) {
            themeToApply = this.detectSystemPreference();
        } else {
            themeToApply = this.userPreference;
        }
        
        this.applyTheme(themeToApply, false);
    }
    
    /**
     * Apply a theme to the document with optimized performance
     * @param {string} theme - Theme to apply ('light' or 'dark')
     * @param {boolean} animate - Whether to animate the transition
     */
    applyTheme(theme, animate = true) {
        if (!Object.values(this.themes).includes(theme) || theme === this.themes.AUTO) {
            console.warn('Invalid theme:', theme);
            return;
        }
        
        const previousTheme = this.currentTheme;
        this.currentTheme = theme;
        
        // Skip if theme hasn't actually changed
        if (previousTheme === theme) {
            return;
        }
        
        // Use requestAnimationFrame for smooth transitions
        if (animate && previousTheme) {
            requestAnimationFrame(() => {
                document.documentElement.classList.add('theme-transitioning');
                document.documentElement.setAttribute(this.THEME_ATTRIBUTE, theme);
                
                // Use requestAnimationFrame for cleanup to ensure smooth animation
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        document.documentElement.classList.remove('theme-transitioning');
                    }, this.transitionDuration);
                });
            });
        } else {
            // Apply immediately without animation
            document.documentElement.setAttribute(this.THEME_ATTRIBUTE, theme);
        }
        
        // Dispatch custom event for other components to listen to
        this.dispatchThemeChangeEvent(theme, previousTheme);
    }
    
    /**
     * Dispatch custom theme change event
     * @param {string} newTheme - New theme applied
     * @param {string} previousTheme - Previous theme
     */
    dispatchThemeChangeEvent(newTheme, previousTheme) {
        const event = new CustomEvent('themechange', {
            detail: {
                theme: newTheme,
                previousTheme: previousTheme,
                userPreference: this.userPreference
            }
        });
        
        document.dispatchEvent(event);
    }
    
    /**
     * Get current active theme
     * @returns {string} Current theme ('light' or 'dark')
     */
    getCurrentTheme() {
        return this.currentTheme;
    }
    
    /**
     * Get user preference setting
     * @returns {string} User preference ('light', 'dark', or 'auto')
     */
    getUserPreference() {
        return this.userPreference;
    }
    
    /**
     * Check if auto theme switching is enabled
     * @returns {boolean} True if auto switching is enabled
     */
    isAutoSwitchEnabled() {
        return this.userPreference === this.themes.AUTO;
    }
    
    /**
     * Enable automatic theme switching based on system preferences
     */
    enableAutoSwitch() {
        this.saveUserPreference(this.themes.AUTO);
        const systemTheme = this.detectSystemPreference();
        this.applyTheme(systemTheme, true);
    }
    
    /**
     * Disable automatic theme switching
     * Keeps current theme as manual preference
     */
    disableAutoSwitch() {
        const currentTheme = this.getCurrentTheme();
        this.saveUserPreference(currentTheme);
    }
    
    /**
     * Manually set theme preference (override automatic detection)
     * @param {string} theme - Theme to set ('light', 'dark', or 'auto')
     */
    setThemePreference(theme) {
        if (!Object.values(this.themes).includes(theme)) {
            console.warn('Invalid theme preference:', theme);
            return;
        }
        
        this.saveUserPreference(theme);
        
        if (theme === this.themes.AUTO) {
            // Switch to system preference
            const systemTheme = this.detectSystemPreference();
            this.applyTheme(systemTheme, true);
        } else {
            // Apply specific theme
            this.applyTheme(theme, true);
        }
    }
    
    /**
     * Toggle between light and dark themes
     * Disables auto-switching when used
     */
    toggleTheme() {
        const currentTheme = this.getCurrentTheme();
        const newTheme = currentTheme === this.themes.LIGHT ? this.themes.DARK : this.themes.LIGHT;
        
        this.setThemePreference(newTheme);
    }
    
    /**
     * Create optimized smooth transition system for theme changes
     * Uses performance-optimized CSS transitions
     */
    createSmoothTransition() {
        // Add transition styles to document if not already present
        if (!document.getElementById('theme-transition-styles')) {
            const style = document.createElement('style');
            style.id = 'theme-transition-styles';
            style.textContent = `
                .theme-transitioning {
                    /* Only transition essential properties for performance */
                    transition: background-color ${this.transitionDuration}ms cubic-bezier(0.4, 0, 0.2, 1),
                                color ${this.transitionDuration}ms cubic-bezier(0.4, 0, 0.2, 1) !important;
                }
                
                .theme-transitioning *:not(img):not(video):not(iframe):not(canvas):not(svg) {
                    transition: background-color ${this.transitionDuration}ms cubic-bezier(0.4, 0, 0.2, 1),
                                color ${this.transitionDuration}ms cubic-bezier(0.4, 0, 0.2, 1),
                                border-color ${this.transitionDuration}ms cubic-bezier(0.4, 0, 0.2, 1) !important;
                }
                
                /* Exclude media elements and performance-heavy elements */
                .theme-transitioning img,
                .theme-transitioning video,
                .theme-transitioning iframe,
                .theme-transitioning canvas,
                .theme-transitioning svg,
                .theme-transitioning [class*="glass-"],
                .theme-transitioning [style*="backdrop-filter"] {
                    transition: none !important;
                }
                
                /* Optimize for GPU acceleration during transitions */
                .theme-transitioning {
                    will-change: background-color, color;
                    transform: translateZ(0);
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    /**
     * Handle real-time system preference changes
     * Enhanced version with better error handling and performance
     */
    handleSystemPreferenceChange() {
        if (!window.matchMedia) {
            console.warn('matchMedia not supported, automatic theme switching disabled');
            return;
        }
        
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        // Enhanced listener with debouncing to prevent rapid changes
        let debounceTimer = null;
        this.mediaQueryListener = (e) => {
            // Clear previous timer
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
            
            // Debounce rapid changes
            debounceTimer = setTimeout(() => {
                if (this.userPreference === this.themes.AUTO) {
                    const newTheme = e.matches ? this.themes.DARK : this.themes.LIGHT;
                    
                    // Only apply if theme actually changed
                    if (newTheme !== this.currentTheme) {
                        this.applyTheme(newTheme, true);
                    }
                }
            }, 100); // 100ms debounce
        };
        
        // Add listener with proper fallbacks
        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', this.mediaQueryListener);
        } else if (mediaQuery.addListener) {
            mediaQuery.addListener(this.mediaQueryListener);
        }
    }
    
    /**
     * Efficiently update CSS variables for theme changes
     * @param {string} theme - Theme to apply variables for
     */
    updateCSSVariables(theme) {
        const root = document.documentElement;
        
        // Batch CSS variable updates for better performance
        requestAnimationFrame(() => {
            if (theme === this.themes.LIGHT) {
                // Light theme variables are already defined in CSS
                root.style.removeProperty('--bg-primary-override');
                root.style.removeProperty('--text-primary-override');
            } else if (theme === this.themes.DARK) {
                // Override with dark theme values if needed
                // This allows for runtime theme switching without loading separate CSS
                root.style.setProperty('--bg-primary-override', '#1a1a1a');
                root.style.setProperty('--text-primary-override', '#ffffff');
            }
        });
    }
    
    /**
     * Get theme status information
     * @returns {Object} Current theme status and preferences
     */
    getThemeStatus() {
        return {
            currentTheme: this.currentTheme,
            userPreference: this.userPreference,
            systemPreference: this.detectSystemPreference(),
            isAutoEnabled: this.isAutoSwitchEnabled(),
            supportsAutoDetection: !!window.matchMedia,
            performanceMode: this.getPerformanceMode()
        };
    }
    
    /**
     * Get current performance mode based on device capabilities
     * @returns {string} Performance mode ('high', 'medium', 'low')
     */
    getPerformanceMode() {
        // Detect device capabilities for performance optimization
        const hasReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const isLowEndDevice = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;
        const hasSlowConnection = navigator.connection && navigator.connection.effectiveType === 'slow-2g';
        
        if (hasReducedMotion || isLowEndDevice || hasSlowConnection) {
            return 'low';
        } else if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) {
            return 'medium';
        }
        return 'high';
    }
    
    /**
     * Validate theme configuration and repair corrupted preferences
     */
    validateAndRepair() {
        try {
            // Check if current theme is valid
            if (!this.currentTheme || !Object.values(this.themes).includes(this.currentTheme)) {
                console.warn('Invalid current theme detected, applying fallback');
                this.recoverFromCorruptedState();
            }
            
            // Check if user preference is valid
            if (!this.userPreference || !Object.values(this.themes).includes(this.userPreference)) {
                console.warn('Invalid user preference detected, attempting recovery');
                this.recoverUserPreference();
            }
            
            // Validate storage integrity
            this.validateStorageIntegrity();
            
            // Ensure media query listener is active if auto mode is enabled
            if (this.userPreference === this.themes.AUTO && !this.mediaQueryListener) {
                this.handleSystemPreferenceChange();
            }
        } catch (error) {
            console.error('Validation and repair failed:', error);
            this.handleError('validateAndRepair', error);
        }
    }
    
    /**
     * Recover from corrupted theme state
     */
    recoverFromCorruptedState() {
        try {
            // Try to detect system preference as fallback
            const systemTheme = this.detectSystemPreference();
            this.currentTheme = systemTheme;
            this.userPreference = this.themes.AUTO;
            
            // Apply the recovered theme
            this.applyTheme(systemTheme, false);
            
            // Save the recovered preference
            this.saveUserPreference(this.themes.AUTO);
            
            console.info('Theme state recovered successfully');
        } catch (error) {
            console.error('Failed to recover from corrupted state:', error);
            this.initializeFallback();
        }
    }
    
    /**
     * Recover corrupted user preference
     */
    recoverUserPreference() {
        try {
            // Try multiple recovery methods
            const recoveredPreference = this.attemptPreferenceRecovery();
            
            if (recoveredPreference) {
                this.userPreference = recoveredPreference;
                this.saveUserPreference(recoveredPreference);
                console.info('User preference recovered:', recoveredPreference);
            } else {
                // Final fallback
                this.userPreference = this.themes.AUTO;
                this.saveUserPreference(this.themes.AUTO);
                console.warn('Could not recover preference, reset to auto');
            }
        } catch (error) {
            console.error('Preference recovery failed:', error);
            this.userPreference = this.themes.AUTO;
        }
    }
    
    /**
     * Attempt to recover user preference from various sources
     * @returns {string|null} Recovered preference or null
     */
    attemptPreferenceRecovery() {
        const recoverySources = [
            // Try backup storage keys
            () => this.storageAvailable ? localStorage.getItem(this.STORAGE_KEY + '_backup') : null,
            () => sessionStorage.getItem(this.STORAGE_KEY),
            () => sessionStorage.getItem(this.STORAGE_KEY + '_backup'),
            
            // Try meta tag
            () => {
                const meta = document.querySelector('meta[name="theme-preference"]');
                return meta ? meta.content : null;
            },
            
            // Try data attribute on html element
            () => document.documentElement.getAttribute('data-theme-preference'),
            
            // Try URL parameter (for debugging/testing)
            () => {
                const params = new URLSearchParams(window.location.search);
                return params.get('theme');
            }
        ];
        
        for (const source of recoverySources) {
            try {
                const preference = source();
                if (preference && Object.values(this.themes).includes(preference)) {
                    return preference;
                }
            } catch (error) {
                // Continue to next source
                continue;
            }
        }
        
        return null;
    }
    
    /**
     * Validate storage integrity and create backups
     */
    validateStorageIntegrity() {
        try {
            if (this.storageAvailable && this.userPreference) {
                // Create backup of current preference
                localStorage.setItem(this.STORAGE_KEY + '_backup', this.userPreference);
                
                // Verify storage is working correctly
                const testWrite = 'test_' + Date.now();
                localStorage.setItem('__theme_test__', testWrite);
                const testRead = localStorage.getItem('__theme_test__');
                
                if (testRead !== testWrite) {
                    console.warn('Storage integrity check failed');
                    this.storageAvailable = false;
                } else {
                    localStorage.removeItem('__theme_test__');
                }
            }
        } catch (error) {
            console.warn('Storage integrity validation failed:', error);
            this.storageAvailable = false;
        }
    }
    
    /**
     * Clean up event listeners
     */
    destroy() {
        if (this.mediaQueryListener && window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            
            if (mediaQuery.removeListener) {
                mediaQuery.removeListener(this.mediaQueryListener);
            } else if (mediaQuery.removeEventListener) {
                mediaQuery.removeEventListener('change', this.mediaQueryListener);
            }
        }
        
        // Remove transition styles
        const transitionStyles = document.getElementById('theme-transition-styles');
        if (transitionStyles) {
            transitionStyles.remove();
        }
    }
}

// Export for module systems or make globally available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeController;
} else {
    window.ThemeController = ThemeController;
}