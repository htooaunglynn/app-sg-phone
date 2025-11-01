/**
 * Pattern Matcher for Enhanced Search Engine
 * Handles ID pattern parsing, wildcard matching, and range searches
 */

class PatternMatcher {
    constructor() {
        // Pattern definitions for different search types
        this.patterns = {
            wildcard: /^(.+)\*$/,
            range: /^(.+?)\s+to\s+(.+)$/i,
            rangeAlternative: /^(.+?)\s*-\s*(.+)$/,
            exact: /^(.+)$/
        };
        
        // Common ID prefixes for Singapore phone records
        this.commonPrefixes = ['SG COM', 'SG', 'COM'];
    }

    /**
     * Parse a search query to determine its type and extract components
     * @param {string} query - Raw search query
     * @returns {Object} Parsed query object
     */
    parseQuery(query) {
        if (!query || typeof query !== 'string') {
            return { type: 'empty', original: query, components: [] };
        }

        const trimmedQuery = query.trim();
        
        // Check for range patterns first (most specific)
        const rangeMatch = trimmedQuery.match(this.patterns.range);
        if (rangeMatch) {
            return {
                type: 'range',
                original: trimmedQuery,
                components: [rangeMatch[1].trim(), rangeMatch[2].trim()],
                startId: rangeMatch[1].trim(),
                endId: rangeMatch[2].trim()
            };
        }

        // Check for alternative range pattern (with dash)
        const rangeAltMatch = trimmedQuery.match(this.patterns.rangeAlternative);
        if (rangeAltMatch && !trimmedQuery.includes('*')) { // Avoid matching wildcards with dashes
            return {
                type: 'range',
                original: trimmedQuery,
                components: [rangeAltMatch[1].trim(), rangeAltMatch[2].trim()],
                startId: rangeAltMatch[1].trim(),
                endId: rangeAltMatch[2].trim()
            };
        }

        // Check for wildcard patterns
        const wildcardMatch = trimmedQuery.match(this.patterns.wildcard);
        if (wildcardMatch) {
            return {
                type: 'wildcard',
                original: trimmedQuery,
                components: [wildcardMatch[1]],
                prefix: wildcardMatch[1]
            };
        }

        // Default to exact/contains search
        return {
            type: 'contains',
            original: trimmedQuery,
            components: [trimmedQuery]
        };
    }

    /**
     * Parse ID pattern specifically for ID-based searches
     * @param {string} pattern - ID pattern string
     * @returns {Object} Parsed pattern object
     */
    parseIdPattern(pattern) {
        if (!pattern || typeof pattern !== 'string') {
            return { type: 'exact', match: [''] };
        }

        const trimmedPattern = pattern.trim();

        // Check each pattern type
        for (const [type, regex] of Object.entries(this.patterns)) {
            const match = trimmedPattern.match(regex);
            if (match) {
                return { 
                    type, 
                    match: match.slice(1),
                    original: trimmedPattern
                };
            }
        }

        return { type: 'exact', match: [trimmedPattern], original: trimmedPattern };
    }

    /**
     * Match records against a parsed query with enhanced pattern matching
     * Implements Requirements: 1.1, 1.3, 1.4
     * @param {Array} records - Array of records to search
     * @param {Object} parsedQuery - Parsed query object
     * @returns {Array} Matching records with relevance scoring
     */
    match(records, parsedQuery) {
        if (!records || !Array.isArray(records)) {
            return [];
        }

        if (!parsedQuery || !parsedQuery.type) {
            return records;
        }

        let matchedRecords = [];

        switch (parsedQuery.type) {
            case 'wildcard':
                matchedRecords = this.matchWildcard(records, parsedQuery.prefix);
                break;
            
            case 'range':
                matchedRecords = this.matchRange(records, parsedQuery.startId, parsedQuery.endId);
                break;
            
            case 'contains':
                matchedRecords = this.matchContains(records, parsedQuery.original);
                break;
            
            case 'empty':
                return records; // Return all records for empty query
            
            default:
                matchedRecords = this.matchContains(records, parsedQuery.original);
        }

        // Add relevance scoring to matched records
        return this.rankResultsByMatchQuality(matchedRecords, parsedQuery);
    }

