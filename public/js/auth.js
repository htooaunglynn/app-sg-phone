/**
 * Authentication utility functions for frontend
 * Handles authentication status checking and redirects
 */

class AuthManager {
    constructor() {
        this.isAuthenticated = false;
        this.user = null;
        this.checkInterval = null;
        this.checkIntervalMs = 5 * 60 * 1000; // Check every 5 minutes
    }

    /**
     * Initialize authentication manager
     */
    async init() {
        try {
            // Check initial authentication status
            await this.checkAuthStatus();
            
            // Start periodic authentication checks
            this.startPeriodicCheck();
            
            // Handle page visibility changes
            this.handleVisibilityChange();
            
            console.log('AuthManager initialized');
        } catch (error) {
            console.error('Failed to initialize AuthManager:', error);
            this.handleAuthError(error);
        }
    }

    /**
     * Check current authentication status
     */
    async checkAuthStatus() {
        try {
            const response = await fetch('/api/auth/status', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.isAuthenticated = data.isAuthenticated || false;
                this.user = data.user || null;
                
                console.log('Authentication status:', {
                    isAuthenticated: this.isAuthenticated,
                    user: this.user?.id || 'anonymous'
                });

                // If not authenticated and on a protected page, redirect to login
                if (!this.isAuthenticated && this.isProtectedPage()) {
                    this.redirectToLogin();
                    return false;
                }

                return this.isAuthenticated;
            } else if (response.status === 401) {
                // Unauthorized - redirect to login
                this.isAuthenticated = false;
                this.user = null;
                
                if (this.isProtectedPage()) {
                    this.redirectToLogin();
                }
                return false;
            } else {
                throw new Error(`Auth status check failed: ${response.status}`);
            }
        } catch (error) {
            console.error('Auth status check error:', error);
            this.handleAuthError(error);
            return false;
        }
    }

    /**
     * Check if current page is protected
     */
    isProtectedPage() {
        const path = window.location.pathname;
        const protectedPaths = ['/', '/profile', '/file-manager', '/monitoring'];
        
        // Check if current path is in protected paths
        return protectedPaths.includes(path) || path.startsWith('/api/');
    }

    /**
     * Redirect to login page with current page as redirect parameter
     */
    redirectToLogin() {
        const currentUrl = window.location.pathname + window.location.search;
        const loginUrl = `/login?redirect=${encodeURIComponent(currentUrl)}`;
        
        console.log('Redirecting to login:', loginUrl);
        window.location.href = loginUrl;
    }

    /**
     * Handle authentication errors
     */
    handleAuthError(error) {
        console.error('Authentication error:', error);
        
        // Show user-friendly error message
        this.showAuthError('Authentication check failed. Please refresh the page or login again.');
        
        // If on a protected page, redirect to login after a delay
        if (this.isProtectedPage()) {
            setTimeout(() => {
                this.redirectToLogin();
            }, 3000);
        }
    }

    /**
     * Show authentication error message to user
     */
    showAuthError(message) {
        // Try to show error in existing status elements
        const statusElements = [
            document.getElementById('checkTableStatus'),
            document.getElementById('modalUploadStatus'),
            document.getElementById('modalExportStatus')
        ];

        for (const element of statusElements) {
            if (element) {
                element.textContent = message;
                element.className = 'status error';
                element.style.display = 'block';
                break;
            }
        }

        // Fallback: create a temporary error message
        if (!statusElements.some(el => el)) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'auth-error-message';
            errorDiv.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #f8d7da;
                color: #721c24;
                padding: 12px 16px;
                border: 1px solid #f5c6cb;
                border-radius: 4px;
                z-index: 10000;
                max-width: 300px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            `;
            errorDiv.textContent = message;
            document.body.appendChild(errorDiv);

            // Remove after 5 seconds
            setTimeout(() => {
                if (errorDiv.parentNode) {
                    errorDiv.parentNode.removeChild(errorDiv);
                }
            }, 5000);
        }
    }

    /**
     * Start periodic authentication checks
     */
    startPeriodicCheck() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }

        this.checkInterval = setInterval(async () => {
            try {
                await this.checkAuthStatus();
            } catch (error) {
                console.error('Periodic auth check failed:', error);
            }
        }, this.checkIntervalMs);
    }

    /**
     * Stop periodic authentication checks
     */
    stopPeriodicCheck() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    /**
     * Handle page visibility changes
     */
    handleVisibilityChange() {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                // Page became visible, check auth status
                this.checkAuthStatus();
            }
        });
    }

    /**
     * Logout user
     */
    async logout() {
        try {
            const response = await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (response.ok) {
                this.isAuthenticated = false;
                this.user = null;
                this.stopPeriodicCheck();
                
                // Redirect to login page
                window.location.href = '/login?message=logged_out';
            } else {
                throw new Error(`Logout failed: ${response.status}`);
            }
        } catch (error) {
            console.error('Logout error:', error);
            // Force redirect to login even if logout request failed
            window.location.href = '/login?error=logout_failed';
        }
    }

    /**
     * Get current user information
     */
    getCurrentUser() {
        return this.user;
    }

    /**
     * Check if user is authenticated
     */
    isUserAuthenticated() {
        return this.isAuthenticated;
    }

    /**
     * Add authentication headers to fetch requests
     */
    addAuthHeaders(headers = {}) {
        return {
            ...headers,
            'X-Requested-With': 'XMLHttpRequest'
        };
    }

    /**
     * Enhanced fetch wrapper with authentication handling
     */
    async authenticatedFetch(url, options = {}) {
        const defaultOptions = {
            credentials: 'include',
            headers: this.addAuthHeaders(options.headers)
        };

        const mergedOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, mergedOptions);

            // Handle authentication errors
            if (response.status === 401) {
                console.log('Request failed with 401, checking auth status');
                await this.checkAuthStatus();
                throw new Error('Authentication required');
            }

            return response;
        } catch (error) {
            if (error.message === 'Authentication required') {
                throw error;
            }
            
            console.error('Authenticated fetch error:', error);
            throw error;
        }
    }

    /**
     * Cleanup when page unloads
     */
    cleanup() {
        this.stopPeriodicCheck();
    }
}

// Global authentication manager instance
let authManager = null;

// Initialize authentication when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
    try {
        authManager = new AuthManager();
        await authManager.init();
        
        // Make authManager globally available
        window.authManager = authManager;
        
        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            if (authManager) {
                authManager.cleanup();
            }
        });
        
    } catch (error) {
        console.error('Failed to initialize authentication:', error);
    }
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthManager;
}