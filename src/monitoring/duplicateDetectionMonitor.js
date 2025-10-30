/**
 * Duplicate Detection Performance Monitor
 * 
 * Implements monitoring for duplicate detection performance metrics
 * and creates alerts for unusual duplicate patterns or performance issues
 * as specified in task 9.2
 */

const fs = require('fs');
const path = require('path');

class DuplicateDetectionMonitor {
    constructor() {
        this.performanceThresholds = {
            maxProcessingTime: 30000, // 30 seconds
            maxMemoryUsage: 100 * 1024 * 1024, // 100MB
            maxDuplicateCheckTime: 5000, // 5 seconds
            minRecordsPerSecond: 10,
            maxDuplicatePercentage: 95, // Alert if > 95% duplicates
            maxErrorRate: 10 // Alert if > 10% error rate
        };

        this.alertThresholds = {
            performanceDegradation: 1.5, // Alert if 50% slower
            memoryLeak: 1.3, // Alert if 30% more memory
            unusualDuplicateRate: 90, // Alert if > 90% duplicates
            highErrorRate: 5 // Alert if > 5% errors
        };

        this.metrics = {
            performanceHistory: [],
            memoryHistory: [],
            duplicateRateHistory: [],
            errorHistory: [],
            alerts: []
        };

        this.monitoringEnabled = true;
        this.alertsEnabled = true;
    }

    /**
     * Monitor file processing performance
     * @param {Object} processingResult - Result from file processing
     * @param {Object} performanceData - Performance metrics
     */
    monitorFileProcessing(processingResult, performanceData) {
        if (!this.monitoringEnabled) return;

        const timestamp = new Date().toISOString();
        
        // Record performance metrics
        const performanceMetric = {
            timestamp,
            processingTime: performanceData.processingTime,
            recordCount: performanceData.recordCount,
            recordsPerSecond: performanceData.recordsPerSecond,
            memoryUsed: performanceData.memoryUsed,
            fileSize: performanceData.fileSize,
            duplicatePercentage: processingResult.duplicateHandling?.duplicatePercentage || 0,
            duplicatesFound: processingResult.duplicateHandling?.duplicatesFound || 0,
            newRecordsStored: processingResult.duplicateHandling?.newRecordsStored || 0
        };

        this.metrics.performanceHistory.push(performanceMetric);

        // Check for performance alerts
        this.checkPerformanceAlerts(performanceMetric);

        // Maintain history size (keep last 1000 entries)
        if (this.metrics.performanceHistory.length > 1000) {
            this.metrics.performanceHistory.shift();
        }

        return performanceMetric;
    }

    /**
     * Monitor duplicate detection service performance
     * @param {Object} serviceMetrics - Metrics from DuplicateDetectionService
     */
    monitorDuplicateDetectionService(serviceMetrics) {
        if (!this.monitoringEnabled) return;

        const timestamp = new Date().toISOString();
        
        const duplicateMetric = {
            timestamp,
            totalChecks: serviceMetrics.totalChecks,
            duplicatesFound: serviceMetrics.duplicatesFound,
            averageCheckTime: serviceMetrics.averageCheckTimeMs,
            duplicateRate: serviceMetrics.duplicateRate,
            cacheHitRate: serviceMetrics.cacheHitRate,
            errorRate: serviceMetrics.errorRate || 0
        };

        this.metrics.duplicateRateHistory.push(duplicateMetric);

        // Check for duplicate detection alerts
        this.checkDuplicateDetectionAlerts(duplicateMetric);

        // Maintain history size
        if (this.metrics.duplicateRateHistory.length > 1000) {
            this.metrics.duplicateRateHistory.shift();
        }

        return duplicateMetric;
    }