    /**
     * Match records using wildcard pattern matching for searches like "SG COM-200*"
     * Enhanced to handle Singapore phone record ID patterns
     * Implements Requirements: 1.1, 1.3
     * @param {Array} records - Records to search
     * @param {string} prefix - Wildcard prefix
     * @returns {Array} Matching records
     */
    matchWildcard(records, prefix) {
        if (!prefix || !records || !Array.isArray(records)) {
            return records || [];
        }

        const lowerPrefix = prefix.toLowerCase().trim();
        
        return records.filter(record => {
            // Primary match: ID field (most important for Singapore phone records)
            const recordId = (record.Id || record.id || '').toString().toLowerCase();
            if (recordId && recordId.startsWith(lowerPrefix)) {
                return true;
            }
            
            // Secondary matches: other searchable fields
            const searchableFields = [
                record.CompanyName || record.companyName,
                record.Phone || record.phone,
                record.PhysicalAddress || record.physicalAddress || record.address,
                record.Email || record.email,
                record.Website || record.website
            ];
            
            return searchableFields.some(field => {
                if (!field) return false;
                const fieldValue = field.toString().toLowerCase();
                return fieldValue.startsWith(lowerPrefix);
            });
        });
    }

    /**
     * Match records within an ID range for "SG COM-2001 to SG COM-2010" queries
     * Enhanced range matching with intelligent numeric comparison
     * Implements Requirements: 1.1, 1.3, 1.4
     * @param {Array} records - Records to search
     * @param {string} startId - Starting ID
     * @param {string} endId - Ending ID
     * @returns {Array} Matching records
     */
    matchRange(records, startId, endId) {
        if (!startId || !endId || !records || !Array.isArray(records)) {
            return records || [];
        }

        return records.filter(record => {
            const recordId = record.Id || record.id || '';
            return this.isIdInRange(recordId, startId, endId);
        });
    }

    /**
     * Match records containing the search term with fuzzy matching support
     * Enhanced to support partial ID searches and flexible field matching
     * Implements Requirements: 1.1, 1.4
     * @param {Array} records - Records to search
     * @param {string} searchTerm - Term to search for
     * @returns {Array} Matching records
     */
    matchContains(records, searchTerm) {
        if (!searchTerm || !records || !Array.isArray(records)) {
            return records || [];
        }

        const lowerSearchTerm = searchTerm.toLowerCase().trim();
        
        return records.filter(record => {
            // Build searchable text for the record with field normalization
            const searchableFields = [
                record.Id || record.id || '',
                record.Phone || record.phone || '',
                record.CompanyName || record.companyName || '',
                record.PhysicalAddress || record.physicalAddress || record.address || '',
                record.Email || record.email || '',
                record.Website || record.website || ''
            ];
            
            const searchableText = searchableFields
                .map(field => field.toString().toLowerCase())
                .join(' ');
            
            // Primary match: exact contains
            if (searchableText.includes(lowerSearchTerm)) {
                return true;
            }
            
            // Secondary match: fuzzy matching for partial searches
            return this.fuzzyMatch(searchableText, lowerSearchTerm);
        });
    }

    /**
     * Perform fuzzy matching for partial ID searches
     * Handles common typos and partial matches
     * @param {string} text - Text to search in
     * @param {string} pattern - Pattern to search for
     * @returns {boolean} True if fuzzy match found
     */
    fuzzyMatch(text, pattern) {
        if (!text || !pattern || pattern.length < 3) {
            return false; // Require minimum 3 characters for fuzzy matching
        }

        // Split pattern into words for better matching
        const patternWords = pattern.split(/\s+/).filter(word => word.length > 1);
        
        // Check if all pattern words are found in text (order independent)
        return patternWords.every(word => text.includes(word));
    }

    /**
     * Check if a record ID falls within a specified range
     * @param {string} recordId - Record ID to check
     * @param {string} startId - Range start ID
     * @param {string} endId - Range end ID
     * @returns {boolean} True if ID is in range
     */
    isIdInRange(recordId, startId, endId) {
        if (!recordId || !startId || !endId) {
            return false;
        }

        // Extract numeric parts for comparison
        const recordNum = this.extractNumericPart(recordId);
        const startNum = this.extractNumericPart(startId);
        const endNum = this.extractNumericPart(endId);

        // If all have numeric parts, compare numerically
        if (recordNum !== null && startNum !== null && endNum !== null) {
            return recordNum >= startNum && recordNum <= endNum;
        }

        // Fallback to string comparison
        const recordIdLower = recordId.toLowerCase();
        const startIdLower = startId.toLowerCase();
        const endIdLower = endId.toLowerCase();

        return recordIdLower >= startIdLower && recordIdLower <= endIdLower;
    }

