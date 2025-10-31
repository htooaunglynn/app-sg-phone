/**
 * Frontend Duplicate Phone Number Detection Service
 * Provides client-side duplicate phone detection utilities for check table records
 * Implements efficient duplicate detection for large record sets with phone number normalization
 */
class FrontendDuplicateDetectionService {
    constructor() {
        // Configuration
        this.config = {
            // Phone number normalization settings
            normalization: {
                removeCountryCode: true,
                removeSpaces: true,
                removeHyphens: true,
                removeBrackets: true,
                removePlus: true
            },
            
            // Performance settings
            performance: {
                batchSize: 1000,
                enableCaching: true,
                cacheTimeout: 300000, // 5 minutes
                maxCacheSize: 10000,
                // Large dataset optimizations
                largeDatasetThreshold: 5000,
                enableLazyLoading: true,
                enableBackgroundProcessing: true,
                maxProcessingTime: 10000, // 10 seconds
                enableProgressiveProcessing: true,
                chunkSize: 500,
                enableMemoryOptimization: true
            },
            
            // Duplicate detection settings
            detection: {
                caseSensitive: false,
                strictMatching: false,
                enableFuzzyMatching: false,
                enableEarlyTermination: true,
                maxDuplicatesBeforeOptimization: 1000
            }
        };

        // Cache for duplicate detection results
        this.duplicateCache = new Map();
        this.phoneNormalizationCache = new Map();
        
        // Performance metrics
        this.metrics = {
            totalDetections: 0,
            cacheHits: 0,
            cacheMisses: 0,
            averageDetectionTime: 0,
            lastDetectionTime: 0
        };

        // Initialize service
        this.initialize();
    }

    /**
     * Initialize the duplicate detection service
     */
    initialize() {
        console.log('Frontend Duplicate Detection Service initialized');
        
        // Setup cache cleanup interval
        if (this.config.performance.enableCaching) {
            setInterval(() => {
                this.cleanupCache();
            }, this.config.performance.cacheTimeout);
        }
    }

    /**
     * Identify duplicate phone numbers in check table records with error handling and performance optimization
     * @param {Array} records - Array of phone records from check table
     * @returns {Object} Object containing duplicate information
     */
    identifyDuplicatePhoneNumbers(records) {
        const startTime = Date.now();
        
        try {
            if (!Array.isArray(records) || records.length === 0) {
                return this.createEmptyDuplicateResult();
            }

            // Check cache first
            const cacheKey = this.generateCacheKey(records);
            if (this.config.performance.enableCaching) {
                const cached = this.duplicateCache.get(cacheKey);
                if (cached && (Date.now() - cached.timestamp) < this.config.performance.cacheTimeout) {
                    this.metrics.cacheHits++;
                    return cached.result;
                }
                this.metrics.cacheMisses++;
            }

            // Determine processing strategy based on dataset size
            let result;
            if (records.length >= this.config.performance.largeDatasetThreshold) {
                console.log(`Large dataset detected (${records.length} records), using optimized processing`);
                result = this.processLargeDatasetOptimized(records, startTime);
            } else {
                // Standard processing for smaller datasets
                result = this.processRecordsForDuplicatesWithErrorHandling(records);
            }
            
            // Update metrics
            const detectionTime = Date.now() - startTime;
            this.updateMetrics(detectionTime);
            result.detectionTime = detectionTime;

            // Cache result if successful and not too large
            if (this.config.performance.enableCaching && 
                !result.errorHandling?.hasErrors && 
                records.length < this.config.performance.largeDatasetThreshold) {
                this.cacheResult(cacheKey, result);
            }

            console.log(`Duplicate detection completed in ${detectionTime}ms`, {
                totalRecords: records.length,
                duplicatePhoneNumbers: result.duplicatePhoneNumbers.size,
                duplicateRecords: result.duplicateRecordIds.length,
                hasErrors: result.errorHandling?.hasErrors || false,
                processingMethod: records.length >= this.config.performance.largeDatasetThreshold ? 'optimized' : 'standard'
            });

            return result;

        } catch (error) {
            console.error('Duplicate detection failed:', error);
            
            // Return graceful degradation result
            const fallbackResult = this.createEmptyDuplicateResult();
            fallbackResult.errorHandling = {
                hasErrors: true,
                fallbackUsed: true,
                gracefulDegradation: true,
                error: error.message,
                timestamp: new Date().toISOString()
            };
            fallbackResult.detectionTime = Date.now() - startTime;
            
            return fallbackResult;
        }
    }

