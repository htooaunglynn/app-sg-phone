/**
 * Authentication middleware
 * Checks if user is authenticated before allowing access to protected routes
 */
function requireAuth(req, res, next) {
    if (req.session && req.session.userId) {
        return next();
    }

    // Check if this is an API request or a page request
    const isApiRequest = req.path.startsWith('/api/') || req.xhr || req.headers.accept?.includes('application/json');

    if (isApiRequest) {
        // For API requests, return JSON error
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    } else {
        // For page requests, redirect to login
        return res.redirect('/login');
    }
}

/**
 * Optional authentication middleware
 * Attaches user info to request if authenticated, but doesn't block unauthenticated requests
 */
function optionalAuth(req, res, next) {
    if (req.session && req.session.userId) {
        req.user = {
            id: req.session.userId,
            email: req.session.userEmail,
            name: req.session.userName
        };
    }
    next();
}

module.exports = {
    requireAuth,
    optionalAuth
};