    /**
     * Extract numeric part from an ID string
     * @param {string} id - ID string
     * @returns {number|null} Extracted number or null if not found
     */
    extractNumericPart(id) {
        if (!id || typeof id !== 'string') {
            return null;
        }

        // Look for numbers at the end of the string (most common pattern)
        const endMatch = id.match(/(\d+)$/);
        if (endMatch) {
            return parseInt(endMatch[1], 10);
        }

        // Look for any number in the string
        const anyMatch = id.match(/(\d+)/);
        if (anyMatch) {
            return parseInt(anyMatch[1], 10);
        }

        return null;
    }

    /**
     * Match records against a specific ID pattern
     * @param {Array} records - Records to search
     * @param {string} pattern - ID pattern
     * @returns {Array} Matching records
     */
    matchIdPattern(records, pattern) {
        const parsed = this.parseIdPattern(pattern);
        
        switch (parsed.type) {
            case 'wildcard':
                return records.filter(record => 
                    record.Id && record.Id.toLowerCase().startsWith(parsed.match[0].toLowerCase())
                );
            
            case 'range':
                return records.filter(record => 
                    this.isIdInRange(record.Id || '', parsed.match[0], parsed.match[1])
                );
            
            case 'exact':
                return records.filter(record => 
                    record.Id && record.Id.toLowerCase().includes(parsed.match[0].toLowerCase())
                );
            
            default:
                return records.filter(record => 
                    record.Id && record.Id.toLowerCase().includes(pattern.toLowerCase())
                );
        }
    }

    /**
     * Generate pattern suggestions based on existing data
     * @param {Array} records - Records to analyze
     * @param {string} partialPattern - Partial pattern input
     * @returns {Array} Array of suggested patterns
     */
    generatePatternSuggestions(records, partialPattern = '') {
        const suggestions = new Set();
        const partial = partialPattern.toLowerCase();

        // Analyze existing IDs to suggest patterns
        records.forEach(record => {
            if (record.Id) {
                const id = record.Id;
                
                // Suggest wildcard patterns
                if (id.toLowerCase().includes(partial)) {
                    // Extract prefix for wildcard suggestion
                    const parts = id.split('-');
                    if (parts.length > 1) {
                        suggestions.add(`${parts[0]}-*`);
                    }
                    
                    // Suggest partial wildcards
                    if (id.length > 3) {
                        suggestions.add(`${id.substring(0, id.length - 1)}*`);
                    }
                }
            }
        });

        // Add common pattern suggestions
        if (partial.includes('sg') || partial.includes('com')) {
            suggestions.add('SG COM-*');
            suggestions.add('SG COM-2001 to SG COM-2010');
        }

        return Array.from(suggestions).slice(0, 5);
    }

    /**
     * Parse ID pattern method specifically for handling wildcards, ranges, and exact matches
     * Enhanced version with better support for Singapore phone record patterns
     * @param {string} pattern - ID pattern to parse
     * @returns {Object} Parsed pattern with detailed information
     */
    parseIdPattern(pattern) {
        if (!pattern || typeof pattern !== 'string') {
            return { 
                type: 'exact', 
                match: [''], 
                original: pattern,
                isValid: false,
                error: 'Pattern cannot be empty'
            };
        }

        const trimmedPattern = pattern.trim();
        
        // Enhanced wildcard pattern matching - supports "SG COM-200*"
        const wildcardMatch = trimmedPattern.match(/^(.+)\*$/);
        if (wildcardMatch) {
            return {
                type: 'wildcard',
                match: [wildcardMatch[1]],
                original: trimmedPattern,
                prefix: wildcardMatch[1],
                isValid: true,
                description: `Wildcard search for IDs starting with "${wildcardMatch[1]}"`
            };
        }

        // Enhanced range pattern matching - supports "SG COM-2001 to SG COM-2010"
        const rangeMatch = trimmedPattern.match(/^(.+?)\s+to\s+(.+)$/i);
        if (rangeMatch) {
            const startId = rangeMatch[1].trim();
            const endId = rangeMatch[2].trim();
            
            return {
                type: 'range',
                match: [startId, endId],
                original: trimmedPattern,
                startId: startId,
                endId: endId,
                isValid: true,
                description: `Range search from "${startId}" to "${endId}"`
            };
        }

        // Alternative range pattern with dash
        const dashRangeMatch = trimmedPattern.match(/^(.+?)\s*-\s*(.+)$/);
        if (dashRangeMatch && !trimmedPattern.includes('*')) {
            const startId = dashRangeMatch[1].trim();
            const endId = dashRangeMatch[2].trim();
            
            // Validate that this looks like a range, not just a hyphenated ID
            if (this.looksLikeRange(startId, endId)) {
                return {
                    type: 'range',
                    match: [startId, endId],
                    original: trimmedPattern,
                    startId: startId,
                    endId: endId,
                    isValid: true,
                    description: `Range search from "${startId}" to "${endId}"`
                };
            }
        }

        // Exact/contains match
        return {
            type: 'exact',
            match: [trimmedPattern],
            original: trimmedPattern,
            isValid: true,
            description: `Exact/contains search for "${trimmedPattern}"`
        };
    }