    /**
     * Process records to identify duplicates with error handling
     * @param {Array} records - Records to process
     * @returns {Object} Duplicate detection result
     */
    processRecordsForDuplicatesWithErrorHandling(records) {
        try {
            return this.processRecordsForDuplicates(records);
        } catch (error) {
            console.warn('Error in duplicate processing, using fallback:', error);
            return this.fallbackDuplicateProcessing(records, error);
        }
    }

    /**
     * Process records to identify duplicates
     * @param {Array} records - Records to process
     * @returns {Object} Duplicate detection result
     */
    processRecordsForDuplicates(records) {
        const phoneMap = new Map(); // normalized phone -> array of record info
        const duplicatePhoneNumbers = new Set();
        const duplicateRecordIds = [];
        const duplicateRecordMap = new Map(); // phone -> record IDs
        const phoneNormalizationMap = new Map(); // original phone -> normalized phone
        const processingErrors = [];

        // First pass: build phone number map with error handling
        for (let i = 0; i < records.length; i++) {
            try {
                const record = records[i];
                const recordId = this.extractRecordId(record);
                const originalPhone = this.extractPhoneNumber(record);
                
                if (!originalPhone) {
                    continue;
                }

                const normalizedPhone = this.normalizePhoneNumber(originalPhone);
                phoneNormalizationMap.set(originalPhone, normalizedPhone);

                if (!phoneMap.has(normalizedPhone)) {
                    phoneMap.set(normalizedPhone, []);
                }

                phoneMap.get(normalizedPhone).push({
                    recordId,
                    originalPhone,
                    recordIndex: i,
                    record
                });
            } catch (recordError) {
                processingErrors.push({
                    recordIndex: i,
                    error: recordError.message,
                    record: records[i]
                });
                console.warn(`Error processing record at index ${i}:`, recordError);
            }
        }

        // Second pass: identify duplicates with error handling
        for (const [normalizedPhone, recordInfos] of phoneMap) {
            try {
                if (recordInfos.length > 1) {
                    // This phone number has duplicates
                    duplicatePhoneNumbers.add(normalizedPhone);
                    
                    const recordIds = recordInfos.map(info => info.recordId);
                    duplicateRecordIds.push(...recordIds);
                    duplicateRecordMap.set(normalizedPhone, recordIds);
                }
            } catch (duplicateError) {
                processingErrors.push({
                    normalizedPhone,
                    error: duplicateError.message,
                    recordCount: recordInfos.length
                });
                console.warn(`Error processing duplicates for phone ${normalizedPhone}:`, duplicateError);
            }
        }

        const result = {
            duplicatePhoneNumbers,
            duplicateRecordIds,
            duplicateRecordMap,
            phoneNormalizationMap,
            phoneMap,
            totalRecords: records.length,
            duplicateCount: duplicateRecordIds.length,
            uniquePhoneCount: phoneMap.size,
            duplicatePhoneCount: duplicatePhoneNumbers.size,
            detectionTime: 0 // Will be set by caller
        };

        // Add error handling information if there were processing errors
        if (processingErrors.length > 0) {
            result.errorHandling = {
                hasErrors: true,
                processingErrors,
                errorCount: processingErrors.length,
                successfulRecords: records.length - processingErrors.length
            };
        }

        return result;
    }

    /**
     * Process large datasets with performance optimizations
     * @param {Array} records - Large array of records to process
     * @param {number} startTime - Processing start time
     * @returns {Object} Optimized duplicate detection result
     */
    processLargeDatasetOptimized(records, startTime) {
        const result = this.createEmptyDuplicateResult();
        result.totalRecords = records.length;
        result.performanceOptimizations = {
            chunkedProcessing: true,
            memoryOptimization: true,
            progressiveProcessing: this.config.performance.enableProgressiveProcessing,
            backgroundProcessing: this.config.performance.enableBackgroundProcessing
        };

        try {
            if (this.config.performance.enableProgressiveProcessing) {
                return this.processRecordsProgressively(records, startTime);
            } else {
                return this.processRecordsInChunks(records, startTime);
            }
        } catch (error) {
            console.warn('Optimized processing failed, falling back to standard processing:', error);
            return this.fallbackDuplicateProcessing(records, error);
        }
    }

