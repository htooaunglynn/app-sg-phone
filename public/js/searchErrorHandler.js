/**
 * Search Error Handler
 * Provides comprehensive error handling for the enhanced search system
 */

class SearchErrorHandler {
    constructor(searchEngine) {
        this.searchEngine = searchEngine;
        this.errorHistory = [];
        this.errorPatterns = new Map();
        this.fallbackStrategies = new Map();
        
        // Error thresholds and configuration
        this.config = {
            maxErrorHistory: 100,
            timeoutThreshold: 5000, // 5 seconds
            retryAttempts: 2,
            retryDelay: 1000, // 1 second
            fallbackSearchLimit: 1000 // Limit fallback searches to prevent performance issues
        };
        
        // Initialize fallback strategies
        this.initializeFallbackStrategies();
        
        // Initialize error patterns for better suggestions
        this.initializeErrorPatterns();
    }

    /**
     * Handle search errors with appropriate recovery strategies
     * @param {Error} error - The error that occurred
     * @param {string} query - Original search query
     * @param {Object} filters - Search filters
     * @param {Object} context - Additional context
     * @returns {Object} Error handling result
     */
    async handleSearchError(error, query, filters = {}, context = {}) {
        const errorInfo = this.analyzeError(error, query, filters, context);
        
        // Record the error
        this.recordError(errorInfo);
        
        // Determine recovery strategy
        const recoveryStrategy = this.determineRecoveryStrategy(errorInfo);
        
        try {
            // Attempt recovery
            const recoveryResult = await this.executeRecoveryStrategy(
                recoveryStrategy, 
                errorInfo, 
                query, 
                filters, 
                context
            );
            
            return {
                success: recoveryResult.success,
                data: recoveryResult.data,
                error: errorInfo,
                recovery: {
                    strategy: recoveryStrategy,
                    applied: true,
                    message: recoveryResult.message
                },
                suggestions: this.generateErrorSuggestions(errorInfo)
            };
            
        } catch (recoveryError) {
            // Recovery failed, return graceful fallback
            return {
                success: false,
                data: this.getEmptySearchResult(query),
                error: errorInfo,
                recovery: {
                    strategy: 'none',
                    applied: false,
                    message: 'All recovery strategies failed'
                },
                suggestions: this.generateErrorSuggestions(errorInfo)
            };
        }
    }

    /**
     * Analyze error to determine type and severity
     * @param {Error} error - The error object
     * @param {string} query - Search query
     * @param {Object} filters - Search filters
     * @param {Object} context - Additional context
     * @returns {Object} Error analysis
     */
    analyzeError(error, query, filters, context) {
        const errorInfo = {
            type: this.classifyError(error),
            message: error.message,
            stack: error.stack,
            query,
            filters,
            context,
            timestamp: Date.now(),
            severity: 'medium',
            recoverable: true,
            userFriendlyMessage: ''
        };

        // Determine severity
        errorInfo.severity = this.determineSeverity(error, errorInfo.type);
        
        // Check if recoverable
        errorInfo.recoverable = this.isRecoverable(errorInfo.type);
        
        // Generate user-friendly message
        errorInfo.userFriendlyMessage = this.generateUserFriendlyMessage(errorInfo);
        
        return errorInfo;
    }

    /**
     * Classify error type
     * @param {Error} error - Error object
     * @returns {string} Error type
     */
    classifyError(error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('timeout') || message.includes('time out')) {
            return 'timeout';
        }
        
        if (message.includes('pattern') || message.includes('syntax')) {
            return 'pattern_invalid';
        }
        
        if (message.includes('network') || message.includes('fetch')) {
            return 'network';
        }
        
        if (message.includes('memory') || message.includes('out of memory')) {
            return 'memory';
        }
        
        if (message.includes('index') || message.includes('search index')) {
            return 'index_error';
        }
        
        if (message.includes('filter') || message.includes('criteria')) {
            return 'filter_error';
        }
        