    /**
     * Match ID pattern method for comparing record IDs against patterns
     * Enhanced to handle Singapore phone record ID formats
     * @param {string} recordId - Record ID to check
     * @param {string} pattern - Pattern to match against
     * @returns {boolean} True if record ID matches the pattern
     */
    matchIdPattern(recordId, pattern) {
        if (!recordId || !pattern) {
            return false;
        }

        const parsed = this.parseIdPattern(pattern);
        
        if (!parsed.isValid) {
            return false;
        }

        const recordIdLower = recordId.toLowerCase();
        
        switch (parsed.type) {
            case 'wildcard':
                return recordIdLower.startsWith(parsed.prefix.toLowerCase());
            
            case 'range':
                return this.isIdInRange(recordId, parsed.startId, parsed.endId);
            
            case 'exact':
                return recordIdLower.includes(parsed.match[0].toLowerCase());
            
            default:
                return false;
        }
    }

    /**
     * Enhanced isIdInRange method for range-based ID searches
     * Specifically designed for Singapore phone record ID patterns like "SG COM-2001"
     * @param {string} recordId - Record ID to check
     * @param {string} startId - Starting ID of the range
     * @param {string} endId - Ending ID of the range
     * @returns {boolean} True if record ID falls within the range
     */
    isIdInRange(recordId, startId, endId) {
        if (!recordId || !startId || !endId) {
            return false;
        }

        // Normalize IDs for comparison
        const normalizeId = (id) => id.trim().toLowerCase();
        
        const normalizedRecordId = normalizeId(recordId);
        const normalizedStartId = normalizeId(startId);
        const normalizedEndId = normalizeId(endId);

        // Extract numeric parts for intelligent comparison
        const recordNum = this.extractNumericPart(recordId);
        const startNum = this.extractNumericPart(startId);
        const endNum = this.extractNumericPart(endId);

        // If all IDs have the same prefix and numeric parts, compare numerically
        if (recordNum !== null && startNum !== null && endNum !== null) {
            const recordPrefix = this.extractPrefix(recordId);
            const startPrefix = this.extractPrefix(startId);
            const endPrefix = this.extractPrefix(endId);
            
            // Check if prefixes match (for IDs like "SG COM-2001", "SG COM-2002")
            if (recordPrefix === startPrefix && startPrefix === endPrefix) {
                return recordNum >= startNum && recordNum <= endNum;
            }
        }

        // Fallback to lexicographic comparison
        return normalizedRecordId >= normalizedStartId && normalizedRecordId <= normalizedEndId;
    }

    /**
     * Extract prefix from ID (everything before the last number)
     * @param {string} id - ID to extract prefix from
     * @returns {string} Prefix part of the ID
     */
    extractPrefix(id) {
        if (!id) return '';
        
        const match = id.match(/^(.+?)(\d+)$/);
        return match ? match[1].toLowerCase() : id.toLowerCase();
    }

    /**
     * Check if two strings look like they form a range pattern
     * @param {string} start - Start string
     * @param {string} end - End string
     * @returns {boolean} True if it looks like a range
     */
    looksLikeRange(start, end) {
        // Check if both have numbers and similar structure
        const startNum = this.extractNumericPart(start);
        const endNum = this.extractNumericPart(end);
        
        if (startNum === null || endNum === null) {
            return false;
        }
        
        // Check if prefixes are similar
        const startPrefix = this.extractPrefix(start);
        const endPrefix = this.extractPrefix(end);
        
        return startPrefix === endPrefix && startNum < endNum;
    }

    /**
     * Get pattern examples for user guidance
     * @returns {Array} Array of pattern examples with descriptions
     */
    getPatternExamples() {
        return [
            {
                pattern: 'SG COM-200*',
                description: 'Find all IDs starting with "SG COM-200"',
                type: 'wildcard'
            },
            {
                pattern: 'SG COM-2001 to SG COM-2010',
                description: 'Find IDs in the range from SG COM-2001 to SG COM-2010',
                type: 'range'
            },
            {
                pattern: 'SG COM',
                description: 'Find all IDs containing "SG COM"',
                type: 'contains'
            },
            {
                pattern: 'COM-*',
                description: 'Find all IDs starting with "COM-"',
                type: 'wildcard'
            },
            {
                pattern: '2001 to 2010',
                description: 'Find IDs with numbers in range 2001-2010',
                type: 'range'
            }
        ];
    }

