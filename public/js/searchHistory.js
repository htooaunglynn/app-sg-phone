/**
 * Search History Manager for Enhanced Search Engine
 * Manages search history with localStorage persistence and deduplication
 */

class SearchHistory {
    constructor(maxItems = 10) {
        this.maxItems = maxItems;
        this.storageKey = 'singapore_phone_search_history';
        this.history = this.loadFromStorage();
        
        // Metrics for tracking usage
        this.metrics = {
            totalSearches: 0,
            uniqueSearches: 0,
            lastSearchTime: null
        };
        
        this.loadMetrics();
    }

    /**
     * Add a search to the history
     * @param {string} query - Search query
     * @param {Object} filters - Filter criteria used
     * @param {Object} metadata - Additional metadata about the search
     */
    add(query, filters = {}, metadata = {}) {
        if (!query || typeof query !== 'string' || query.trim().length === 0) {
            return;
        }

        const searchItem = {
            id: this.generateId(),
            query: query.trim(),
            filters: this.sanitizeFilters(filters),
            timestamp: new Date().toISOString(),
            resultCount: metadata.resultCount || 0,
            executionTime: metadata.executionTime || 0,
            searchType: this.determineSearchType(query)
        };

        // Remove duplicates (same query and filters)
        this.history = this.history.filter(item => 
            !(item.query === searchItem.query && 
              JSON.stringify(item.filters) === JSON.stringify(searchItem.filters))
        );

        // Add to the beginning of the array
        this.history.unshift(searchItem);

        // Limit history size
        if (this.history.length > this.maxItems) {
            this.history = this.history.slice(0, this.maxItems);
        }

        // Update metrics
        this.metrics.totalSearches++;
        this.metrics.uniqueSearches = this.history.length;
        this.metrics.lastSearchTime = new Date().toISOString();

        // Persist to storage
        this.saveToStorage();
        this.saveMetrics();
    }

    /**
     * Get the search history
     * @param {number} limit - Maximum number of items to return
     * @returns {Array} Array of search history items
     */
    getHistory(limit = null) {
        const historyToReturn = limit ? this.history.slice(0, limit) : this.history;
        
        // Add display-friendly formatting
        return historyToReturn.map(item => ({
            ...item,
            displayText: this.formatSearchForDisplay(item),
            timeAgo: this.formatTimeAgo(item.timestamp)
        }));
    }

    /**
     * Get recent searches (last 5)
     * @returns {Array} Recent search items
     */
    getRecentSearches() {
        return this.getHistory(5);
    }

