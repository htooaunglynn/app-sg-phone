# Production Deployment Checklist

This checklist ensures proper deployment of the Singapore Phone Detect application with Excel processing capabilities.

## Pre-Deployment Checklist

### System Requirements
- [ ] Node.js 16 or higher installed
- [ ] MySQL 5.7 or higher installed and configured
- [ ] Sufficient disk space for file uploads and processing
- [ ] Additional disk space for Excel temporary files
- [ ] Memory requirements met (minimum 2GB RAM recommended)

### Dependencies
- [ ] All npm dependencies installed (`npm install`)
- [ ] xlsx package installed for Excel processing
- [ ] libphonenumber-js package available for phone validation
- [ ] All development dependencies available for testing

### Environment Configuration
- [ ] `.env` file created from `.env.example`
- [ ] Database credentials configured
- [ ] Excel processing limits configured
- [ ] File upload limits set appropriately
- [ ] Security settings configured

## Database Setup

### Schema Preparation
- [ ] Database created with proper name
- [ ] Database user created with appropriate permissions
- [ ] Connection tested successfully
- [ ] Database migration scripts ready

### Table Structure
- [ ] `backup_table` schema verified
- [ ] `check_table` schema verified
- [ ] `uploaded_files` table with Excel support columns
- [ ] Indexes created for performance
- [ ] Foreign key constraints verified

## File System Setup

### Directory Structure
- [ ] `uploads/` directory created with proper permissions
- [ ] `uploads/pdf/` subdirectory created
- [ ] `uploads/excel/` subdirectory created
- [ ] `uploads/temp/` directory created
- [ ] `uploads/temp/excel/` subdirectory created
- [ ] `exports/` directory created
- [ ] `exports/temp/` directory created
- [ ] `logs/` directory created

### Permissions
- [ ] Upload directories writable by application
- [ ] Export directories writable by application
- [ ] Log directories writable by application
- [ ] Proper file ownership set
- [ ] Security permissions configured

## Excel Processing Configuration

### Excel-Specific Settings
- [ ] `EXCEL_MAX_WORKSHEETS` configured (default: 10)
- [ ] `EXCEL_MAX_ROWS_PER_SHEET` configured (default: 10,000)
- [ ] `EXCEL_PROCESSING_TIMEOUT` configured (default: 300,000ms)
- [ ] `ENABLE_EXCEL_MACROS` set to false for security
- [ ] `EXCEL_TEMP_DIR` configured and created
- [ ] `EXCEL_UPLOAD_DIR` configured and created

### Security Configuration
- [ ] Excel macro execution disabled
- [ ] File type validation enabled
- [ ] File size limits configured
- [ ] MIME type validation active
- [ ] Content scanning enabled

## Application Configuration

### Environment Variables
- [ ] `NODE_ENV` set to `production`
- [ ] Database connection variables set
- [ ] File upload configuration verified
- [ ] Security settings configured
- [ ] Logging configuration set

### Performance Settings
- [ ] Database connection pool configured
- [ ] File processing limits set
- [ ] Memory limits configured
- [ ] Timeout settings appropriate
- [ ] Concurrent processing limits set

## Security Checklist

### File Upload Security
- [ ] File type validation active
- [ ] File size limits enforced
- [ ] MIME type checking enabled
- [ ] Malicious content scanning active
- [ ] Upload directory secured

### Application Security
- [ ] Session secret changed from default
- [ ] CORS origins configured properly
- [ ] Rate limiting enabled
- [ ] HTTPS configured (if applicable)
- [ ] Security headers configured

### Database Security
- [ ] Database user has minimal required permissions
- [ ] Database password is strong
- [ ] Database connection encrypted (if applicable)
- [ ] SQL injection protection verified
- [ ] Database backup strategy in place

## Testing Checklist

### Unit Tests
- [ ] All unit tests passing
- [ ] Excel processing tests passing
- [ ] PDF processing tests still working
- [ ] Database integration tests passing
- [ ] API endpoint tests passing

### Integration Tests
- [ ] End-to-end Excel processing tested
- [ ] PDF processing still functional
- [ ] Mixed file processing tested
- [ ] Database consistency verified
- [ ] Web interface functionality tested

### Performance Tests
- [ ] Large Excel file processing tested
- [ ] Multiple worksheet processing tested
- [ ] Concurrent file processing tested
- [ ] Memory usage monitored
- [ ] Processing timeout tested

## Deployment Process

### Application Deployment
- [ ] Code deployed to production server
- [ ] Dependencies installed
- [ ] Environment configuration applied
- [ ] Database migrations run
- [ ] File directories created

