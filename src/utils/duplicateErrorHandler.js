/**
 * Comprehensive Error Handling Utility for Duplicate Visual Styling System
 * Provides graceful degradation, fallback mechanisms, and user-friendly error messages
 */

class DuplicateErrorHandler {
    constructor() {
        this.errorStats = {
            detectionErrors: 0,
            stylingErrors: 0,
            fallbacksUsed: 0,
            gracefulDegradations: 0,
            lastErrorTimestamp: null,
            errorTypes: {}
        };

        this.config = {
            enableGracefulDegradation: true,
            enableFallbacks: true,
            maxRetries: 3,
            retryDelay: 1000,
            logErrors: true,
            userFriendlyMessages: true
        };
    }

    /**
     * Handle duplicate detection service errors with graceful degradation
     * @param {Error} error - The error that occurred
     * @param {Array} records - Records being processed
     * @param {Object} context - Additional context information
     * @returns {Object} Error handling result
     */
    handleDuplicateDetectionError(error, records = [], context = {}) {
        this.updateErrorStats('detection', error);

        const errorResult = {
            success: false,
            duplicateInfo: null,
            errorHandling: {
                hasErrors: true,
                originalError: error.message,
                errorType: error.constructor.name,
                timestamp: new Date().toISOString(),
                context: context.operation || 'duplicate_detection'
            }
        };

        if (this.config.logErrors) {
            console.error(`Duplicate detection error in ${context.operation || 'unknown'}:`, error);
        }

        // Try graceful degradation
        if (this.config.enableGracefulDegradation) {
            try {
                const fallbackResult = this.createFallbackDuplicateResult(records, error);
                errorResult.success = true;
                errorResult.duplicateInfo = fallbackResult;
                errorResult.errorHandling.gracefulDegradation = true;
                errorResult.errorHandling.fallbackMethod = fallbackResult.fallbackMethod;

                this.errorStats.gracefulDegradations++;

                if (this.config.logErrors) {
                    // logging removed
                }

                return errorResult;

            } catch (fallbackError) {
                errorResult.errorHandling.fallbackError = fallbackError.message;

                if (this.config.logErrors) {
                    console.error('Graceful degradation also failed:', fallbackError);
                }
            }
        }

        // If graceful degradation is disabled or failed, return error result
        errorResult.userMessage = this.createUserFriendlyMessage('detection_failed', {
            recordCount: records.length,
            error: error.message
        });

        return errorResult;
    }

    /**
     * Handle duplicate styling errors with fallback mechanisms
     * @param {Error} error - The error that occurred
     * @param {Object} stylingContext - Styling context information
     * @returns {Object} Error handling result
     */
    handleDuplicateStylingError(error, stylingContext = {}) {
        this.updateErrorStats('styling', error);

        const errorResult = {
            success: false,
            stylingApplied: false,
            errorHandling: {
                hasErrors: true,
                originalError: error.message,
                errorType: error.constructor.name,
                timestamp: new Date().toISOString(),
                context: stylingContext.operation || 'duplicate_styling'
            }
        };

        if (this.config.logErrors) {
            console.error(`Duplicate styling error in ${stylingContext.operation || 'unknown'}:`, error);
        }

        // Try fallback styling
        if (this.config.enableFallbacks) {
            try {
                const fallbackResult = this.applyFallbackStyling(stylingContext);
                errorResult.success = true;
                errorResult.stylingApplied = fallbackResult.applied;
                errorResult.errorHandling.fallbackUsed = true;
                errorResult.errorHandling.fallbackMethod = fallbackResult.method;

                this.errorStats.fallbacksUsed++;

                if (this.config.logErrors) {
                    // logging removed
                }

                return errorResult;

            } catch (fallbackError) {
                errorResult.errorHandling.fallbackError = fallbackError.message;

                if (this.config.logErrors) {
                    console.error('Fallback styling also failed:', fallbackError);
                }
            }
        }

        // Create user-friendly error message
        errorResult.userMessage = this.createUserFriendlyMessage('styling_failed', {
            operation: stylingContext.operation,
            error: error.message
        });

        return errorResult;
    }