    /**
     * Process records progressively to avoid blocking the UI
     * @param {Array} records - Records to process
     * @param {number} startTime - Processing start time
     * @returns {Promise<Object>} Progressive processing result
     */
    async processRecordsProgressively(records, startTime) {
        const result = this.createEmptyDuplicateResult();
        result.totalRecords = records.length;
        
        const phoneMap = new Map();
        const duplicatePhoneNumbers = new Set();
        const duplicateRecordIds = [];
        const duplicateRecordMap = new Map();
        const phoneNormalizationMap = new Map();
        
        const chunkSize = this.config.performance.chunkSize;
        const maxProcessingTime = this.config.performance.maxProcessingTime;
        let processedRecords = 0;
        let processingErrors = [];

        // Process records in chunks with yield points
        for (let i = 0; i < records.length; i += chunkSize) {
            const chunkStartTime = Date.now();
            
            // Check if we've exceeded max processing time
            if (Date.now() - startTime > maxProcessingTime) {
                console.warn(`Processing timeout reached, processed ${processedRecords}/${records.length} records`);
                result.errorHandling = {
                    hasErrors: true,
                    timeout: true,
                    processedRecords,
                    totalRecords: records.length,
                    partialResult: true
                };
                break;
            }

            const chunk = records.slice(i, i + chunkSize);
            
            try {
                // Process chunk
                const chunkResult = this.processChunkOptimized(chunk, i, phoneMap, phoneNormalizationMap);
                processedRecords += chunk.length;
                
                if (chunkResult.errors.length > 0) {
                    processingErrors.push(...chunkResult.errors);
                }

                // Yield control to prevent UI blocking
                if (Date.now() - chunkStartTime > 50) { // If chunk took more than 50ms
                    await this.yieldControl();
                }

            } catch (chunkError) {
                console.warn(`Error processing chunk ${Math.floor(i / chunkSize) + 1}:`, chunkError);
                processingErrors.push({
                    chunkIndex: Math.floor(i / chunkSize) + 1,
                    error: chunkError.message,
                    recordsInChunk: chunk.length
                });
            }
        }

        // Identify duplicates from processed phone map
        for (const [normalizedPhone, recordInfos] of phoneMap) {
            if (recordInfos.length > 1) {
                duplicatePhoneNumbers.add(normalizedPhone);
                const recordIds = recordInfos.map(info => info.recordId);
                duplicateRecordIds.push(...recordIds);
                duplicateRecordMap.set(normalizedPhone, recordIds);
            }
        }

        // Finalize result
        result.duplicatePhoneNumbers = duplicatePhoneNumbers;
        result.duplicateRecordIds = duplicateRecordIds;
        result.duplicateRecordMap = duplicateRecordMap;
        result.phoneNormalizationMap = phoneNormalizationMap;
        result.phoneMap = phoneMap;
        result.duplicateCount = duplicateRecordIds.length;
        result.uniquePhoneCount = phoneMap.size;
        result.duplicatePhoneCount = duplicatePhoneNumbers.size;

        if (processingErrors.length > 0) {
            result.errorHandling = {
                hasErrors: true,
                processingErrors,
                errorCount: processingErrors.length,
                successfulRecords: processedRecords - processingErrors.length
            };
        }

        return result;
    }

