/**
 * Enhanced Search System Integration
 * Main entry point for the enhanced search functionality
 */

// Import all search components (when using modules)
// For now, we'll assume all classes are loaded via script tags
// Required components: SearchEngine, PatternMatcher, FilterEngine, IndexManager, 
// SearchHistory, SavedSearches, SearchResultHighlighter, SearchPerformanceOptimizer, SearchErrorHandler

/**
 * Enhanced Search System - Main orchestrator class
 * Integrates all search components into a cohesive system
 */
class EnhancedSearchSystem {
    constructor(recordData = []) {
        // Initialize all components
        this.searchEngine = new SearchEngine(recordData);
        this.patternMatcher = new PatternMatcher();
        this.filterEngine = new FilterEngine();
        this.indexManager = new IndexManager(recordData);
        this.searchHistory = new SearchHistory();
        this.savedSearches = new SavedSearches();
        
        // Initialize performance optimization and error handling
        this.performanceOptimizer = new SearchPerformanceOptimizer(this.searchEngine);
        this.errorHandler = new SearchErrorHandler(this.searchEngine);
        
        // System state
        this.isInitialized = false;
        this.currentQuery = '';
        this.currentFilters = {};
        this.lastResults = null;
        
        // Performance tracking
        this.systemMetrics = {
            totalSearches: 0,
            averageSearchTime: 0,
            lastSearchTime: 0
        };
    }

    /**
     * Initialize the enhanced search system
     * @param {Object} options - Initialization options
     */
    async initialize(options = {}) {
        try {
            console.log('Initializing Enhanced Search System...');
            
            // Update search engine with current records
            if (options.records && Array.isArray(options.records)) {
                this.updateRecords(options.records);
            }
            
            // Set up event listeners if DOM elements exist
            this.setupEventListeners();
            
            this.isInitialized = true;
            console.log('Enhanced Search System initialized successfully');
            
            return true;
        } catch (error) {
            console.error('Error initializing Enhanced Search System:', error);
            return false;
        }
    }

    /**
     * Perform an enhanced search with optimization and error handling
     * @param {string} query - Search query
     * @param {Object} filters - Filter criteria
     * @param {Object} options - Search options
     * @returns {Promise<Object>} Search results
     */
    async performSearch(query, filters = {}, options = {}) {
        if (!this.isInitialized) {
            console.warn('Enhanced Search System not initialized');
            return this.getFallbackResults(query);
        }

        try {
            const searchStart = Date.now();
            
            // Store current search state
            this.currentQuery = query;
            this.currentFilters = filters;
            
            // Use performance optimizer for the search
            const results = await this.performanceOptimizer.optimizedSearch(query, filters, options);
            
            // Store results for reference
            this.lastResults = results;
            
            // Update metrics
            this.updateMetrics(Date.now() - searchStart);
            
            return results;
            
        } catch (error) {
            console.error('Enhanced search error:', error);
            
            // Use error handler for recovery
            const errorResult = await this.errorHandler.handleSearchError(
                error, 
                query, 
                filters, 
                { searchStart: Date.now() }
            );
            
            // Store error result
            this.lastResults = errorResult.data;
            
            return {
                ...errorResult.data,
                error: errorResult.error,
                recovery: errorResult.recovery,
                suggestions: errorResult.suggestions
            };
        }
    }

    /**
     * Perform progressive search for large result sets
     * @param {string} query - Search query
     * @param {Object} filters - Filter criteria
     * @param {Function} onBatchLoaded - Callback for each batch
     * @param {Object} options - Progressive loading options
     * @returns {Promise<Object>} Progressive search results
     */
    async performProgressiveSearch(query, filters = {}, onBatchLoaded = null, options = {}) {
        if (!this.isInitialized) {
            console.warn('Enhanced Search System not initialized');
            return this.getFallbackResults(query);
        }

        try {
            // Store current search state
            this.currentQuery = query;
            this.currentFilters = filters;
            
            // Use performance optimizer for progressive search
            const results = await this.performanceOptimizer.progressiveSearch(
                query, 
                filters, 
                onBatchLoaded, 
                options
            );
            
            // Store results for reference
            this.lastResults = results;
            
            return results;
            
        } catch (error) {
            console.error('Progressive search error:', error);
            
            // Use error handler for recovery
            const errorResult = await this.errorHandler.handleSearchError(
                error, 
                query, 
                filters, 
                { progressive: true }
            );
            
            return {
                ...errorResult.data,
                error: errorResult.error,
                recovery: errorResult.recovery,
                suggestions: errorResult.suggestions
            };
        }
    }

