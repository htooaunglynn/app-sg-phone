#!/bin/bash

# Singapore Phone Detect Application Startup Script
# This script handles application startup with proper environment setup

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 16 or higher."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2)
REQUIRED_VERSION="16.0.0"

if ! node -e "process.exit(require('semver').gte('$NODE_VERSION', '$REQUIRED_VERSION') ? 0 : 1)" 2>/dev/null; then
    print_error "Node.js version $NODE_VERSION is not supported. Please install Node.js $REQUIRED_VERSION or higher."
    exit 1
fi

print_success "Node.js version $NODE_VERSION detected"

# Check if we're in the correct directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the application root directory."
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_warning ".env file not found. Checking for .env.example..."
    if [ -f ".env.example" ]; then
        print_status "Copying .env.example to .env"
        cp .env.example .env
        print_warning "Please edit .env file with your configuration before starting the application."
        exit 1
    else
        print_error "No .env or .env.example file found. Please create a .env file with required configuration."
        exit 1
    fi
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    npm install
    print_success "Dependencies installed"
fi

# Create required directories
print_status "Creating required directories..."
mkdir -p uploads uploads/temp uploads/excel uploads/pdf uploads/temp/excel exports exports/temp logs
print_success "Directories created"

# Check database connectivity (optional)
if command -v mysql &> /dev/null; then
    print_status "MySQL client found. You can test database connectivity manually if needed."
fi

# Set NODE_ENV if not set
if [ -z "$NODE_ENV" ]; then
    export NODE_ENV=production
    print_status "NODE_ENV set to production"
fi

# Start the application
print_status "Starting Singapore Phone Detect application..."
print_status "Environment: $NODE_ENV"
print_status "Starting server..."

# Use PM2 if available, otherwise use node directly
if command -v pm2 &> /dev/null; then
    print_status "PM2 detected. Starting with PM2..."
    pm2 start src/app.js --name "singapore-phone-detect" --env $NODE_ENV
    pm2 save
    print_success "Application started with PM2"
    print_status "Use 'pm2 status' to check application status"
    print_status "Use 'pm2 logs singapore-phone-detect' to view logs"
    print_status "Use 'pm2 stop singapore-phone-detect' to stop the application"
else
    print_status "Starting with Node.js directly..."
    node src/app.js
fi