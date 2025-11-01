/**
 * Theme Initialization Script
 * Automatically initializes the theme controller when the page loads
 */

// Global theme controller instance
let themeController = null;

/**
 * Initialize theme controller
 */
function initializeThemeController() {
    if (typeof ThemeController !== 'undefined') {
        themeController = new ThemeController();
        
        // Make controller globally accessible for debugging and manual control
        window.themeController = themeController;
        
        // Add convenience methods to window for easy access
        window.setTheme = (theme) => themeController.setThemePreference(theme);
        window.toggleTheme = () => themeController.toggleTheme();
        window.getThemeStatus = () => themeController.getThemeStatus();
        
        console.log('Theme controller initialized:', themeController.getThemeStatus());
    } else {
        console.error('ThemeController class not found. Make sure themeController.js is loaded first.');
    }
}

/**
 * Initialize when DOM is ready
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeThemeController);
} else {
    // DOM is already ready
    initializeThemeController();
}

/**
 * Handle page visibility changes to refresh theme if needed
 * Useful for when system preferences change while page is hidden
 */
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && themeController && themeController.isAutoSwitchEnabled()) {
        // Validate current theme matches system preference
        const systemPreference = themeController.detectSystemPreference();
        const currentTheme = themeController.getCurrentTheme();
        
        if (systemPreference !== currentTheme) {
            themeController.applyTheme(systemPreference, true);
        }
    }
});

/**
 * Listen for theme change events and log them (for debugging)
 */
document.addEventListener('themechange', (event) => {
    console.log('Theme changed:', event.detail);
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initializeThemeController, themeController };
}