    /**
     * Rank search results based on match quality
     * Implements Requirements: 1.1, 1.3, 1.4
     * @param {Array} records - Records to rank
     * @param {Object} parsedQuery - Parsed query object
     * @returns {Array} Records sorted by relevance score
     */
    rankResultsByMatchQuality(records, parsedQuery) {
        if (!records || !Array.isArray(records) || records.length === 0) {
            return records || [];
        }

        if (!parsedQuery || !parsedQuery.original) {
            return records;
        }

        const query = parsedQuery.original.toLowerCase();
        
        // Calculate relevance score for each record
        const scoredRecords = records.map(record => ({
            ...record,
            _relevanceScore: this.calculateMatchScore(record, query, parsedQuery.type)
        }));

        // Sort by relevance score (highest first)
        return scoredRecords
            .sort((a, b) => b._relevanceScore - a._relevanceScore)
            .map(record => {
                // Remove the temporary score field
                const { _relevanceScore, ...cleanRecord } = record;
                return cleanRecord;
            });
    }

    /**
     * Calculate match score for a record based on query and match type
     * @param {Object} record - Record to score
     * @param {string} query - Search query (lowercase)
     * @param {string} matchType - Type of match (wildcard, range, contains)
     * @returns {number} Relevance score
     */
    calculateMatchScore(record, query, matchType) {
        let score = 0;
        
        const recordId = (record.Id || record.id || '').toString().toLowerCase();
        const phone = (record.Phone || record.phone || '').toString().toLowerCase();
        const companyName = (record.CompanyName || record.companyName || '').toString().toLowerCase();
        const email = (record.Email || record.email || '').toString().toLowerCase();
        const website = (record.Website || record.website || '').toString().toLowerCase();
        const address = (record.PhysicalAddress || record.physicalAddress || record.address || '').toString().toLowerCase();

        // Exact matches get highest scores
        if (recordId === query) score += 1000;
        if (phone === query) score += 900;
        if (companyName === query) score += 800;

        // Starts with matches get high scores
        if (recordId.startsWith(query)) score += 500;
        if (phone.startsWith(query)) score += 400;
        if (companyName.startsWith(query)) score += 300;

        // Contains matches get medium scores
        if (recordId.includes(query)) score += 200;
        if (phone.includes(query)) score += 150;
        if (companyName.includes(query)) score += 100;
        if (email.includes(query)) score += 75;
        if (website.includes(query)) score += 50;
        if (address.includes(query)) score += 25;

        // Bonus points for match type relevance
        switch (matchType) {
            case 'wildcard':
                if (recordId.startsWith(query.replace('*', ''))) score += 100;
                break;
            case 'range':
                // Range matches are already filtered, give consistent score
                score += 50;
                break;
            case 'exact':
                if (recordId === query || phone === query) score += 200;
                break;
        }

        // Bonus for records with complete information
        if (companyName) score += 10;
        if (email) score += 10;
        if (website) score += 5;
        if (address) score += 5;

        return score;
    }

    /**
     * Validate a search pattern
     * @param {string} pattern - Pattern to validate
     * @returns {Object} Validation result
     */
    validatePattern(pattern) {
        if (!pattern || typeof pattern !== 'string') {
            return { valid: false, error: 'Pattern cannot be empty' };
        }

        const trimmed = pattern.trim();
        if (trimmed.length === 0) {
            return { valid: false, error: 'Pattern cannot be empty' };
        }

        // Use the enhanced parseIdPattern for validation
        const parsed = this.parseIdPattern(trimmed);
        
        if (!parsed.isValid) {
            return { valid: false, error: parsed.error || 'Invalid pattern format' };
        }

        // Additional validation for range patterns
        if (parsed.type === 'range') {
            const startNum = this.extractNumericPart(parsed.startId);
            const endNum = this.extractNumericPart(parsed.endId);
            
            if (startNum !== null && endNum !== null && startNum > endNum) {
                return { 
                    valid: false, 
                    error: 'Range start cannot be greater than range end' 
                };
            }
        }

        return { 
            valid: true, 
            type: parsed.type,
            description: parsed.description 
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PatternMatcher;
}