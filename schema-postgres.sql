-- PostgreSQL schema for singapore_phone_db
-- Converted from MySQL schema
-- Database: singapore_phone_db

-- Create ENUM types first (PostgreSQL requires this)
DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('active', 'inactive', 'banned');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE login_result AS ENUM ('success', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

--
-- Table structure for table "users"
--

DROP TABLE IF EXISTS "users" CASCADE;

CREATE TABLE "users" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(100) NOT NULL,
  "email" VARCHAR(150) NOT NULL UNIQUE,
  "password" VARCHAR(255) NOT NULL,
  "status" user_status DEFAULT 'active',
  "device" VARCHAR(200) DEFAULT NULL,
  "ip_address" VARCHAR(45) DEFAULT NULL,
  "location" VARCHAR(255) DEFAULT NULL,
  "last_seen" TIMESTAMP DEFAULT NULL,
  "login_token" VARCHAR(255) DEFAULT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on email
CREATE INDEX idx_users_email ON "users"("email");

-- Create trigger for updated_at auto-update
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON "users"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

--
-- Table structure for table "user_logins"
--

DROP TABLE IF EXISTS "user_logins" CASCADE;

CREATE TABLE "user_logins" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "login_time" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "ip_address" VARCHAR(45) DEFAULT NULL,
  "device" VARCHAR(200) DEFAULT NULL,
  "location" VARCHAR(255) DEFAULT NULL,
  "result" login_result DEFAULT 'success',
  CONSTRAINT "user_logins_user_id_fkey"
    FOREIGN KEY ("user_id")
    REFERENCES "users"("id")
    ON DELETE CASCADE
);

-- Create index on user_id
CREATE INDEX idx_user_logins_user_id ON "user_logins"("user_id");

--
-- Table structure for table "check_table"
--

DROP TABLE IF EXISTS "check_table" CASCADE;

CREATE TABLE "check_table" (
  "id" VARCHAR(100) PRIMARY KEY,
  "numeric_id" INTEGER DEFAULT NULL,
  "phone" VARCHAR(50) NOT NULL,
  "status" BOOLEAN DEFAULT NULL,
  "company_name" VARCHAR(255) DEFAULT NULL,
  "physical_address" TEXT DEFAULT NULL,
  "email" VARCHAR(255) DEFAULT NULL,
  "website" VARCHAR(255) DEFAULT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add comment to table
COMMENT ON TABLE "check_table" IS 'Editable table for validated phone data with company information';

-- Add comment to columns
COMMENT ON COLUMN "check_table"."numeric_id" IS 'Extracted numeric portion from Id column';
COMMENT ON COLUMN "check_table"."status" IS 'true for Singapore phone, false for non-Singapore';

-- Create indexes
CREATE UNIQUE INDEX unique_email ON "check_table"("email");
CREATE INDEX idx_phone ON "check_table"("phone");
CREATE INDEX idx_status ON "check_table"("status");
CREATE INDEX idx_check_email ON "check_table"("email");
CREATE INDEX idx_created_at ON "check_table"("created_at");
CREATE INDEX idx_updated_at ON "check_table"("updated_at");
CREATE INDEX idx_company_name ON "check_table"("company_name");
CREATE INDEX idx_numeric_id ON "check_table"("numeric_id");

-- Create trigger for updated_at auto-update
CREATE TRIGGER update_check_table_updated_at BEFORE UPDATE ON "check_table"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Schema conversion completed
-- Note: PostgreSQL uses different data types and syntax than MySQL
-- Key changes made:
-- 1. AUTO_INCREMENT -> SERIAL
-- 2. tinyint(1) -> BOOLEAN
-- 3. ENUM types created separately
-- 4. Backticks (`) replaced with double quotes (")
-- 5. Added triggers for ON UPDATE CURRENT_TIMESTAMP behavior
-- 6. Removed MySQL-specific commands and engine declarations