    /**
     * Get search suggestions
     * @param {string} partialQuery - Partial query
     * @returns {Array} Search suggestions
     */
    getSuggestions(partialQuery) {
        if (!this.isInitialized) {
            return [];
        }

        try {
            // Combine suggestions from multiple sources
            const historySuggestions = this.searchHistory.getSuggestions(partialQuery, 3);
            const indexSuggestions = this.indexManager.getSuggestions(partialQuery, 3);
            const patternSuggestions = this.patternMatcher.generatePatternSuggestions(
                this.searchEngine.records, 
                partialQuery
            );

            // Merge and deduplicate suggestions
            const allSuggestions = [
                ...historySuggestions.map(s => ({ ...s, source: 'history' })),
                ...indexSuggestions.map(s => ({ query: s, source: 'index' })),
                ...patternSuggestions.map(s => ({ query: s, source: 'pattern' }))
            ];

            // Remove duplicates and limit results
            const uniqueSuggestions = [];
            const seenQueries = new Set();
            
            for (const suggestion of allSuggestions) {
                if (!seenQueries.has(suggestion.query.toLowerCase()) && uniqueSuggestions.length < 5) {
                    seenQueries.add(suggestion.query.toLowerCase());
                    uniqueSuggestions.push(suggestion);
                }
            }

            return uniqueSuggestions;
            
        } catch (error) {
            console.error('Error getting suggestions:', error);
            return [];
        }
    }

    /**
     * Save current search
     * @param {string} name - Name for the saved search
     * @returns {string|null} ID of saved search or null if failed
     */
    saveCurrentSearch(name) {
        if (!this.currentQuery) {
            throw new Error('No current search to save');
        }

        try {
            return this.savedSearches.save(name, this.currentQuery, this.currentFilters);
        } catch (error) {
            console.error('Error saving search:', error);
            throw error;
        }
    }

    /**
     * Load and execute a saved search
     * @param {string} searchId - ID of the saved search
     * @returns {Promise<Object>} Search results
     */
    async loadSavedSearch(searchId) {
        try {
            const savedSearch = this.savedSearches.load(searchId);
            
            if (!savedSearch) {
                throw new Error('Saved search not found');
            }

            return await this.performSearch(savedSearch.query, savedSearch.filters);
            
        } catch (error) {
            console.error('Error loading saved search:', error);
            throw error;
        }
    }

    /**
     * Update the records dataset
     * @param {Array} newRecords - New records array
     */
    updateRecords(newRecords) {
        if (!Array.isArray(newRecords)) {
            console.warn('Invalid records data provided');
            return;
        }

        this.searchEngine.updateRecords(newRecords);
        this.indexManager.updateIndex(newRecords);
        
        console.log(`Updated search system with ${newRecords.length} records`);
    }

    /**
     * Get system status and metrics including performance and error data
     * @returns {Object} System status
     */
    getSystemStatus() {
        return {
            isInitialized: this.isInitialized,
            recordCount: this.searchEngine.records.length,
            searchMetrics: this.systemMetrics,
            historyMetrics: this.searchHistory.getMetrics(),
            savedSearchCount: this.savedSearches.getAll().length,
            indexStats: this.indexManager.getIndexStats(),
            performanceMetrics: this.performanceOptimizer.getPerformanceMetrics(),
            errorStats: this.errorHandler.getErrorStats(),
            lastQuery: this.currentQuery,
            lastResults: this.lastResults ? {
                count: this.lastResults.totalCount,
                executionTime: this.lastResults.executionTime,
                cached: this.lastResults.cached || false,
                error: this.lastResults.error || false
            } : null
        };
    }

    /**
     * Get detailed performance analysis
     * @returns {Object} Performance analysis
     */
    getPerformanceAnalysis() {
        return this.performanceOptimizer.performanceMonitor.getPerformanceAnalysis();
    }

    /**
     * Get trending performance data
     * @returns {Object} Trending data
     */
    getTrendingData() {
        return this.performanceOptimizer.performanceMonitor.getTrendingData();
    }

