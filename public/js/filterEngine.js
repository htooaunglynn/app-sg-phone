/**
 * Filter Engine for Enhanced Search Engine
 * Handles multi-criteria filtering and advanced search options
 */

class FilterEngine {
    constructor() {
        // Filter type definitions
        this.filterTypes = {
            id: 'string',
            phone: 'string',
            companyName: 'string',
            address: 'string',
            email: 'string',
            website: 'string',
            status: 'boolean',
            dateRange: 'object'
        };
        
        // Performance tracking
        this.filterMetrics = {
            lastFilterTime: 0,
            filterCounts: {}
        };
    }

    /**
     * Apply multiple filters to a record set with sequential filter application
     * Implements Requirements: 2.1, 2.2, 2.4, 2.5
     * @param {Array} records - Records to filter
     * @param {Object} filters - Filter criteria object
     * @returns {Promise<Array>} Filtered records
     */
    async apply(records, filters = {}) {
        const filterStart = Date.now();
        
        if (!records || !Array.isArray(records)) {
            console.warn('FilterEngine.apply: Invalid records array provided');
            return [];
        }

        if (!filters || Object.keys(filters).length === 0) {
            return records;
        }

        let filteredRecords = [...records];
        const appliedFilters = [];

        try {
            // Apply each filter sequentially for better performance and debugging
            // Each filter reduces the dataset size for subsequent filters

            // ID filter - most specific, apply first
            if (filters.id && filters.id.trim()) {
                const beforeCount = filteredRecords.length;
                filteredRecords = this.filterById(filteredRecords, filters.id.trim());
                appliedFilters.push(`ID: ${beforeCount} -> ${filteredRecords.length}`);
            }

            // Phone filter
            if (filters.phone && filters.phone.trim()) {
                const beforeCount = filteredRecords.length;
                filteredRecords = this.filterByPhone(filteredRecords, filters.phone.trim());
                appliedFilters.push(`Phone: ${beforeCount} -> ${filteredRecords.length}`);
            }

            // Status filter - boolean, fast to apply
            if (filters.status && filters.status !== 'all') {
                const beforeCount = filteredRecords.length;
                filteredRecords = this.filterByStatus(filteredRecords, filters.status);
                appliedFilters.push(`Status: ${beforeCount} -> ${filteredRecords.length}`);
            }

            // Company name filter
            if (filters.companyName && filters.companyName.trim()) {
                const beforeCount = filteredRecords.length;
                filteredRecords = this.filterByCompanyName(filteredRecords, filters.companyName.trim());
                appliedFilters.push(`Company: ${beforeCount} -> ${filteredRecords.length}`);
            }

            // Address filter
            if (filters.address && filters.address.trim()) {
                const beforeCount = filteredRecords.length;
                filteredRecords = this.filterByAddress(filteredRecords, filters.address.trim());
                appliedFilters.push(`Address: ${beforeCount} -> ${filteredRecords.length}`);
            }

            // Email filter
            if (filters.email && filters.email.trim()) {
                const beforeCount = filteredRecords.length;
                filteredRecords = this.filterByEmail(filteredRecords, filters.email.trim());
                appliedFilters.push(`Email: ${beforeCount} -> ${filteredRecords.length}`);
            }

            // Website filter
            if (filters.website && filters.website.trim()) {
                const beforeCount = filteredRecords.length;
                filteredRecords = this.filterByWebsite(filteredRecords, filters.website.trim());
                appliedFilters.push(`Website: ${beforeCount} -> ${filteredRecords.length}`);
            }

            // Date range filter - most expensive, apply last
            if (filters.dateRange && this.isValidDateRange(filters.dateRange)) {
                const beforeCount = filteredRecords.length;
                filteredRecords = this.filterByDateRange(filteredRecords, filters.dateRange);
                appliedFilters.push(`DateRange: ${beforeCount} -> ${filteredRecords.length}`);
            }

            // Track performance and filter application
            const filterTime = Date.now() - filterStart;
            this.filterMetrics.lastFilterTime = filterTime;
            
            // Log filter chain for debugging (only in development)
            if (appliedFilters.length > 0 && typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
                console.log(`Filter chain applied: ${appliedFilters.join(' | ')} (${filterTime}ms)`);
            }
            
            return filteredRecords;

        } catch (error) {
            console.error('Filter application error:', error);
            console.error('Applied filters before error:', appliedFilters);
            return records; // Return original records on error
        }
    }

