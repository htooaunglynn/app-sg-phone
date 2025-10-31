/**
 * Frontend Error Handling Utility for Duplicate Visual Styling System
 * Provides graceful degradation, fallback mechanisms, and user-friendly error messages for browser environment
 */

class FrontendDuplicateErrorHandler {
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
            userFriendlyMessages: true,
            showUserNotifications: false
        };

        // Initialize error handling
        this.initialize();
    }

    /**
     * Initialize error handling
     */
    initialize() {
        // Set up global error handlers for duplicate-related errors
        if (typeof window !== 'undefined') {
            window.addEventListener('error', (event) => {
                if (this.isDuplicateRelatedError(event.error)) {
                    this.handleGlobalError(event.error);
                }
            });

            window.addEventListener('unhandledrejection', (event) => {
                if (this.isDuplicateRelatedError(event.reason)) {
                    this.handleGlobalError(event.reason);
                }
            });
        }
    }

    /**
     * Check if error is related to duplicate detection/styling
     * @param {Error} error - Error to check
     * @returns {boolean} True if duplicate-related
     */
    isDuplicateRelatedError(error) {
        if (!error || !error.message) return false;
        
        const duplicateKeywords = [
            'duplicate', 'duplicateDetection', 'duplicatePhone', 
            'duplicateStyle', 'duplicateData', 'FrontendDuplicateDetectionService',
            'DuplicateDataManager'
        ];
        
        return duplicateKeywords.some(keyword => 
            error.message.toLowerCase().includes(keyword.toLowerCase()) ||
            (error.stack && error.stack.includes(keyword))
        );
    }

    /**
     * Handle global duplicate-related errors
     * @param {Error} error - The error that occurred
     */
    handleGlobalError(error) {
        console.warn('Global duplicate-related error caught:', error);
        this.updateErrorStats('global', error);
        
        if (this.config.showUserNotifications) {
            this.showUserNotification('error', 
                'Duplicate detection encountered an issue but will continue working normally.'
            );
        }
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
            console.error(`Frontend duplicate detection error in ${context.operation || 'unknown'}:`, error);
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
                    console.log(`Frontend graceful degradation applied: ${fallbackResult.fallbackMethod}`);
                }
                
                return errorResult;
                
            } catch (fallbackError) {
                errorResult.errorHandling.fallbackError = fallbackError.message;
                
                if (this.config.logErrors) {
                    console.error('Frontend graceful degradation also failed:', fallbackError);
                }
            }
        }

        // Show user notification if enabled
        if (this.config.showUserNotifications) {
            this.showUserNotification('warning', 
                'Duplicate detection is temporarily unavailable but the table will continue to work normally.'
            );
        }

        // Create user-friendly error message
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
            console.error(`Frontend duplicate styling error in ${stylingContext.operation || 'unknown'}:`, error);
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
                    console.log(`Frontend fallback styling applied: ${fallbackResult.method}`);
                }
                
                return errorResult;
                
            } catch (fallbackError) {
                errorResult.errorHandling.fallbackError = fallbackError.message;
                
                if (this.config.logErrors) {
                    console.error('Frontend fallback styling also failed:', fallbackError);
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
     * Basic duplicate detection fallback method for frontend
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
                // Simple phone normalization for frontend
                const normalizedPhone = phone.toString()
                    .replace(/[\s\-\(\)\+]/g, '')
                    .toLowerCase()
                    .trim();
                
                if (normalizedPhone) {
                    if (!phoneGroups[normalizedPhone]) {
                        phoneGroups[normalizedPhone] = [];
                    }
                    phoneGroups[normalizedPhone].push(recordId);
                }
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

        try {
            // Apply basic CSS class without complex logic
            if (stylingContext.elements && Array.isArray(stylingContext.elements)) {
                let appliedCount = 0;
                
                for (const element of stylingContext.elements) {
                    try {
                        if (element && element.classList) {
                            // Remove any existing duplicate classes first
                            element.classList.remove('duplicate-phone-record');
                            // Apply fallback class
                            element.classList.add('duplicate-phone-fallback');
                            appliedCount++;
                        }
                    } catch (elementError) {
                        // Skip problematic elements
                        console.warn('Error applying fallback styling to element:', elementError);
                    }
                }
                
                fallbackResult.applied = appliedCount > 0;
                fallbackResult.method = 'basic_css_class';
                fallbackResult.details.elementsStyled = appliedCount;
                
            } else if (stylingContext.tableElement) {
                // Apply fallback styling to entire table
                try {
                    stylingContext.tableElement.classList.add('duplicate-detection-unavailable');
                    fallbackResult.applied = true;
                    fallbackResult.method = 'table_fallback_class';
                } catch (tableError) {
                    fallbackResult.method = 'table_fallback_failed';
                    fallbackResult.details.error = tableError.message;
                }
            }
            
        } catch (fallbackError) {
            fallbackResult.method = 'fallback_failed';
            fallbackResult.details.error = fallbackError.message;
        }

        return fallbackResult;
    }

    /**
     * Show user notification
     * @param {string} type - Notification type (error, warning, info)
     * @param {string} message - Notification message
     */
    showUserNotification(type, message) {
        // Try different notification methods
        
        // Method 1: Custom notification system (if available)
        if (typeof window !== 'undefined' && window.showNotification) {
            window.showNotification(type, message);
            return;
        }
        
        // Method 2: Toast notification (if available)
        if (typeof window !== 'undefined' && window.toast) {
            window.toast(message, type);
            return;
        }
        
        // Method 3: Console notification as fallback
        const consoleMethod = type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'info';
        console[consoleMethod](`[Duplicate Detection] ${message}`);
        
        // Method 4: Simple alert for critical errors (only if no other method worked)
        if (type === 'error' && this.config.showUserNotifications) {
            // Only show alert for critical errors and if explicitly enabled
            setTimeout(() => {
                if (confirm(`Duplicate Detection Issue: ${message}\n\nClick OK to continue or Cancel to reload the page.`)) {
                    // User chose to continue
                } else {
                    // User chose to reload
                    window.location.reload();
                }
            }, 100);
        }
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
            detection_failed: `Unable to detect duplicate phone numbers${context.recordCount ? ` for ${context.recordCount} records` : ''}. The table will continue to work normally without duplicate highlighting.`,
            styling_failed: `Unable to apply duplicate highlighting${context.operation ? ` in ${context.operation}` : ''}. The table display will continue without duplicate styling.`,
            service_unavailable: 'The duplicate detection service is temporarily unavailable. The table will work normally without duplicate highlighting.',
            network_error: 'Network connection issue prevented duplicate detection. Please refresh the page if the issue persists.',
            data_error: 'Invalid data format prevented duplicate detection. The table will display normally.',
            performance_error: 'Duplicate detection timed out due to large dataset. The table will display without duplicate highlighting.'
        };

        let message = messages[errorType] || messages.detection_failed;

        // Add helpful suggestions for frontend
        if (context.recordCount > 5000) {
            message += ' For better performance with large datasets, consider using filters to reduce the number of displayed records.';
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
     * Get health status for frontend duplicate detection
     * @returns {Object} Health check result
     */
    getHealthStatus() {
        const stats = this.getErrorStats();
        const totalOperations = stats.totalErrors + stats.fallbacksUsed + stats.gracefulDegradations;
        
        let status = 'healthy';
        let message = 'Duplicate detection is working normally';
        
        if (totalOperations > 0) {
            const errorRate = (stats.totalErrors / totalOperations) * 100;
            
            if (errorRate > 50) {
                status = 'unhealthy';
                message = 'Duplicate detection is experiencing frequent errors';
            } else if (errorRate > 20) {
                status = 'degraded';
                message = 'Duplicate detection is experiencing some issues';
            } else if (stats.fallbacksUsed > 0 || stats.gracefulDegradations > 0) {
                status = 'degraded';
                message = 'Duplicate detection is using fallback mechanisms';
            }
        }
        
        return {
            status,
            message,
            errorRate: totalOperations > 0 ? (stats.totalErrors / totalOperations) * 100 : 0,
            fallbackRate: stats.fallbackRate,
            lastError: stats.lastErrorTimestamp
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FrontendDuplicateErrorHandler;
}

// Make available globally in browser
if (typeof window !== 'undefined') {
    window.FrontendDuplicateErrorHandler = FrontendDuplicateErrorHandler;
}