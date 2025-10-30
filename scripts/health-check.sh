#!/bin/bash

# Health Check Script for Singapore Phone Detect Application
# This script can be used by monitoring systems or load balancers

set -e

# Configuration
HOST=${HEALTH_CHECK_HOST:-localhost}
PORT=${HEALTH_CHECK_PORT:-3000}
TIMEOUT=${HEALTH_CHECK_TIMEOUT:-10}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}[HEALTHY]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[UNHEALTHY]${NC} $1"
}

# Check if curl is available
if ! command -v curl &> /dev/null; then
    print_error "curl is not installed. Please install curl to run health checks."
    exit 1
fi

# Perform health check
HEALTH_URL="http://${HOST}:${PORT}/health"

print_success "Checking application health at $HEALTH_URL"

# Make the health check request
HTTP_STATUS=$(curl -s -o /tmp/health_response.json -w "%{http_code}" --connect-timeout $TIMEOUT "$HEALTH_URL" || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
    # Parse the response
    if command -v jq &> /dev/null; then
        STATUS=$(jq -r '.status' /tmp/health_response.json 2>/dev/null || echo "unknown")
        DATABASE=$(jq -r '.database.status' /tmp/health_response.json 2>/dev/null || echo "unknown")
        UPTIME=$(jq -r '.uptime' /tmp/health_response.json 2>/dev/null || echo "unknown")
        
        if [ "$STATUS" = "healthy" ] && [ "$DATABASE" = "connected" ]; then
            print_success "Application is healthy"
            print_success "Database: $DATABASE"
            print_success "Uptime: $UPTIME"
            rm -f /tmp/health_response.json
            exit 0
        else
            print_warning "Application responded but may have issues"
            print_warning "Status: $STATUS"
            print_warning "Database: $DATABASE"
            cat /tmp/health_response.json
            rm -f /tmp/health_response.json
            exit 1
        fi
    else
        print_success "Application responded with HTTP 200"
        print_warning "jq not available for detailed response parsing"
        rm -f /tmp/health_response.json
        exit 0
    fi
elif [ "$HTTP_STATUS" = "000" ]; then
    print_error "Failed to connect to application (connection timeout or refused)"
    rm -f /tmp/health_response.json
    exit 1
else
    print_error "Application responded with HTTP $HTTP_STATUS"
    if [ -f /tmp/health_response.json ]; then
        cat /tmp/health_response.json
        rm -f /tmp/health_response.json
    fi
    exit 1
fi