    /**
     * Filter records by ID pattern with enhanced pattern matching
     * Supports wildcards, ranges, and exact matching for Singapore phone record IDs
     * Implements Requirements: 2.1, 2.2
     * @param {Array} records - Records to filter
     * @param {string} idPattern - ID pattern to match
     * @returns {Array} Filtered records
     */
    filterById(records, idPattern) {
        if (!idPattern || !records || !Array.isArray(records)) {
            return records || [];
        }

        const pattern = idPattern.trim().toLowerCase();
        
        return records.filter(record => {
            const recordId = (record.Id || record.id || '').toString().toLowerCase();
            
            if (!recordId) return false;
            
            // Support wildcard matching (e.g., "SG COM-200*")
            if (pattern.includes('*')) {
                const prefix = pattern.replace(/\*+/g, '');
                return recordId.startsWith(prefix);
            }
            
            // Support range matching (e.g., "SG COM-2001 to SG COM-2010")
            if (pattern.includes(' to ')) {
                const [start, end] = pattern.split(' to ').map(s => s.trim());
                return this.isIdInRange(recordId, start, end);
            }
            
            // Support alternative range syntax with dash
            if (pattern.includes('-') && !recordId.includes('-')) {
                // This might be a range like "2001-2010" for IDs like "SG COM-2001"
                const rangeParts = pattern.split('-');
                if (rangeParts.length === 2 && /^\d+$/.test(rangeParts[0]) && /^\d+$/.test(rangeParts[1])) {
                    const startNum = parseInt(rangeParts[0]);
                    const endNum = parseInt(rangeParts[1]);
                    const recordNum = this.extractNumber(recordId);
                    if (recordNum !== null) {
                        return recordNum >= startNum && recordNum <= endNum;
                    }
                }
            }
            
            // Default contains matching
            return recordId.includes(pattern);
        });
    }

    /**
     * Filter records by phone number with flexible matching
     * Handles various phone number formats and partial matching
     * Implements Requirements: 2.1, 2.2
     * @param {Array} records - Records to filter
     * @param {string} phonePattern - Phone pattern to match
     * @returns {Array} Filtered records
     */
    filterByPhone(records, phonePattern) {
        if (!phonePattern || !records || !Array.isArray(records)) {
            return records || [];
        }

        // Normalize pattern by removing common separators and spaces
        const pattern = phonePattern.toLowerCase()
            .replace(/[\s\-\(\)\+]/g, '')
            .trim();
        
        if (!pattern) return records;
        
        return records.filter(record => {
            const phone = (record.Phone || record.phone || '').toString().toLowerCase()
                .replace(/[\s\-\(\)\+]/g, '');
            
            if (!phone) return false;
            
            // Support partial phone matching from start (most common use case)
            if (phone.startsWith(pattern)) {
                return true;
            }
            
            // Support contains matching for middle digits
            return phone.includes(pattern);
        });
    }

    /**
     * Filter records by company name
     * @param {Array} records - Records to filter
     * @param {string} companyPattern - Company name pattern to match
     * @returns {Array} Filtered records
     */
    filterByCompanyName(records, companyPattern) {
        if (!companyPattern) return records;

        const pattern = companyPattern.toLowerCase();
        
        return records.filter(record => {
            const companyName = (record.CompanyName || '').toLowerCase();
            return companyName.includes(pattern);
        });
    }

    /**
     * Filter records by address
     * @param {Array} records - Records to filter
     * @param {string} addressPattern - Address pattern to match
     * @returns {Array} Filtered records
     */
    filterByAddress(records, addressPattern) {
        if (!addressPattern) return records;

        const pattern = addressPattern.toLowerCase();
        
        return records.filter(record => {
            const address = (record.PhysicalAddress || '').toLowerCase();
            return address.includes(pattern);
        });
    }

    /**
     * Filter records by email
     * @param {Array} records - Records to filter
     * @param {string} emailPattern - Email pattern to match
     * @returns {Array} Filtered records
     */
    filterByEmail(records, emailPattern) {
        if (!emailPattern) return records;

        const pattern = emailPattern.toLowerCase();
        
        return records.filter(record => {
            const email = (record.Email || '').toLowerCase();
            return email.includes(pattern);
        });
    }

    /**
     * Filter records by website
     * @param {Array} records - Records to filter
     * @param {string} websitePattern - Website pattern to match
     * @returns {Array} Filtered records
     */
    filterByWebsite(records, websitePattern) {
        if (!websitePattern) return records;

        const pattern = websitePattern.toLowerCase();
        
        return records.filter(record => {
            const website = (record.Website || '').toLowerCase();
            return website.includes(pattern);
        });
    }

