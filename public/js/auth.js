// Authentication API client
const AuthAPI = {
    baseURL: 'http://localhost:3200/api/auth',

    async register(name, email, password) {
        try {
            const response = await fetch(`${this.baseURL}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ name, email, password })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Register error:', error);
            return { success: false, message: 'Network error. Please try again.' };
        }
    },

    async login(email, password) {
        try {
            const response = await fetch(`${this.baseURL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: 'Network error. Please try again.' };
        }
    },

    async logout() {
        try {
            const response = await fetch(`${this.baseURL}/logout`, {
                method: 'POST',
                credentials: 'include'
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Logout error:', error);
            return { success: false, message: 'Network error. Please try again.' };
        }
    },

    async checkStatus() {
        try {
            const response = await fetch(`${this.baseURL}/status`, {
                method: 'GET',
                credentials: 'include'
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Status check error:', error);
            return { authenticated: false };
        }
    },

    async getCurrentUser() {
        try {
            const response = await fetch(`${this.baseURL}/me`, {
                method: 'GET',
                credentials: 'include'
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Get user error:', error);
            return { success: false, message: 'Failed to get user information' };
        }
    }
};

// Handle registration form
async function handleRegister(event) {
    event.preventDefault();

    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    const errorDiv = document.getElementById('registerError');

    // Clear previous errors
    errorDiv.classList.add('hidden');
    errorDiv.textContent = '';

    // Validate passwords match
    if (password !== confirmPassword) {
        errorDiv.textContent = 'Passwords do not match';
        errorDiv.classList.remove('hidden');
        return;
    }

    // Validate password length
    if (password.length < 8) {
        errorDiv.textContent = 'Password must be at least 8 characters long';
        errorDiv.classList.remove('hidden');
        return;
    }

    // Call API
    const result = await AuthAPI.register(name, email, password);

    if (result.success) {
        // Registration successful, redirect to home
        window.location.href = '/index.html';
    } else {
        // Show error
        errorDiv.textContent = result.message || 'Registration failed. Please try again.';
        errorDiv.classList.remove('hidden');
    }
}

// Handle login form
async function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');

    // Clear previous errors
    errorDiv.classList.add('hidden');
    errorDiv.textContent = '';

    // Call API
    const result = await AuthAPI.login(email, password);

    if (result.success) {
        // Login successful, redirect to home
        window.location.href = '/index.html';
    } else {
        // Show error
        errorDiv.textContent = result.message || 'Login failed. Please try again.';
        errorDiv.classList.remove('hidden');
    }
}

// Handle logout
async function logout() {
    const result = await AuthAPI.logout();

    if (result.success) {
        // Redirect to login page
        window.location.href = '/html/login.html';
    } else {
        console.error('Logout failed:', result.message);
        // Still redirect to login even if logout fails
        window.location.href = '/html/login.html';
    }
}

// Update user display in navigation
async function updateUserDisplay() {
    const userDisplay = document.getElementById('userDisplay');
    if (!userDisplay) return;

    const status = await AuthAPI.checkStatus();

    if (status.authenticated && status.user) {
        userDisplay.textContent = `Hello, ${status.user.name}`;
    } else {
        userDisplay.textContent = '';
    }
}

// Check authentication on protected pages
async function checkAuthentication() {
    const currentPage = window.location.pathname;
    const isLoginPage = currentPage.includes('login.html');
    const isRegisterPage = currentPage.includes('register.html');

    const status = await AuthAPI.checkStatus();

    // If not authenticated and not on login/register pages, redirect to login
    if (!status.authenticated && !isLoginPage && !isRegisterPage) {
        window.location.href = '/html/login.html';
        return;
    }

    // If authenticated and on login/register pages, redirect to home
    if (status.authenticated && (isLoginPage || isRegisterPage)) {
        window.location.href = '/index.html';
        return;
    }

    // Update user display if authenticated
    if (status.authenticated) {
        updateUserDisplay();
    }
}

// Navigation helper
function navigateTo(page) {
    window.location.href = page.startsWith('/') ? page : `/${page}`;
}

// Initialize authentication on page load
document.addEventListener('DOMContentLoaded', () => {
    checkAuthentication();

    // Attach form handlers if they exist
    const registerForm = document.querySelector('form[onsubmit*="handleRegister"]');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }

    const loginForm = document.querySelector('form[onsubmit*="handleLogin"]');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
});
