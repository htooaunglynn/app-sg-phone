const express = require('express');
const router = express.Router();
const databaseManager = require('../utils/database');

/**
 * Monitoring Routes Module
 * Provides system health checks, metrics, and monitoring endpoints
 * Implements requirements 2.1, 2.2, 4.1, 4.2, 4.3, 4.4, 4.5
 */

/**
 * Get system uptime in milliseconds
 */
function getSystemUptime() {
  return process.uptime() * 1000;
}

/**
 * Get memory usage statistics
 */
function getMemoryUsage() {
  const memUsage = process.memoryUsage();
  const totalMemory = require('os').totalmem();
  const freeMemory = require('os').freemem();
  const usedMemory = totalMemory - freeMemory;
  
  return {
    used: Math.round(usedMemory / 1024 / 1024), // MB
    total: Math.round(totalMemory / 1024 / 1024), // MB
    percentage: Math.round((usedMemory / totalMemory) * 100),
    process: {
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      external: Math.round(memUsage.external / 1024 / 1024) // MB
    }
  };
}

/**
 * Get CPU usage information
 */
function getCPUUsage() {
  const cpus = require('os').cpus();
  const loadAvg = require('os').loadavg();
  
  return {
    cores: cpus.length,
    model: cpus[0]?.model || 'Unknown',
    loadAverage: {
      '1min': Math.round(loadAvg[0] * 100) / 100,
      '5min': Math.round(loadAvg[1] * 100) / 100,
      '15min': Math.round(loadAvg[2] * 100) / 100
    }
  };
}

/**
 * Test database connection and get response time
 */