    /**
     * Create fallback duplicate result when detection fails
     * @param {Array} records - Records to process
     * @param {Error} originalError - The original error
     * @returns {Object} Fallback duplicate result
     */
    createFallbackDuplicateResult(records, originalError) {
        const fallbackResult = {
            duplicatePhoneNumbers: new Set(),
            duplicateRecordIds: [],
            duplicateRecordMap: new Map(),
            phoneMap: new Map(),
            totalRecords: records.length,
            duplicateCount: 0,
            uniquePhoneCount: 0,
            duplicatePhoneCount: 0,
            fallbackMethod: 'empty_result',
            errorHandling: {
                fallbackUsed: true,
                originalError: originalError.message,
                timestamp: new Date().toISOString()
            }
        };

        // Try basic duplicate detection as fallback
        if (this.config.enableFallbacks && Array.isArray(records) && records.length > 0) {
            try {
                const basicResult = this.basicDuplicateDetection(records);
                if (basicResult.duplicateCount > 0) {
                    Object.assign(fallbackResult, basicResult);
                    fallbackResult.fallbackMethod = 'basic_detection';
                }
            } catch (basicError) {
                // If basic detection also fails, stick with empty result
                fallbackResult.errorHandling.basicDetectionError = basicError.message;
            }
        }

        return fallbackResult;
    }

    /**
     * Basic duplicate detection fallback method
     * @param {Array} records - Records to check for duplicates
     * @returns {Object} Basic duplicate detection result
     */
    basicDuplicateDetection(records) {
        const phoneGroups = {};
        const duplicateRecordIds = [];
        const duplicatePhoneNumbers = new Set();
        const duplicateRecordMap = new Map();

        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            const phone = this.extractPhoneNumber(record);
            const recordId = this.extractRecordId(record);

            if (phone && recordId) {
                // Simple phone normalization
                const normalizedPhone = phone.replace(/[\s\-\(\)\+]/g, '').toLowerCase();

                if (!phoneGroups[normalizedPhone]) {
                    phoneGroups[normalizedPhone] = [];
                }
                phoneGroups[normalizedPhone].push(recordId);
            }
        }

        // Identify duplicates
        for (const [phone, recordIds] of Object.entries(phoneGroups)) {
            if (recordIds.length > 1) {
                duplicatePhoneNumbers.add(phone);
                duplicateRecordIds.push(...recordIds);
                duplicateRecordMap.set(phone, recordIds);
            }
        }