    /**
     * Process records in chunks for memory optimization
     * @param {Array} records - Records to process
     * @param {number} startTime - Processing start time
     * @returns {Object} Chunked processing result
     */
    processRecordsInChunks(records, startTime) {
        const result = this.createEmptyDuplicateResult();
        result.totalRecords = records.length;
        
        const phoneMap = new Map();
        const phoneNormalizationMap = new Map();
        const chunkSize = this.config.performance.chunkSize;
        let processingErrors = [];

        // Process records in memory-efficient chunks
        for (let i = 0; i < records.length; i += chunkSize) {
            const chunk = records.slice(i, i + chunkSize);
            
            try {
                const chunkResult = this.processChunkOptimized(chunk, i, phoneMap, phoneNormalizationMap);
                
                if (chunkResult.errors.length > 0) {
                    processingErrors.push(...chunkResult.errors);
                }

                // Memory cleanup between chunks
                if (this.config.performance.enableMemoryOptimization && i % (chunkSize * 10) === 0) {
                    this.performMemoryCleanup();
                }

            } catch (chunkError) {
                console.warn(`Error processing chunk ${Math.floor(i / chunkSize) + 1}:`, chunkError);
                processingErrors.push({
                    chunkIndex: Math.floor(i / chunkSize) + 1,
                    error: chunkError.message,
                    recordsInChunk: chunk.length
                });
            }
        }

        // Identify duplicates
        const duplicatePhoneNumbers = new Set();
        const duplicateRecordIds = [];
        const duplicateRecordMap = new Map();

        for (const [normalizedPhone, recordInfos] of phoneMap) {
            if (recordInfos.length > 1) {
                duplicatePhoneNumbers.add(normalizedPhone);
                const recordIds = recordInfos.map(info => info.recordId);
                duplicateRecordIds.push(...recordIds);
                duplicateRecordMap.set(normalizedPhone, recordIds);
            }
        }

        // Finalize result
        result.duplicatePhoneNumbers = duplicatePhoneNumbers;
        result.duplicateRecordIds = duplicateRecordIds;
        result.duplicateRecordMap = duplicateRecordMap;
        result.phoneNormalizationMap = phoneNormalizationMap;
        result.phoneMap = phoneMap;
        result.duplicateCount = duplicateRecordIds.length;
        result.uniquePhoneCount = phoneMap.size;
        result.duplicatePhoneCount = duplicatePhoneNumbers.size;

        if (processingErrors.length > 0) {
            result.errorHandling = {
                hasErrors: true,
                processingErrors,
                errorCount: processingErrors.length,
                successfulRecords: records.length - processingErrors.length
            };
        }

        return result;
    }

    /**
     * Process a chunk of records with optimization
     * @param {Array} chunk - Chunk of records to process
     * @param {number} startIndex - Starting index of chunk
     * @param {Map} phoneMap - Phone map to update
     * @param {Map} phoneNormalizationMap - Normalization map to update
     * @returns {Object} Chunk processing result
     */
    processChunkOptimized(chunk, startIndex, phoneMap, phoneNormalizationMap) {
        const errors = [];

        for (let i = 0; i < chunk.length; i++) {
            try {
                const record = chunk[i];
                const recordId = this.extractRecordId(record);
                const originalPhone = this.extractPhoneNumber(record);
                
                if (!originalPhone) {
                    continue;
                }

                const normalizedPhone = this.normalizePhoneNumber(originalPhone);
                phoneNormalizationMap.set(originalPhone, normalizedPhone);

                if (!phoneMap.has(normalizedPhone)) {
                    phoneMap.set(normalizedPhone, []);
                }

                phoneMap.get(normalizedPhone).push({
                    recordId,
                    originalPhone,
                    recordIndex: startIndex + i,
                    record
                });

            } catch (recordError) {
                errors.push({
                    recordIndex: startIndex + i,
                    error: recordError.message,
                    record: chunk[i]
                });
            }
        }

        return { errors };
    }

    /**
     * Yield control to prevent UI blocking
     * @returns {Promise} Promise that resolves after yielding
     */
    yieldControl() {
        return new Promise(resolve => setTimeout(resolve, 0));
    }

    /**
     * Perform memory cleanup to optimize memory usage
     */
    performMemoryCleanup() {
        // Clean up phone normalization cache if it's getting too large
        if (this.phoneNormalizationCache.size > this.config.performance.maxCacheSize * 2) {
            const keysToDelete = Array.from(this.phoneNormalizationCache.keys()).slice(0, this.config.performance.maxCacheSize);
            keysToDelete.forEach(key => this.phoneNormalizationCache.delete(key));
        }

        // Clean up duplicate cache if needed
        if (this.duplicateCache.size > this.config.performance.maxCacheSize) {
            const oldestEntries = Array.from(this.duplicateCache.entries())
                .sort((a, b) => a[1].timestamp - b[1].timestamp)
                .slice(0, Math.floor(this.config.performance.maxCacheSize / 2));
            
            oldestEntries.forEach(([key]) => this.duplicateCache.delete(key));
        }

        // Trigger garbage collection if available
        if (typeof window !== 'undefined' && window.gc) {
            try {
                window.gc();
            } catch (gcError) {
                // Ignore GC errors
            }
        }
    }

