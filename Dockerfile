# Singapore Phone Detect Application with Excel Processing Support
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies for Excel processing
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create required directories with proper permissions
RUN mkdir -p uploads uploads/temp uploads/excel uploads/pdf uploads/temp/excel \
    exports exports/temp logs \
    && chown -R node:node uploads exports logs

# Set environment variables for Excel processing
ENV NODE_ENV=production \
    EXCEL_MAX_WORKSHEETS=10 \
    EXCEL_MAX_ROWS_PER_SHEET=10000 \
    EXCEL_PROCESSING_TIMEOUT=300000 \
    ENABLE_EXCEL_MACROS=false

# Expose application port
EXPOSE 3000

# Switch to non-root user for security
USER node

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start the application
CMD ["npm", "start"]