/**
 * Saved Searches Manager for Enhanced Search Engine
 * Manages persistent saved searches with localStorage integration
 */

class SavedSearches {
    constructor() {
        this.storageKey = 'singapore_phone_saved_searches';
        this.searches = this.loadFromStorage();
        
        // Metrics for tracking usage
        this.metrics = {
            totalSaved: 0,
            totalExecutions: 0,
            lastSaved: null,
            lastExecuted: null
        };
        
        this.loadMetrics();
    }

    /**
     * Save a search with a custom name
     * @param {string} name - Name for the saved search
     * @param {string} query - Search query
     * @param {Object} filters - Filter criteria
     * @param {Object} options - Additional options
     * @returns {string} ID of the saved search
     */
    save(name, query, filters = {}, options = {}) {
        if (!name || !name.trim()) {
            throw new Error('Search name is required');
        }

        if (!query || !query.trim()) {
            throw new Error('Search query is required');
        }

        // Check for duplicate names
        const existingSearch = this.searches.find(search => 
            search.name.toLowerCase() === name.trim().toLowerCase()
        );

        if (existingSearch) {
            throw new Error('A search with this name already exists');
        }

        const searchItem = {
            id: this.generateId(),
            name: name.trim(),
            query: query.trim(),
            filters: this.sanitizeFilters(filters),
            options: this.sanitizeOptions(options),
            createdAt: new Date().toISOString(),
            lastExecuted: null,
            executionCount: 0,
            description: this.generateDescription(query, filters),
            tags: this.generateTags(query, filters)
        };

        this.searches.push(searchItem);
        
        // Update metrics
        this.metrics.totalSaved++;
        this.metrics.lastSaved = new Date().toISOString();

        // Sort by name for better organization
        this.searches.sort((a, b) => a.name.localeCompare(b.name));

        this.saveToStorage();
        this.saveMetrics();

        return searchItem.id;
    }

    /**
     * Load a saved search by ID
     * @param {string} id - ID of the saved search
     * @returns {Object|null} Saved search object or null if not found
     */
    load(id) {
        const search = this.searches.find(search => search.id === id);
        
        if (search) {
            // Update execution tracking
            search.lastExecuted = new Date().toISOString();
            search.executionCount = (search.executionCount || 0) + 1;
            
            this.metrics.totalExecutions++;
            this.metrics.lastExecuted = new Date().toISOString();
            
            this.saveToStorage();
            this.saveMetrics();
        }

        return search || null;
    }

    /**
     * Update an existing saved search
     * @param {string} id - ID of the search to update
     * @param {Object} updates - Updates to apply
     * @returns {boolean} Success status
     */
    update(id, updates) {
        const searchIndex = this.searches.findIndex(search => search.id === id);
        
        if (searchIndex === -1) {
            return false;
        }

        const search = this.searches[searchIndex];
        
        // Update allowed fields
        if (updates.name && updates.name.trim()) {
            // Check for duplicate names (excluding current search)
            const duplicateName = this.searches.find((s, index) => 
                index !== searchIndex && 
                s.name.toLowerCase() === updates.name.trim().toLowerCase()
            );
            
            if (duplicateName) {
                throw new Error('A search with this name already exists');
            }
            
            search.name = updates.name.trim();
        }

        if (updates.query && updates.query.trim()) {
            search.query = updates.query.trim();
        }

        if (updates.filters) {
            search.filters = this.sanitizeFilters(updates.filters);
        }

        if (updates.options) {
            search.options = this.sanitizeOptions(updates.options);
        }

        // Update derived fields
        search.description = this.generateDescription(search.query, search.filters);
        search.tags = this.generateTags(search.query, search.filters);
        search.updatedAt = new Date().toISOString();

        // Re-sort by name
        this.searches.sort((a, b) => a.name.localeCompare(b.name));

        this.saveToStorage();
        return true;
    }

    /**
     * Delete a saved search
     * @param {string} id - ID of the search to delete
     * @returns {boolean} Success status
     */
    delete(id) {
        const initialLength = this.searches.length;
        this.searches = this.searches.filter(search => search.id !== id);
        
        const wasDeleted = this.searches.length < initialLength;
        
        if (wasDeleted) {
            this.saveToStorage();
        }
        
        return wasDeleted;
    }