    /**
     * Fallback duplicate processing when main processing fails
     * @param {Array} records - Records to process
     * @param {Error} originalError - The original error that caused fallback
     * @returns {Object} Fallback duplicate detection result
     */
    fallbackDuplicateProcessing(records, originalError) {
        console.log('Using fallback duplicate processing');
        
        const fallbackResult = this.createEmptyDuplicateResult();
        fallbackResult.totalRecords = records.length;
        fallbackResult.errorHandling = {
            hasErrors: true,
            fallbackUsed: true,
            originalError: originalError.message,
            fallbackMethod: 'basic_phone_comparison',
            timestamp: new Date().toISOString()
        };

        try {
            // Simple fallback: basic phone number comparison without normalization
            const phoneGroups = {};
            const duplicateRecordIds = [];
            const duplicatePhoneNumbers = new Set();

            // Process in smaller chunks for fallback
            const fallbackChunkSize = Math.min(100, records.length);
            
            for (let i = 0; i < records.length; i += fallbackChunkSize) {
                const chunk = records.slice(i, i + fallbackChunkSize);
                
                for (const record of chunk) {
                    try {
                        const phone = this.extractPhoneNumber(record);
                        const recordId = this.extractRecordId(record);
                        
                        if (phone && recordId) {
                            // Simple phone comparison without complex normalization
                            const simplePhone = phone.replace(/\s+/g, '').toLowerCase();
                            
                            if (!phoneGroups[simplePhone]) {
                                phoneGroups[simplePhone] = [];
                            }
                            phoneGroups[simplePhone].push(recordId);
                        }
                    } catch (recordError) {
                        // Skip problematic records in fallback
                        console.warn(`Skipping record in fallback processing:`, recordError);
                    }
                }
            }

            // Identify duplicates from groups
            for (const [phone, recordIds] of Object.entries(phoneGroups)) {
                if (recordIds.length > 1) {
                    duplicatePhoneNumbers.add(phone);
                    duplicateRecordIds.push(...recordIds);
                }
            }

            fallbackResult.duplicatePhoneNumbers = duplicatePhoneNumbers;
            fallbackResult.duplicateRecordIds = duplicateRecordIds;
            fallbackResult.duplicateCount = duplicateRecordIds.length;
            fallbackResult.duplicatePhoneCount = duplicatePhoneNumbers.size;
            
            console.log(`Fallback processing completed: ${duplicateRecordIds.length} duplicates found`);

        } catch (fallbackError) {
            console.error('Fallback processing also failed:', fallbackError);
            fallbackResult.errorHandling.fallbackError = fallbackError.message;
            fallbackResult.errorHandling.gracefulDegradation = true;
        }

        return fallbackResult;
    }

    /**
     * Create duplicate phone number mapping for table row identification
     * @param {Array} records - Array of phone records
     * @returns {Map} Map of record IDs to duplicate information
     */
    createDuplicatePhoneMapping(records) {
        const duplicateInfo = this.identifyDuplicatePhoneNumbers(records);
        const recordDuplicateMap = new Map();

        // Create mapping from record ID to duplicate information
        for (const [normalizedPhone, recordIds] of duplicateInfo.duplicateRecordMap) {
            for (const recordId of recordIds) {
                recordDuplicateMap.set(recordId, {
                    isDuplicate: true,
                    normalizedPhone,
                    duplicateCount: recordIds.length,
                    duplicateRecordIds: recordIds,
                    duplicateGroup: normalizedPhone
                });
            }
        }

        // Add non-duplicate records
        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            const recordId = this.extractRecordId(record);
            
            if (!recordDuplicateMap.has(recordId)) {
                recordDuplicateMap.set(recordId, {
                    isDuplicate: false,
                    normalizedPhone: null,
                    duplicateCount: 1,
                    duplicateRecordIds: [recordId],
                    duplicateGroup: null
                });
            }
        }

