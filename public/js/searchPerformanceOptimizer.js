/**
 * Search Performance Optimizer
 * Provides advanced performance optimization features for the enhanced search system
 */

class SearchPerformanceOptimizer {
    constructor(searchEngine) {
        this.searchEngine = searchEngine;
        this.cache = new Map();
        this.cacheMetrics = {
            hits: 0,
            misses: 0,
            totalRequests: 0,
            cacheSize: 0,
            maxCacheSize: 100, // Maximum number of cached results
            lastCleanup: Date.now()
        };
        
        // Performance monitoring
        this.performanceMonitor = new SearchPerformanceMonitor();
        
        // Progressive loading configuration
        this.progressiveConfig = {
            batchSize: 50,
            loadDelay: 100, // ms between batches
            maxBatches: 20
        };
        
        // Auto-cleanup interval (5 minutes)
        this.cleanupInterval = setInterval(() => {
            this.cleanupCache();
        }, 5 * 60 * 1000);
    }

    /**
     * Perform optimized search with caching and performance monitoring
     * @param {string} query - Search query
     * @param {Object} filters - Filter criteria
     * @param {Object} options - Search options
     * @returns {Promise<Object>} Optimized search results
     */
    async optimizedSearch(query, filters = {}, options = {}) {
        const searchStart = Date.now();
        const cacheKey = this.generateCacheKey(query, filters, options);
        
        this.cacheMetrics.totalRequests++;
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            this.cacheMetrics.hits++;
            const cachedResult = this.cache.get(cacheKey);
            
            // Update cache access time
            cachedResult.lastAccessed = Date.now();
            
            // Add performance metrics
            const result = {
                ...cachedResult.data,
                cached: true,
                cacheHit: true,
                executionTime: Date.now() - searchStart
            };
            
            this.performanceMonitor.recordSearch(query, result.executionTime, true);
            return result;
        }
        
        this.cacheMetrics.misses++;
        