    /**
     * Get all saved searches
     * @param {Object} options - Options for filtering/sorting
     * @returns {Array} Array of saved searches
     */
    getAll(options = {}) {
        let results = [...this.searches];

        // Filter by tag if specified
        if (options.tag) {
            results = results.filter(search => 
                search.tags && search.tags.includes(options.tag)
            );
        }

        // Filter by search text
        if (options.search) {
            const searchLower = options.search.toLowerCase();
            results = results.filter(search => 
                search.name.toLowerCase().includes(searchLower) ||
                search.query.toLowerCase().includes(searchLower) ||
                search.description.toLowerCase().includes(searchLower)
            );
        }

        // Sort options
        if (options.sortBy) {
            switch (options.sortBy) {
                case 'name':
                    results.sort((a, b) => a.name.localeCompare(b.name));
                    break;
                case 'created':
                    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                    break;
                case 'lastExecuted':
                    results.sort((a, b) => {
                        const aTime = a.lastExecuted ? new Date(a.lastExecuted) : new Date(0);
                        const bTime = b.lastExecuted ? new Date(b.lastExecuted) : new Date(0);
                        return bTime - aTime;
                    });
                    break;
                case 'popularity':
                    results.sort((a, b) => (b.executionCount || 0) - (a.executionCount || 0));
                    break;
                default:
                    // Default to name sorting
                    results.sort((a, b) => a.name.localeCompare(b.name));
            }
        }

        // Add display-friendly formatting
        return results.map(search => ({
            ...search,
            displayName: this.formatDisplayName(search),
            timeAgo: this.formatTimeAgo(search.createdAt),
            lastExecutedAgo: search.lastExecuted ? this.formatTimeAgo(search.lastExecuted) : 'Never'
        }));
    }

    /**
     * Get popular saved searches
     * @param {number} limit - Maximum number of searches to return
     * @returns {Array} Popular saved searches
     */
    getPopular(limit = 5) {
        return this.getAll({ sortBy: 'popularity' }).slice(0, limit);
    }

    /**
     * Get recently executed saved searches
     * @param {number} limit - Maximum number of searches to return
     * @returns {Array} Recently executed saved searches
     */
    getRecentlyExecuted(limit = 5) {
        return this.getAll({ sortBy: 'lastExecuted' }).slice(0, limit);
    }

    /**
     * Get all unique tags
     * @returns {Array} Array of unique tags
     */
    getAllTags() {
        const tagSet = new Set();
        
        this.searches.forEach(search => {
            if (search.tags && Array.isArray(search.tags)) {
                search.tags.forEach(tag => tagSet.add(tag));
            }
        });

        return Array.from(tagSet).sort();
    }

    /**
     * Duplicate a saved search with a new name
     * @param {string} id - ID of the search to duplicate
     * @param {string} newName - Name for the duplicated search
     * @returns {string|null} ID of the new search or null if failed
     */
    duplicate(id, newName) {
        const originalSearch = this.searches.find(search => search.id === id);
        
        if (!originalSearch) {
            return null;
        }

        try {
            return this.save(
                newName,
                originalSearch.query,
                originalSearch.filters,
                originalSearch.options
            );
        } catch (error) {
            console.error('Error duplicating saved search:', error);
            return null;
        }
    }

    /**
     * Export saved searches
     * @param {Array} ids - Optional array of IDs to export (exports all if not provided)
     * @returns {Object} Exportable data
     */
    export(ids = null) {
        const searchesToExport = ids 
            ? this.searches.filter(search => ids.includes(search.id))
            : this.searches;

        return {
            searches: searchesToExport,
            exportDate: new Date().toISOString(),
            version: '1.0',
            count: searchesToExport.length
        };
    }

    /**
     * Import saved searches
     * @param {Object} importData - Data to import
     * @param {Object} options - Import options
     * @returns {Object} Import result
     */
    import(importData, options = {}) {
        const result = {
            imported: 0,
            skipped: 0,
            errors: []
        };

        if (!importData || !importData.searches || !Array.isArray(importData.searches)) {
            result.errors.push('Invalid import data format');
            return result;
        }

        importData.searches.forEach((searchData, index) => {
            try {
                // Validate required fields
                if (!searchData.name || !searchData.query) {
                    result.errors.push(`Search ${index + 1}: Missing required fields`);
                    result.skipped++;
                    return;
                }

                // Handle name conflicts
                let finalName = searchData.name;
                if (options.handleConflicts === 'rename') {
                    let counter = 1;
                    while (this.searches.find(s => s.name.toLowerCase() === finalName.toLowerCase())) {
                        finalName = `${searchData.name} (${counter})`;
                        counter++;
                    }
                } else if (options.handleConflicts === 'skip') {
                    if (this.searches.find(s => s.name.toLowerCase() === searchData.name.toLowerCase())) {
                        result.skipped++;
                        return;
                    }
                }

                // Import the search
                this.save(
                    finalName,
                    searchData.query,
                    searchData.filters || {},
                    searchData.options || {}
                );

                result.imported++;

            } catch (error) {
                result.errors.push(`Search ${index + 1}: ${error.message}`);
                result.skipped++;
            }
        });

        return result;
    }