### Service Configuration
- [ ] Process manager configured (PM2 recommended)
- [ ] Auto-restart on failure enabled
- [ ] Log rotation configured
- [ ] Health check endpoints active
- [ ] Monitoring configured

### Web Server Configuration
- [ ] Reverse proxy configured (nginx/Apache)
- [ ] SSL certificates installed (if applicable)
- [ ] Static file serving configured
- [ ] Request size limits configured
- [ ] Timeout settings configured

## Post-Deployment Verification

### Functionality Tests
- [ ] Application starts successfully
- [ ] Database connection verified
- [ ] PDF upload and processing working
- [ ] Excel upload and processing working
- [ ] Export functionality working
- [ ] Web interface accessible

### Health Checks
- [ ] `/health` endpoint responding
- [ ] Database health check passing
- [ ] File system health check passing
- [ ] Memory usage within limits
- [ ] CPU usage acceptable

### Performance Verification
- [ ] Response times acceptable
- [ ] File processing times reasonable
- [ ] Database query performance good
- [ ] Memory usage stable
- [ ] No memory leaks detected

## Monitoring Setup

### Application Monitoring
- [ ] Process monitoring configured
- [ ] Log monitoring active
- [ ] Error tracking enabled
- [ ] Performance metrics collected
- [ ] Uptime monitoring configured

### Resource Monitoring
- [ ] CPU usage monitoring
- [ ] Memory usage monitoring
- [ ] Disk space monitoring
- [ ] Database performance monitoring
- [ ] Network monitoring

### Alerting
- [ ] Critical error alerts configured
- [ ] Resource usage alerts set
- [ ] Uptime alerts enabled
- [ ] Database alerts configured
- [ ] File processing alerts set

## Backup and Recovery

### Data Backup
- [ ] Database backup strategy implemented
- [ ] Uploaded files backup configured
- [ ] Configuration backup in place
- [ ] Backup testing performed
- [ ] Recovery procedures documented

### Disaster Recovery
- [ ] Recovery procedures tested
- [ ] Backup restoration verified
- [ ] Failover procedures documented
- [ ] Recovery time objectives met
- [ ] Data integrity verified

## Documentation

### System Documentation
- [ ] Deployment guide updated
- [ ] Configuration documentation current
- [ ] API documentation updated
- [ ] Troubleshooting guide available
- [ ] Excel processing guide available

### Operational Documentation
- [ ] Monitoring procedures documented
- [ ] Backup procedures documented
- [ ] Recovery procedures documented
- [ ] Maintenance procedures documented
- [ ] Support contact information available

## Final Verification

### Complete System Test
- [ ] Upload PDF file and verify processing
- [ ] Upload Excel file and verify processing
- [ ] Test multiple worksheet Excel file
- [ ] Verify data in backup_table
- [ ] Verify data in check_table
- [ ] Test export functionality
- [ ] Verify web interface functionality

### Performance Baseline
- [ ] Baseline performance metrics recorded
- [ ] Memory usage baseline established
- [ ] Processing time baseline recorded
- [ ] Database performance baseline set
- [ ] System capacity documented

### Sign-off
- [ ] Technical team approval
- [ ] Security review completed
- [ ] Performance review completed
- [ ] Documentation review completed
- [ ] Production deployment approved

## Post-Deployment Tasks

### Immediate Tasks (First 24 hours)
- [ ] Monitor application stability
- [ ] Check error logs for issues
- [ ] Verify all functionality working
- [ ] Monitor resource usage
- [ ] Test with real user data

### Short-term Tasks (First week)
- [ ] Performance optimization if needed
- [ ] User feedback collection
- [ ] Bug fixes if identified
- [ ] Documentation updates
- [ ] Training materials updated

### Long-term Tasks (First month)
- [ ] Performance trend analysis
- [ ] Capacity planning review
- [ ] Security audit
- [ ] Backup verification
- [ ] Disaster recovery testing

## Rollback Plan

### Rollback Triggers
- [ ] Critical functionality failure
- [ ] Performance degradation
- [ ] Security vulnerability
- [ ] Data corruption
- [ ] System instability

### Rollback Procedures
- [ ] Application rollback procedure documented
- [ ] Database rollback procedure documented
- [ ] Configuration rollback procedure documented
- [ ] File system rollback procedure documented
- [ ] Rollback testing completed

This checklist ensures comprehensive deployment of the Singapore Phone Detect application with full Excel processing capabilities. Complete each item before proceeding to production deployment.