    /**
     * Check for performance-related alerts
     * @param {Object} metric - Current performance metric
     */
    checkPerformanceAlerts(metric) {
        if (!this.alertsEnabled) return;

        const alerts = [];

        // Processing time alert
        if (metric.processingTime > this.performanceThresholds.maxProcessingTime) {
            alerts.push({
                type: 'slow_processing',
                severity: 'warning',
                message: `Processing time (${metric.processingTime}ms) exceeds threshold (${this.performanceThresholds.maxProcessingTime}ms)`,
                metric: 'processingTime',
                value: metric.processingTime,
                threshold: this.performanceThresholds.maxProcessingTime,
                timestamp: metric.timestamp
            });
        }

        // Memory usage alert
        if (metric.memoryUsed > this.performanceThresholds.maxMemoryUsage) {
            alerts.push({
                type: 'high_memory_usage',
                severity: 'warning',
                message: `Memory usage (${Math.round(metric.memoryUsed / 1024 / 1024)}MB) exceeds threshold (${Math.round(this.performanceThresholds.maxMemoryUsage / 1024 / 1024)}MB)`,
                metric: 'memoryUsed',
                value: metric.memoryUsed,
                threshold: this.performanceThresholds.maxMemoryUsage,
                timestamp: metric.timestamp
            });
        }

        // Records per second alert
        if (metric.recordsPerSecond < this.performanceThresholds.minRecordsPerSecond) {
            alerts.push({
                type: 'low_throughput',
                severity: 'warning',
                message: `Processing throughput (${metric.recordsPerSecond.toFixed(2)} records/sec) below threshold (${this.performanceThresholds.minRecordsPerSecond} records/sec)`,
                metric: 'recordsPerSecond',
                value: metric.recordsPerSecond,
                threshold: this.performanceThresholds.minRecordsPerSecond,
                timestamp: metric.timestamp
            });
        }

        // Unusual duplicate rate alert
        if (metric.duplicatePercentage > this.alertThresholds.unusualDuplicateRate) {
            alerts.push({
                type: 'unusual_duplicate_rate',
                severity: 'info',
                message: `Unusually high duplicate rate (${metric.duplicatePercentage}%) detected`,
                metric: 'duplicatePercentage',
                value: metric.duplicatePercentage,
                threshold: this.alertThresholds.unusualDuplicateRate,
                timestamp: metric.timestamp
            });
        }

        // Performance degradation alert
        if (this.metrics.performanceHistory.length >= 5) {
            const recentMetrics = this.metrics.performanceHistory.slice(-5);
            const olderMetrics = this.metrics.performanceHistory.slice(-10, -5);
            
            if (olderMetrics.length > 0) {
                const recentAvg = recentMetrics.reduce((sum, m) => sum + m.processingTime, 0) / recentMetrics.length;
                const olderAvg = olderMetrics.reduce((sum, m) => sum + m.processingTime, 0) / olderMetrics.length;
                
                if (recentAvg > olderAvg * this.alertThresholds.performanceDegradation) {
                    alerts.push({
                        type: 'performance_degradation',
                        severity: 'warning',
                        message: `Performance degradation detected: recent average (${recentAvg.toFixed(0)}ms) is ${((recentAvg / olderAvg - 1) * 100).toFixed(1)}% slower than previous average (${olderAvg.toFixed(0)}ms)`,
                        metric: 'processingTime',
                        recentAverage: recentAvg,
                        previousAverage: olderAvg,
                        degradationPercentage: ((recentAvg / olderAvg - 1) * 100),
                        timestamp: metric.timestamp
                    });
                }
            }
        }

        // Store alerts
        for (const alert of alerts) {
            this.addAlert(alert);
        }

        return alerts;
    }