    /**
     * Get saved search metrics
     * @returns {Object} Metrics object
     */
    getMetrics() {
        return {
            ...this.metrics,
            totalSavedSearches: this.searches.length,
            averageExecutionsPerSearch: this.searches.length > 0 
                ? Math.round(this.searches.reduce((sum, s) => sum + (s.executionCount || 0), 0) / this.searches.length)
                : 0,
            mostPopularSearch: this.searches.length > 0 
                ? this.searches.reduce((max, s) => (s.executionCount || 0) > (max.executionCount || 0) ? s : max)
                : null
        };
    }

    /**
     * Clear all saved searches
     */
    clear() {
        this.searches = [];
        this.saveToStorage();
    }

    // Private methods

    /**
     * Load saved searches from localStorage
     * @returns {Array} Loaded searches or empty array
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                return Array.isArray(parsed) ? parsed : [];
            }
        } catch (error) {
            console.warn('Error loading saved searches from storage:', error);
        }
        return [];
    }

    /**
     * Save searches to localStorage
     */
    saveToStorage() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.searches));
        } catch (error) {
            console.warn('Error saving searches to storage:', error);
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
            console.warn('Error loading saved search metrics from storage:', error);
        }
    }

    /**
     * Save metrics to localStorage
     */
    saveMetrics() {
        try {
            localStorage.setItem(this.storageKey + '_metrics', JSON.stringify(this.metrics));
        } catch (error) {
            console.warn('Error saving saved search metrics to storage:', error);
        }
    }

    /**
     * Generate a unique ID
     * @returns {string} Unique ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Sanitize filters object
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
     * Sanitize options object
     * @param {Object} options - Options to sanitize
     * @returns {Object} Sanitized options
     */
    sanitizeOptions(options) {
        if (!options || typeof options !== 'object') {
            return {};
        }

        const sanitized = {};
        const allowedKeys = ['caseSensitive', 'exactMatch', 'useWildcards', 'pageSize'];
        
        allowedKeys.forEach(key => {
            if (options[key] !== undefined && options[key] !== null) {
                sanitized[key] = options[key];
            }
        });

        return sanitized;
    }

    /**
     * Generate a description for the search
     * @param {string} query - Search query
     * @param {Object} filters - Search filters
     * @returns {string} Generated description
     */
    generateDescription(query, filters) {
        let description = `Search for "${query}"`;
        
        const activeFilters = [];
        if (filters.status && filters.status !== 'all') {
            activeFilters.push(`${filters.status} records`);
        }
        if (filters.companyName) {
            activeFilters.push(`company containing "${filters.companyName}"`);
        }
        if (filters.dateRange) {
            activeFilters.push('within date range');
        }
        
        if (activeFilters.length > 0) {
            description += ` with filters: ${activeFilters.join(', ')}`;
        }

        return description;
    }

    /**
     * Generate tags for the search
     * @param {string} query - Search query
     * @param {Object} filters - Search filters
     * @returns {Array} Generated tags
     */
    generateTags(query, filters) {
        const tags = [];
        
        // Query-based tags
        if (query.includes('*')) tags.push('wildcard');
        if (query.includes(' to ')) tags.push('range');
        if (query.match(/^SG\s+COM/i)) tags.push('id-pattern');
        if (query.match(/^\+?65/)) tags.push('phone');
        if (query.includes('@')) tags.push('email');
        
        // Filter-based tags
        if (filters.status && filters.status !== 'all') {
            tags.push(`status-${filters.status}`);
        }
        if (filters.companyName) tags.push('company-filter');
        if (filters.dateRange) tags.push('date-filter');
        
        return tags;
    }

    /**
     * Format display name for a saved search
     * @param {Object} search - Saved search object
     * @returns {string} Formatted display name
     */
    formatDisplayName(search) {
        let displayName = search.name;
        
        if (search.executionCount > 0) {
            displayName += ` (used ${search.executionCount} times)`;
        }
        
        return displayName;
    }

    /**
     * Format timestamp as "time ago" string
     * @param {string} timestamp - ISO timestamp
     * @returns {string} Formatted time ago string
     */
    formatTimeAgo(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diffMs = now - time;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return time.toLocaleDateString();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SavedSearches;
}