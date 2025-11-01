/**
 * Enhanced Search Engine for Singapore Phone Detect Application
 * Provides advanced search capabilities with pattern matching, filtering, and performance optimization
 */

class SearchEngine {
    constructor(recordData = []) {
        this.records = recordData;
        this.indexManager = new IndexManager(recordData);
        this.patternMatcher = new PatternMatcher();
        this.filterEngine = new FilterEngine();
        this.searchHistory = new SearchHistory();
        this.savedSearches = new SavedSearches();
        this.resultHighlighter = new SearchResultHighlighter();
        
        // Performance tracking
        this.performanceMetrics = {
            searchTimes: [],
            lastSearchTime: 0
        };
    }

    /**
     * Main search method that orchestrates the entire search process
     * @param {string} query - The search query
     * @param {Object} filters - Additional filter criteria
     * @param {Object} options - Search options
     * @returns {Promise<Object>} Search results with metadata
     */
    async search(query, filters = {}, options = {}) {
        const searchStart = Date.now();
        
        try {
            // Add timeout handling
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Search timeout')), options.timeout || 5000);
            });
            
            const searchPromise = this.performSearchInternal(query, filters, options, searchStart);
            
            // Race between search and timeout
            return await Promise.race([searchPromise, timeoutPromise]);
            
        } catch (error) {
            console.error('Search error:', error);
            
            // Return structured error response
            return {
                records: [],
                originalRecords: [],
                totalCount: 0,
                query: { original: query, type: 'error' },
                executionTime: Date.now() - searchStart,
                error: error.message,
                suggestions: this.getSuggestions(query),
                highlighting: {
                    enabled: false,
                    stats: { totalMatches: 0, highlightedFields: 0, lastHighlightTime: 0 }
                }
            };
        }
    }

    /**
     * Internal search method with core logic
     * @param {string} query - The search query
     * @param {Object} filters - Additional filter criteria
     * @param {Object} options - Search options
     * @param {number} searchStart - Search start time
     * @returns {Promise<Object>} Search results with metadata
     */
    async performSearchInternal(query, filters, options, searchStart) {
        // Parse the query using pattern matcher
        const parsedQuery = this.patternMatcher.parseQuery(query);
        
        // Apply filters first to reduce dataset size
        let filteredRecords = await this.filterEngine.apply(this.records, filters);
        
        // Apply pattern matching to filtered records
        let matchedRecords = this.patternMatcher.match(filteredRecords, parsedQuery);
        
        // Rank results based on relevance
        matchedRecords = this.rankResults(matchedRecords, parsedQuery);
        
        // Add to search history
        this.searchHistory.add(query, filters);
        
        // Calculate execution time
        const executionTime = Date.now() - searchStart;
        this.performanceMetrics.searchTimes.push(executionTime);
        this.performanceMetrics.lastSearchTime = executionTime;
        
        // Keep only last 10 performance measurements
        if (this.performanceMetrics.searchTimes.length > 10) {
            this.performanceMetrics.searchTimes.shift();
        }
        
        // Add highlighting to results if requested
        let highlightedRecords = matchedRecords;
        if (options.highlight !== false && query && query.trim()) {
            highlightedRecords = this.resultHighlighter.highlightTableResults(
                matchedRecords, 
                query.trim()
            );
        }

        return {
            records: highlightedRecords,
            originalRecords: matchedRecords, // Keep original for export
            totalCount: matchedRecords.length,
            query: parsedQuery,
            executionTime,
            suggestions: this.getSuggestions(query),
            pagination: this.calculatePagination(matchedRecords.length, options.page, options.pageSize),
            highlighting: {
                enabled: options.highlight !== false,
                stats: this.resultHighlighter.getStatistics()
            }
        };
    }

    /**
     * Search specifically by ID pattern
     * @param {string} pattern - ID pattern to search for
     * @returns {Array} Matching records
     */
    searchByIdPattern(pattern) {
        return this.patternMatcher.matchIdPattern(this.records, pattern);
    }

    /**
     * Search by ID range
     * @param {string} startId - Starting ID
     * @param {string} endId - Ending ID
     * @returns {Array} Records within the range
     */
    searchByRange(startId, endId) {
        return this.records.filter(record => 
            this.patternMatcher.isIdInRange(record.Id || '', startId, endId)
        );
    }

    /**
     * Search with wildcards
     * @param {string} pattern - Wildcard pattern
     * @returns {Array} Matching records
     */
    searchWithWildcards(pattern) {
        const parsedPattern = this.patternMatcher.parseIdPattern(pattern);
        return this.patternMatcher.match(this.records, parsedPattern);
    }

    /**
     * Get search suggestions based on partial query
     * @param {string} partialQuery - Partial search query
     * @returns {Array} Array of suggestions
     */
    getSuggestions(partialQuery) {
        if (!partialQuery || partialQuery.length < 2) {
            return [];
        }

        const suggestions = new Set();
        const query = partialQuery.toLowerCase();

        // Get suggestions from existing record data
        this.records.forEach(record => {
            // ID suggestions
            if (record.Id && record.Id.toLowerCase().includes(query)) {
                suggestions.add(record.Id);
            }
            
            // Company name suggestions
            if (record.CompanyName && record.CompanyName.toLowerCase().includes(query)) {
                suggestions.add(record.CompanyName);
            }
            
            // Phone suggestions (first few digits)
            if (record.Phone && record.Phone.includes(query)) {
                suggestions.add(record.Phone);
            }
        });

        // Add pattern-based suggestions
        if (query.includes('sg com')) {
            suggestions.add('SG COM-*');
            suggestions.add('SG COM-2001 to SG COM-2010');
        }

        return Array.from(suggestions).slice(0, 5); // Limit to 5 suggestions
    }

    /**
     * Rank search results based on relevance
     * @param {Array} records - Records to rank
     * @param {Object} parsedQuery - Parsed query object
     * @returns {Array} Ranked records
     */
    rankResults(records, parsedQuery) {
        if (!parsedQuery.original || parsedQuery.original.length === 0) {
            return records;
        }

        return records.sort((a, b) => {
            const scoreA = this.calculateRelevanceScore(a, parsedQuery);
            const scoreB = this.calculateRelevanceScore(b, parsedQuery);
            return scoreB - scoreA; // Higher scores first
        });
    }

    /**
     * Calculate relevance score for a record
     * @param {Object} record - Record to score
     * @param {Object} parsedQuery - Parsed query
     * @returns {number} Relevance score
     */
    calculateRelevanceScore(record, parsedQuery) {
        let score = 0;
        const query = parsedQuery.original.toLowerCase();

        // Exact matches get highest score
        if (record.Id && record.Id.toLowerCase() === query) score += 100;
        if (record.Phone && record.Phone === query) score += 90;
        if (record.CompanyName && record.CompanyName.toLowerCase() === query) score += 80;

        // Starts with matches get high score
        if (record.Id && record.Id.toLowerCase().startsWith(query)) score += 50;
        if (record.CompanyName && record.CompanyName.toLowerCase().startsWith(query)) score += 40;

        // Contains matches get lower score
        if (record.Id && record.Id.toLowerCase().includes(query)) score += 20;
        if (record.CompanyName && record.CompanyName.toLowerCase().includes(query)) score += 15;
        if (record.PhysicalAddress && record.PhysicalAddress.toLowerCase().includes(query)) score += 10;
        if (record.Email && record.Email.toLowerCase().includes(query)) score += 10;
        if (record.Website && record.Website.toLowerCase().includes(query)) score += 10;

        return score;
    }

    /**
     * Calculate pagination metadata
     * @param {number} totalRecords - Total number of records
     * @param {number} currentPage - Current page number
     * @param {number} pageSize - Records per page
     * @returns {Object} Pagination metadata
     */
    calculatePagination(totalRecords, currentPage = 1, pageSize = 50) {
        const totalPages = Math.ceil(totalRecords / pageSize);
        
        return {
            currentPage: Math.max(1, Math.min(currentPage, totalPages)),
            totalPages,
            recordsPerPage: pageSize,
            totalRecords,
            hasNextPage: currentPage < totalPages,
            hasPreviousPage: currentPage > 1
        };
    }

    /**
     * Update the records dataset
     * @param {Array} newRecords - New records array
     */
    updateRecords(newRecords) {
        this.records = newRecords;
        this.indexManager.updateIndex(newRecords);
    }

    /**
     * Get search performance metrics
     * @returns {Object} Performance metrics
     */
    getPerformanceMetrics() {
        const avgSearchTime = this.performanceMetrics.searchTimes.length > 0 
            ? this.performanceMetrics.searchTimes.reduce((a, b) => a + b, 0) / this.performanceMetrics.searchTimes.length 
            : 0;

        return {
            averageSearchTime: Math.round(avgSearchTime),
            lastSearchTime: this.performanceMetrics.lastSearchTime,
            totalSearches: this.performanceMetrics.searchTimes.length
        };
    }

    /**
     * Get the result highlighter instance
     * @returns {SearchResultHighlighter} Highlighter instance
     */
    getResultHighlighter() {
        return this.resultHighlighter;
    }

    /**
     * Highlight search results in a container
     * @param {string|HTMLElement} container - Container to highlight
     * @param {Array} records - Records to display
     * @param {string} searchTerm - Search term to highlight
     * @param {Object} options - Highlighting options
     */
    highlightResultsInContainer(container, records, searchTerm, options = {}) {
        if (!this.resultHighlighter) {
            console.warn('Result highlighter not available');
            return;
        }

        const highlightedRecords = this.resultHighlighter.highlightTableResults(
            records, 
            searchTerm, 
            options.fieldsToHighlight
        );

        // Display statistics
        if (options.showStats !== false) {
            this.resultHighlighter.displayMatchCount(
                container,
                records.length,
                searchTerm,
                options.executionTime || 0,
                options.additionalStats || {}
            );
        }

        return highlightedRecords;
    }

    /**
     * Display no results state with suggestions
     * @param {string|HTMLElement} container - Container to display in
     * @param {string} searchQuery - Original search query
     * @param {Function} onSuggestionClick - Callback for suggestion clicks
     */
    displayNoResultsState(container, searchQuery, onSuggestionClick = null) {
        if (!this.resultHighlighter) {
            console.warn('Result highlighter not available');
            return;
        }

        const suggestions = this.getSuggestions(searchQuery);
        this.resultHighlighter.displayNoResultsState(
            container, 
            searchQuery, 
            suggestions, 
            onSuggestionClick
        );
    }

    /**
     * Clear all highlighting from a container
     * @param {string|HTMLElement} container - Container to clear
     */
    clearHighlighting(container) {
        if (this.resultHighlighter) {
            this.resultHighlighter.clearHighlighting(container);
        }
    }

    /**
     * Clear all caches and reset performance metrics
     */
    clearCache() {
        this.indexManager.clearIndex();
        this.performanceMetrics.searchTimes = [];
        this.performanceMetrics.lastSearchTime = 0;
        
        if (this.resultHighlighter) {
            this.resultHighlighter.resetStatistics();
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SearchEngine;
}