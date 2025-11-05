-- Drop tables if exist (order matters because of FK dependency)
DROP TABLE IF EXISTS user_logins;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS check_table;

-- ===========================
-- Table: check_table
-- ===========================
CREATE TABLE check_table (
    id VARCHAR(100) PRIMARY KEY,
    numeric_id INT NULL,   -- Extracted numeric portion from id
    phone VARCHAR(50) NOT NULL,
    status BOOLEAN NULL,   -- tinyint(1) → boolean
    company_name VARCHAR(255) NULL,
    physical_address TEXT NULL,
    email VARCHAR(255) NULL UNIQUE,
    website VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- In PostgreSQL we use a trigger for "ON UPDATE CURRENT_TIMESTAMP"
);

-- Indexes
CREATE INDEX idx_phone ON check_table (phone);
CREATE INDEX idx_status ON check_table (status);
CREATE INDEX idx_email ON check_table (email);
CREATE INDEX idx_created_at ON check_table (created_at);
CREATE INDEX idx_updated_at ON check_table (updated_at);
CREATE INDEX idx_company_name ON check_table (company_name);
CREATE INDEX idx_numeric_id ON check_table (numeric_id);

-- Auto-update updated_at timestamp (similar to MySQL ON UPDATE CURRENT_TIMESTAMP)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_timestamp
BEFORE UPDATE ON check_table
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- ===========================
-- Table: users
-- ===========================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,  -- AUTO_INCREMENT → SERIAL
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    status VARCHAR(10) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'banned')),
    device VARCHAR(200) NULL,
    ip_address VARCHAR(45) NULL,
    location VARCHAR(255) NULL,
    last_seen TIMESTAMP NULL,
    login_token VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Auto-update for users.updated_at
CREATE TRIGGER trg_users_update_timestamp
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- ===========================
-- Table: user_logins
-- ===========================
CREATE TABLE user_logins (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45) NULL,
    device VARCHAR(200) NULL,
    location VARCHAR(255) NULL,
    result VARCHAR(10) DEFAULT 'success' CHECK (result IN ('success', 'failed')),

    CONSTRAINT fk_user_logins_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE
);

CREATE INDEX idx_user_id ON user_logins (user_id);