    /**
     * Clear performance cache
     */
    clearPerformanceCache() {
        this.performanceOptimizer.clearCache();
    }

    /**
     * Update performance configuration
     * @param {Object} config - New configuration
     */
    updatePerformanceConfig(config) {
        this.performanceOptimizer.updateConfig(config);
    }

    /**
     * Update error handling configuration
     * @param {Object} config - New configuration
     */
    updateErrorConfig(config) {
        this.errorHandler.updateConfig(config);
    }

    /**
     * Clear all search data including performance cache and error history
     */
    clearAllData() {
        this.searchHistory.clear();
        this.savedSearches.clear();
        this.indexManager.clearIndex();
        this.performanceOptimizer.clearCache();
        this.errorHandler.clearErrorHistory();
        this.currentQuery = '';
        this.currentFilters = {};
        this.lastResults = null;
        
        console.log('All search data cleared');
    }

    /**
     * Destroy the system and clean up resources
     */
    destroy() {
        if (this.performanceOptimizer) {
            this.performanceOptimizer.destroy();
        }
        
        this.clearAllData();
        this.isInitialized = false;
        
        console.log('Enhanced Search System destroyed');
    }

    /**
     * Export search data
     * @returns {Object} Exportable search data
     */
    exportSearchData() {
        return {
            history: this.searchHistory.exportHistory(),
            savedSearches: this.savedSearches.export(),
            metrics: this.systemMetrics,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
    }

    /**
     * Import search data
     * @param {Object} importData - Data to import
     * @returns {Object} Import results
     */
    importSearchData(importData) {
        const results = {
            history: false,
            savedSearches: { imported: 0, skipped: 0, errors: [] },
            success: false
        };

        try {
            if (importData.history) {
                results.history = this.searchHistory.importHistory(importData.history);
            }

            if (importData.savedSearches) {
                results.savedSearches = this.savedSearches.import(importData.savedSearches, {
                    handleConflicts: 'rename'
                });
            }

            results.success = true;
            return results;
            
        } catch (error) {
            console.error('Error importing search data:', error);
            results.error = error.message;
            return results;
        }
    }

    // Private methods

    /**
     * Set up event listeners for search interface
     */
    setupEventListeners() {
        // This will be implemented when integrating with the UI
        // For now, just log that we're ready for integration
        console.log('Enhanced Search System ready for UI integration');
    }

    /**
     * Update system metrics
     * @param {number} searchTime - Time taken for the search
     */
    updateMetrics(searchTime) {
        this.systemMetrics.totalSearches++;
        this.systemMetrics.lastSearchTime = searchTime;
        
        // Calculate rolling average
        if (this.systemMetrics.totalSearches === 1) {
            this.systemMetrics.averageSearchTime = searchTime;
        } else {
            this.systemMetrics.averageSearchTime = 
                (this.systemMetrics.averageSearchTime * (this.systemMetrics.totalSearches - 1) + searchTime) / 
                this.systemMetrics.totalSearches;
        }
    }

    /**
     * Get fallback results when enhanced search fails
     * @param {string} query - Original query
     * @returns {Object} Fallback results
     */
    getFallbackResults(query) {
        return {
            records: [],
            totalCount: 0,
            query: { original: query, type: 'fallback' },
            executionTime: 0,
            error: 'Enhanced search unavailable, using fallback',
            suggestions: []
        };
    }
}

// Global instance for easy access
let enhancedSearchSystem = null;

/**
 * Initialize the global enhanced search system
 * @param {Array} records - Initial records data
 * @param {Object} options - Initialization options
 * @returns {Promise<EnhancedSearchSystem>} Initialized system
 */
async function initializeEnhancedSearch(records = [], options = {}) {
    if (!enhancedSearchSystem) {
        enhancedSearchSystem = new EnhancedSearchSystem(records);
        await enhancedSearchSystem.initialize(options);
    } else {
        enhancedSearchSystem.updateRecords(records);
    }
    
    return enhancedSearchSystem;
}

/**
 * Get the global enhanced search system instance
 * @returns {EnhancedSearchSystem|null} Search system instance
 */
function getEnhancedSearchSystem() {
    return enhancedSearchSystem;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        EnhancedSearchSystem,
        initializeEnhancedSearch,
        getEnhancedSearchSystem
    };
}