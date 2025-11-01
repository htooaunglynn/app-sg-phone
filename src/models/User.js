const databaseManager = require('../utils/database');
const bcrypt = require('bcrypt');

/**
 * User Model for handling user authentication and profile management
 * Interacts with users and user_logins tables
 */
class User {
    constructor() {
        this.tableName = 'users';
        this.loginTableName = 'user_logins';
    }

    /**
     * Create a new user account
     * @param {Object} userData - User registration data
     * @param {string} userData.name - User's full name
     * @param {string} userData.email - User's email address
     * @param {string} userData.password - User's password (will be hashed)
     * @param {string} userData.device - Device information
     * @param {string} userData.ip_address - User's IP address
     * @param {string} userData.location - User's location
     * @returns {Object} Created user data (without password)
     */
    async createUser(userData) {
        const connection = await databaseManager.getConnection();

        try {
            const { name, email, password, device, ip_address, location } = userData;

            // Additional password validation as a safety check
            if (!password || password.length < 8) {
                throw new Error('Password must be at least 8 characters long');
            }

            // Check if user already exists
            const existingUser = await this.findByEmail(email);
            if (existingUser) {
                throw new Error('User with this email already exists');
            }

            // Hash password
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            // Insert new user
            const query = `
        INSERT INTO ${this.tableName}
        (name, email, password, device, ip_address, location, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())
      `;

            const [result] = await connection.execute(query, [
                name,
                email,
                hashedPassword,
                device || null,
                ip_address || null,
                location || null
            ]);

            // Get the created user (without password)
            const createdUser = await this.findById(result.insertId);

            return createdUser;
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Find user by ID
     * @param {number} id - User ID
     * @returns {Object|null} User data (without password) or null if not found
     */
    async findById(id) {
        const connection = await databaseManager.getConnection();

        try {
            const query = `
        SELECT id, name, email, status, device, ip_address, location,
               last_seen, created_at, updated_at
        FROM ${this.tableName}
        WHERE id = ?
      `;

            const [rows] = await connection.execute(query, [id]);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error('Error finding user by ID:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Find user by email
     * @param {string} email - User email
     * @returns {Object|null} User data (without password) or null if not found
     */
    async findByEmail(email) {
        const connection = await databaseManager.getConnection();

        try {
            const query = `
        SELECT id, name, email, status, device, ip_address, location,
               last_seen, created_at, updated_at
        FROM ${this.tableName}
        WHERE email = ?
      `;

            const [rows] = await connection.execute(query, [email]);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error('Error finding user by email:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Find user by email with password (for authentication)
     * @param {string} email - User email
     * @returns {Object|null} User data with password or null if not found
     */
    async findByEmailWithPassword(email) {
        const connection = await databaseManager.getConnection();

        try {
            const query = `
        SELECT id, name, email, password, status, device, ip_address, location,
               last_seen, login_token, created_at, updated_at
        FROM ${this.tableName}
        WHERE email = ?
      `;

            const [rows] = await connection.execute(query, [email]);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error('Error finding user by email with password:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Validate user credentials
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Object|null} User data (without password) if valid, null if invalid
     */
    async validateCredentials(email, password) {
        try {
            const user = await this.findByEmailWithPassword(email);

            if (!user) {
                return null;
            }

            // Check if user is active
            if (user.status !== 'active') {
                throw new Error('User account is not active');
            }

            // Verify password
            const isValidPassword = await bcrypt.compare(password, user.password);

            if (!isValidPassword) {
                return null;
            }

            // Return user data without password
            const { password: _, ...userWithoutPassword } = user;
            return userWithoutPassword;
        } catch (error) {
            console.error('Error validating credentials:', error);
            throw error;
        }
    }

    /**
     * Update user's last seen timestamp and login token
     * @param {number} userId - User ID
     * @param {string} loginToken - Login session token
     * @param {Object} deviceInfo - Device and location information
     * @returns {boolean} Success status
     */
    async updateLastSeen(userId, loginToken, deviceInfo = {}) {
        const connection = await databaseManager.getConnection();

        try {
            const { device, ip_address, location } = deviceInfo;

            const query = `
        UPDATE ${this.tableName}
        SET last_seen = NOW(),
            login_token = ?,
            device = COALESCE(?, device),
            ip_address = COALESCE(?, ip_address),
            location = COALESCE(?, location),
            updated_at = NOW()
        WHERE id = ?
      `;

            await connection.execute(query, [
                loginToken,
                device,
                ip_address,
                location,
                userId
            ]);

            return true;
        } catch (error) {
            console.error('Error updating last seen:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Log user login attempt
     * @param {number} userId - User ID
     * @param {Object} loginData - Login attempt data
     * @param {string} loginData.ip_address - IP address
     * @param {string} loginData.device - Device information
     * @param {string} loginData.location - Location information
     * @param {string} loginData.result - Login result ('success' or 'failed')
     * @returns {number} Login log ID
     */
    async logLoginAttempt(userId, loginData) {
        const connection = await databaseManager.getConnection();

        try {
            const { ip_address, device, location, result = 'success' } = loginData;

            const query = `
        INSERT INTO ${this.loginTableName}
        (user_id, login_time, ip_address, device, location, result)
        VALUES (?, NOW(), ?, ?, ?, ?)
      `;

            const [insertResult] = await connection.execute(query, [
                userId,
                ip_address || null,
                device || null,
                location || null,
                result
            ]);

            return insertResult.insertId;
        } catch (error) {
            console.error('Error logging login attempt:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Get user's login history
     * @param {number} userId - User ID
     * @param {number} limit - Number of records to retrieve (default: 10)
     * @returns {Array} Array of login history records
     */
    async getLoginHistory(userId, limit = 10) {
        const connection = await databaseManager.getConnection();

        try {
            const query = `
        SELECT id, login_time, ip_address, device, location, result
        FROM ${this.loginTableName}
        WHERE user_id = ?
        ORDER BY login_time DESC
        LIMIT ?
      `;

            const [rows] = await connection.execute(query, [userId, limit]);
            return rows;
        } catch (error) {
            console.error('Error getting login history:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Update user password
     * @param {number} userId - User ID
     * @param {string} newPassword - New password (will be hashed)
     * @returns {boolean} Success status
     */
    async updatePassword(userId, newPassword) {
        const connection = await databaseManager.getConnection();

        try {
            // Hash new password
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

            const query = `
        UPDATE ${this.tableName}
        SET password = ?, updated_at = NOW()
        WHERE id = ?
      `;

            await connection.execute(query, [hashedPassword, userId]);
            return true;
        } catch (error) {
            console.error('Error updating password:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Update user profile
     * @param {number} userId - User ID
     * @param {Object} profileData - Profile data to update
     * @returns {Object} Updated user data
     */
    async updateProfile(userId, profileData) {
        const connection = await databaseManager.getConnection();

        try {
            const allowedFields = ['name', 'device', 'ip_address', 'location'];
            const updateFields = [];
            const updateValues = [];

            // Build dynamic update query
            for (const [key, value] of Object.entries(profileData)) {
                if (allowedFields.includes(key) && value !== undefined) {
                    updateFields.push(`${key} = ?`);
                    updateValues.push(value);
                }
            }

            if (updateFields.length === 0) {
                throw new Error('No valid fields to update');
            }

            updateFields.push('updated_at = NOW()');
            updateValues.push(userId);

            const query = `
        UPDATE ${this.tableName}
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `;

            await connection.execute(query, updateValues);

            // Return updated user data
            return await this.findById(userId);
        } catch (error) {
            console.error('Error updating profile:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Deactivate user account
     * @param {number} userId - User ID
     * @returns {boolean} Success status
     */
    async deactivateUser(userId) {
        const connection = await databaseManager.getConnection();

        try {
            const query = `
        UPDATE ${this.tableName}
        SET status = 'inactive', login_token = NULL, updated_at = NOW()
        WHERE id = ?
      `;

            await connection.execute(query, [userId]);
            return true;
        } catch (error) {
            console.error('Error deactivating user:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Get all users (admin function)
     * @param {Object} options - Query options
     * @param {number} options.page - Page number (default: 1)
     * @param {number} options.limit - Records per page (default: 20)
     * @param {string} options.status - Filter by status (optional)
     * @returns {Object} Users data with pagination info
     */
    async getAllUsers(options = {}) {
        const connection = await databaseManager.getConnection();

        try {
            const { page = 1, limit = 20, status } = options;
            const offset = (page - 1) * limit;

            let whereClause = '';
            const queryParams = [];

            if (status) {
                whereClause = 'WHERE status = ?';
                queryParams.push(status);
            }

            // Get total count
            const countQuery = `SELECT COUNT(*) as total FROM ${this.tableName} ${whereClause}`;
            const [countResult] = await connection.execute(countQuery, queryParams);
            const total = countResult[0].total;

            // Get users
            const usersQuery = `
        SELECT id, name, email, status, device, ip_address, location,
               last_seen, created_at, updated_at
        FROM ${this.tableName}
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;

            const [users] = await connection.execute(usersQuery, [...queryParams, limit, offset]);

            return {
                users,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                    hasNext: page * limit < total,
                    hasPrev: page > 1
                }
            };
        } catch (error) {
            console.error('Error getting all users:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Clear user's login token (logout)
     * @param {number} userId - User ID
     * @returns {boolean} Success status
     */
    async clearLoginToken(userId) {
        const connection = await databaseManager.getConnection();

        try {
            const query = `
        UPDATE ${this.tableName}
        SET login_token = NULL, updated_at = NOW()
        WHERE id = ?
      `;

            await connection.execute(query, [userId]);
            return true;
        } catch (error) {
            console.error('Error clearing login token:', error);
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = User;