    /**
     * Check for duplicate detection service alerts
     * @param {Object} metric - Current duplicate detection metric
     */
    checkDuplicateDetectionAlerts(metric) {
        if (!this.alertsEnabled) return;

        const alerts = [];

        // Slow duplicate detection alert
        if (metric.averageCheckTime > this.performanceThresholds.maxDuplicateCheckTime) {
            alerts.push({
                type: 'slow_duplicate_detection',
                severity: 'warning',
                message: `Duplicate detection is slow (${metric.averageCheckTime}ms average) - consider optimizing queries or enabling caching`,
                metric: 'averageCheckTime',
                value: metric.averageCheckTime,
                threshold: this.performanceThresholds.maxDuplicateCheckTime,
                timestamp: metric.timestamp
            });
        }

        // High error rate alert
        if (metric.errorRate > this.alertThresholds.highErrorRate) {
            alerts.push({
                type: 'high_error_rate',
                severity: 'error',
                message: `High error rate in duplicate detection (${metric.errorRate}%) - investigate database connectivity or query issues`,
                metric: 'errorRate',
                value: metric.errorRate,
                threshold: this.alertThresholds.highErrorRate,
                timestamp: metric.timestamp
            });
        }

        // Low cache hit rate alert (if caching is enabled)
        if (metric.cacheHitRate !== undefined && metric.cacheHitRate < 50 && metric.totalChecks > 100) {
            alerts.push({
                type: 'low_cache_efficiency',
                severity: 'info',
                message: `Low cache hit rate (${metric.cacheHitRate}%) - consider adjusting cache settings or data patterns`,
                metric: 'cacheHitRate',
                value: metric.cacheHitRate,
                threshold: 50,
                timestamp: metric.timestamp
            });
        }

        // Store alerts
        for (const alert of alerts) {
            this.addAlert(alert);
        }

        return alerts;
    }

    /**
     * Add alert to the system
     * @param {Object} alert - Alert object
     */
    addAlert(alert) {
        this.metrics.alerts.push(alert);

        // Log alert
        console.warn(`[DUPLICATE_MONITOR_ALERT] ${alert.severity.toUpperCase()}: ${alert.message}`);

        // Maintain alert history (keep last 500 alerts)
        if (this.metrics.alerts.length > 500) {
            this.metrics.alerts.shift();
        }

        // Trigger alert handlers if configured
        this.triggerAlertHandlers(alert);
    }

    /**
     * Trigger alert handlers (email, webhook, etc.)
     * @param {Object} alert - Alert object
     */
    triggerAlertHandlers(alert) {
        // Placeholder for alert handler integration
        // In production, this could send emails, webhooks, or integrate with monitoring systems
        
        if (process.env.ALERT_WEBHOOK_URL && alert.severity === 'error') {
            // Send webhook for critical alerts
            this.sendWebhookAlert(alert).catch(error => {
                console.error('Failed to send webhook alert:', error.message);
            });
        }
    }

    /**
     * Send webhook alert (placeholder implementation)
     * @param {Object} alert - Alert object
     */
    async sendWebhookAlert(alert) {
        // Placeholder for webhook implementation
        console.log(`Webhook alert would be sent: ${alert.message}`);
    }

