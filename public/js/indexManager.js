/**
 * Index Manager for Enhanced Search Engine
 * Provides client-side indexing for performance optimization
 */

class IndexManager {
    constructor(recordData = []) {
        this.records = recordData;
        this.indexes = {
            id: new Map(),
            phone: new Map(),
            company: new Map(),
            email: new Map(),
            website: new Map(),
            fullText: new Map()
        };
        
        this.indexMetrics = {
            buildTime: 0,
            indexSize: 0,
            lastUpdate: null
        };
        
        // Build initial indexes
        if (recordData.length > 0) {
            this.buildIndexes();
        }
    }

    /**
     * Build all search indexes from the current record set
     */
    buildIndexes() {
        const buildStart = Date.now();
        
        // Clear existing indexes
        this.clearIndexes();
        
        // Build indexes for each record
        this.records.forEach((record, index) => {
            this.indexRecord(record, index);
        });
        
        // Update metrics
        this.indexMetrics.buildTime = Date.now() - buildStart;
        this.indexMetrics.indexSize = this.calculateIndexSize();
        this.indexMetrics.lastUpdate = new Date();
        
        console.log(`Indexes built in ${this.indexMetrics.buildTime}ms for ${this.records.length} records`);
    }

    /**
     * Index a single record
     * @param {Object} record - Record to index
     * @param {number} recordIndex - Index position of the record
     */
    indexRecord(record, recordIndex) {
        // ID index
        if (record.Id) {
            this.addToIndex('id', record.Id.toLowerCase(), recordIndex);
            
            // Index ID parts for partial matching
            const idParts = record.Id.split(/[-\s]/);
            idParts.forEach(part => {
                if (part.trim()) {
                    this.addToIndex('id', part.toLowerCase().trim(), recordIndex);
                }
            });
        }

        // Phone index
        if (record.Phone) {
            const cleanPhone = record.Phone.replace(/\s+/g, '');
            this.addToIndex('phone', cleanPhone, recordIndex);
            
            // Index phone number parts for partial matching
            if (cleanPhone.length > 3) {
                for (let i = 3; i <= cleanPhone.length; i++) {
                    this.addToIndex('phone', cleanPhone.substring(0, i), recordIndex);
                }
            }
        }

        // Company name index
        if (record.CompanyName) {
            const companyLower = record.CompanyName.toLowerCase();
            this.addToIndex('company', companyLower, recordIndex);
            
            // Index company name words
            const words = companyLower.split(/\s+/);
            words.forEach(word => {
                if (word.length > 2) {
                    this.addToIndex('company', word, recordIndex);
                }
            });
        }

        // Email index
        if (record.Email) {
            const emailLower = record.Email.toLowerCase();
            this.addToIndex('email', emailLower, recordIndex);
            
            // Index email parts
            const [localPart, domain] = emailLower.split('@');
            if (localPart) this.addToIndex('email', localPart, recordIndex);
            if (domain) this.addToIndex('email', domain, recordIndex);
        }

        // Website index
        if (record.Website) {
            const websiteLower = record.Website.toLowerCase();
            this.addToIndex('website', websiteLower, recordIndex);
            
            // Index domain from website
            try {
                const url = new URL(record.Website.startsWith('http') ? record.Website : `http://${record.Website}`);
                this.addToIndex('website', url.hostname, recordIndex);
            } catch (e) {
                // Invalid URL, just index as-is
            }
        }

        // Full-text index for general searching
        const fullText = [
            record.Id || '',
            record.Phone || '',
            record.CompanyName || '',
            record.PhysicalAddress || '',
            record.Email || '',
            record.Website || ''
        ].join(' ').toLowerCase();

        // Index n-grams for better partial matching
        this.indexNGrams(fullText, recordIndex);
    }