async function testDatabaseConnection() {
  const startTime = Date.now();
  
  try {
    const connectionStatus = databaseManager.getConnectionStatus();
    
    if (!connectionStatus.isConnected) {
      await databaseManager.connect();
    }
    
    // Test with a simple query
    await databaseManager.query('SELECT 1 as test');
    
    const responseTime = Date.now() - startTime;
    
    return {
      connected: true,
      responseTime: responseTime,
      status: 'healthy'
    };
  } catch (error) {
    return {
      connected: false,
      responseTime: Date.now() - startTime,
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Get database statistics
 */
async function getDatabaseStats() {
  try {
    const tableStats = await databaseManager.getTableStats();
    const fileStats = await databaseManager.getFileStats();
    
    return {
      tables: tableStats,
      files: fileStats,
      status: 'healthy'
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Create standardized response format
 */
function createResponse(success, data, error = null) {
  return {
    success: success,
    data: data,
    error: error,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  };
}

/**
 * Basic health check endpoint
 * GET /api/monitoring/health
 */
router.get('/health', async (req, res) => {
  try {
    const uptime = getSystemUptime();
    const memory = getMemoryUsage();
    const database = await testDatabaseConnection();
    
    const healthData = {
      status: database.connected ? 'healthy' : 'degraded',
      uptime: uptime,
      memory: memory,
      database: database
    };
    
    const statusCode = database.connected ? 200 : 503;
    res.status(statusCode).json(createResponse(database.connected, healthData));
    
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json(createResponse(false, null, 'Health check failed'));
  }
});

/**
 * System performance metrics endpoint
 * GET /api/monitoring/metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const memory = getMemoryUsage();
    const cpu = getCPUUsage();
    const uptime = getSystemUptime();
    
    // Get basic request metrics (simplified for now)
    const metricsData = {
      system: {
        uptime: uptime,
        memory: memory,
        cpu: cpu,
        platform: process.platform,
        nodeVersion: process.version
      },
      performance: {
        averageResponseTime: 0, // Placeholder - would need request tracking
        slowRequests: 0, // Placeholder - would need request tracking
        totalRequests: 0 // Placeholder - would need request tracking
      },
      resources: {
        memoryUsage: memory.percentage,
        cpuUsage: cpu.loadAverage['1min'],
        diskUsage: 0 // Placeholder - would need disk monitoring
      }
    };
    
    res.json(createResponse(true, metricsData));
    
  } catch (error) {
    console.error('Metrics collection failed:', error);
    res.status(500).json(createResponse(false, null, 'Metrics collection failed'));
  }
});

/**
 * Database connection status and statistics
 * GET /api/monitoring/database
 */
router.get('/database', async (req, res) => {
  try {
    const connectionTest = await testDatabaseConnection();
    const databaseStats = await getDatabaseStats();
    
    const databaseData = {
      connection: connectionTest,
      statistics: databaseStats,
      connectionPool: databaseManager.getConnectionStatus()
    };
    
    const statusCode = connectionTest.connected ? 200 : 503;
    res.status(statusCode).json(createResponse(connectionTest.connected, databaseData));
    
  } catch (error) {
    console.error('Database monitoring failed:', error);
    res.status(500).json(createResponse(false, null, 'Database monitoring failed'));
  }
});

/**
 * Error tracking and recent errors
 * GET /api/monitoring/errors
 */
router.get('/errors', async (req, res) => {
  try {
    // For now, return a placeholder structure
    // In a full implementation, this would read from error logs or error tracking system
    const errorData = {
      recentErrors: [],
      errorCounts: {
        last24Hours: 0,
        lastWeek: 0,
        lastMonth: 0
      },
      errorTypes: {},
      lastError: null
    };
    
    res.json(createResponse(true, errorData));
    
  } catch (error) {
    console.error('Error tracking failed:', error);
    res.status(500).json(createResponse(false, null, 'Error tracking failed'));
  }
});

/**
 * Comprehensive system status endpoint
 * GET /api/monitoring/status
 */
router.get('/status', async (req, res) => {
  try {
    const uptime = getSystemUptime();
    const memory = getMemoryUsage();
    const cpu = getCPUUsage();
    const database = await testDatabaseConnection();
    const databaseStats = await getDatabaseStats();
    
    const statusData = {
      overall: {
        status: database.connected ? 'healthy' : 'degraded',
        uptime: uptime,
        lastCheck: new Date().toISOString()
      },
      system: {
        memory: memory,
        cpu: cpu,
        platform: process.platform,
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development'
      },
      database: {
        connection: database,
        statistics: databaseStats
      },
      application: {
        version: process.env.npm_package_version || '1.0.0',
        name: process.env.npm_package_name || 'singapore-phone-detect',
        pid: process.pid
      }
    };
    
    const statusCode = database.connected ? 200 : 503;
    res.status(statusCode).json(createResponse(database.connected, statusData));
    
  } catch (error) {
    console.error('Status check failed:', error);
    res.status(500).json(createResponse(false, null, 'Status check failed'));
  }
});

/**
 * Application performance and file processing statistics
 * GET /api/monitoring/performance
 */
router.get('/performance', async (req, res) => {
  try {
    const fileStats = await databaseManager.getFileStats();
    const duplicateStats = await databaseManager.getDuplicateHandlingStats();
    const tableStats = await databaseManager.getTableStats();
    
    const performanceData = {
      fileProcessing: {
        totalFiles: fileStats.totalFiles,
        processedFiles: fileStats.processedFiles,
        pendingFiles: fileStats.pendingFiles,
        failedFiles: fileStats.failedFiles,
        totalSize: fileStats.totalSize,
        totalRecordsExtracted: fileStats.totalRecordsExtracted,
        processingRate: fileStats.totalFiles > 0 ? 
          Math.round((fileStats.processedFiles / fileStats.totalFiles) * 100) : 0
      },
      duplicateHandling: duplicateStats,
      database: {
        backupTableRecords: tableStats.backupTable,
        checkTableRecords: tableStats.checkTable,
        validatedPhones: tableStats.validatedPhones,
        invalidPhones: tableStats.invalidPhones
      },
      system: {
        uptime: getSystemUptime(),
        memory: getMemoryUsage(),
        cpu: getCPUUsage()
      }
    };
    
    res.json(createResponse(true, performanceData));
    
  } catch (error) {
    console.error('Performance monitoring failed:', error);
    res.status(500).json(createResponse(false, null, 'Performance monitoring failed'));
  }
});

module.exports = router;