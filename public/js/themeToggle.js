/**
 * ThemeToggle - Elegant theme switcher component with Apple-inspired design
 * Provides visual indicators for current theme state and smooth toggle animations
 */
class ThemeToggle {
    constructor(containerId, themeController) {
        this.container = document.getElementById(containerId);
        this.themeController = themeController;
        this.isInitialized = false;
        
        // Animation settings
        this.animationDuration = 300;
        this.debounceDelay = 150;
        this.debounceTimer = null;
        
        this.init();
    }
    
    /**
     * Initialize the theme toggle component
     */
    init() {
        if (!this.container || !this.themeController) {
            console.warn('ThemeToggle: Missing required container or theme controller');
            return;
        }
        
        this.createToggleInterface();
        this.attachEventListeners();
        this.updateVisualState();
        this.isInitialized = true;
        
        // Listen for theme changes from other sources
        document.addEventListener('themechange', (e) => {
            this.updateVisualState();
        });
    }
    
    /**
     * Create the elegant theme toggle interface
     */
    createToggleInterface() {
        const toggleHTML = `
            <div class="theme-toggle-wrapper" role="group" aria-label="Theme selection">
                <button class="theme-toggle-button" 
                        id="themeToggleBtn" 
                        aria-label="Toggle between light and dark theme"
                        aria-pressed="false"
                        title="Switch theme">
                    <div class="theme-toggle-track">
                        <div class="theme-toggle-thumb">
                            <div class="theme-icon light-icon">☀️</div>
                            <div class="theme-icon dark-icon">🌙</div>
                        </div>
                    </div>
                    <span class="theme-toggle-label" id="themeToggleLabel">Light</span>
                </button>
                
                <div class="theme-options-dropdown" id="themeOptionsDropdown" role="menu" aria-hidden="true">
                    <button class="theme-option" data-theme="light" role="menuitem" aria-label="Switch to light theme">
                        <span class="theme-option-icon">☀️</span>
                        <span class="theme-option-text">Light</span>
                        <span class="theme-option-check">✓</span>
                    </button>
                    <button class="theme-option" data-theme="dark" role="menuitem" aria-label="Switch to dark theme">
                        <span class="theme-option-icon">🌙</span>
                        <span class="theme-option-text">Dark</span>
                        <span class="theme-option-check">✓</span>
                    </button>
                    <button class="theme-option" data-theme="auto" role="menuitem" aria-label="Use system theme preference">
                        <span class="theme-option-icon">🔄</span>
                        <span class="theme-option-text">Auto</span>
                        <span class="theme-option-check">✓</span>
                    </button>
                </div>
            </div>
        `;
        
        this.container.innerHTML = toggleHTML;
        this.addToggleStyles();
    }
    