    /**
     * Add a term to a specific index
     * @param {string} indexName - Name of the index
     * @param {string} term - Term to index
     * @param {number} recordIndex - Record index
     */
    addToIndex(indexName, term, recordIndex) {
        if (!this.indexes[indexName]) {
            this.indexes[indexName] = new Map();
        }

        const index = this.indexes[indexName];
        if (!index.has(term)) {
            index.set(term, new Set());
        }
        index.get(term).add(recordIndex);
    }

    /**
     * Index n-grams for better partial matching
     * @param {string} text - Text to create n-grams from
     * @param {number} recordIndex - Record index
     */
    indexNGrams(text, recordIndex) {
        const words = text.split(/\s+/).filter(word => word.length > 0);
        
        words.forEach(word => {
            // Index the full word
            this.addToIndex('fullText', word, recordIndex);
            
            // Index 3-grams for partial matching
            if (word.length >= 3) {
                for (let i = 0; i <= word.length - 3; i++) {
                    const ngram = word.substring(i, i + 3);
                    this.addToIndex('fullText', ngram, recordIndex);
                }
            }
        });
    }

    /**
     * Search using the indexes
     * @param {string} query - Search query
     * @param {string} indexType - Type of index to search ('id', 'phone', 'company', 'email', 'website', 'fullText')
     * @returns {Set} Set of record indexes that match
     */
    search(query, indexType = 'fullText') {
        if (!query || !this.indexes[indexType]) {
            return new Set();
        }

        const queryLower = query.toLowerCase();
        const matchingIndexes = new Set();
        const index = this.indexes[indexType];

        // Exact match first
        if (index.has(queryLower)) {
            index.get(queryLower).forEach(idx => matchingIndexes.add(idx));
        }

        // Partial matches for longer queries
        if (queryLower.length >= 3) {
            for (const [term, indexes] of index.entries()) {
                if (term.includes(queryLower)) {
                    indexes.forEach(idx => matchingIndexes.add(idx));
                }
            }
        }

        return matchingIndexes;
    }

    /**
     * Search across multiple indexes
     * @param {string} query - Search query
     * @param {Array} indexTypes - Array of index types to search
     * @returns {Set} Combined set of matching record indexes
     */
    multiSearch(query, indexTypes = ['fullText']) {
        const allMatches = new Set();
        
        indexTypes.forEach(indexType => {
            const matches = this.search(query, indexType);
            matches.forEach(idx => allMatches.add(idx));
        });
        
        return allMatches;
    }

    /**
     * Get records by their indexes
     * @param {Set} recordIndexes - Set of record indexes
     * @returns {Array} Array of matching records
     */
    getRecordsByIndexes(recordIndexes) {
        const results = [];
        recordIndexes.forEach(index => {
            if (index < this.records.length) {
                results.push(this.records[index]);
            }
        });
        return results;
    }

    /**
     * Perform an optimized search using indexes
     * @param {string} query - Search query
     * @param {Object} options - Search options
     * @returns {Array} Array of matching records
     */
    optimizedSearch(query, options = {}) {
        const searchStart = Date.now();
        
        if (!query || query.trim().length === 0) {
            return this.records;
        }

        const queryTrimmed = query.trim();
        const indexTypes = options.indexTypes || ['fullText'];
        
        // Use indexes for search
        const matchingIndexes = this.multiSearch(queryTrimmed, indexTypes);
        const results = this.getRecordsByIndexes(matchingIndexes);
        
        const searchTime = Date.now() - searchStart;
        console.log(`Indexed search completed in ${searchTime}ms, found ${results.length} results`);
        
        return results;
    }

    /**
     * Update indexes with new record data
     * @param {Array} newRecords - New record data
     */
    updateIndex(newRecords) {
        this.records = newRecords;
        this.buildIndexes();
    }

    /**
     * Add a single record to existing indexes
     * @param {Object} record - Record to add
     */
    addRecord(record) {
        const recordIndex = this.records.length;
        this.records.push(record);
        this.indexRecord(record, recordIndex);
        
        this.indexMetrics.indexSize = this.calculateIndexSize();
        this.indexMetrics.lastUpdate = new Date();
    }

