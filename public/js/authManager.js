/**
 * Authentication utility for frontend
 * Handles authentication state, login/logout, and protected route access
 */
class AuthManager {
    constructor() {
        this.user = null;
        this.isAuthenticated = false;
        this.sessionToken = null;
        this.csrfToken = null;

        // Initialize authentication state
        this.init();
    }

    /**
     * Initialize authentication state
     */
    async init() {
        try {
            // Try to get session token from localStorage
            this.sessionToken = localStorage.getItem('sessionToken');
            const storedUser = localStorage.getItem('user');

            if (storedUser) {
                this.user = JSON.parse(storedUser);
            }

            // Verify authentication status with server
            await this.checkAuthStatus();
        } catch (error) {
            console.error('Auth initialization error:', error);
            this.clearAuthData();
        }
    }

    /**
     * Check authentication status with server
     */
    async checkAuthStatus() {
        try {
            const response = await fetch('/api/auth/status', {
                credentials: 'include'
            });

            const result = await response.json();

            if (result.success && result.data.isAuthenticated) {
                this.isAuthenticated = true;
                this.user = result.data.user;
                this.csrfToken = result.data.csrfToken;

                // Update localStorage
                localStorage.setItem('user', JSON.stringify(this.user));

                // Dispatch auth state change event
                this.dispatchAuthEvent('authenticated', this.user);
            } else {
                this.clearAuthData();
                this.dispatchAuthEvent('unauthenticated');
            }
        } catch (error) {
            console.error('Auth status check error:', error);
            this.clearAuthData();
            this.dispatchAuthEvent('unauthenticated');
        }
    }

    /**
     * Login user
     */
    async login(email, password, rememberMe = false) {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    email,
                    password,
                    rememberMe
                })
            });

            const result = await response.json();

            if (result.success) {
                this.isAuthenticated = true;
                this.user = result.user;
                this.sessionToken = result.sessionToken;

                // Store in localStorage
                localStorage.setItem('sessionToken', this.sessionToken);
                localStorage.setItem('user', JSON.stringify(this.user));

                // Get CSRF token
                await this.getCsrfToken();

                // Dispatch auth event
                this.dispatchAuthEvent('login', this.user);

                return { success: true, user: this.user };
            } else {
                return { success: false, error: result.error, code: result.code };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: 'Network error occurred' };
        }
    }

    /**
     * Register new user
     */
    async register(userData) {
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(userData)
            });

            const result = await response.json();

            if (result.success) {
                this.isAuthenticated = true;
                this.user = result.user;
                this.sessionToken = result.sessionToken;

                // Store in localStorage
                if (this.sessionToken) {
                    localStorage.setItem('sessionToken', this.sessionToken);
                }
                localStorage.setItem('user', JSON.stringify(this.user));

                // Get CSRF token
                await this.getCsrfToken();

                // Dispatch auth event
                this.dispatchAuthEvent('register', this.user);

                return { success: true, user: this.user };
            } else {
                return { success: false, error: result.error, code: result.code };
            }
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, error: 'Network error occurred' };
        }
    }

    /**
     * Logout user
     */
    async logout() {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            this.clearAuthData();
            this.dispatchAuthEvent('logout');
        }
    }

    /**
     * Get CSRF token
     */
    async getCsrfToken() {
        try {
            const response = await fetch('/api/auth/csrf-token', {
                credentials: 'include'
            });

            const result = await response.json();

            if (result.success) {
                this.csrfToken = result.data.csrfToken;
                return this.csrfToken;
            }
        } catch (error) {
            console.error('CSRF token error:', error);
        }

        return null;
    }

    /**
     * Make authenticated API request
     */
    async authenticatedFetch(url, options = {}) {
        const defaultOptions = {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        // Add CSRF token for state-changing requests
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method)) {
            if (!this.csrfToken) {
                await this.getCsrfToken();
            }

            if (this.csrfToken) {
                defaultOptions.headers['X-CSRF-Token'] = this.csrfToken;
            }
        }

        // Add session token if available
        if (this.sessionToken) {
            defaultOptions.headers['Authorization'] = `Bearer ${this.sessionToken}`;
        }

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
                this.clearAuthData();
                this.dispatchAuthEvent('unauthenticated');

                // Redirect to login if on a protected page
                if (this.isProtectedRoute()) {
                    this.redirectToLogin();
                }
            }

            return response;
        } catch (error) {
            console.error('Authenticated fetch error:', error);
            throw error;
        }
    }

    /**
     * Check if user has required permissions
     */
    hasPermission(requiredRole = 'user') {
        if (!this.isAuthenticated || !this.user) {
            return false;
        }

        const userRole = this.user.role || 'user';
        const rolePriority = {
            'user': 1,
            'admin': 2
        };

        return rolePriority[userRole] >= rolePriority[requiredRole];
    }

    /**
     * Check if current route is protected
     */
    isProtectedRoute() {
        const protectedPaths = [
            '/upload',
            '/export',
            '/check',
            '/files',
            '/stats',
            '/system',
            '/file-manager',
            '/monitoring'
        ];

        const currentPath = window.location.pathname;
        return protectedPaths.some(path => currentPath.startsWith(path));
    }

    /**
     * Redirect to login page
     */
    redirectToLogin() {
        const currentUrl = window.location.href;
        const loginUrl = `/login?redirect=${encodeURIComponent(currentUrl)}`;
        window.location.href = loginUrl;
    }

    /**
     * Clear authentication data
     */
    clearAuthData() {
        this.isAuthenticated = false;
        this.user = null;
        this.sessionToken = null;
        this.csrfToken = null;

        // Clear localStorage
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('user');
    }

    /**
     * Dispatch authentication events
     */
    dispatchAuthEvent(type, data = null) {
        const event = new CustomEvent('authStateChange', {
            detail: {
                type,
                isAuthenticated: this.isAuthenticated,
                user: this.user,
                data
            }
        });

        window.dispatchEvent(event);
    }

    /**
     * Update user profile
     */
    async updateProfile(profileData) {
        try {
            const response = await this.authenticatedFetch('/api/auth/profile', {
                method: 'PUT',
                body: JSON.stringify(profileData)
            });

            const result = await response.json();

            if (result.success) {
                this.user = result.user;
                localStorage.setItem('user', JSON.stringify(this.user));
                this.dispatchAuthEvent('profileUpdated', this.user);
                return { success: true, user: this.user };
            } else {
                return { success: false, error: result.error };
            }
        } catch (error) {
            console.error('Profile update error:', error);
            return { success: false, error: 'Network error occurred' };
        }
    }

    /**
     * Change password
     */
    async changePassword(currentPassword, newPassword, confirmPassword) {
        try {
            const response = await this.authenticatedFetch('/api/auth/change-password', {
                method: 'POST',
                body: JSON.stringify({
                    currentPassword,
                    newPassword,
                    confirmPassword
                })
            });

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Password change error:', error);
            return { success: false, error: 'Network error occurred' };
        }
    }

    /**
     * Get user profile with login history
     */
    async getProfile() {
        try {
            const response = await this.authenticatedFetch('/api/auth/profile');
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Get profile error:', error);
            return { success: false, error: 'Network error occurred' };
        }
    }
}

// Create global auth manager instance
window.authManager = new AuthManager();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthManager;
}