    /**
     * Generate performance report
     * @param {string} timeRange - Time range for report ('1h', '24h', '7d', '30d')
     * @returns {Object} Performance report
     */
    generatePerformanceReport(timeRange = '24h') {
        const now = new Date();
        const timeRangeMs = this.parseTimeRange(timeRange);
        const cutoffTime = new Date(now.getTime() - timeRangeMs);

        // Filter metrics by time range
        const recentPerformance = this.metrics.performanceHistory.filter(
            m => new Date(m.timestamp) >= cutoffTime
        );
        const recentDuplicateMetrics = this.metrics.duplicateRateHistory.filter(
            m => new Date(m.timestamp) >= cutoffTime
        );
        const recentAlerts = this.metrics.alerts.filter(
            a => new Date(a.timestamp) >= cutoffTime
        );

        const report = {
            timestamp: now.toISOString(),
            timeRange: timeRange,
            summary: {
                totalProcessingOperations: recentPerformance.length,
                totalDuplicateDetectionOperations: recentDuplicateMetrics.length,
                totalAlerts: recentAlerts.length,
                criticalAlerts: recentAlerts.filter(a => a.severity === 'error').length,
                warningAlerts: recentAlerts.filter(a => a.severity === 'warning').length
            },
            performance: {
                averageProcessingTime: this.calculateAverage(recentPerformance, 'processingTime'),
                averageRecordsPerSecond: this.calculateAverage(recentPerformance, 'recordsPerSecond'),
                averageMemoryUsage: this.calculateAverage(recentPerformance, 'memoryUsed'),
                averageDuplicatePercentage: this.calculateAverage(recentPerformance, 'duplicatePercentage'),
                maxProcessingTime: Math.max(...recentPerformance.map(m => m.processingTime), 0),
                minProcessingTime: Math.min(...recentPerformance.map(m => m.processingTime), Infinity)
            },
            duplicateDetection: {
                averageCheckTime: this.calculateAverage(recentDuplicateMetrics, 'averageCheckTime'),
                averageDuplicateRate: this.calculateAverage(recentDuplicateMetrics, 'duplicateRate'),
                averageCacheHitRate: this.calculateAverage(recentDuplicateMetrics, 'cacheHitRate'),
                averageErrorRate: this.calculateAverage(recentDuplicateMetrics, 'errorRate'),
                totalDuplicatesFound: recentDuplicateMetrics.reduce((sum, m) => sum + (m.duplicatesFound || 0), 0)
            },
            alerts: {
                byType: this.groupAlertsByType(recentAlerts),
                bySeverity: this.groupAlertsBySeverity(recentAlerts),
                recent: recentAlerts.slice(-10) // Last 10 alerts
            },
            recommendations: this.generateRecommendations(recentPerformance, recentDuplicateMetrics, recentAlerts),
            thresholds: this.performanceThresholds
        };

        return report;
    }

    /**
     * Parse time range string to milliseconds
     * @param {string} timeRange - Time range string
     * @returns {number} Time range in milliseconds
     */
    parseTimeRange(timeRange) {
        const timeRanges = {
            '1h': 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000,
            '30d': 30 * 24 * 60 * 60 * 1000
        };

        return timeRanges[timeRange] || timeRanges['24h'];
    }

    /**
     * Calculate average of a metric
     * @param {Array} metrics - Array of metrics
     * @param {string} field - Field to calculate average for
     * @returns {number} Average value
     */
    calculateAverage(metrics, field) {
        if (metrics.length === 0) return 0;
        const values = metrics.map(m => m[field]).filter(v => v !== undefined && v !== null);
        if (values.length === 0) return 0;
        return values.reduce((sum, v) => sum + v, 0) / values.length;
    }

    /**
     * Group alerts by type
     * @param {Array} alerts - Array of alerts
     * @returns {Object} Alerts grouped by type
     */
    groupAlertsByType(alerts) {
        const grouped = {};
        for (const alert of alerts) {
            if (!grouped[alert.type]) {
                grouped[alert.type] = [];
            }
            grouped[alert.type].push(alert);
        }
        return grouped;
    }

    /**
     * Group alerts by severity
     * @param {Array} alerts - Array of alerts
     * @returns {Object} Alerts grouped by severity
     */
    groupAlertsBySeverity(alerts) {
        const grouped = { error: [], warning: [], info: [] };
        for (const alert of alerts) {
            if (grouped[alert.severity]) {
                grouped[alert.severity].push(alert);
            }
        }
        return grouped;
    }