        return {
            duplicatePhoneNumbers,
            duplicateRecordIds,
            duplicateRecordMap,
            totalRecords: records.length,
            duplicateCount: duplicateRecordIds.length,
            uniquePhoneCount: Object.keys(phoneGroups).length,
            duplicatePhoneCount: duplicatePhoneNumbers.size
        };
    }

    /**
     * Apply fallback styling when main styling fails
     * @param {Object} stylingContext - Styling context
     * @returns {Object} Fallback styling result
     */
    applyFallbackStyling(stylingContext) {
        const fallbackResult = {
            applied: false,
            method: 'none',
            details: {}
        };

        // For web interface fallback
        if (stylingContext.type === 'web') {
            try {
                // Apply basic CSS class without complex logic
                if (stylingContext.elements && Array.isArray(stylingContext.elements)) {
                    let appliedCount = 0;

                    for (const element of stylingContext.elements) {
                        try {
                            if (element && element.classList) {
                                element.classList.add('duplicate-phone-fallback');
                                appliedCount++;
                            }
                        } catch (elementError) {
                            // Skip problematic elements
                        }
                    }

                    fallbackResult.applied = appliedCount > 0;
                    fallbackResult.method = 'basic_css_class';
                    fallbackResult.details.elementsStyled = appliedCount;
                }
            } catch (webFallbackError) {
                fallbackResult.method = 'web_fallback_failed';
                fallbackResult.details.error = webFallbackError.message;
            }
        }

        // For Excel export fallback
        if (stylingContext.type === 'excel') {
            try {
                // Skip duplicate styling and continue with normal styling
                fallbackResult.applied = true;
                fallbackResult.method = 'skip_duplicate_styling';
                fallbackResult.details.message = 'Continuing Excel export without duplicate highlighting';
            } catch (excelFallbackError) {
                fallbackResult.method = 'excel_fallback_failed';
                fallbackResult.details.error = excelFallbackError.message;
            }
        }

        return fallbackResult;
    }

    /**
     * Create user-friendly error messages
     * @param {string} errorType - Type of error
     * @param {Object} context - Error context
     * @returns {string} User-friendly error message
     */
    createUserFriendlyMessage(errorType, context = {}) {
        if (!this.config.userFriendlyMessages) {
            return context.error || 'An error occurred';
        }

        const messages = {
            detection_failed: `Unable to detect duplicate phone numbers${context.recordCount ? ` for ${context.recordCount} records` : ''}. The system will continue without duplicate highlighting.`,
            styling_failed: `Unable to apply duplicate highlighting${context.operation ? ` in ${context.operation}` : ''}. The data export/display will continue without duplicate styling.`,
            service_unavailable: 'The duplicate detection service is temporarily unavailable. Please try again later.',
            network_error: 'Network connection issue prevented duplicate detection. Please check your connection.',
            data_error: 'Invalid data format prevented duplicate detection. Please verify your data.',
            performance_error: 'Duplicate detection timed out due to large dataset. Consider processing smaller batches.'
        };

        let message = messages[errorType] || messages.detection_failed;

        // Add helpful suggestions
        if (context.recordCount > 10000) {
            message += ' For large datasets, consider processing in smaller batches for better performance.';
        }

        return message;
    }

    /**
     * Extract phone number from record with error handling
     * @param {Object} record - Record object
     * @returns {string|null} Phone number or null
     */
    extractPhoneNumber(record) {
        try {
            return record.phone || record.Phone || record.phoneNumber ||
                record.phone_number || record.PhoneNumber ||
                record.mobile || record.Mobile || null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Extract record ID from record with error handling
     * @param {Object} record - Record object
     * @returns {string|null} Record ID or null
     */
    extractRecordId(record) {
        try {
            return record.id || record.Id || record.ID ||
                record.recordId || record.record_id ||
                String(record.index || 0);
        } catch (error) {
            return null;
        }
    }

    /**
     * Update error statistics
     * @param {string} errorType - Type of error
     * @param {Error} error - Error object
     */
    updateErrorStats(errorType, error) {
        this.errorStats.lastErrorTimestamp = new Date().toISOString();

        if (errorType === 'detection') {
            this.errorStats.detectionErrors++;
        } else if (errorType === 'styling') {
            this.errorStats.stylingErrors++;
        }

        const errorKey = error.code || error.constructor.name || 'unknown';
        this.errorStats.errorTypes[errorKey] = (this.errorStats.errorTypes[errorKey] || 0) + 1;
    }

    /**
     * Get error statistics
     * @returns {Object} Error statistics
     */
    getErrorStats() {
        return {
            ...this.errorStats,
            totalErrors: this.errorStats.detectionErrors + this.errorStats.stylingErrors,
            fallbackRate: this.errorStats.fallbacksUsed > 0 ?
                (this.errorStats.fallbacksUsed / (this.errorStats.detectionErrors + this.errorStats.stylingErrors)) * 100 : 0
        };
    }

    /**
     * Reset error statistics
     */
    resetErrorStats() {
        this.errorStats = {
            detectionErrors: 0,
            stylingErrors: 0,
            fallbacksUsed: 0,
            gracefulDegradations: 0,
            lastErrorTimestamp: null,
            errorTypes: {}
        };
    }

    /**
     * Configure error handling behavior
     * @param {Object} config - Configuration options
     */
    configure(config) {
        this.config = {
            ...this.config,
            ...config
        };
    }

    /**
     * Check if system is healthy based on error rates
     * @returns {Object} Health check result
     */
    getHealthStatus() {
        const stats = this.getErrorStats();
        const totalOperations = stats.totalErrors + stats.fallbacksUsed + stats.gracefulDegradations;

        let status = 'healthy';
        let message = 'Duplicate detection system is operating normally';

        if (totalOperations > 0) {
            const errorRate = (stats.totalErrors / totalOperations) * 100;

            if (errorRate > 50) {
                status = 'unhealthy';
                message = 'High error rate detected in duplicate detection system';
            } else if (errorRate > 20) {
                status = 'degraded';
                message = 'Elevated error rate in duplicate detection system';
            } else if (stats.fallbacksUsed > 0 || stats.gracefulDegradations > 0) {
                status = 'degraded';
                message = 'Duplicate detection system is using fallback mechanisms';
            }
        }

        return {
            status,
            message,
            errorRate: totalOperations > 0 ? (stats.totalErrors / totalOperations) * 100 : 0,
            fallbackRate: stats.fallbackRate,
            lastError: stats.lastErrorTimestamp,
            recommendations: this.getHealthRecommendations(stats)
        };
    }

    /**
     * Get health recommendations based on error patterns
     * @param {Object} stats - Error statistics
     * @returns {Array} Array of recommendations
     */
    getHealthRecommendations(stats) {
        const recommendations = [];

        if (stats.detectionErrors > stats.stylingErrors * 2) {
            recommendations.push('Consider optimizing duplicate detection algorithms or database queries');
        }

        if (stats.stylingErrors > stats.detectionErrors * 2) {
            recommendations.push('Review styling application logic and error handling');
        }

        if (stats.fallbacksUsed > 10) {
            recommendations.push('Investigate root causes of failures requiring fallback mechanisms');
        }

        if (stats.errorTypes.NetworkError || stats.errorTypes.ECONNREFUSED) {
            recommendations.push('Check database connectivity and network stability');
        }

        if (stats.errorTypes.TimeoutError || stats.errorTypes.ETIMEDOUT) {
            recommendations.push('Consider optimizing query performance or increasing timeout limits');
        }

        return recommendations;
    }
}

module.exports = DuplicateErrorHandler;