    /**
     * Add CSS styles for the theme toggle component
     */
    addToggleStyles() {
        if (document.getElementById('theme-toggle-styles')) {
            return; // Styles already added
        }
        
        const style = document.createElement('style');
        style.id = 'theme-toggle-styles';
        style.textContent = `
            .theme-toggle-wrapper {
                position: relative;
                display: inline-block;
            }
            
            .theme-toggle-button {
                display: flex;
                align-items: center;
                gap: 12px;
                background: rgba(255, 255, 255, 0.8);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid #E5E7EB;
                border-radius: 12px;
                padding: 12px 16px;
                cursor: pointer;
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                font-weight: 500;
                color: #1F2937;
                outline: none;
                position: relative;
                overflow: hidden;
                min-width: 110px;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
            }
            
            .theme-toggle-button:hover {
                background: rgba(248, 248, 248, 0.9);
                border-color: #D1D5DB;
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08), 0 0 20px rgba(0, 0, 0, 0.02);
            }
            
            .theme-toggle-button:focus-visible {
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1), 0 4px 12px rgba(0, 0, 0, 0.08);
            }
            
            .theme-toggle-button:active {
                transform: translateY(0);
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
            }
            
            .theme-toggle-track {
                position: relative;
                width: 44px;
                height: 24px;
                background: #F3F4F6;
                border-radius: 12px;
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                overflow: hidden;
            }
            
            .theme-toggle-thumb {
                position: absolute;
                top: 2px;
                left: 2px;
                width: 20px;
                height: 20px;
                background: #FFFFFF;
                border-radius: 10px;
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            
            .theme-icon {
                font-size: 12px;
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                position: absolute;
                opacity: 0;
                transform: scale(0.8);
            }
            
            .theme-icon.active {
                opacity: 1;
                transform: scale(1);
            }
            
            .theme-toggle-label {
                font-weight: 500;
                letter-spacing: -0.01em;
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            /* Dark theme state */
            .theme-toggle-button[data-theme="dark"] .theme-toggle-track {
                background: #374151;
            }
            
            .theme-toggle-button[data-theme="dark"] .theme-toggle-thumb {
                transform: translateX(20px);
                background: #1F2937;
            }
            
            .theme-toggle-button[data-theme="dark"] .dark-icon {
                opacity: 1;
                transform: scale(1);
            }
            
            .theme-toggle-button[data-theme="dark"] .light-icon {
                opacity: 0;
                transform: scale(0.8);
            }
            
            /* Light theme state */
            .theme-toggle-button[data-theme="light"] .theme-toggle-track {
                background: #FEF3C7;
            }
            
            .theme-toggle-button[data-theme="light"] .light-icon {
                opacity: 1;
                transform: scale(1);
            }
            
            .theme-toggle-button[data-theme="light"] .dark-icon {
                opacity: 0;
                transform: scale(0.8);
            }
            
            /* Auto theme state */
            .theme-toggle-button[data-theme="auto"] .theme-toggle-track {
                background: linear-gradient(90deg, #FEF3C7 0%, #374151 100%);
            }
            
            .theme-toggle-button[data-theme="auto"] .theme-toggle-thumb {
                transform: translateX(10px);
                background: linear-gradient(135deg, #FFFFFF 0%, #F3F4F6 100%);
            }
            
            /* Dropdown styles */
            .theme-options-dropdown {
                position: absolute;
                top: calc(100% + 8px);
                right: 0;
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid #E5E7EB;
                border-radius: 12px;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
                padding: 8px;
                min-width: 140px;
                z-index: 1000;
                opacity: 0;
                visibility: hidden;
                transform: translateY(-8px) scale(0.95);
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .theme-options-dropdown.show {
                opacity: 1;
                visibility: visible;
                transform: translateY(0) scale(1);
            }
            
            .theme-option {
                display: flex;
                align-items: center;
                gap: 12px;
                width: 100%;
                padding: 10px 12px;
                background: transparent;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-family: inherit;
                font-size: 14px;
                color: #1F2937;
                transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
                outline: none;
                position: relative;
            }
            
            .theme-option:hover {
                background: rgba(59, 130, 246, 0.08);
                color: #1F2937;
            }
            
            .theme-option:focus-visible {
                background: rgba(59, 130, 246, 0.1);
                box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
            }
            
            .theme-option-icon {
                font-size: 16px;
                width: 20px;
                text-align: center;
            }
            
            .theme-option-text {
                flex: 1;
                text-align: left;
                font-weight: 500;
            }
            
            .theme-option-check {
                font-size: 14px;
                color: #10B981;
                opacity: 0;
                transform: scale(0.8);
                transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .theme-option.active .theme-option-check {
                opacity: 1;
                transform: scale(1);
            }
            
            .theme-option.active {
                background: rgba(16, 185, 129, 0.08);
                color: #065F46;
            }
            
            /* Responsive design */
            @media (max-width: 768px) {
                .theme-toggle-button {
                    padding: 6px 12px;
                    font-size: 13px;
                    min-width: 90px;
                }
                
                .theme-toggle-track {
                    width: 40px;
                    height: 22px;
                }
                
                .theme-toggle-thumb {
                    width: 18px;
                    height: 18px;
                }
                
                .theme-toggle-button[data-theme="dark"] .theme-toggle-thumb {
                    transform: translateX(18px);
                }
                
                .theme-toggle-button[data-theme="auto"] .theme-toggle-thumb {
                    transform: translateX(9px);
                }
                
                .theme-options-dropdown {
                    min-width: 120px;
                }
            }
            
            /* Dark theme support for the toggle itself */
            [data-theme="dark"] .theme-toggle-button {
                background: rgba(31, 41, 55, 0.8);
                border-color: #4B5563;
                color: #F9FAFB;
            }
            
            [data-theme="dark"] .theme-toggle-button:hover {
                background: rgba(55, 65, 81, 0.9);
                border-color: #6B7280;
            }
            
            [data-theme="dark"] .theme-options-dropdown {
                background: rgba(31, 41, 55, 0.95);
                border-color: #4B5563;
            }
            
            [data-theme="dark"] .theme-option {
                color: #F9FAFB;
            }
            
            [data-theme="dark"] .theme-option:hover {
                background: rgba(59, 130, 246, 0.15);
                color: #F9FAFB;
            }
            
            [data-theme="dark"] .theme-option.active {
                background: rgba(16, 185, 129, 0.15);
                color: #34D399;
            }
            
            /* Intro animation for discoverability */
            @keyframes theme-toggle-intro {
                0%, 100% { 
                    transform: scale(1); 
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
                }
                25% { 
                    transform: scale(1.05); 
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
                }
                50% { 
                    transform: scale(1); 
                    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
                }
                75% { 
                    transform: scale(1.02); 
                    box-shadow: 0 3px 10px rgba(59, 130, 246, 0.12);
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * Attach event listeners for theme toggle functionality
     */
    attachEventListeners() {
        const toggleButton = document.getElementById('themeToggleBtn');
        const dropdown = document.getElementById('themeOptionsDropdown');
        const themeOptions = dropdown.querySelectorAll('.theme-option');
        
        // Toggle button click - show dropdown
        toggleButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });
        
        // Theme option selection
        themeOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const theme = option.dataset.theme;
                this.handleThemeChange(theme);
                this.hideDropdown();
            });
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) {
                this.hideDropdown();
            }
        });
        
        // Keyboard navigation
        toggleButton.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggleDropdown();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.showDropdown();
                this.focusFirstOption();
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                this.quickToggle();
            }
        });
        
        // Dropdown keyboard navigation
        dropdown.addEventListener('keydown', (e) => {
            this.handleDropdownKeyboard(e);
        });
        
        // Quick toggle with double-click
        toggleButton.addEventListener('dblclick', (e) => {
            e.preventDefault();
            this.quickToggle();
        });
        
        // Add discoverable help on first visit
        this.addDiscoverabilityFeatures();
    }
    
    /**
     * Handle theme change with debouncing
     */
    handleThemeChange(theme) {
        // Clear any pending theme change
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        // Debounce rapid theme changes
        this.debounceTimer = setTimeout(() => {
            this.themeController.setThemePreference(theme);
            this.updateVisualState();
            
            // Dispatch custom event for other components
            document.dispatchEvent(new CustomEvent('themetogglechange', {
                detail: { theme, source: 'toggle' }
            }));
        }, this.debounceDelay);
    }
    
    /**
     * Quick toggle between light and dark (skips auto)
     */
    quickToggle() {
        const currentTheme = this.themeController.getCurrentTheme();
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.handleThemeChange(newTheme);
    }
    
    /**
     * Update visual state based on current theme
     */
    updateVisualState() {
        if (!this.isInitialized) return;
        
        const toggleButton = document.getElementById('themeToggleBtn');
        const toggleLabel = document.getElementById('themeToggleLabel');
        const themeOptions = document.querySelectorAll('.theme-option');
        
        if (!toggleButton || !toggleLabel) return;
        
        const userPreference = this.themeController.getUserPreference();
        const currentTheme = this.themeController.getCurrentTheme();
        
        // Update button state
        toggleButton.setAttribute('data-theme', userPreference);
        toggleButton.setAttribute('aria-pressed', userPreference !== 'auto');
        
        // Update label text
        const labelText = this.getThemeLabelText(userPreference, currentTheme);
        toggleLabel.textContent = labelText;
        
        // Update button title
        const titleText = this.getThemeTitleText(userPreference, currentTheme);
        toggleButton.setAttribute('title', titleText);
        toggleButton.setAttribute('aria-label', titleText);
        
        // Update dropdown options
        themeOptions.forEach(option => {
            const isActive = option.dataset.theme === userPreference;
            option.classList.toggle('active', isActive);
            option.setAttribute('aria-selected', isActive);
        });
        
        // Add visual feedback animation
        this.addStateChangeAnimation();
    }
    
    /**
     * Get appropriate label text for current theme state
     */
    getThemeLabelText(userPreference, currentTheme) {
        switch (userPreference) {
            case 'light':
                return 'Light';
            case 'dark':
                return 'Dark';
            case 'auto':
                return `Auto (${currentTheme === 'light' ? 'Light' : 'Dark'})`;
            default:
                return 'Theme';
        }
    }
    
    /**
     * Get appropriate title text for current theme state
     */
    getThemeTitleText(userPreference, currentTheme) {
        switch (userPreference) {
            case 'light':
                return 'Switch to dark theme';
            case 'dark':
                return 'Switch to light theme';
            case 'auto':
                return `Auto theme (currently ${currentTheme}). Click to change theme preference`;
            default:
                return 'Switch theme';
        }
    }
    
    /**
     * Add subtle animation when theme state changes
     */
    addStateChangeAnimation() {
        const toggleButton = document.getElementById('themeToggleBtn');
        if (!toggleButton) return;
        
        // Add a subtle pulse animation
        toggleButton.style.transform = 'scale(0.95)';
        toggleButton.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.3)';
        
        setTimeout(() => {
            toggleButton.style.transform = '';
            toggleButton.style.boxShadow = '';
        }, 200);
        
        // Add a brief highlight to indicate the change
        const track = toggleButton.querySelector('.theme-toggle-track');
        if (track) {
            track.style.boxShadow = 'inset 0 0 10px rgba(59, 130, 246, 0.2)';
            setTimeout(() => {
                track.style.boxShadow = '';
            }, 300);
        }
    }
    
    /**
     * Toggle dropdown visibility
     */
    toggleDropdown() {
        const dropdown = document.getElementById('themeOptionsDropdown');
        const isVisible = dropdown.classList.contains('show');
        
        if (isVisible) {
            this.hideDropdown();
        } else {
            this.showDropdown();
        }
    }
    
    /**
     * Show dropdown menu
     */
    showDropdown() {
        const dropdown = document.getElementById('themeOptionsDropdown');
        dropdown.classList.add('show');
        dropdown.setAttribute('aria-hidden', 'false');
        
        // Focus management
        setTimeout(() => {
            const activeOption = dropdown.querySelector('.theme-option.active');
            if (activeOption) {
                activeOption.focus();
            }
        }, 100);
    }
    
    /**
     * Hide dropdown menu
     */
    hideDropdown() {
        const dropdown = document.getElementById('themeOptionsDropdown');
        dropdown.classList.remove('show');
        dropdown.setAttribute('aria-hidden', 'true');
    }
    
    /**
     * Focus first option in dropdown
     */
    focusFirstOption() {
        const dropdown = document.getElementById('themeOptionsDropdown');
        const firstOption = dropdown.querySelector('.theme-option');
        if (firstOption) {
            firstOption.focus();
        }
    }
    
    /**
     * Handle keyboard navigation in dropdown
     */
    handleDropdownKeyboard(e) {
        const dropdown = document.getElementById('themeOptionsDropdown');
        const options = Array.from(dropdown.querySelectorAll('.theme-option'));
        const currentIndex = options.indexOf(document.activeElement);
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                const nextIndex = (currentIndex + 1) % options.length;
                options[nextIndex].focus();
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                const prevIndex = currentIndex === 0 ? options.length - 1 : currentIndex - 1;
                options[prevIndex].focus();
                break;
                
            case 'Enter':
            case ' ':
                e.preventDefault();
                if (document.activeElement.classList.contains('theme-option')) {
                    document.activeElement.click();
                }
                break;
                
            case 'Escape':
                e.preventDefault();
                this.hideDropdown();
                document.getElementById('themeToggleBtn').focus();
                break;
                
            case 'Tab':
                this.hideDropdown();
                break;
        }
    }
    
    /**
     * Get current theme toggle state
     */
    getState() {
        return {
            userPreference: this.themeController.getUserPreference(),
            currentTheme: this.themeController.getCurrentTheme(),
            isAutoEnabled: this.themeController.isAutoSwitchEnabled(),
            isInitialized: this.isInitialized
        };
    }
    
    /**
     * Add features to make theme controls more discoverable
     */
    addDiscoverabilityFeatures() {
        // Check if user has interacted with theme toggle before
        const hasUsedThemeToggle = localStorage.getItem('theme-toggle-used');
        
        if (!hasUsedThemeToggle) {
            // Add a subtle pulse animation on first load
            setTimeout(() => {
                const toggleButton = document.getElementById('themeToggleBtn');
                if (toggleButton) {
                    toggleButton.style.animation = 'theme-toggle-intro 2s ease-in-out';
                    
                    // Remove animation after it completes
                    setTimeout(() => {
                        toggleButton.style.animation = '';
                    }, 2000);
                }
            }, 1000);
        }
        
        // Mark as used when user interacts
        const toggleButton = document.getElementById('themeToggleBtn');
        if (toggleButton) {
            const markAsUsed = () => {
                localStorage.setItem('theme-toggle-used', 'true');
                toggleButton.removeEventListener('click', markAsUsed);
            };
            toggleButton.addEventListener('click', markAsUsed);
        }
    }

    /**
     * Clean up event listeners and DOM elements
     */
    destroy() {
        // Remove event listeners
        const toggleButton = document.getElementById('themeToggleBtn');
        if (toggleButton) {
            toggleButton.replaceWith(toggleButton.cloneNode(true));
        }
        
        // Remove styles
        const styles = document.getElementById('theme-toggle-styles');
        if (styles) {
            styles.remove();
        }
        
        // Clear timers
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        this.isInitialized = false;
    }
}

// Export for module systems or make globally available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeToggle;
} else {
    window.ThemeToggle = ThemeToggle;
}