    /**
     * Filter records by Singapore phone validation status
     * Handles various status representations (boolean, number, string)
     * Implements Requirements: 2.2, 2.4
     * @param {Array} records - Records to filter
     * @param {string} status - Status filter ('valid', 'invalid', 'all')
     * @returns {Array} Filtered records
     */
    filterByStatus(records, status) {
        if (!status || status === 'all' || !records || !Array.isArray(records)) {
            return records || [];
        }

        const isValidStatus = status.toLowerCase() === 'valid';
        
        return records.filter(record => {
            // Handle different status representations from database
            const recordStatus = record.Status || record.status;
            
            // Handle null/undefined status
            if (recordStatus === null || recordStatus === undefined) {
                return !isValidStatus; // Treat null/undefined as invalid
            }
            
            // Handle boolean status (most common)
            if (typeof recordStatus === 'boolean') {
                return recordStatus === isValidStatus;
            }
            
            // Handle numeric status (1 = valid, 0 = invalid)
            if (typeof recordStatus === 'number') {
                return (recordStatus === 1) === isValidStatus;
            }
            
            // Handle string status
            if (typeof recordStatus === 'string') {
                const statusLower = recordStatus.toLowerCase().trim();
                if (isValidStatus) {
                    return statusLower === 'true' || 
                           statusLower === 'valid' || 
                           statusLower === '1' ||
                           statusLower === 'yes';
                } else {
                    return statusLower === 'false' || 
                           statusLower === 'invalid' || 
                           statusLower === '0' ||
                           statusLower === 'no';
                }
            }
            
            // Default to invalid for unknown types
            return !isValidStatus;
        });
    }

    /**
     * Filter records by date range for temporal filtering
     * Checks multiple possible date fields and handles various date formats
     * Implements Requirements: 2.4, 2.5
     * @param {Array} records - Records to filter
     * @param {Object} dateRange - Date range object with start and end dates
     * @returns {Array} Filtered records
     */
    filterByDateRange(records, dateRange) {
        if (!this.isValidDateRange(dateRange) || !records || !Array.isArray(records)) {
            return records || [];
        }

        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        
        // Set end date to end of day for inclusive range
        endDate.setHours(23, 59, 59, 999);
        
        return records.filter(record => {
            // Check various date fields that might exist in the record
            const dateFields = [
                record.created_at,
                record.updated_at,
                record.CreatedAt,
                record.UpdatedAt,
                record.ProcessedAt,
                record.processed_at,
                record.timestamp,
                record.date
            ];
            
            let recordDate = null;
            
            // Find the first valid date field
            for (const dateField of dateFields) {
                if (dateField) {
                    const testDate = new Date(dateField);
                    if (!isNaN(testDate.getTime())) {
                        recordDate = testDate;
                        break;
                    }
                }
            }
            
            // If no valid date field found, exclude from results
            if (!recordDate) {
                return false;
            }
            
            // Check if record date falls within the specified range
            return recordDate >= startDate && recordDate <= endDate;
        });
    }

    /**
     * Check if ID is within range (helper method)
     * @param {string} recordId - Record ID to check
     * @param {string} startId - Range start
     * @param {string} endId - Range end
     * @returns {boolean} True if in range
     */
    isIdInRange(recordId, startId, endId) {
        // Extract numeric parts for comparison
        const recordNum = this.extractNumber(recordId);
        const startNum = this.extractNumber(startId);
        const endNum = this.extractNumber(endId);

        // If all have numeric parts, compare numerically
        if (recordNum !== null && startNum !== null && endNum !== null) {
            return recordNum >= startNum && recordNum <= endNum;
        }

        // Fallback to string comparison
        return recordId >= startId && recordId <= endId;
    }

    /**
     * Extract numeric part from string
     * @param {string} str - String to extract number from
     * @returns {number|null} Extracted number or null
     */
    extractNumber(str) {
        if (!str) return null;
        const match = str.match(/(\d+)$/);
        return match ? parseInt(match[1], 10) : null;
    }

    /**
     * Validate date range object
     * @param {Object} dateRange - Date range to validate
     * @returns {boolean} True if valid
     */
    isValidDateRange(dateRange) {
        if (!dateRange || typeof dateRange !== 'object') {
            return false;
        }

        const { start, end } = dateRange;
        
        if (!start || !end) {
            return false;
        }

        const startDate = new Date(start);
        const endDate = new Date(end);

        return !isNaN(startDate.getTime()) && 
               !isNaN(endDate.getTime()) && 
               startDate <= endDate;
    }