        return 'unknown';
    }

    /**
     * Determine error severity
     * @param {Error} error - Error object
     * @param {string} errorType - Classified error type
     * @returns {string} Severity level
     */
    determineSeverity(error, errorType) {
        switch (errorType) {
            case 'timeout':
                return 'medium';
            case 'pattern_invalid':
                return 'low';
            case 'network':
                return 'high';
            case 'memory':
                return 'high';
            case 'index_error':
                return 'medium';
            case 'filter_error':
                return 'low';
            default:
                return 'medium';
        }
    }

    /**
     * Check if error is recoverable
     * @param {string} errorType - Error type
     * @returns {boolean} Whether error is recoverable
     */
    isRecoverable(errorType) {
        const nonRecoverableTypes = ['memory', 'network'];
        return !nonRecoverableTypes.includes(errorType);
    }

    /**
     * Generate user-friendly error message
     * @param {Object} errorInfo - Error information
     * @returns {string} User-friendly message
     */
    generateUserFriendlyMessage(errorInfo) {
        switch (errorInfo.type) {
            case 'timeout':
                return 'Search is taking longer than expected. Please try a more specific search or check your connection.';
            
            case 'pattern_invalid':
                return 'The search pattern appears to be invalid. Please check your search syntax.';
            
            case 'network':
                return 'Unable to connect to the search service. Please check your internet connection.';
            
            case 'memory':
                return 'Search results are too large to process. Please try a more specific search.';
            
            case 'index_error':
                return 'There was an issue with the search index. Trying alternative search method.';
            
            case 'filter_error':
                return 'One or more search filters are invalid. Please check your filter criteria.';
            
            default:
                return 'An unexpected error occurred during search. Please try again.';
        }
    }

    /**
     * Determine appropriate recovery strategy
     * @param {Object} errorInfo - Error information
     * @returns {string} Recovery strategy
     */
    determineRecoveryStrategy(errorInfo) {
        if (!errorInfo.recoverable) {
            return 'graceful_fallback';
        }

        switch (errorInfo.type) {
            case 'timeout':
                return 'timeout_recovery';
            case 'pattern_invalid':
                return 'pattern_correction';
            case 'index_error':
                return 'fallback_search';
            case 'filter_error':
                return 'filter_simplification';
            default:
                return 'retry_with_backoff';
        }
    }

    /**
     * Execute recovery strategy
     * @param {string} strategy - Recovery strategy
     * @param {Object} errorInfo - Error information
     * @param {string} query - Original query
     * @param {Object} filters - Original filters
     * @param {Object} context - Context information
     * @returns {Promise<Object>} Recovery result
     */
    async executeRecoveryStrategy(strategy, errorInfo, query, filters, context) {
        const strategyHandler = this.fallbackStrategies.get(strategy);
        
        if (!strategyHandler) {
            throw new Error(`Unknown recovery strategy: ${strategy}`);
        }
        
        return await strategyHandler.call(this, errorInfo, query, filters, context);
    }

    /**
     * Initialize fallback strategies
     */
    initializeFallbackStrategies() {
        // Timeout recovery - use simpler search with timeout
        this.fallbackStrategies.set('timeout_recovery', async (errorInfo, query, filters, context) => {
            try {
                // Simplify the search to avoid timeout
                const simplifiedFilters = this.simplifyFilters(filters);
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Timeout')), this.config.timeoutThreshold / 2);
                });
                
                const searchPromise = this.performBasicSearch(query, simplifiedFilters);
                const result = await Promise.race([searchPromise, timeoutPromise]);
                
                return {
                    success: true,
                    data: result,
                    message: 'Used simplified search to avoid timeout'
                };
            } catch (error) {
                return await this.fallbackStrategies.get('graceful_fallback').call(this, errorInfo, query, filters, context);
            }
        });

        // Pattern correction - attempt to fix common pattern issues
        this.fallbackStrategies.set('pattern_correction', async (errorInfo, query, filters, context) => {
            const correctedQuery = this.correctSearchPattern(query);
            
            if (correctedQuery !== query) {
                try {
                    const result = await this.performBasicSearch(correctedQuery, filters);
                    return {
                        success: true,
                        data: result,
                        message: `Corrected search pattern from "${query}" to "${correctedQuery}"`
                    };
                } catch (error) {
                    // Fall through to basic search
                }
            }
            
            // Try basic text search
            const basicResult = await this.performBasicTextSearch(query, filters);
            return {
                success: true,
                data: basicResult,
                message: 'Used basic text search instead of pattern matching'
            };
        });

        // Fallback search - use alternative search method
        this.fallbackStrategies.set('fallback_search', async (errorInfo, query, filters, context) => {
            const result = await this.performBasicTextSearch(query, filters);
            return {
                success: true,
                data: result,
                message: 'Used alternative search method due to index issues'
            };
        });

        // Filter simplification - remove problematic filters
        this.fallbackStrategies.set('filter_simplification', async (errorInfo, query, filters, context) => {
            const simplifiedFilters = this.simplifyFilters(filters);
            const result = await this.performBasicSearch(query, simplifiedFilters);
            
            return {
                success: true,
                data: result,
                message: 'Simplified search filters to resolve error'
            };
        });

        // Retry with backoff
        this.fallbackStrategies.set('retry_with_backoff', async (errorInfo, query, filters, context) => {
            for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
                try {
                    await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempt));
                    const result = await this.searchEngine.search(query, filters);
                    
                    return {
                        success: true,
                        data: result,
                        message: `Search succeeded on retry attempt ${attempt}`
                    };
                } catch (retryError) {
                    if (attempt === this.config.retryAttempts) {
                        throw retryError;
                    }
                }
            }
        });

        // Graceful fallback - return empty results with helpful message
        this.fallbackStrategies.set('graceful_fallback', async (errorInfo, query, filters, context) => {
            return {
                success: false,
                data: this.getEmptySearchResult(query),
                message: 'Search temporarily unavailable. Please try again later.'
            };
        });
    }

    /**
     * Initialize common error patterns for better suggestions
     */
    initializeErrorPatterns() {
        // Common pattern mistakes and their corrections
        this.errorPatterns.set(/sg\s+com\s*(\d+)/i, 'SG COM-$1');
        this.errorPatterns.set(/sg\s*com\s*-?\s*(\d+)\s*-\s*(\d+)/i, 'SG COM-$1 to SG COM-$2');
        this.errorPatterns.set(/(\d+)\s*to\s*(\d+)/i, 'SG COM-$1 to SG COM-$2');
        this.errorPatterns.set(/sg\s*com\s*(\d+)\s*\*/i, 'SG COM-$1*');
    }

    /**
     * Correct common search pattern mistakes
     * @param {string} query - Original query
     * @returns {string} Corrected query
     */
    correctSearchPattern(query) {
        let correctedQuery = query;
        
        for (const [pattern, replacement] of this.errorPatterns.entries()) {
            if (pattern.test(correctedQuery)) {
                correctedQuery = correctedQuery.replace(pattern, replacement);
                break;
            }
        }
        
        return correctedQuery;
    }

    /**
     * Simplify filters to avoid errors
     * @param {Object} filters - Original filters
     * @returns {Object} Simplified filters
     */
    simplifyFilters(filters) {
        const simplified = {};
        
        // Keep only basic filters that are less likely to cause errors
        if (filters.id && typeof filters.id === 'string') {
            simplified.id = filters.id;
        }
        
        if (filters.phone && typeof filters.phone === 'string') {
            simplified.phone = filters.phone;
        }
        
        // Skip complex filters like date ranges that might cause issues
        return simplified;
    }

    /**
     * Perform basic search without advanced features
     * @param {string} query - Search query
     * @param {Object} filters - Search filters
     * @returns {Promise<Object>} Basic search results
     */
    async performBasicSearch(query, filters = {}) {
        // Use a simplified search that's less likely to fail
        const records = this.searchEngine.records || [];
        const queryLower = query.toLowerCase();
        
        const matchedRecords = records.filter(record => {
            // Basic text matching
            const searchableText = [
                record.Id || '',
                record.Phone || '',
                record.CompanyName || '',
                record.PhysicalAddress || '',
                record.Email || '',
                record.Website || ''
            ].join(' ').toLowerCase();
            
            return searchableText.includes(queryLower);
        }).slice(0, this.config.fallbackSearchLimit);
        
        return {
            records: matchedRecords,
            totalCount: matchedRecords.length,
            query: { original: query, type: 'basic_fallback' },
            executionTime: 0,
            fallback: true
        };
    }

    /**
     * Perform basic text search
     * @param {string} query - Search query
     * @param {Object} filters - Search filters
     * @returns {Promise<Object>} Text search results
     */
    async performBasicTextSearch(query, filters = {}) {
        const records = this.searchEngine.records || [];
        const queryLower = query.toLowerCase();
        
        let filteredRecords = records;
        
        // Apply basic filters
        if (filters.id) {
            filteredRecords = filteredRecords.filter(record => 
                (record.Id || '').toLowerCase().includes(filters.id.toLowerCase())
            );
        }
        
        if (filters.phone) {
            filteredRecords = filteredRecords.filter(record => 
                (record.Phone || '').includes(filters.phone)
            );
        }
        
        // Apply text search
        const matchedRecords = filteredRecords.filter(record => {
            const searchableText = [
                record.Id || '',
                record.Phone || '',
                record.CompanyName || ''
            ].join(' ').toLowerCase();
            
            return searchableText.includes(queryLower);
        }).slice(0, this.config.fallbackSearchLimit);
        
        return {
            records: matchedRecords,
            totalCount: matchedRecords.length,
            query: { original: query, type: 'text_fallback' },
            executionTime: 0,
            fallback: true
        };
    }

    /**
     * Get empty search result structure
     * @param {string} query - Original query
     * @returns {Object} Empty search result
     */
    getEmptySearchResult(query) {
        return {
            records: [],
            totalCount: 0,
            query: { original: query, type: 'error_fallback' },
            executionTime: 0,
            error: true,
            fallback: true
        };
    }

    /**
     * Generate suggestions for error recovery
     * @param {Object} errorInfo - Error information
     * @returns {Array} Array of suggestions
     */
    generateErrorSuggestions(errorInfo) {
        const suggestions = [];
        
        switch (errorInfo.type) {
            case 'pattern_invalid':
                suggestions.push('Try using simpler search terms');
                suggestions.push('Use patterns like "SG COM-200*" for wildcard searches');
                suggestions.push('Use "SG COM-2001 to SG COM-2010" for range searches');
                
                // Add specific correction if available
                const corrected = this.correctSearchPattern(errorInfo.query);
                if (corrected !== errorInfo.query) {
                    suggestions.unshift(`Did you mean "${corrected}"?`);
                }
                break;
                
            case 'timeout':
                suggestions.push('Try a more specific search term');
                suggestions.push('Use filters to narrow down results');
                suggestions.push('Search for shorter ID patterns');
                break;
                
            case 'filter_error':
                suggestions.push('Check your filter criteria');
                suggestions.push('Try removing some filters');
                suggestions.push('Ensure date ranges are valid');
                break;
                
            case 'memory':
                suggestions.push('Use more specific search terms');
                suggestions.push('Add filters to reduce result size');
                suggestions.push('Try searching for exact matches');
                break;
                
            default:
                suggestions.push('Try a simpler search');
                suggestions.push('Check your search terms');
                suggestions.push('Try again in a moment');
        }
        
        return suggestions;
    }

    /**
     * Record error for analysis and improvement
     * @param {Object} errorInfo - Error information
     */
    recordError(errorInfo) {
        this.errorHistory.unshift(errorInfo);
        
        // Limit error history size
        if (this.errorHistory.length > this.config.maxErrorHistory) {
            this.errorHistory = this.errorHistory.slice(0, this.config.maxErrorHistory);
        }
        
        // Log error for debugging
        console.error('Search error recorded:', {
            type: errorInfo.type,
            query: errorInfo.query,
            message: errorInfo.message,
            timestamp: new Date(errorInfo.timestamp).toISOString()
        });
    }

    /**
     * Get error statistics
     * @returns {Object} Error statistics
     */
    getErrorStats() {
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        const oneDay = 24 * oneHour;
        
        const recentErrors = this.errorHistory.filter(error => 
            now - error.timestamp < oneHour
        );
        
        const dailyErrors = this.errorHistory.filter(error => 
            now - error.timestamp < oneDay
        );
        
        // Count errors by type
        const errorsByType = {};
        this.errorHistory.forEach(error => {
            errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
        });
        
        return {
            totalErrors: this.errorHistory.length,
            recentErrors: recentErrors.length,
            dailyErrors: dailyErrors.length,
            errorsByType,
            mostCommonError: Object.keys(errorsByType).reduce((a, b) => 
                errorsByType[a] > errorsByType[b] ? a : b, 'none'
            ),
            lastError: this.errorHistory.length > 0 ? this.errorHistory[0] : null
        };
    }

    /**
     * Clear error history
     */
    clearErrorHistory() {
        this.errorHistory = [];
    }

    /**
     * Update configuration
     * @param {Object} newConfig - New configuration options
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Get current configuration
     * @returns {Object} Current configuration
     */
    getConfig() {
        return { ...this.config };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SearchErrorHandler;
}