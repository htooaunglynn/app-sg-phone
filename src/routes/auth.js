const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../utils/database');

// Render register page
router.get('/register', (req, res) => {
    if (req.session && req.session.userId) return res.redirect('/')
    return res.render('html/register', { error: null })
});

// Register (server-rendered)
router.post('/register', async (req, res) => {
    const { name, email, password, confirmPassword } = req.body;

    // Validation
    if (!name || !email || !password) {
        return res.status(400).render('html/register', { error: 'All fields are required' });
    }

    if (password.length < 8) {
        return res.status(400).render('html/register', { error: 'Password must be at least 8 characters long' });
    }

    if (password !== confirmPassword) {
        return res.status(400).render('html/register', { error: 'Passwords do not match' });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).render('html/register', { error: 'Please enter a valid email address' });
    }

    try {
        // Check if user already exists
        const existingUsers = await db.query('SELECT id FROM users WHERE email = $1', [email]);

        if (existingUsers.length > 0) {
            return res.status(400).render('html/register', { error: 'Email already registered' });
        }

        // Hash password
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Insert user (PostgreSQL RETURNING clause)
        const result = await db.query(
            'INSERT INTO users (name, email, password, status) VALUES ($1, $2, $3, $4) RETURNING id',
            [name, email, hashedPassword, 'active']
        );

        // Create session
        req.session.userId = result[0].id;
        req.session.userEmail = email;
        req.session.userName = name;

        // Save session explicitly and wait for it
        req.session.save((err) => {
            if (err) {
                console.error('Session save error during registration:', err);
                return res.status(500).render('html/register', { error: 'Registration successful but login failed. Please try logging in.' });
            }

            console.log('User registered successfully:', { userId: result[0].id, email, sessionID: req.sessionID });
            return res.redirect('/');
        });
    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).render('html/register', { error: 'Registration failed. Please try again.' });
    }
});

// Render login page
router.get('/login', (req, res) => {
    if (req.session && req.session.userId) return res.redirect('/')
    return res.render('html/login', { error: null })
});

// Login (server-rendered)
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
        return res.status(400).render('html/login', { error: 'Email and password are required' });
    }

    try {
        // Get user from database
        const users = await db.query(
            'SELECT id, name, email, password, status FROM users WHERE email = $1',
            [email]
        );

        if (users.length === 0) {
            return res.status(401).render('html/login', { error: 'Invalid email or password' });
        }

        const user = users[0];

        // Check if user is active
        if (user.status !== 'active') {
            return res.status(403).render('html/login', { error: 'Account is inactive or banned' });
        }

        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            // Log failed login attempt
            await db.query(
                'INSERT INTO user_logins (user_id, ip_address, device, result) VALUES ($1, $2, $3, $4)',
                [user.id, req.ip, req.headers['user-agent'] || 'Unknown', 'failed']
            );

            return res.status(401).render('html/login', { error: 'Invalid email or password' });
        }

        // Create session
        req.session.userId = user.id;
        req.session.userEmail = user.email;
        req.session.userName = user.name;

        // Update last seen
        await db.query(
            'UPDATE users SET last_seen = NOW(), ip_address = $1, device = $2 WHERE id = $3',
            [req.ip, req.headers['user-agent'] || 'Unknown', user.id]
        );

        // Log successful login
        await db.query(
            'INSERT INTO user_logins (user_id, ip_address, device, result) VALUES ($1, $2, $3, $4)',
            [user.id, req.ip, req.headers['user-agent'] || 'Unknown', 'success']
        );

        // Save session explicitly and wait for it
        req.session.save((err) => {
            if (err) {
                console.error('Session save error during login:', err);
                return res.status(500).render('html/login', { error: 'Login successful but session failed. Please try again.' });
            }

            console.log('User logged in successfully:', { userId: user.id, email: user.email, sessionID: req.sessionID });
            return res.redirect('/');
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).render('html/login', { error: 'Login failed. Please try again.' });
    }
});

// Logout route (server-rendered)
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).render('html/login', { error: 'Logout failed' });
        }

        res.clearCookie('connect.sid');
        return res.redirect('/login');
    });
});

// Optional: Deprecated REST endpoints are intentionally removed for server-rendered flow

module.exports = router;