    /**
     * Generate recommendations based on metrics and alerts
     * @param {Array} performanceMetrics - Performance metrics
     * @param {Array} duplicateMetrics - Duplicate detection metrics
     * @param {Array} alerts - Recent alerts
     * @returns {Array} Array of recommendations
     */
    generateRecommendations(performanceMetrics, duplicateMetrics, alerts) {
        const recommendations = [];

        // Performance recommendations
        const avgProcessingTime = this.calculateAverage(performanceMetrics, 'processingTime');
        if (avgProcessingTime > 15000) {
            recommendations.push({
                type: 'performance',
                priority: 'high',
                message: 'Consider optimizing file processing pipeline or increasing server resources',
                reason: `Average processing time is ${(avgProcessingTime / 1000).toFixed(1)} seconds`
            });
        }

        // Memory recommendations
        const avgMemoryUsage = this.calculateAverage(performanceMetrics, 'memoryUsed');
        if (avgMemoryUsage > 50 * 1024 * 1024) {
            recommendations.push({
                type: 'memory',
                priority: 'medium',
                message: 'Consider implementing streaming processing for large files',
                reason: `Average memory usage is ${(avgMemoryUsage / 1024 / 1024).toFixed(1)}MB`
            });
        }

        // Duplicate detection recommendations
        const avgCheckTime = this.calculateAverage(duplicateMetrics, 'averageCheckTime');
        if (avgCheckTime > 2000) {
            recommendations.push({
                type: 'duplicate_detection',
                priority: 'medium',
                message: 'Enable query caching and database index optimization for duplicate detection',
                reason: `Average duplicate check time is ${avgCheckTime.toFixed(0)}ms`
            });
        }

        // Alert-based recommendations
        const errorAlerts = alerts.filter(a => a.severity === 'error');
        if (errorAlerts.length > 0) {
            recommendations.push({
                type: 'reliability',
                priority: 'high',
                message: 'Investigate and resolve error conditions to improve system reliability',
                reason: `${errorAlerts.length} error alerts in the selected time range`
            });
        }

        return recommendations;
    }

    /**
     * Export monitoring data for external analysis
     * @param {string} format - Export format ('json', 'csv')
     * @returns {string} Exported data
     */
    exportMonitoringData(format = 'json') {
        const data = {
            timestamp: new Date().toISOString(),
            performanceHistory: this.metrics.performanceHistory,
            duplicateRateHistory: this.metrics.duplicateRateHistory,
            alerts: this.metrics.alerts,
            thresholds: this.performanceThresholds
        };

        if (format === 'json') {
            return JSON.stringify(data, null, 2);
        } else if (format === 'csv') {
            return this.convertToCSV(data);
        }

        throw new Error(`Unsupported export format: ${format}`);
    }

    /**
     * Convert monitoring data to CSV format
     * @param {Object} data - Monitoring data
     * @returns {string} CSV formatted data
     */
    convertToCSV(data) {
        // Simple CSV conversion for performance metrics
        const headers = ['timestamp', 'processingTime', 'recordCount', 'recordsPerSecond', 'memoryUsed', 'duplicatePercentage'];
        const rows = [headers.join(',')];

        for (const metric of data.performanceHistory) {
            const row = headers.map(header => metric[header] || '').join(',');
            rows.push(row);
        }

        return rows.join('\n');
    }

    /**
     * Save monitoring report to file
     * @param {string} filePath - File path to save report
     * @param {string} timeRange - Time range for report
     */
    saveMonitoringReport(filePath, timeRange = '24h') {
        const report = this.generatePerformanceReport(timeRange);
        fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
        console.log(`Monitoring report saved to: ${filePath}`);
    }

    /**
     * Configure monitoring thresholds
     * @param {Object} thresholds - New threshold values
     */
    configureThresholds(thresholds) {
        this.performanceThresholds = {
            ...this.performanceThresholds,
            ...thresholds
        };
        console.log('Monitoring thresholds updated:', this.performanceThresholds);
    }

    /**
     * Enable or disable monitoring
     * @param {boolean} enabled - Whether monitoring is enabled
     */
    setMonitoringEnabled(enabled) {
        this.monitoringEnabled = enabled;
        console.log(`Monitoring ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Enable or disable alerts
     * @param {boolean} enabled - Whether alerts are enabled
     */
    setAlertsEnabled(enabled) {
        this.alertsEnabled = enabled;
        console.log(`Alerts ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Get current monitoring status
     * @returns {Object} Monitoring status
     */
    getMonitoringStatus() {
        return {
            monitoringEnabled: this.monitoringEnabled,
            alertsEnabled: this.alertsEnabled,
            performanceHistoryCount: this.metrics.performanceHistory.length,
            duplicateHistoryCount: this.metrics.duplicateRateHistory.length,
            alertCount: this.metrics.alerts.length,
            thresholds: this.performanceThresholds
        };
    }
}

module.exports = DuplicateDetectionMonitor;