    /**
     * Remove a record from indexes
     * @param {number} recordIndex - Index of record to remove
     */
    removeRecord(recordIndex) {
        if (recordIndex < 0 || recordIndex >= this.records.length) {
            return;
        }

        // Remove from records array
        this.records.splice(recordIndex, 1);
        
        // Rebuild indexes (simpler than trying to remove specific entries)
        this.buildIndexes();
    }

    /**
     * Clear all indexes
     */
    clearIndexes() {
        Object.keys(this.indexes).forEach(indexName => {
            this.indexes[indexName].clear();
        });
    }

    /**
     * Clear all indexes and data
     */
    clearIndex() {
        this.clearIndexes();
        this.records = [];
        this.indexMetrics = {
            buildTime: 0,
            indexSize: 0,
            lastUpdate: null
        };
    }

    /**
     * Calculate the total size of all indexes
     * @returns {number} Total number of index entries
     */
    calculateIndexSize() {
        let totalSize = 0;
        Object.values(this.indexes).forEach(index => {
            totalSize += index.size;
        });
        return totalSize;
    }

    /**
     * Get index statistics
     * @returns {Object} Index statistics
     */
    getIndexStats() {
        const stats = {
            recordCount: this.records.length,
            indexCount: Object.keys(this.indexes).length,
            totalIndexSize: this.calculateIndexSize(),
            buildTime: this.indexMetrics.buildTime,
            lastUpdate: this.indexMetrics.lastUpdate,
            indexSizes: {}
        };

        // Get size of each individual index
        Object.entries(this.indexes).forEach(([name, index]) => {
            stats.indexSizes[name] = index.size;
        });

        return stats;
    }

    /**
     * Get suggestions based on indexed terms
     * @param {string} partialQuery - Partial query to get suggestions for
     * @param {number} maxSuggestions - Maximum number of suggestions to return
     * @returns {Array} Array of suggestions
     */
    getSuggestions(partialQuery, maxSuggestions = 5) {
        if (!partialQuery || partialQuery.length < 2) {
            return [];
        }

        const queryLower = partialQuery.toLowerCase();
        const suggestions = new Set();

        // Search in ID index for ID-like suggestions
        if (this.indexes.id) {
            for (const term of this.indexes.id.keys()) {
                if (term.startsWith(queryLower) && suggestions.size < maxSuggestions) {
                    suggestions.add(term);
                }
            }
        }

        // Search in company index for company suggestions
        if (this.indexes.company && suggestions.size < maxSuggestions) {
            for (const term of this.indexes.company.keys()) {
                if (term.startsWith(queryLower) && suggestions.size < maxSuggestions) {
                    suggestions.add(term);
                }
            }
        }

        return Array.from(suggestions).slice(0, maxSuggestions);
    }

    /**
     * Optimize indexes by removing unused entries
     */
    optimizeIndexes() {
        const optimizeStart = Date.now();
        let removedEntries = 0;

        Object.entries(this.indexes).forEach(([indexName, index]) => {
            const toRemove = [];
            
            for (const [term, recordIndexes] of index.entries()) {
                // Remove entries that point to non-existent records
                const validIndexes = new Set();
                recordIndexes.forEach(idx => {
                    if (idx < this.records.length) {
                        validIndexes.add(idx);
                    }
                });
                
                if (validIndexes.size === 0) {
                    toRemove.push(term);
                } else if (validIndexes.size !== recordIndexes.size) {
                    index.set(term, validIndexes);
                }
            }
            
            toRemove.forEach(term => {
                index.delete(term);
                removedEntries++;
            });
        });

        const optimizeTime = Date.now() - optimizeStart;
        console.log(`Index optimization completed in ${optimizeTime}ms, removed ${removedEntries} entries`);
        
        this.indexMetrics.indexSize = this.calculateIndexSize();
        this.indexMetrics.lastUpdate = new Date();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IndexManager;
}