        return recordDuplicateMap;
    }

    /**
     * Normalize phone number for accurate duplicate detection
     * @param {string} phoneNumber - Original phone number
     * @returns {string} Normalized phone number
     */
    normalizePhoneNumber(phoneNumber) {
        if (!phoneNumber || typeof phoneNumber !== 'string') {
            return '';
        }

        // Check cache first
        if (this.phoneNormalizationCache.has(phoneNumber)) {
            return this.phoneNormalizationCache.get(phoneNumber);
        }

        let normalized = phoneNumber.trim();

        // Apply normalization rules
        if (this.config.normalization.removePlus) {
            normalized = normalized.replace(/^\+/, '');
        }

        if (this.config.normalization.removeCountryCode) {
            // Remove Singapore country code (65) if present at the beginning
            normalized = normalized.replace(/^65/, '');
        }

        if (this.config.normalization.removeSpaces) {
            normalized = normalized.replace(/\s+/g, '');
        }

        if (this.config.normalization.removeHyphens) {
            normalized = normalized.replace(/-/g, '');
        }

        if (this.config.normalization.removeBrackets) {
            normalized = normalized.replace(/[()]/g, '');
        }

        // Remove any remaining non-digit characters except for extensions
        normalized = normalized.replace(/[^\d]/g, '');

        // Handle case sensitivity
        if (!this.config.detection.caseSensitive) {
            normalized = normalized.toLowerCase();
        }

        // Cache the result
        if (this.phoneNormalizationCache.size < this.config.performance.maxCacheSize) {
            this.phoneNormalizationCache.set(phoneNumber, normalized);
        }

        return normalized;
    }

    /**
     * Check if a specific phone number is duplicate
     * @param {string} phoneNumber - Phone number to check
     * @param {Array} records - Array of records to check against
     * @returns {Object} Duplicate check result
     */
    isPhoneNumberDuplicate(phoneNumber, records) {
        if (!phoneNumber || !Array.isArray(records)) {
            return {
                isDuplicate: false,
                duplicateCount: 0,
                duplicateRecords: []
            };
        }

        const normalizedTarget = this.normalizePhoneNumber(phoneNumber);
        const duplicateRecords = [];

        for (const record of records) {
            const recordPhone = this.extractPhoneNumber(record);
            if (recordPhone) {
                const normalizedRecord = this.normalizePhoneNumber(recordPhone);
                if (normalizedRecord === normalizedTarget) {
                    duplicateRecords.push(record);
                }
            }
        }

        return {
            isDuplicate: duplicateRecords.length > 1,
            duplicateCount: duplicateRecords.length,
            duplicateRecords,
            normalizedPhone: normalizedTarget
        };
    }

    /**
     * Get duplicate statistics for a set of records
     * @param {Array} records - Array of records to analyze
     * @returns {Object} Duplicate statistics
     */
    getDuplicateStatistics(records) {
        const duplicateInfo = this.identifyDuplicatePhoneNumbers(records);
        
        const stats = {
            totalRecords: records.length,
            uniquePhoneNumbers: duplicateInfo.uniquePhoneCount,
            duplicatePhoneNumbers: duplicateInfo.duplicatePhoneCount,
            duplicateRecords: duplicateInfo.duplicateCount,
            duplicatePercentage: records.length > 0 ? 
                (duplicateInfo.duplicateCount / records.length * 100).toFixed(2) : 0,
            uniquePercentage: records.length > 0 ? 
                ((records.length - duplicateInfo.duplicateCount) / records.length * 100).toFixed(2) : 0,
            detectionTime: duplicateInfo.detectionTime,
            largestDuplicateGroup: 0
        };

        // Find largest duplicate group
        for (const recordIds of duplicateInfo.duplicateRecordMap.values()) {
            if (recordIds.length > stats.largestDuplicateGroup) {
                stats.largestDuplicateGroup = recordIds.length;
            }
        }

        return stats;
    }

    /**
     * Extract record ID from record object
     * @param {Object} record - Record object
     * @returns {string} Record ID
     */
    extractRecordId(record) {
        return record.id || record.Id || record.ID || 
               record.recordId || record.record_id || 
               String(record.index || 0);
    }

    /**
     * Extract phone number from record object
     * @param {Object} record - Record object
     * @returns {string} Phone number
     */
    extractPhoneNumber(record) {
        return record.phone || record.Phone || record.phoneNumber || 
               record.phone_number || record.PhoneNumber || 
               record.mobile || record.Mobile || '';
    }

    /**
     * Generate cache key for records
     * @param {Array} records - Records to generate key for
     * @returns {string} Cache key
     */
    generateCacheKey(records) {
        // Create a simple hash based on record count and first few phone numbers
        const samplePhones = records.slice(0, 5).map(r => this.extractPhoneNumber(r)).join('|');
        return `${records.length}_${samplePhones}`;
    }

    /**
     * Cache duplicate detection result
     * @param {string} cacheKey - Cache key
     * @param {Object} result - Result to cache
     */
    cacheResult(cacheKey, result) {
        if (this.duplicateCache.size >= this.config.performance.maxCacheSize) {
            // Remove oldest entry
            const firstKey = this.duplicateCache.keys().next().value;
            this.duplicateCache.delete(firstKey);
        }

        this.duplicateCache.set(cacheKey, {
            result: { ...result },
            timestamp: Date.now()
        });
    }

    /**
     * Clean up expired cache entries
     */
    cleanupCache() {
        const now = Date.now();
        const expiredKeys = [];

        for (const [key, value] of this.duplicateCache) {
            if (now - value.timestamp > this.config.performance.cacheTimeout) {
                expiredKeys.push(key);
            }
        }

        for (const key of expiredKeys) {
            this.duplicateCache.delete(key);
        }

        // Also cleanup phone normalization cache
        if (this.phoneNormalizationCache.size > this.config.performance.maxCacheSize) {
            this.phoneNormalizationCache.clear();
        }

        if (expiredKeys.length > 0) {
            console.log(`Cleaned up ${expiredKeys.length} expired cache entries`);
        }
    }

    /**
     * Create empty duplicate result
     * @returns {Object} Empty duplicate result
     */
    createEmptyDuplicateResult() {
        return {
            duplicatePhoneNumbers: new Set(),
            duplicateRecordIds: [],
            duplicateRecordMap: new Map(),
            phoneNormalizationMap: new Map(),
            phoneMap: new Map(),
            totalRecords: 0,
            duplicateCount: 0,
            uniquePhoneCount: 0,
            duplicatePhoneCount: 0,
            detectionTime: 0
        };
    }

    /**
     * Update performance metrics
     * @param {number} detectionTime - Time taken for detection
     */
    updateMetrics(detectionTime) {
        this.metrics.totalDetections++;
        this.metrics.lastDetectionTime = detectionTime;
        
        // Calculate rolling average
        this.metrics.averageDetectionTime = 
            (this.metrics.averageDetectionTime * (this.metrics.totalDetections - 1) + detectionTime) / 
            this.metrics.totalDetections;
    }

    /**
     * Get performance metrics
     * @returns {Object} Performance metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            cacheSize: this.duplicateCache.size,
            phoneNormalizationCacheSize: this.phoneNormalizationCache.size,
            cacheHitRate: this.metrics.totalDetections > 0 ? 
                (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) * 100).toFixed(2) : 0
        };
    }

    /**
     * Configure the service
     * @param {Object} newConfig - New configuration options
     */
    configure(newConfig) {
        this.config = {
            ...this.config,
            ...newConfig
        };
        
        console.log('Duplicate detection service reconfigured', this.config);
    }

    /**
     * Reset service state
     */
    reset() {
        this.duplicateCache.clear();
        this.phoneNormalizationCache.clear();
        this.metrics = {
            totalDetections: 0,
            cacheHits: 0,
            cacheMisses: 0,
            averageDetectionTime: 0,
            lastDetectionTime: 0
        };
        
        console.log('Duplicate detection service reset');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FrontendDuplicateDetectionService;
}

// Make available globally in browser
if (typeof window !== 'undefined') {
    window.FrontendDuplicateDetectionService = FrontendDuplicateDetectionService;
}