    /**
     * Get popular searches based on frequency
     * @param {number} limit - Maximum number of items to return
     * @returns {Array} Popular search items
     */
    getPopularSearches(limit = 5) {
        // Count frequency of similar searches
        const searchCounts = new Map();
        
        this.history.forEach(item => {
            const key = item.query.toLowerCase();
            searchCounts.set(key, (searchCounts.get(key) || 0) + 1);
        });

        // Get unique searches sorted by frequency
        const popularSearches = [];
        const seenQueries = new Set();

        for (const item of this.history) {
            const queryLower = item.query.toLowerCase();
            if (!seenQueries.has(queryLower)) {
                seenQueries.add(queryLower);
                popularSearches.push({
                    ...item,
                    frequency: searchCounts.get(queryLower),
                    displayText: this.formatSearchForDisplay(item),
                    timeAgo: this.formatTimeAgo(item.timestamp)
                });
            }
        }

        return popularSearches
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, limit);
    }

    /**
     * Search within the history
     * @param {string} query - Query to search for in history
     * @returns {Array} Matching history items
     */
    searchHistory(query) {
        if (!query || query.trim().length === 0) {
            return this.getHistory();
        }

        const queryLower = query.toLowerCase();
        
        return this.history
            .filter(item => 
                item.query.toLowerCase().includes(queryLower) ||
                (item.filters.companyName && item.filters.companyName.toLowerCase().includes(queryLower))
            )
            .map(item => ({
                ...item,
                displayText: this.formatSearchForDisplay(item),
                timeAgo: this.formatTimeAgo(item.timestamp)
            }));
    }

    /**
     * Remove a specific search from history
     * @param {string} searchId - ID of the search to remove
     */
    remove(searchId) {
        this.history = this.history.filter(item => item.id !== searchId);
        this.metrics.uniqueSearches = this.history.length;
        this.saveToStorage();
        this.saveMetrics();
    }

    /**
     * Clear all search history
     */
    clear() {
        this.history = [];
        this.metrics.uniqueSearches = 0;
        this.saveToStorage();
        this.saveMetrics();
    }

    /**
     * Get search suggestions based on history
     * @param {string} partialQuery - Partial query to get suggestions for
     * @param {number} maxSuggestions - Maximum number of suggestions
     * @returns {Array} Array of suggestions
     */
    getSuggestions(partialQuery, maxSuggestions = 5) {
        if (!partialQuery || partialQuery.length < 2) {
            return this.getRecentSearches().slice(0, maxSuggestions);
        }

        const queryLower = partialQuery.toLowerCase();
        const suggestions = [];
        const seenQueries = new Set();

        // Find matching queries from history
        for (const item of this.history) {
            if (suggestions.length >= maxSuggestions) break;
            
            const itemQuery = item.query.toLowerCase();
            if (itemQuery.startsWith(queryLower) && !seenQueries.has(itemQuery)) {
                seenQueries.add(itemQuery);
                suggestions.push({
                    query: item.query,
                    type: item.searchType,
                    lastUsed: item.timestamp,
                    resultCount: item.resultCount
                });
            }
        }

        // If not enough suggestions, look for contains matches
        if (suggestions.length < maxSuggestions) {
            for (const item of this.history) {
                if (suggestions.length >= maxSuggestions) break;
                
                const itemQuery = item.query.toLowerCase();
                if (itemQuery.includes(queryLower) && !seenQueries.has(itemQuery)) {
                    seenQueries.add(itemQuery);
                    suggestions.push({
                        query: item.query,
                        type: item.searchType,
                        lastUsed: item.timestamp,
                        resultCount: item.resultCount
                    });
                }
            }
        }

        return suggestions;
    }

    /**
     * Export search history
     * @returns {Object} Exportable history data
     */
    exportHistory() {
        return {
            history: this.history,
            metrics: this.metrics,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
    }

    /**
     * Import search history
     * @param {Object} historyData - History data to import
     * @returns {boolean} Success status
     */
    importHistory(historyData) {
        try {
            if (!historyData || !historyData.history || !Array.isArray(historyData.history)) {
                return false;
            }

            // Validate and merge with existing history
            const importedItems = historyData.history.filter(item => 
                item.query && item.timestamp && item.id
            );

            // Merge with existing history, avoiding duplicates
            const existingQueries = new Set(this.history.map(item => 
                `${item.query}|${JSON.stringify(item.filters)}`
            ));

            const newItems = importedItems.filter(item => 
                !existingQueries.has(`${item.query}|${JSON.stringify(item.filters)}`)
            );

            this.history = [...newItems, ...this.history].slice(0, this.maxItems);
            this.metrics.uniqueSearches = this.history.length;

            this.saveToStorage();
            this.saveMetrics();

            return true;
        } catch (error) {
            console.error('Error importing search history:', error);
            return false;
        }
    }

    /**
     * Get search history metrics
     * @returns {Object} History metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            historySize: this.history.length,
            oldestSearch: this.history.length > 0 ? this.history[this.history.length - 1].timestamp : null,
            newestSearch: this.history.length > 0 ? this.history[0].timestamp : null
        };
    }

    // Private methods

    /**
     * Load history from localStorage
     * @returns {Array} Loaded history or empty array
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                return Array.isArray(parsed) ? parsed : [];
            }
        } catch (error) {
            console.warn('Error loading search history from storage:', error);
        }
        return [];
    }

    /**
     * Save history to localStorage
     */
    saveToStorage() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.history));
        } catch (error) {
            console.warn('Error saving search history to storage:', error);
        }
    }

    /**
     * Load metrics from localStorage
     */
    loadMetrics() {
        try {
            const stored = localStorage.getItem(this.storageKey + '_metrics');
            if (stored) {
                const parsed = JSON.parse(stored);
                this.metrics = { ...this.metrics, ...parsed };
            }
        } catch (error) {
            console.warn('Error loading search metrics from storage:', error);
        }
    }

    /**
     * Save metrics to localStorage
     */
    saveMetrics() {
        try {
            localStorage.setItem(this.storageKey + '_metrics', JSON.stringify(this.metrics));
        } catch (error) {
            console.warn('Error saving search metrics to storage:', error);
        }
    }

    /**
     * Generate a unique ID for search items
     * @returns {string} Unique ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Sanitize filters object for storage
     * @param {Object} filters - Filters to sanitize
     * @returns {Object} Sanitized filters
     */
    sanitizeFilters(filters) {
        if (!filters || typeof filters !== 'object') {
            return {};
        }

        const sanitized = {};
        const allowedKeys = ['id', 'phone', 'companyName', 'address', 'email', 'website', 'status', 'dateRange'];
        
        allowedKeys.forEach(key => {
            if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
                sanitized[key] = filters[key];
            }
        });

        return sanitized;
    }

    /**
     * Determine the type of search based on the query
     * @param {string} query - Search query
     * @returns {string} Search type
     */
    determineSearchType(query) {
        if (query.includes('*')) return 'wildcard';
        if (query.includes(' to ')) return 'range';
        if (query.match(/^SG\s+COM/i)) return 'id_pattern';
        if (query.match(/^\+?65/)) return 'phone';
        if (query.includes('@')) return 'email';
        if (query.includes('.com') || query.includes('.sg')) return 'website';
        return 'general';
    }

    /**
     * Format search item for display
     * @param {Object} item - Search history item
     * @returns {string} Formatted display text
     */
    formatSearchForDisplay(item) {
        let displayText = item.query;
        
        // Add filter information if present
        const activeFilters = [];
        if (item.filters.status && item.filters.status !== 'all') {
            activeFilters.push(`status:${item.filters.status}`);
        }
        if (item.filters.companyName) {
            activeFilters.push(`company:${item.filters.companyName}`);
        }
        if (item.filters.dateRange) {
            activeFilters.push('date filtered');
        }
        
        if (activeFilters.length > 0) {
            displayText += ` (${activeFilters.join(', ')})`;
        }

        return displayText;
    }

    /**
     * Format timestamp as "time ago" string
     * @param {string} timestamp - ISO timestamp
     * @returns {string} Formatted time ago string
     */
    formatTimeAgo(timestamp) {
        const now = new Date();
        const searchTime = new Date(timestamp);
        const diffMs = now - searchTime;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return searchTime.toLocaleDateString();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SearchHistory;
}