        try {
            // Perform actual search
            const searchResult = await this.searchEngine.search(query, filters, options);
            
            // Cache the result
            this.cacheResult(cacheKey, searchResult);
            
            // Add performance metrics
            const result = {
                ...searchResult,
                cached: false,
                cacheHit: false
            };
            
            this.performanceMonitor.recordSearch(query, result.executionTime, false);
            return result;
            
        } catch (error) {
            this.performanceMonitor.recordError(query, error);
            throw error;
        }
    }

    /**
     * Implement progressive loading for large result sets
     * @param {string} query - Search query
     * @param {Object} filters - Filter criteria
     * @param {Function} onBatchLoaded - Callback for each batch
     * @param {Object} options - Progressive loading options
     * @returns {Promise<Object>} Complete results with progressive loading info
     */
    async progressiveSearch(query, filters = {}, onBatchLoaded = null, options = {}) {
        const config = { ...this.progressiveConfig, ...options };
        const searchStart = Date.now();
        
        try {
            // Get initial results
            const initialResults = await this.optimizedSearch(query, filters, {
                ...options,
                limit: config.batchSize
            });
            
            if (initialResults.totalCount <= config.batchSize) {
                // Small result set, return immediately
                return {
                    ...initialResults,
                    progressive: false,
                    batchInfo: {
                        totalBatches: 1,
                        loadedBatches: 1,
                        isComplete: true
                    }
                };
            }
            
            // Calculate batches needed
            const totalBatches = Math.min(
                Math.ceil(initialResults.totalCount / config.batchSize),
                config.maxBatches
            );
            
            let allRecords = [...initialResults.records];
            let loadedBatches = 1;
            
            // Notify about first batch
            if (onBatchLoaded) {
                onBatchLoaded({
                    batchNumber: 1,
                    records: initialResults.records,
                    totalBatches,
                    isComplete: false
                });
            }
            
            // Load remaining batches
            for (let batch = 2; batch <= totalBatches; batch++) {
                await new Promise(resolve => setTimeout(resolve, config.loadDelay));
                
                const batchResults = await this.optimizedSearch(query, filters, {
                    ...options,
                    offset: (batch - 1) * config.batchSize,
                    limit: config.batchSize
                });
                
                allRecords = allRecords.concat(batchResults.records);
                loadedBatches++;
                
                // Notify about batch completion
                if (onBatchLoaded) {
                    onBatchLoaded({
                        batchNumber: batch,
                        records: batchResults.records,
                        totalBatches,
                        isComplete: batch === totalBatches
                    });
                }
            }
            
            return {
                ...initialResults,
                records: allRecords,
                progressive: true,
                executionTime: Date.now() - searchStart,
                batchInfo: {
                    totalBatches,
                    loadedBatches,
                    isComplete: true,
                    batchSize: config.batchSize
                }
            };
            
        } catch (error) {
            this.performanceMonitor.recordError(query, error);
            throw error;
        }
    }

    /**
     * Generate cache key for search parameters
     * @param {string} query - Search query
     * @param {Object} filters - Filter criteria
     * @param {Object} options - Search options
     * @returns {string} Cache key
     */
    generateCacheKey(query, filters, options) {
        const keyData = {
            query: query.toLowerCase().trim(),
            filters: JSON.stringify(filters),
            options: JSON.stringify({
                highlight: options.highlight,
                limit: options.limit,
                offset: options.offset
            })
        };
        
        return btoa(JSON.stringify(keyData)).replace(/[^a-zA-Z0-9]/g, '');
    }

    /**
     * Cache search result
     * @param {string} cacheKey - Cache key
     * @param {Object} result - Search result to cache
     */
    cacheResult(cacheKey, result) {
        // Don't cache error results
        if (result.error) {
            return;
        }
        
        // Clean up cache if it's getting too large
        if (this.cache.size >= this.cacheMetrics.maxCacheSize) {
            this.cleanupCache();
        }
        
        const cacheEntry = {
            data: result,
            createdAt: Date.now(),
            lastAccessed: Date.now(),
            accessCount: 1
        };
        
        this.cache.set(cacheKey, cacheEntry);
        this.cacheMetrics.cacheSize = this.cache.size;
    }

    /**
     * Clean up old cache entries
     */
    cleanupCache() {
        const now = Date.now();
        const maxAge = 10 * 60 * 1000; // 10 minutes
        const entriesToRemove = [];
        
        // Find old entries
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.lastAccessed > maxAge) {
                entriesToRemove.push(key);
            }
        }
        
        // Remove old entries
        entriesToRemove.forEach(key => this.cache.delete(key));
        
        // If still too large, remove least recently used entries
        if (this.cache.size > this.cacheMetrics.maxCacheSize * 0.8) {
            const entries = Array.from(this.cache.entries())
                .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
            
            const toRemove = entries.slice(0, Math.floor(this.cache.size * 0.3));
            toRemove.forEach(([key]) => this.cache.delete(key));
        }
        
        this.cacheMetrics.cacheSize = this.cache.size;
        this.cacheMetrics.lastCleanup = now;
        
        console.log(`Cache cleanup completed. Removed ${entriesToRemove.length} entries. Current size: ${this.cache.size}`);
    }

    /**
     * Clear all cached results
     */
    clearCache() {
        this.cache.clear();
        this.cacheMetrics.cacheSize = 0;
        this.cacheMetrics.hits = 0;
        this.cacheMetrics.misses = 0;
        this.cacheMetrics.totalRequests = 0;
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getCacheStats() {
        const hitRate = this.cacheMetrics.totalRequests > 0 
            ? (this.cacheMetrics.hits / this.cacheMetrics.totalRequests * 100).toFixed(2)
            : 0;
        
        return {
            ...this.cacheMetrics,
            hitRate: `${hitRate}%`,
            memoryUsage: this.estimateCacheMemoryUsage()
        };
    }

    /**
     * Estimate cache memory usage
     * @returns {string} Estimated memory usage
     */
    estimateCacheMemoryUsage() {
        let totalSize = 0;
        
        for (const entry of this.cache.values()) {
            // Rough estimation of memory usage
            totalSize += JSON.stringify(entry.data).length * 2; // UTF-16 characters
        }
        
        if (totalSize < 1024) {
            return `${totalSize} bytes`;
        } else if (totalSize < 1024 * 1024) {
            return `${(totalSize / 1024).toFixed(2)} KB`;
        } else {
            return `${(totalSize / (1024 * 1024)).toFixed(2)} MB`;
        }
    }

    /**
     * Get performance metrics
     * @returns {Object} Performance metrics
     */
    getPerformanceMetrics() {
        return {
            cache: this.getCacheStats(),
            monitor: this.performanceMonitor.getMetrics(),
            progressive: {
                batchSize: this.progressiveConfig.batchSize,
                loadDelay: this.progressiveConfig.loadDelay,
                maxBatches: this.progressiveConfig.maxBatches
            }
        };
    }

    /**
     * Update configuration
     * @param {Object} config - New configuration
     */
    updateConfig(config) {
        if (config.cache) {
            if (config.cache.maxSize) {
                this.cacheMetrics.maxCacheSize = config.cache.maxSize;
            }
        }
        
        if (config.progressive) {
            this.progressiveConfig = { ...this.progressiveConfig, ...config.progressive };
        }
    }

    /**
     * Destroy the optimizer and clean up resources
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        
        this.clearCache();
        this.performanceMonitor.destroy();
    }
}

/**
 * Search Performance Monitor
 * Tracks and analyzes search performance metrics
 */
class SearchPerformanceMonitor {
    constructor() {
        this.metrics = {
            totalSearches: 0,
            totalTime: 0,
            averageTime: 0,
            minTime: Infinity,
            maxTime: 0,
            cacheHits: 0,
            errors: 0,
            recentSearches: [], // Last 100 searches
            performanceHistory: [], // Last 24 hours of performance data
            slowQueries: [] // Queries that took longer than threshold
        };
        
        this.thresholds = {
            slowQuery: 1000, // ms
            maxRecentSearches: 100,
            maxPerformanceHistory: 144 // 24 hours in 10-minute intervals
        };
        
        // Start performance history tracking
        this.historyInterval = setInterval(() => {
            this.recordPerformanceSnapshot();
        }, 10 * 60 * 1000); // Every 10 minutes
    }

    /**
     * Record a search operation
     * @param {string} query - Search query
     * @param {number} executionTime - Time taken in milliseconds
     * @param {boolean} fromCache - Whether result came from cache
     */
    recordSearch(query, executionTime, fromCache = false) {
        this.metrics.totalSearches++;
        
        if (fromCache) {
            this.metrics.cacheHits++;
        } else {
            this.metrics.totalTime += executionTime;
            this.metrics.minTime = Math.min(this.metrics.minTime, executionTime);
            this.metrics.maxTime = Math.max(this.metrics.maxTime, executionTime);
            
            // Update average time (excluding cached searches)
            const nonCachedSearches = this.metrics.totalSearches - this.metrics.cacheHits;
            this.metrics.averageTime = nonCachedSearches > 0 
                ? this.metrics.totalTime / nonCachedSearches 
                : 0;
        }
        
        // Record recent search
        const searchRecord = {
            query,
            executionTime,
            fromCache,
            timestamp: Date.now()
        };
        
        this.metrics.recentSearches.unshift(searchRecord);
        
        // Limit recent searches
        if (this.metrics.recentSearches.length > this.thresholds.maxRecentSearches) {
            this.metrics.recentSearches = this.metrics.recentSearches.slice(0, this.thresholds.maxRecentSearches);
        }
        
        // Track slow queries
        if (!fromCache && executionTime > this.thresholds.slowQuery) {
            this.metrics.slowQueries.unshift({
                query,
                executionTime,
                timestamp: Date.now()
            });
            
            // Keep only last 20 slow queries
            if (this.metrics.slowQueries.length > 20) {
                this.metrics.slowQueries = this.metrics.slowQueries.slice(0, 20);
            }
        }
    }

    /**
     * Record a search error
     * @param {string} query - Search query that caused error
     * @param {Error} error - Error object
     */
    recordError(query, error) {
        this.metrics.errors++;
        
        console.error('Search error recorded:', {
            query,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Record performance snapshot for historical tracking
     */
    recordPerformanceSnapshot() {
        const now = Date.now();
        const recentSearches = this.metrics.recentSearches.filter(
            search => now - search.timestamp < 10 * 60 * 1000 // Last 10 minutes
        );
        
        const snapshot = {
            timestamp: now,
            searchCount: recentSearches.length,
            averageTime: recentSearches.length > 0 
                ? recentSearches.reduce((sum, s) => sum + s.executionTime, 0) / recentSearches.length
                : 0,
            cacheHitRate: recentSearches.length > 0
                ? (recentSearches.filter(s => s.fromCache).length / recentSearches.length * 100)
                : 0
        };
        
        this.metrics.performanceHistory.unshift(snapshot);
        
        // Limit history size
        if (this.metrics.performanceHistory.length > this.thresholds.maxPerformanceHistory) {
            this.metrics.performanceHistory = this.metrics.performanceHistory.slice(0, this.thresholds.maxPerformanceHistory);
        }
    }

    /**
     * Get current performance metrics
     * @returns {Object} Performance metrics
     */
    getMetrics() {
        const cacheHitRate = this.metrics.totalSearches > 0 
            ? (this.metrics.cacheHits / this.metrics.totalSearches * 100).toFixed(2)
            : 0;
        
        return {
            ...this.metrics,
            cacheHitRate: `${cacheHitRate}%`,
            minTime: this.metrics.minTime === Infinity ? 0 : this.metrics.minTime,
            thresholds: this.thresholds
        };
    }

    /**
     * Get performance analysis
     * @returns {Object} Performance analysis
     */
    getPerformanceAnalysis() {
        const metrics = this.getMetrics();
        const analysis = {
            overall: 'good',
            issues: [],
            recommendations: []
        };
        
        // Analyze average search time
        if (metrics.averageTime > 500) {
            analysis.overall = 'poor';
            analysis.issues.push('High average search time');
            analysis.recommendations.push('Consider optimizing search indexes or reducing dataset size');
        } else if (metrics.averageTime > 200) {
            analysis.overall = 'fair';
            analysis.issues.push('Moderate search times');
            analysis.recommendations.push('Monitor search performance and consider caching improvements');
        }
        
        // Analyze cache hit rate
        const cacheHitRate = parseFloat(metrics.cacheHitRate);
        if (cacheHitRate < 20) {
            analysis.issues.push('Low cache hit rate');
            analysis.recommendations.push('Review caching strategy and cache size limits');
        }
        
        // Analyze error rate
        const errorRate = metrics.totalSearches > 0 
            ? (metrics.errors / metrics.totalSearches * 100)
            : 0;
        
        if (errorRate > 5) {
            analysis.overall = 'poor';
            analysis.issues.push('High error rate');
            analysis.recommendations.push('Investigate and fix search errors');
        }
        
        // Analyze slow queries
        if (metrics.slowQueries.length > 5) {
            analysis.issues.push('Multiple slow queries detected');
            analysis.recommendations.push('Optimize slow query patterns or add query-specific indexes');
        }
        
        return analysis;
    }

    /**
     * Get trending performance data
     * @returns {Object} Trending data
     */
    getTrendingData() {
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        const oneDay = 24 * oneHour;
        
        const lastHour = this.metrics.recentSearches.filter(
            search => now - search.timestamp < oneHour
        );
        
        const lastDay = this.metrics.recentSearches.filter(
            search => now - search.timestamp < oneDay
        );
        
        return {
            lastHour: {
                searchCount: lastHour.length,
                averageTime: lastHour.length > 0 
                    ? lastHour.reduce((sum, s) => sum + s.executionTime, 0) / lastHour.length
                    : 0,
                cacheHitRate: lastHour.length > 0
                    ? (lastHour.filter(s => s.fromCache).length / lastHour.length * 100)
                    : 0
            },
            lastDay: {
                searchCount: lastDay.length,
                averageTime: lastDay.length > 0 
                    ? lastDay.reduce((sum, s) => sum + s.executionTime, 0) / lastDay.length
                    : 0,
                cacheHitRate: lastDay.length > 0
                    ? (lastDay.filter(s => s.fromCache).length / lastDay.length * 100)
                    : 0
            },
            performanceHistory: this.metrics.performanceHistory.slice(0, 24) // Last 4 hours
        };
    }

    /**
     * Reset all metrics
     */
    reset() {
        this.metrics = {
            totalSearches: 0,
            totalTime: 0,
            averageTime: 0,
            minTime: Infinity,
            maxTime: 0,
            cacheHits: 0,
            errors: 0,
            recentSearches: [],
            performanceHistory: [],
            slowQueries: []
        };
    }

    /**
     * Destroy the monitor and clean up resources
     */
    destroy() {
        if (this.historyInterval) {
            clearInterval(this.historyInterval);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SearchPerformanceOptimizer,
        SearchPerformanceMonitor
    };
}