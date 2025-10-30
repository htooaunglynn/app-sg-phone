# Deployment Guide

This guide covers deployment options for the Singapore Phone Detect application.

## Prerequisites

- Node.js 16 or higher
- MySQL 5.7 or higher
- Sufficient disk space for file uploads and exports
- Additional disk space for Excel file processing and temporary storage

## Quick Start

1. **Clone and Setup**
   ```bash
   git clone <repository-url>
   cd singapore-phone-detect
   npm run setup
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start Application**
   ```bash
   npm run start:prod
   ```

## Environment Configuration

### Required Variables

- `DB_HOST` - MySQL database host
- `DB_USER` - Database username
- `DB_PASSWORD` - Database password
- `DB_NAME` - Database name

### Excel Processing Variables

- `EXCEL_MAX_WORKSHEETS` - Maximum worksheets to process per Excel file (default: 10)
- `EXCEL_MAX_ROWS_PER_SHEET` - Maximum rows to process per worksheet (default: 10,000)
- `EXCEL_PROCESSING_TIMEOUT` - Processing timeout in milliseconds (default: 300,000)
- `ENABLE_EXCEL_MACROS` - Enable Excel macro processing (default: false, recommended)
- `EXCEL_TEMP_DIR` - Temporary directory for Excel processing (default: ./uploads/temp/excel)
- `EXCEL_UPLOAD_DIR` - Directory for storing original Excel files (default: ./uploads/excel)

### Optional Variables

See `.env.example` for all available configuration options.

## Deployment Options

### Option 1: Direct Node.js

```bash
# Production start
NODE_ENV=production npm start

# Or use the startup script
npm run start:prod
```

### Option 2: PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start src/app.js --name singapore-phone-detect

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
```

### Option 3: Docker

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN mkdir -p uploads uploads/temp uploads/excel uploads/pdf exports exports/temp logs

EXPOSE 3000

USER node

CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t singapore-phone-detect .
docker run -d -p 3000:3000 --env-file .env singapore-phone-detect
```

### Option 4: Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    volumes:
      - ./uploads:/app/uploads
      - ./exports:/app/exports
      - ./logs:/app/logs
    environment:
      - EXCEL_MAX_WORKSHEETS=10
      - EXCEL_MAX_ROWS_PER_SHEET=10000
      - EXCEL_PROCESSING_TIMEOUT=300000
      - ENABLE_EXCEL_MACROS=false
    depends_on:
      - mysql
    restart: unless-stopped

  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: singapore_phone_db
      MYSQL_USER: app_user
      MYSQL_PASSWORD: secure_password
    volumes:
      - mysql_data:/var/lib/mysql
    restart: unless-stopped

volumes:
  mysql_data:
```

## Database Setup

### Manual Setup

```sql
CREATE DATABASE singapore_phone_db;
CREATE USER 'app_user'@'%' IDENTIFIED BY 'secure_password';
GRANT ALL PRIVILEGES ON singapore_phone_db.* TO 'app_user'@'%';
FLUSH PRIVILEGES;
```

### Automatic Setup

The application will automatically create the required tables on startup.

## Health Monitoring

### Health Check Endpoint

```bash
curl http://localhost:3000/health
```

### Health Check Script

```bash
npm run health-check
```

### Monitoring with External Tools

The application provides several endpoints for monitoring:

- `GET /health` - Detailed health status
- `GET /ping` - Simple ping response
- `GET /stats` - Application statistics

## Security Considerations

### Production Checklist

- [ ] Change default `SESSION_SECRET`
- [ ] Use strong database passwords
- [ ] Configure proper CORS origins
- [ ] Enable HTTPS in production
- [ ] Set up proper firewall rules
- [ ] Configure rate limiting
- [ ] Set up log rotation
- [ ] Regular security updates

### Environment Variables

Never commit `.env` files to version control. Use environment-specific configuration.

## Excel Processing Configuration

### Excel Processing Limits

Configure Excel processing limits based on your server resources:

```bash
# Maximum worksheets to process per Excel file
EXCEL_MAX_WORKSHEETS=10

# Maximum rows to process per worksheet
EXCEL_MAX_ROWS_PER_SHEET=10000

# Processing timeout (5 minutes default)
EXCEL_PROCESSING_TIMEOUT=300000

# Disable Excel macros for security
ENABLE_EXCEL_MACROS=false
```

### Excel Storage Configuration

```bash
# Excel-specific directories
EXCEL_TEMP_DIR=./uploads/temp/excel
EXCEL_UPLOAD_DIR=./uploads/excel

# Ensure directories exist
mkdir -p uploads/excel uploads/pdf uploads/temp/excel
```

### Excel Processing Security

- **Macro Handling**: Keep `ENABLE_EXCEL_MACROS=false` for security
- **File Size Limits**: Use same `MAX_FILE_SIZE` as PDF processing
- **File Type Validation**: System validates Excel MIME types automatically
- **Content Scanning**: Excel files are scanned for malicious content

### Excel Processing Performance

- **Memory Usage**: Excel processing uses streaming to handle large files
- **Processing Time**: Adjust `EXCEL_PROCESSING_TIMEOUT` based on expected file sizes
- **Concurrent Processing**: Excel and PDF processing can run concurrently
- **Worksheet Limits**: Limit `EXCEL_MAX_WORKSHEETS` to prevent resource exhaustion

## Performance Tuning

### Database

- Adjust `DB_CONNECTION_LIMIT` based on expected load
- Configure proper MySQL settings for your hardware
- Consider read replicas for high-read workloads

### Application

- Use PM2 cluster mode for multi-core systems
- Configure proper `MAX_FILE_SIZE` limits
- Set up log rotation to prevent disk space issues
- Adjust Excel processing limits based on server resources

### File System

- Use SSD storage for better I/O performance
- Consider separate volumes for uploads and exports
- Implement cleanup policies for old files
- Monitor disk space for Excel temporary processing files

## Backup Strategy

### Database Backups

```bash
# Daily backup script
mysqldump -u app_user -p singapore_phone_db > backup_$(date +%Y%m%d).sql
```

### File Backups

- Backup upload and export directories regularly
- Consider using cloud storage for backups
- Test restore procedures regularly

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check database credentials in `.env`
   - Verify database server is running
   - Check network connectivity

2. **File Upload Errors**
   - Verify upload directory permissions
   - Check available disk space
   - Review file size limits
   - Ensure Excel-specific directories exist

3. **Excel Processing Issues**
   - Check Excel file format (.xlsx or .xls)
   - Verify Excel processing timeout settings
   - Monitor Excel temporary directory disk space
   - Check Excel processing logs for detailed errors

4. **Memory Issues**
   - Monitor application memory usage
   - Adjust Node.js memory limits if needed
   - Consider processing large files in chunks
   - Adjust Excel processing limits for large files

### Log Files

Application logs are available at:
- Console output (stdout/stderr)
- File logs (if `ENABLE_FILE_LOGGING=true`)

### Debug Mode

```bash
NODE_ENV=development npm start
```

## Scaling

### Horizontal Scaling

- Use load balancer (nginx, HAProxy)
- Share session storage (Redis)
- Use shared file storage (NFS, cloud storage)

### Vertical Scaling

- Increase server resources (CPU, RAM)
- Optimize database configuration
- Use PM2 cluster mode

## Documentation

### Complete Documentation Set
- **DEPLOYMENT.md** - This deployment guide
- **EXCEL_PROCESSING_GUIDE.md** - Comprehensive Excel processing documentation
- **PRODUCTION_DEPLOYMENT_CHECKLIST.md** - Complete deployment checklist
- **SYSTEM_ARCHITECTURE.md** - Detailed system architecture documentation
- **README.md** - Basic setup and usage guide

### Configuration Files
- **Dockerfile** - Container deployment configuration
- **docker-compose.yml** - Multi-service orchestration
- **config/mysql.cnf** - Optimized MySQL configuration
- **config/nginx.conf** - Production web server configuration

## Support

For issues and questions:
1. Check application logs
2. Run health checks
3. Review this deployment guide and related documentation
4. Check system resources (CPU, memory, disk)
5. Consult the Excel Processing Guide for Excel-specific issues
6. Use the Production Deployment Checklist for deployment verification