    /**
     * Get filter performance metrics
     * @returns {Object} Performance metrics
     */
    getFilterMetrics() {
        return {
            lastFilterTime: this.filterMetrics.lastFilterTime,
            filterCounts: { ...this.filterMetrics.filterCounts }
        };
    }

    /**
     * Reset filter metrics
     */
    resetMetrics() {
        this.filterMetrics.lastFilterTime = 0;
        this.filterMetrics.filterCounts = {};
    }

    /**
     * Create filter combination logic for AND operations
     * Returns a single filter function that applies all criteria
     * Implements Requirements: 2.1, 2.2, 2.5
     * @param {Object} filters - Filter criteria
     * @returns {Function} Combined filter function
     */
    createCombinedFilter(filters) {
        if (!filters || typeof filters !== 'object') {
            return () => true; // Return all records if no filters
        }

        return (record) => {
            // Apply all filters as AND conditions - all must pass for record to be included
            
            // ID filter
            if (filters.id && filters.id.trim()) {
                if (!this.filterById([record], filters.id.trim()).length) return false;
            }
            
            // Phone filter
            if (filters.phone && filters.phone.trim()) {
                if (!this.filterByPhone([record], filters.phone.trim()).length) return false;
            }
            
            // Company name filter
            if (filters.companyName && filters.companyName.trim()) {
                if (!this.filterByCompanyName([record], filters.companyName.trim()).length) return false;
            }
            
            // Address filter
            if (filters.address && filters.address.trim()) {
                if (!this.filterByAddress([record], filters.address.trim()).length) return false;
            }
            
            // Email filter
            if (filters.email && filters.email.trim()) {
                if (!this.filterByEmail([record], filters.email.trim()).length) return false;
            }
            
            // Website filter
            if (filters.website && filters.website.trim()) {
                if (!this.filterByWebsite([record], filters.website.trim()).length) return false;
            }
            
            // Status filter
            if (filters.status && filters.status !== 'all') {
                if (!this.filterByStatus([record], filters.status).length) return false;
            }
            
            // Date range filter
            if (filters.dateRange && this.isValidDateRange(filters.dateRange)) {
                if (!this.filterByDateRange([record], filters.dateRange).length) return false;
            }
            
            return true; // All filters passed
        };
    }

    /**
     * Apply filters using the combined filter function (alternative to sequential apply)
     * Useful for single-pass filtering when performance is critical
     * @param {Array} records - Records to filter
     * @param {Object} filters - Filter criteria
     * @returns {Array} Filtered records
     */
    applyCombined(records, filters = {}) {
        if (!records || !Array.isArray(records)) {
            return [];
        }

        if (!filters || Object.keys(filters).length === 0) {
            return records;
        }

        const filterStart = Date.now();
        const combinedFilter = this.createCombinedFilter(filters);
        const filteredRecords = records.filter(combinedFilter);
        
        this.filterMetrics.lastFilterTime = Date.now() - filterStart;
        
        return filteredRecords;
    }

    /**
     * Get available filter options based on current data
     * @param {Array} records - Records to analyze
     * @returns {Object} Available filter options
     */
    getAvailableFilterOptions(records) {
        const options = {
            statuses: new Set(),
            companies: new Set(),
            domains: new Set(),
            idPrefixes: new Set()
        };

        records.forEach(record => {
            // Status options
            if (record.Status !== undefined && record.Status !== null) {
                options.statuses.add(record.Status);
            }

            // Company options (first 50 unique companies)
            if (record.CompanyName && options.companies.size < 50) {
                options.companies.add(record.CompanyName);
            }

            // Email domain options
            if (record.Email && record.Email.includes('@')) {
                const domain = record.Email.split('@')[1];
                if (domain && options.domains.size < 20) {
                    options.domains.add(domain);
                }
            }

            // ID prefix options
            if (record.Id) {
                const parts = record.Id.split('-');
                if (parts.length > 1 && options.idPrefixes.size < 10) {
                    options.idPrefixes.add(parts[0]);
                }
            }
        });

        return {
            statuses: Array.from(options.statuses),
            companies: Array.from(options.companies).sort(),
            domains: Array.from(options.domains).sort(),
            idPrefixes: Array.from(options.idPrefixes).sort()
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FilterEngine;
}