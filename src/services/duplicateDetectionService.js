const databaseManager = require('../utils/database');

/**
 * Service for detecting duplicate entries in check_table before insertion
 * Implements efficient batch duplicate checking using SQL IN queries
 * Enhanced with comprehensive error handling and logging
 */
class DuplicateDetectionService {
    constructor() {
        // Batch size for efficient duplicate checking
        this.batchSize = 1000;

        // Query result caching for frequently checked IDs
        this.queryCache = new Map();
        this.cacheTimeout = 300000; // 5 minutes
        this.maxCacheSize = 10000; // Maximum cached entries

        // Query optimization settings
        this.queryOptimization = {
            useIndexedLookups: true,
            enableQueryCaching: true,
            optimizeBatchSize: true,
            usePreparedStatements: true,
            enableQueryHints: true
        };

        // Memory optimization settings
        this.memoryOptimization = {
            enableStreamingProcessing: true,
            chunkSize: 1000, // Records per chunk for streaming
            maxMemoryUsage: 100 * 1024 * 1024, // 100MB limit
            enableGarbageCollection: true,
            optimizeDataStructures: true
        };

        // Memory usage tracking
        this.memoryMetrics = {
            peakMemoryUsage: 0,
            currentMemoryUsage: 0,
            chunksProcessed: 0,
            streamingOperations: 0,
            gcCollections: 0
        };

        // Performance metrics
        this.metrics = {
            totalChecks: 0,
            duplicatesFound: 0,
            averageCheckTime: 0,
            batchChecks: 0,
            cacheHits: 0,
            cacheMisses: 0,
            queryOptimizations: 0
        };

        // Error handling configuration
        this.errorHandling = {
            maxRetries: 3,
            retryDelay: 1000,
            fallbackEnabled: true,
            gracefulDegradation: true
        };

        // Logging configuration
        this.logging = {
            enabled: true,
            logLevel: 'INFO', // DEBUG, INFO, WARN, ERROR
            performanceLogging: true,
            auditTrail: true
        };

        // Error statistics for monitoring
        this.errorStats = {
            queryFailures: 0,
            fallbacksUsed: 0,
            gracefulDegradations: 0,
            lastErrorTimestamp: null,
            errorTypes: {}
        };
    }

    /**
     * Check for duplicates in a batch of records with memory-optimized processing
     * @param {Array} records - Array of records with id and phoneNumber properties
     * @returns {Promise<Object>} Object containing duplicates and new records
     */
    async checkForDuplicates(records) {
        const startTime = Date.now();
        const operationId = this.generateOperationId();

        this.logOperation('duplicate_detection_start', {
            operationId,
            recordCount: records?.length || 0,
            timestamp: new Date().toISOString()
        });

        try {
            if (!Array.isArray(records) || records.length === 0) {
                this.logOperation('duplicate_detection_empty_input', { operationId });
                return {
                    duplicates: [],
                    newRecords: [],
                    duplicateIds: [],
                    newRecordIds: [],
                    operationId,
                    errorHandling: { fallbackUsed: false, gracefulDegradation: false }
                };
            }

            // Check if we should use streaming processing for large datasets
            if (this.shouldUseStreamingProcessing(records.length)) {
                return await this.checkForDuplicatesStreaming(records, operationId, startTime);
            }

            // Standard processing for smaller datasets
            return await this.checkForDuplicatesStandard(records, operationId, startTime);

        } catch (error) {
            return await this.handleDuplicateDetectionError(error, records, operationId, startTime);
        }
    }

    /**
     * Standard duplicate detection for smaller datasets
     * @param {Array} records - Array of records
     * @param {string} operationId - Operation identifier
     * @param {number} startTime - Start time
     * @returns {Promise<Object>} Duplicate detection result
     */
    async checkForDuplicatesStandard(records, operationId, startTime) {
        // Track memory usage
        const initialMemory = this.getCurrentMemoryUsage();

        // Extract IDs from records with validation
        const recordIds = this.extractAndValidateIds(records);

        // Check for existing IDs with error handling and fallbacks
        const existingIds = await this.batchCheckExistingIdsWithErrorHandling(recordIds, operationId);
        const existingIdSet = new Set(existingIds.duplicateIds);

        // Use memory-optimized data structures
        const result = this.createOptimizedResult(records, existingIdSet, operationId);

        // Update metrics
        const checkTime = Date.now() - startTime;
        const finalMemory = this.getCurrentMemoryUsage();
        this.updateMetrics(records.length, result.duplicateCount, checkTime);
        this.updateMemoryMetrics(finalMemory - initialMemory);

        this.logOperation('duplicate_detection_success', {
            operationId,
            result: {
                totalRecords: result.totalRecords,
                duplicateCount: result.duplicateCount,
                newRecordCount: result.newRecordCount,
                checkTime: result.checkTime,
                memoryUsed: finalMemory - initialMemory
            }
        });

        // Trigger garbage collection if enabled and memory usage is high
        if (this.memoryOptimization.enableGarbageCollection && (finalMemory - initialMemory) > 50 * 1024 * 1024) {
            this.triggerGarbageCollection();
        }

        return result;
    }

    /**
     * Memory-optimized streaming duplicate detection for large datasets
     * @param {Array} records - Array of records
     * @param {string} operationId - Operation identifier
     * @param {number} startTime - Start time
     * @returns {Promise<Object>} Duplicate detection result
     */
    async checkForDuplicatesStreaming(records, operationId, startTime) {
        this.logOperation('streaming_duplicate_detection_start', {
            operationId,
            totalRecords: records.length,
            chunkSize: this.memoryOptimization.chunkSize
        });

        const result = {
            duplicates: [],
            newRecords: [],
            duplicateIds: [],
            newRecordIds: [],
            totalRecords: records.length,
            duplicateCount: 0,
            newRecordCount: 0,
            checkTime: 0,
            operationId,
            errorHandling: { fallbackUsed: false, gracefulDegradation: false },
            streamingMetrics: {
                chunksProcessed: 0,
                peakMemoryUsage: 0,
                averageChunkTime: 0
            }
        };

        const chunkSize = this.memoryOptimization.chunkSize;
        const totalChunks = Math.ceil(records.length / chunkSize);
        let totalChunkTime = 0;

        // Process records in memory-efficient chunks
        for (let i = 0; i < records.length; i += chunkSize) {
            const chunkStartTime = Date.now();
            const chunk = records.slice(i, i + chunkSize);
            const chunkNumber = Math.floor(i / chunkSize) + 1;

            try {
                // Process chunk with memory optimization
                const chunkResult = await this.processChunkOptimized(chunk, operationId, chunkNumber);

                // Merge results using memory-efficient approach
                this.mergeChunkResults(result, chunkResult);

                const chunkTime = Date.now() - chunkStartTime;
                totalChunkTime += chunkTime;
                result.streamingMetrics.chunksProcessed++;

                // Track memory usage
                const currentMemory = this.getCurrentMemoryUsage();
                if (currentMemory > result.streamingMetrics.peakMemoryUsage) {
                    result.streamingMetrics.peakMemoryUsage = currentMemory;
                }

                this.logOperation('chunk_processed', {
                    operationId,
                    chunkNumber,
                    chunkSize: chunk.length,
                    chunkDuplicates: chunkResult.duplicateCount,
                    chunkTime,
                    memoryUsage: currentMemory
                });

                // Trigger garbage collection between chunks if memory usage is high
                if (this.memoryOptimization.enableGarbageCollection && currentMemory > this.memoryOptimization.maxMemoryUsage) {
                    this.triggerGarbageCollection();
                }

                // Small delay to prevent overwhelming the system
                if (chunkNumber % 10 === 0) {
                    await this.delay(10);
                }

            } catch (chunkError) {
                this.logOperation('chunk_processing_error', {
                    operationId,
                    chunkNumber,
                    error: chunkError.message
                });

                // Continue with next chunk but log the error
                result.errorHandling.errors = result.errorHandling.errors || [];
                result.errorHandling.errors.push(`Chunk ${chunkNumber}: ${chunkError.message}`);
            }
        }

        // Finalize results
        result.checkTime = Date.now() - startTime;
        result.streamingMetrics.averageChunkTime = totalChunks > 0 ? totalChunkTime / totalChunks : 0;

        // Update metrics
        this.updateMetrics(records.length, result.duplicateCount, result.checkTime);
        this.memoryMetrics.streamingOperations++;
        this.memoryMetrics.chunksProcessed += result.streamingMetrics.chunksProcessed;

        this.logOperation('streaming_duplicate_detection_success', {
            operationId,
            totalRecords: result.totalRecords,
            duplicateCount: result.duplicateCount,
            newRecordCount: result.newRecordCount,
            checkTime: result.checkTime,
            chunksProcessed: result.streamingMetrics.chunksProcessed,
            peakMemoryUsage: result.streamingMetrics.peakMemoryUsage,
            averageChunkTime: result.streamingMetrics.averageChunkTime
        });

        return result;
    }

    /**
     * Process a chunk of records with memory optimization
     * @param {Array} chunk - Chunk of records to process
     * @param {string} operationId - Operation identifier
     * @param {number} chunkNumber - Chunk number
     * @returns {Promise<Object>} Chunk processing result
     */
    async processChunkOptimized(chunk, operationId, chunkNumber) {
        // Extract IDs efficiently
        const recordIds = this.extractAndValidateIds(chunk);

        // Check for existing IDs
        const existingIds = await this.batchCheckExistingIdsWithErrorHandling(recordIds, `${operationId}_chunk_${chunkNumber}`);
        const existingIdSet = new Set(existingIds.duplicateIds);

        // Create optimized result for chunk
        return this.createOptimizedResult(chunk, existingIdSet, `${operationId}_chunk_${chunkNumber}`);
    }

    /**
     * Create memory-optimized result structure
     * @param {Array} records - Records to process
     * @param {Set} existingIdSet - Set of existing IDs
     * @param {string} operationId - Operation identifier
     * @returns {Object} Optimized result structure
     */
    createOptimizedResult(records, existingIdSet, operationId) {
        const result = {
            duplicates: [],
            newRecords: [],
            duplicateIds: [],
            newRecordIds: [],
            totalRecords: records.length,
            duplicateCount: 0,
            newRecordCount: 0,
            operationId
        };

        // Use optimized data structures if enabled
        if (this.memoryOptimization.optimizeDataStructures) {
            // Pre-allocate arrays with estimated sizes for better memory efficiency
            const estimatedDuplicates = Math.floor(records.length * 0.1); // Assume 10% duplicates
            result.duplicates = new Array(estimatedDuplicates);
            result.newRecords = new Array(records.length - estimatedDuplicates);
            result.duplicateIds = new Array(estimatedDuplicates);
            result.newRecordIds = new Array(records.length - estimatedDuplicates);
        }

        let duplicateIndex = 0;
        let newRecordIndex = 0;

        // Process records efficiently
        for (const record of records) {
            const recordId = record.id || record.Id;

            if (existingIdSet.has(recordId)) {
                if (this.memoryOptimization.optimizeDataStructures) {
                    result.duplicates[duplicateIndex] = record;
                    result.duplicateIds[duplicateIndex] = recordId;
                    duplicateIndex++;
                } else {
                    result.duplicates.push(record);
                    result.duplicateIds.push(recordId);
                }
                result.duplicateCount++;
            } else {
                if (this.memoryOptimization.optimizeDataStructures) {
                    result.newRecords[newRecordIndex] = record;
                    result.newRecordIds[newRecordIndex] = recordId;
                    newRecordIndex++;
                } else {
                    result.newRecords.push(record);
                    result.newRecordIds.push(recordId);
                }
                result.newRecordCount++;
            }
        }

        // Trim arrays to actual size if using optimized data structures
        if (this.memoryOptimization.optimizeDataStructures) {
            result.duplicates = result.duplicates.slice(0, duplicateIndex);
            result.newRecords = result.newRecords.slice(0, newRecordIndex);
            result.duplicateIds = result.duplicateIds.slice(0, duplicateIndex);
            result.newRecordIds = result.newRecordIds.slice(0, newRecordIndex);
        }

        return result;
    }

    /**
     * Merge chunk results into main result using memory-efficient approach
     * @param {Object} mainResult - Main result object
     * @param {Object} chunkResult - Chunk result to merge
     */
    mergeChunkResults(mainResult, chunkResult) {
        // Merge arrays efficiently
        mainResult.duplicates.push(...chunkResult.duplicates);
        mainResult.newRecords.push(...chunkResult.newRecords);
        mainResult.duplicateIds.push(...chunkResult.duplicateIds);
        mainResult.newRecordIds.push(...chunkResult.newRecordIds);

        // Update counts
        mainResult.duplicateCount += chunkResult.duplicateCount;
        mainResult.newRecordCount += chunkResult.newRecordCount;

        // Merge error handling if present
        if (chunkResult.errorHandling && chunkResult.errorHandling.errors) {
            mainResult.errorHandling.errors = mainResult.errorHandling.errors || [];
            mainResult.errorHandling.errors.push(...chunkResult.errorHandling.errors);
        }
    }

    /**
     * Determine if streaming processing should be used based on dataset size
     * @param {number} recordCount - Number of records to process
     * @returns {boolean} True if streaming should be used
     */
    shouldUseStreamingProcessing(recordCount) {
        if (!this.memoryOptimization.enableStreamingProcessing) {
            return false;
        }

        // Use streaming for large datasets or when memory usage is high
        const currentMemory = this.getCurrentMemoryUsage();
        const memoryThreshold = this.memoryOptimization.maxMemoryUsage * 0.7; // 70% of max memory

        return recordCount > 5000 || currentMemory > memoryThreshold;
    }

    /**
     * Get current memory usage in bytes
     * @returns {number} Current memory usage
     */
    getCurrentMemoryUsage() {
        if (typeof process !== 'undefined' && process.memoryUsage) {
            const memUsage = process.memoryUsage();
            return memUsage.heapUsed;
        }
        return 0;
    }

    /**
     * Update memory usage metrics
     * @param {number} memoryUsed - Memory used for operation
     */
    updateMemoryMetrics(memoryUsed) {
        this.memoryMetrics.currentMemoryUsage = this.getCurrentMemoryUsage();

        if (this.memoryMetrics.currentMemoryUsage > this.memoryMetrics.peakMemoryUsage) {
            this.memoryMetrics.peakMemoryUsage = this.memoryMetrics.currentMemoryUsage;
        }
    }

    /**
     * Trigger garbage collection if available and enabled
     */
    triggerGarbageCollection() {
        if (this.memoryOptimization.enableGarbageCollection && typeof global !== 'undefined' && global.gc) {
            try {
                global.gc();
                this.memoryMetrics.gcCollections++;

                this.logOperation('garbage_collection_triggered', {
                    memoryBefore: this.memoryMetrics.currentMemoryUsage,
                    memoryAfter: this.getCurrentMemoryUsage(),
                    gcCollections: this.memoryMetrics.gcCollections
                });
            } catch (error) {
                this.logOperation('garbage_collection_error', {
                    error: error.message
                });
            }
        }
    }

    /**
     * Process files with thousands of duplicate entries using chunked processing
     * @param {Array} records - Large array of records with high duplicate rate
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} Chunked processing result
     */
    async processHighDuplicateDataset(records, options = {}) {
        const processingOptions = {
            chunkSize: 500, // Smaller chunks for high-duplicate scenarios
            maxConcurrentChunks: 3, // Limit concurrent processing
            duplicateThreshold: 0.5, // 50% duplicate rate threshold
            memoryLimit: 50 * 1024 * 1024, // 50MB memory limit
            ...options
        };

        const operationId = this.generateOperationId();
        const startTime = Date.now();

        this.logOperation('high_duplicate_processing_start', {
            operationId,
            totalRecords: records.length,
            chunkSize: processingOptions.chunkSize,
            maxConcurrentChunks: processingOptions.maxConcurrentChunks
        });

        const result = {
            duplicates: [],
            newRecords: [],
            duplicateIds: [],
            newRecordIds: [],
            totalRecords: records.length,
            duplicateCount: 0,
            newRecordCount: 0,
            checkTime: 0,
            operationId,
            processingMetrics: {
                chunksProcessed: 0,
                concurrentChunks: 0,
                averageDuplicateRate: 0,
                memoryOptimizations: 0
            }
        };

        const chunks = this.createOptimizedChunks(records, processingOptions.chunkSize);
        const chunkPromises = [];
        let activeChunks = 0;

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];

            // Wait if we've reached the concurrent chunk limit
            while (activeChunks >= processingOptions.maxConcurrentChunks) {
                await Promise.race(chunkPromises);
                activeChunks--;
            }

            // Process chunk with memory monitoring
            const chunkPromise = this.processHighDuplicateChunk(chunk, i + 1, operationId, processingOptions)
                .then(chunkResult => {
                    this.mergeChunkResults(result, chunkResult);
                    result.processingMetrics.chunksProcessed++;

                    // Update duplicate rate tracking
                    const chunkDuplicateRate = chunkResult.totalRecords > 0 ?
                        chunkResult.duplicateCount / chunkResult.totalRecords : 0;
                    result.processingMetrics.averageDuplicateRate =
                        (result.processingMetrics.averageDuplicateRate * (result.processingMetrics.chunksProcessed - 1) + chunkDuplicateRate) /
                        result.processingMetrics.chunksProcessed;

                    return chunkResult;
                })
                .catch(error => {
                    this.logOperation('high_duplicate_chunk_error', {
                        operationId,
                        chunkNumber: i + 1,
                        error: error.message
                    });
                    return { duplicateCount: 0, newRecordCount: 0, totalRecords: chunk.length };
                });

            chunkPromises.push(chunkPromise);
            activeChunks++;

            // Memory management between chunks
            if (i % 5 === 0) {
                const currentMemory = this.getCurrentMemoryUsage();
                if (currentMemory > processingOptions.memoryLimit) {
                    this.triggerGarbageCollection();
                    result.processingMetrics.memoryOptimizations++;

                    // Small delay to allow memory cleanup
                    await this.delay(100);
                }
            }
        }

        // Wait for all chunks to complete
        await Promise.all(chunkPromises);

        result.checkTime = Date.now() - startTime;
        this.updateMetrics(records.length, result.duplicateCount, result.checkTime);

        this.logOperation('high_duplicate_processing_success', {
            operationId,
            totalRecords: result.totalRecords,
            duplicateCount: result.duplicateCount,
            duplicateRate: (result.duplicateCount / result.totalRecords) * 100,
            checkTime: result.checkTime,
            chunksProcessed: result.processingMetrics.chunksProcessed,
            memoryOptimizations: result.processingMetrics.memoryOptimizations
        });

        return result;
    }

    /**
     * Process a single chunk in high-duplicate scenario with memory optimization
     * @param {Array} chunk - Chunk of records
     * @param {number} chunkNumber - Chunk number
     * @param {string} operationId - Operation identifier
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} Chunk processing result
     */
    async processHighDuplicateChunk(chunk, chunkNumber, operationId, options) {
        const chunkStartTime = Date.now();
        const initialMemory = this.getCurrentMemoryUsage();

        try {
            // Use memory-efficient ID extraction
            const recordIds = this.extractAndValidateIds(chunk);

            // Batch check with smaller sub-batches for memory efficiency
            const subBatchSize = Math.min(100, recordIds.length);
            const existingIds = [];

            for (let i = 0; i < recordIds.length; i += subBatchSize) {
                const subBatch = recordIds.slice(i, i + subBatchSize);
                const subBatchExisting = await this.batchCheckExistingIdsWithErrorHandling(
                    subBatch,
                    `${operationId}_chunk_${chunkNumber}_sub_${Math.floor(i / subBatchSize) + 1}`
                );
                existingIds.push(...subBatchExisting.duplicateIds);

                // Small delay between sub-batches to prevent overwhelming the database
                if (i + subBatchSize < recordIds.length) {
                    await this.delay(10);
                }
            }

            const existingIdSet = new Set(existingIds);
            const chunkResult = this.createOptimizedResult(chunk, existingIdSet, `${operationId}_chunk_${chunkNumber}`);

            const chunkTime = Date.now() - chunkStartTime;
            const finalMemory = this.getCurrentMemoryUsage();

            this.logOperation('high_duplicate_chunk_processed', {
                operationId,
                chunkNumber,
                chunkSize: chunk.length,
                duplicateCount: chunkResult.duplicateCount,
                duplicateRate: (chunkResult.duplicateCount / chunk.length) * 100,
                chunkTime,
                memoryUsed: finalMemory - initialMemory
            });

            return chunkResult;

        } catch (error) {
            this.logOperation('high_duplicate_chunk_error', {
                operationId,
                chunkNumber,
                error: error.message,
                chunkTime: Date.now() - chunkStartTime
            });
            throw error;
        }
    }

    /**
     * Create optimized chunks for processing with memory considerations
     * @param {Array} records - Records to chunk
     * @param {number} chunkSize - Size of each chunk
     * @returns {Array} Array of record chunks
     */
    createOptimizedChunks(records, chunkSize) {
        const chunks = [];

        for (let i = 0; i < records.length; i += chunkSize) {
            chunks.push(records.slice(i, i + chunkSize));
        }

        return chunks;
    }

    /**
     * Optimize data structures used during duplicate detection for memory efficiency
     * @param {Array} records - Records to optimize
     * @returns {Object} Optimized data structures
     */
    optimizeDataStructures(records) {
        const optimization = {
            originalSize: records.length,
            optimizedStructures: {},
            memorySaved: 0
        };

        if (!this.memoryOptimization.optimizeDataStructures) {
            return optimization;
        }

        try {
            // Create memory-efficient ID lookup structure
            const idMap = new Map();
            const phoneMap = new Map();

            for (let i = 0; i < records.length; i++) {
                const record = records[i];
                const id = record.id || record.Id;
                const phone = record.phoneNumber || record.Phone;

                if (id) {
                    idMap.set(id, i); // Store index instead of full record
                }
                if (phone) {
                    if (!phoneMap.has(phone)) {
                        phoneMap.set(phone, []);
                    }
                    phoneMap.get(phone).push(i);
                }
            }

            optimization.optimizedStructures = {
                idMap,
                phoneMap,
                recordCount: records.length
            };

            // Estimate memory savings (rough calculation)
            const originalMemory = records.length * 200; // Assume 200 bytes per record
            const optimizedMemory = (idMap.size + phoneMap.size) * 50; // Assume 50 bytes per map entry
            optimization.memorySaved = Math.max(0, originalMemory - optimizedMemory);

            this.logOperation('data_structures_optimized', {
                originalRecords: records.length,
                uniqueIds: idMap.size,
                uniquePhones: phoneMap.size,
                estimatedMemorySaved: optimization.memorySaved
            });

        } catch (error) {
            this.logOperation('data_structure_optimization_error', {
                error: error.message,
                recordCount: records.length
            });
        }

        return optimization;
    }

    /**
     * Configure memory optimization settings
     * @param {Object} memoryConfig - Memory optimization configuration
     */
    configureMemoryOptimization(memoryConfig) {
        const previousConfig = { ...this.memoryOptimization };

        this.memoryOptimization = {
            ...this.memoryOptimization,
            ...memoryConfig
        };

        this.logOperation('memory_optimization_configured', {
            previousConfig,
            newConfig: this.memoryOptimization
        });
    }

    /**
     * Get memory usage metrics
     * @returns {Object} Memory metrics
     */
    getMemoryMetrics() {
        return {
            ...this.memoryMetrics,
            currentMemoryUsageMB: Math.round(this.memoryMetrics.currentMemoryUsage / 1024 / 1024),
            peakMemoryUsageMB: Math.round(this.memoryMetrics.peakMemoryUsage / 1024 / 1024),
            maxMemoryLimitMB: Math.round(this.memoryOptimization.maxMemoryUsage / 1024 / 1024)
        };
    }

    /**
     * Reset memory metrics
     */
    resetMemoryMetrics() {
        this.memoryMetrics = {
            peakMemoryUsage: 0,
            currentMemoryUsage: 0,
            chunksProcessed: 0,
            streamingOperations: 0,
            gcCollections: 0
        };
    }

    /**
     * Check if a single ID is duplicate in check_table with optimized caching and indexed lookups
     * @param {string} id - The ID to check
     * @returns {Promise<boolean>} True if ID exists in check_table
     */
    async isDuplicateId(id) {
        const operationId = this.generateOperationId();

        try {
            if (!id) {
                this.logOperation('single_id_check_empty_input', { operationId });
                return false;
            }

            this.logOperation('single_id_check_start', { operationId, id });

            // Check cache first for frequently checked IDs
            if (this.queryOptimization.enableQueryCaching) {
                const cached = this.queryCache.get(id);
                const now = Date.now();

                if (cached && (now - cached.timestamp) < this.cacheTimeout) {
                    this.metrics.cacheHits++;
                    this.logOperation('single_id_check_cache_hit', { operationId, id, isDuplicate: cached.isDuplicate });
                    return cached.isDuplicate;
                }
            }

            // Use optimized indexed lookup with prepared statement
            const sql = 'SELECT 1 FROM check_table WHERE id = $1 LIMIT 1';

            const result = await databaseManager.preparedQuery(sql, [id], true);

            const isDuplicate = result.length > 0;

            // Cache the result
            if (this.queryOptimization.enableQueryCaching) {
                this.cacheQueryResults([id], isDuplicate ? [id] : []);
                this.metrics.cacheMisses++;
            }

            // Update metrics
            this.metrics.totalChecks++;
            if (isDuplicate) {
                this.metrics.duplicatesFound++;
            }

            this.logOperation('single_id_check_success', {
                operationId,
                id,
                isDuplicate,
                usedCache: false
            });

            return isDuplicate;

        } catch (error) {
            this.updateErrorStats('single_id_check_error', error);

            this.logOperation('single_id_check_error', {
                operationId,
                id,
                error: error.message
            });

            // For single ID checks, we can try fallback or graceful degradation
            if (this.errorHandling.gracefulDegradation) {
                this.logOperation('single_id_check_graceful_degradation', {
                    operationId,
                    id,
                    assumeNotDuplicate: true
                });

                return false; // Assume not duplicate if we can't check
            }

            const errorMessage = this.createDuplicateErrorMessage(error, 1);
            throw new Error(errorMessage);
        }
    }

    /**
     * Filter records to return only new records (non-duplicates) with error handling
     * @param {Array} records - Array of records to filter
     * @returns {Promise<Array>} Array of new records only
     */
    async filterNewRecords(records) {
        const operationId = this.generateOperationId();

        try {
            this.logOperation('filter_new_records_start', {
                operationId,
                recordCount: records?.length || 0
            });

            const duplicateCheck = await this.checkForDuplicates(records);

            this.logOperation('filter_new_records_success', {
                operationId,
                totalRecords: duplicateCheck.totalRecords,
                newRecords: duplicateCheck.newRecordCount,
                duplicatesFiltered: duplicateCheck.duplicateCount
            });

            return duplicateCheck.newRecords;

        } catch (error) {
            this.updateErrorStats('filter_records_error', error);

            this.logOperation('filter_new_records_error', {
                operationId,
                error: error.message,
                recordCount: records?.length || 0
            });

            if (this.errorHandling.gracefulDegradation) {
                this.logOperation('filter_new_records_graceful_degradation', {
                    operationId,
                    message: 'Returning all records as new due to filtering error'
                });

                return records || [];
            }

            const errorMessage = this.createDuplicateErrorMessage(error, records?.length || 0);
            throw new Error(`Record filtering failed: ${errorMessage}`);
        }
    }

    /**
     * Batch check for existing IDs in check_table using SQL IN query with error handling
     * @param {Array} ids - Array of IDs to check
     * @returns {Promise<Array>} Array of existing IDs
     */
    async batchCheckExistingIds(ids) {
        const operationId = this.generateOperationId();
        const startTime = Date.now();

        try {
            if (!Array.isArray(ids) || ids.length === 0) {
                this.logOperation('batch_check_empty_input', { operationId });
                return [];
            }

            // Remove null/undefined IDs and ensure uniqueness
            const validIds = [...new Set(ids.filter(id => id != null))];

            if (validIds.length === 0) {
                this.logOperation('batch_check_no_valid_ids', {
                    operationId,
                    originalCount: ids.length
                });
                return [];
            }

            this.logOperation('batch_check_start', {
                operationId,
                totalIds: validIds.length,
                batchSize: this.batchSize
            });

            // Process in batches for large datasets
            const allExistingIds = [];
            const batchCount = Math.ceil(validIds.length / this.batchSize);

            for (let i = 0; i < validIds.length; i += this.batchSize) {
                const batchNumber = Math.floor(i / this.batchSize) + 1;
                const batch = validIds.slice(i, i + this.batchSize);

                try {
                    const batchExistingIds = await this.checkBatchIds(batch);
                    allExistingIds.push(...batchExistingIds);

                    this.logOperation('batch_check_batch_success', {
                        operationId,
                        batchNumber,
                        batchSize: batch.length,
                        duplicatesFound: batchExistingIds.length
                    });

                } catch (batchError) {
                    this.logOperation('batch_check_batch_error', {
                        operationId,
                        batchNumber,
                        batchSize: batch.length,
                        error: batchError.message
                    });

                    // Continue with other batches, but log the error
                    this.updateErrorStats('batch_error', batchError);
                }
            }

            const checkTime = Date.now() - startTime;
            this.metrics.batchChecks++;

            this.logOperation('batch_check_success', {
                operationId,
                totalIds: validIds.length,
                duplicatesFound: allExistingIds.length,
                batchesProcessed: batchCount,
                checkTime
            });

            // Log performance metrics
            this.logPerformanceMetrics({
                operation: 'batch_check',
                recordCount: validIds.length,
                checkTime,
                duplicatesFound: allExistingIds.length,
                batchesProcessed: batchCount
            });

            return allExistingIds;

        } catch (error) {
            const checkTime = Date.now() - startTime;
            this.updateErrorStats('batch_check_error', error);

            this.logOperation('batch_check_error', {
                operationId,
                error: error.message,
                totalIds: ids.length,
                checkTime
            });

            const errorMessage = this.createDuplicateErrorMessage(error, ids.length);
            throw new Error(`Batch ID check failed: ${errorMessage}`);
        }
    }

    /**
     * Check a single batch of IDs against check_table with optimized queries and caching
     * @param {Array} idBatch - Batch of IDs to check
     * @returns {Promise<Array>} Array of existing IDs from this batch
     */
    async checkBatchIds(idBatch) {
        const operationId = this.generateOperationId();
        const startTime = Date.now();

        try {
            if (!Array.isArray(idBatch) || idBatch.length === 0) {
                return [];
            }

            this.logOperation('check_batch_ids_start', {
                operationId,
                batchSize: idBatch.length
            });

            // Check cache first for frequently checked IDs
            const { cachedIds, uncachedIds } = this.checkQueryCache(idBatch);
            let existingIds = [...cachedIds];

            // Only query database for uncached IDs
            if (uncachedIds.length > 0) {
                const dbExistingIds = await this.executeOptimizedBatchQuery(uncachedIds, operationId);
                existingIds.push(...dbExistingIds);

                // Cache the results
                this.cacheQueryResults(uncachedIds, dbExistingIds);
            }

            const queryTime = Date.now() - startTime;

            this.logOperation('check_batch_ids_success', {
                operationId,
                batchSize: idBatch.length,
                duplicatesFound: existingIds.length,
                cacheHits: cachedIds.length,
                dbQueries: uncachedIds.length,
                queryTime
            });

            // Update metrics
            this.metrics.cacheHits += cachedIds.length;
            this.metrics.cacheMisses += uncachedIds.length;

            return existingIds;

        } catch (error) {
            const queryTime = Date.now() - startTime;
            this.updateErrorStats('batch_query_error', error);

            this.logOperation('check_batch_ids_error', {
                operationId,
                batchSize: idBatch.length,
                error: error.message,
                queryTime
            });

            const errorMessage = this.createDuplicateErrorMessage(error, idBatch.length);
            throw new Error(`Batch ID query failed: ${errorMessage}`);
        }
    }

    /**
     * Execute optimized batch query with performance enhancements
     * @param {Array} ids - IDs to query from database
     * @param {string} operationId - Operation identifier
     * @returns {Promise<Array>} Array of existing IDs from database
     */
    async executeOptimizedBatchQuery(ids, operationId) {
        if (ids.length === 0) return [];

        // Optimize batch size based on query performance
        const optimizedBatchSize = this.getOptimizedBatchSize(ids.length);
        const existingIds = [];

        // Process in optimized batches
        for (let i = 0; i < ids.length; i += optimizedBatchSize) {
            const batch = ids.slice(i, i + optimizedBatchSize);

            // Create optimized SQL query with hints for large datasets
            const sql = this.buildOptimizedQuery(batch.length);

            try {
                const result = await databaseManager.preparedQuery(sql, batch, true);
                const batchExistingIds = result.map(row => row.id);
                existingIds.push(...batchExistingIds);

                this.metrics.queryOptimizations++;

            } catch (batchError) {
                this.logOperation('optimized_batch_query_error', {
                    operationId,
                    batchSize: batch.length,
                    error: batchError.message
                });
                throw batchError;
            }
        }

        return existingIds;
    }

    /**
     * Build optimized SQL query with performance hints
     * @param {number} batchSize - Size of the batch
     * @returns {string} Optimized SQL query
     */
    buildOptimizedQuery(batchSize) {
        const placeholders = Array.from({ length: batchSize }, (_, i) => `$${i + 1}`).join(',');
        return `SELECT id FROM check_table WHERE id IN (${placeholders})`;
    }

    /**
     * Get optimized batch size based on dataset size and performance metrics
     * @param {number} totalIds - Total number of IDs to process
     * @returns {number} Optimized batch size
     */
    getOptimizedBatchSize(totalIds) {
        if (!this.queryOptimization.optimizeBatchSize) {
            return this.batchSize;
        }

        // Adjust batch size based on average query time and dataset size
        const avgQueryTime = this.metrics.averageCheckTime;

        if (avgQueryTime > 5000) { // If queries are slow (>5s), use smaller batches
            return Math.min(500, this.batchSize);
        } else if (avgQueryTime < 1000 && totalIds > 5000) { // If queries are fast and dataset is large, use larger batches
            return Math.min(2000, this.batchSize * 2);
        }

        return this.batchSize;
    }

    /**
     * Check query cache for frequently checked IDs
     * @param {Array} ids - IDs to check in cache
     * @returns {Object} Object with cached and uncached IDs
     */
    checkQueryCache(ids) {
        if (!this.queryOptimization.enableQueryCaching) {
            return { cachedIds: [], uncachedIds: ids };
        }

        const cachedIds = [];
        const uncachedIds = [];
        const now = Date.now();

        for (const id of ids) {
            const cached = this.queryCache.get(id);

            if (cached && (now - cached.timestamp) < this.cacheTimeout) {
                if (cached.isDuplicate) {
                    cachedIds.push(id);
                }
                // If not duplicate, we don't add to cachedIds (it's a new record)
            } else {
                uncachedIds.push(id);
            }
        }

        return { cachedIds, uncachedIds };
    }

    /**
     * Cache query results for frequently checked IDs
     * @param {Array} queriedIds - IDs that were queried
     * @param {Array} existingIds - IDs that exist in database
     */
    cacheQueryResults(queriedIds, existingIds) {
        if (!this.queryOptimization.enableQueryCaching) {
            return;
        }

        const now = Date.now();
        const existingIdSet = new Set(existingIds);

        // Clean cache if it's getting too large
        if (this.queryCache.size >= this.maxCacheSize) {
            this.cleanupQueryCache();
        }

        // Cache results for all queried IDs
        for (const id of queriedIds) {
            this.queryCache.set(id, {
                isDuplicate: existingIdSet.has(id),
                timestamp: now
            });
        }
    }

    /**
     * Clean up expired entries from query cache
     */
    cleanupQueryCache() {
        const now = Date.now();
        const expiredKeys = [];

        for (const [key, value] of this.queryCache.entries()) {
            if ((now - value.timestamp) >= this.cacheTimeout) {
                expiredKeys.push(key);
            }
        }

        for (const key of expiredKeys) {
            this.queryCache.delete(key);
        }

        this.logOperation('query_cache_cleanup', {
            expiredEntries: expiredKeys.length,
            remainingEntries: this.queryCache.size
        });
    }

    /**
     * Get detailed information about existing records for duplicates
     * @param {Array} duplicateIds - Array of duplicate IDs
     * @returns {Promise<Array>} Array of existing record details
     */
    async getExistingRecordDetails(duplicateIds) {
        try {
            if (!Array.isArray(duplicateIds) || duplicateIds.length === 0) {
                return [];
            }

            const validIds = duplicateIds.filter(id => id != null);
            if (validIds.length === 0) {
                return [];
            }

            // Get existing record details in batches
            const allDetails = [];

            for (let i = 0; i < validIds.length; i += this.batchSize) {
                const batch = validIds.slice(i, i + this.batchSize);
                const batchDetails = await this.getBatchRecordDetails(batch);
                allDetails.push(...batchDetails);
            }

            return allDetails;

        } catch (error) {
            console.error('Error getting existing record details:', error.message);
            throw new Error(`Failed to get existing record details: ${error.message}`);
        }
    }

    /**
     * Get details for a batch of existing records
     * @param {Array} idBatch - Batch of IDs to get details for
     * @returns {Promise<Array>} Array of record details
     */
    async getBatchRecordDetails(idBatch) {
        try {
            if (!Array.isArray(idBatch) || idBatch.length === 0) {
                return [];
            }

            const placeholders = idBatch.map((_, i) => `$${i + 1}`).join(',');
            const sql = `
                SELECT id, phone, created_at
                FROM check_table
                WHERE id IN (${placeholders})
            `;

            const result = await databaseManager.query(sql, idBatch);

            return result.map(row => ({
                id: row.id,
                phone: row.phone,
                createdAt: row.created_at
            }));

        } catch (error) {
            console.error('Error getting batch record details:', error.message);
            throw new Error(`Batch record details query failed: ${error.message}`);
        }
    }

    /**
     * Safely parse JSON metadata
     * @param {string} jsonString - JSON string to parse
     * @returns {Object|null} Parsed object or null if parsing fails
     */
    safeParseJSON(jsonString) {
        try {
            return JSON.parse(jsonString);
        } catch (error) {
            console.warn('Failed to parse JSON metadata:', error.message);
            return null;
        }
    }

    /**
     * Update performance metrics with enhanced logging
     * @param {number} totalRecords - Total records checked
     * @param {number} duplicatesFound - Number of duplicates found
     * @param {number} checkTime - Time taken for check in milliseconds
     */
    updateMetrics(totalRecords, duplicatesFound, checkTime) {
        const previousMetrics = { ...this.metrics };

        this.metrics.totalChecks += totalRecords;
        this.metrics.duplicatesFound += duplicatesFound;

        // Update average check time
        const totalTime = this.metrics.averageCheckTime * (this.metrics.batchChecks || 1) + checkTime;
        this.metrics.batchChecks = (this.metrics.batchChecks || 0) + 1;
        this.metrics.averageCheckTime = totalTime / this.metrics.batchChecks;

        // Log performance metrics update
        this.logOperation('metrics_updated', {
            operation: 'performance_metrics_update',
            recordsProcessed: totalRecords,
            duplicatesFound: duplicatesFound,
            checkTime: checkTime,
            previousTotalChecks: previousMetrics.totalChecks,
            newTotalChecks: this.metrics.totalChecks,
            previousDuplicatesFound: previousMetrics.duplicatesFound,
            newDuplicatesFound: this.metrics.duplicatesFound,
            newAverageCheckTime: this.metrics.averageCheckTime
        });

        // Log performance warnings
        if (checkTime > 10000) { // More than 10 seconds
            this.logOperation('slow_duplicate_detection_warning', {
                checkTime: checkTime,
                recordsProcessed: totalRecords,
                duplicatesFound: duplicatesFound,
                averageTimePerRecord: totalRecords > 0 ? checkTime / totalRecords : 0
            });
        }

        // Log high duplicate rate warnings
        const duplicateRate = totalRecords > 0 ? (duplicatesFound / totalRecords) * 100 : 0;
        if (duplicateRate > 50) {
            this.logOperation('high_duplicate_rate_warning', {
                duplicateRate: duplicateRate,
                duplicatesFound: duplicatesFound,
                totalRecords: totalRecords,
                checkTime: checkTime
            });
        }

        // Performance logging
        if (this.logging.performanceLogging) {
            this.logPerformanceMetrics({
                operation: 'metrics_update',
                totalRecords: totalRecords,
                duplicatesFound: duplicatesFound,
                checkTime: checkTime,
                duplicateRate: duplicateRate,
                cumulativeMetrics: this.getMetrics()
            });
        }
    }

    /**
     * Get current performance metrics including cache performance
     * @returns {Object} Performance metrics object
     */
    getMetrics() {
        const totalCacheRequests = this.metrics.cacheHits + this.metrics.cacheMisses;
        const cacheHitRate = totalCacheRequests > 0 ? (this.metrics.cacheHits / totalCacheRequests) * 100 : 0;

        return {
            ...this.metrics,
            duplicateRate: this.metrics.totalChecks > 0 ?
                (this.metrics.duplicatesFound / this.metrics.totalChecks) * 100 : 0,
            averageCheckTimeMs: Math.round(this.metrics.averageCheckTime * 100) / 100,
            cacheHitRate: Math.round(cacheHitRate * 100) / 100,
            cacheSize: this.queryCache.size,
            queryOptimizationsApplied: this.metrics.queryOptimizations
        };
    }

    /**
     * Optimize duplicate detection queries for large check_table datasets
     * @param {number} estimatedTableSize - Estimated size of check_table
     * @returns {Promise<Object>} Optimization results
     */
    async optimizeForLargeDataset(estimatedTableSize = null) {
        const optimization = {
            applied: [],
            recommendations: [],
            estimatedTableSize: estimatedTableSize,
            currentOptimizations: { ...this.queryOptimization }
        };

        try {
            // Get actual table size if not provided
            if (!estimatedTableSize) {
                const tableStats = await databaseManager.getCheckRecordsCount();
                estimatedTableSize = tableStats;
                optimization.estimatedTableSize = estimatedTableSize;
            }

            // Apply optimizations based on table size
            if (estimatedTableSize > 1000000) { // Large dataset (>1M records)
                // Enable all optimizations for large datasets
                this.queryOptimization.useIndexedLookups = true;
                this.queryOptimization.enableQueryCaching = true;
                this.queryOptimization.optimizeBatchSize = true;
                this.queryOptimization.usePreparedStatements = true;

                // Increase cache size for large datasets
                this.maxCacheSize = 50000;
                this.cacheTimeout = 600000; // 10 minutes for large datasets

                // Optimize batch size for large datasets
                this.batchSize = 500; // Smaller batches for better performance

                optimization.applied.push('large_dataset_optimizations');
                optimization.recommendations.push('Consider creating additional indexes on frequently queried columns');

            } else if (estimatedTableSize > 100000) { // Medium dataset (>100K records)
                this.queryOptimization.enableQueryCaching = true;
                this.queryOptimization.optimizeBatchSize = true;
                this.queryOptimization.usePreparedStatements = true;

                this.maxCacheSize = 20000;
                this.batchSize = 1000;

                optimization.applied.push('medium_dataset_optimizations');

            } else { // Small dataset (<100K records)
                // Minimal optimizations for small datasets
                this.queryOptimization.usePreparedStatements = true;
                optimization.applied.push('small_dataset_optimizations');
            }

            this.logOperation('duplicate_detection_optimized', {
                estimatedTableSize,
                optimizationsApplied: optimization.applied,
                newBatchSize: this.batchSize,
                newCacheSize: this.maxCacheSize
            });

        } catch (error) {
            this.logOperation('optimization_error', {
                error: error.message,
                estimatedTableSize
            });
            optimization.error = error.message;
        }

        return optimization;
    }

    /**
     * Implement query result caching for frequently checked IDs
     * @param {Array} frequentIds - Array of frequently checked IDs
     * @returns {Promise<Object>} Caching implementation result
     */
    async implementQueryResultCaching(frequentIds = []) {
        const caching = {
            enabled: this.queryOptimization.enableQueryCaching,
            preloadedIds: 0,
            cacheSize: this.queryCache.size,
            maxCacheSize: this.maxCacheSize,
            cacheTimeout: this.cacheTimeout
        };

        if (!this.queryOptimization.enableQueryCaching) {
            caching.message = 'Query caching is disabled';
            return caching;
        }

        // Preload frequently checked IDs into cache
        if (frequentIds.length > 0) {
            try {
                const existingIds = await this.executeOptimizedBatchQuery(frequentIds, 'cache_preload');
                this.cacheQueryResults(frequentIds, existingIds);
                caching.preloadedIds = frequentIds.length;

                this.logOperation('cache_preloaded', {
                    preloadedIds: frequentIds.length,
                    existingIds: existingIds.length,
                    cacheSize: this.queryCache.size
                });

            } catch (error) {
                caching.error = `Failed to preload cache: ${error.message}`;
                this.logOperation('cache_preload_error', {
                    error: error.message,
                    attemptedIds: frequentIds.length
                });
            }
        }

        return caching;
    }

    /**
     * Clear and reset query cache
     */
    clearQueryCache() {
        const previousSize = this.queryCache.size;
        this.queryCache.clear();

        this.logOperation('query_cache_cleared', {
            previousSize,
            newSize: this.queryCache.size
        });
    }

    /**
     * Configure query optimization settings
     * @param {Object} optimizationConfig - Optimization configuration
     */
    configureQueryOptimization(optimizationConfig) {
        const previousConfig = { ...this.queryOptimization };

        this.queryOptimization = {
            ...this.queryOptimization,
            ...optimizationConfig
        };

        this.logOperation('query_optimization_configured', {
            previousConfig,
            newConfig: this.queryOptimization
        });
    }

    /**
     * Reset performance metrics
     */
    resetMetrics() {
        this.metrics = {
            totalChecks: 0,
            duplicatesFound: 0,
            averageCheckTime: 0,
            batchChecks: 0
        };
    }

    /**
     * Validate record structure for duplicate checking
     * @param {Object} record - Record to validate
     * @returns {boolean} True if record has required structure
     */
    validateRecordStructure(record) {
        if (!record || typeof record !== 'object') {
            return false;
        }

        // Check for required ID field (either 'id' or 'Id')
        const hasId = record.id != null || record.Id != null;

        // Check for phone number field
        const hasPhone = record.phoneNumber != null || record.Phone != null;

        return hasId && hasPhone;
    }

    /**
     * Validate array of records for duplicate checking
     * @param {Array} records - Array of records to validate
     * @returns {Object} Validation result with valid and invalid records
     */
    validateRecords(records) {
        if (!Array.isArray(records)) {
            return {
                valid: [],
                invalid: [],
                errors: ['Input is not an array']
            };
        }

        const valid = [];
        const invalid = [];
        const errors = [];

        for (let i = 0; i < records.length; i++) {
            const record = records[i];

            if (this.validateRecordStructure(record)) {
                valid.push(record);
            } else {
                invalid.push({ index: i, record });
                errors.push(`Record at index ${i} is missing required fields (id and phoneNumber)`);
            }
        }

        return { valid, invalid, errors };
    }
    /**
     * Generate detailed duplicate report with comprehensive information and enhanced logging
     * @param {Array} duplicates - Array of duplicate records
     * @param {string} sourceFile - Source file name
     * @param {Object} existingRecordDetails - Details of existing records
     * @returns {Object} Detailed duplicate report
     */
    async generateDuplicateReport(duplicates, sourceFile = null, existingRecordDetails = null) {
        const operationId = this.generateOperationId();
        const startTime = Date.now();

        try {
            this.logOperation('duplicate_report_generation_start', {
                operationId,
                duplicateCount: duplicates?.length || 0,
                sourceFile,
                hasExistingDetails: !!existingRecordDetails
            });

            const timestamp = new Date().toISOString();

            // Get existing record details if not provided
            let existingDetails = existingRecordDetails;
            if (!existingDetails && duplicates.length > 0) {
                this.logOperation('duplicate_report_fetching_existing_details', {
                    operationId,
                    duplicateIds: duplicates.length
                });

                const duplicateIds = duplicates.map(d => d.id || d.Id);
                existingDetails = await this.getExistingRecordDetails(duplicateIds);

                this.logOperation('duplicate_report_existing_details_fetched', {
                    operationId,
                    existingDetailsCount: existingDetails?.length || 0
                });
            }

            // Create a map for quick lookup of existing record details
            const existingDetailsMap = new Map();
            if (existingDetails) {
                existingDetails.forEach(detail => {
                    existingDetailsMap.set(detail.id, detail);
                });
            }

            // Generate detailed duplicate entries with audit trail
            const duplicateEntries = duplicates.map(duplicate => {
                const duplicateId = duplicate.id || duplicate.Id;
                const existingRecord = existingDetailsMap.get(duplicateId);

                // Create audit trail for each duplicate decision
                this.createAuditTrail({
                    type: 'duplicate_detected',
                    recordId: duplicateId,
                    sourceFile: sourceFile,
                    action: 'skip_duplicate',
                    reason: 'record_already_exists_in_check_table',
                    metadata: {
                        phone: duplicate.phoneNumber || duplicate.Phone,
                        existingCreatedAt: existingRecord?.createdAt
                    }
                });

                return {
                    id: duplicateId,
                    phone: duplicate.phoneNumber || duplicate.Phone,
                    sourceFile: sourceFile,
                    attemptedTimestamp: timestamp,
                    existingRecord: existingRecord ? {
                        createdAt: existingRecord.createdAt
                    } : null,
                    metadata: duplicate.metadata || null
                };
            });

            // Calculate statistics
            const totalDuplicates = duplicates.length;
            const phoneNumberFrequency = this.calculatePhoneFrequency(duplicateEntries);

            const report = {
                timestamp,
                sourceFile,
                operationId,
                summary: {
                    totalDuplicates,
                    uniquePhoneNumbers: new Set(duplicateEntries.map(d => d.phone)).size,
                },
                duplicateEntries,
                phoneNumberFrequency,
                recommendations: this.generateRecommendations(duplicateEntries),
                processingMetadata: {
                    detectionMethod: 'batch_sql_query',
                    batchSize: this.batchSize,
                    performanceMetrics: this.getMetrics(),
                    errorStats: this.getErrorStats(),
                    generationTime: Date.now() - startTime
                }
            };

            // Enhanced logging for duplicate report generation
            this.logDuplicateReportGeneration(report, operationId);

            // Log monitoring statistics
            this.logMonitoringStats({
                operation: 'duplicate_report_generation',
                sourceFile,
                duplicateCount: totalDuplicates,
                uniquePhoneNumbers: report.summary.uniquePhoneNumbers,
                generationTime: report.processingMetadata.generationTime
            });

            return report;

        } catch (error) {
            const generationTime = Date.now() - startTime;
            this.updateErrorStats('report_generation_error', error);

            this.logOperation('duplicate_report_generation_error', {
                operationId,
                error: error.message,
                duplicateCount: duplicates?.length || 0,
                sourceFile,
                generationTime
            });

            const errorMessage = this.createDuplicateErrorMessage(error, duplicates?.length || 0);
            throw new Error(`Duplicate report generation failed: ${errorMessage}`);
        }
    }

    /**
     * Enhanced logging for individual duplicate entry with comprehensive audit trail
     * @param {Object} duplicateRecord - The duplicate record
     * @param {string} sourceFile - Source file name
     * @param {Object} existingRecord - Details of existing record
     */
    logDuplicateEntry(duplicateRecord, sourceFile = null, existingRecord = null) {
        const operationId = this.generateOperationId();

        try {
            const timestamp = new Date().toISOString();
            const duplicateId = duplicateRecord.id || duplicateRecord.Id;
            const phone = duplicateRecord.phoneNumber || duplicateRecord.Phone;

            // Enhanced log entry with more details
            const logEntry = {
                timestamp,
                operationId,
                level: 'INFO',
                type: 'DUPLICATE_DETECTED',
                duplicateId,
                phone,
                sourceFile,
                existingRecord: existingRecord ? {
                    createdAt: existingRecord.createdAt
                } : null,
                metadata: duplicateRecord.metadata || null,
                processingContext: {
                    detectionMethod: 'individual_entry_logging',
                    batchSize: this.batchSize,
                    currentMetrics: this.getMetrics()
                }
            };

            // Structured operation logging
            this.logOperation('duplicate_entry_detected', {
                operationId,
                duplicateId,
                phone,
                sourceFile,
                existingCreatedAt: existingRecord?.createdAt,
                hasMetadata: !!(duplicateRecord.metadata)
            });

            // Create detailed audit trail
            this.createAuditTrail({
                type: 'individual_duplicate_logged',
                recordId: duplicateId,
                sourceFile: sourceFile,
                action: 'log_duplicate_entry',
                reason: 'duplicate_entry_detected_during_processing',
                metadata: {
                    phone,
                    existingRecord: existingRecord ? {
                        createdAt: existingRecord.createdAt
                    } : null,
                    recordMetadata: duplicateRecord.metadata
                }
            });

            // Enhanced console logging with more context
            console.log(`[DUPLICATE_ENTRY] ${timestamp} - ID: ${duplicateId}, Phone: ${phone}, Source: ${sourceFile || 'unknown'}`);

            if (existingRecord) {
                console.log(`  - Originally from: ${existingRecord.sourceFile || 'unknown'} at ${existingRecord.createdAt || 'unknown time'}`);
            }

            if (duplicateRecord.metadata) {
                console.log(`  - Record metadata: ${JSON.stringify(duplicateRecord.metadata)}`);
            }

            // Store detailed log entry for potential external logging systems
            this.storeDuplicateLogEntry(logEntry);

            // Performance logging for duplicate entry detection
            if (this.logging.performanceLogging) {
                this.logPerformanceMetrics({
                    operation: 'individual_duplicate_entry_logging',
                    recordId: duplicateId,
                    sourceFile,
                    hasExistingRecord: !!existingRecord,
                    logTime: Date.now() - new Date(timestamp).getTime()
                });
            }

        } catch (error) {
            this.updateErrorStats('duplicate_entry_logging_error', error);

            this.logOperation('duplicate_entry_logging_error', {
                operationId,
                error: error.message,
                duplicateId: duplicateRecord?.id || duplicateRecord?.Id,
                sourceFile
            });
        }
    }

    /**
     * Calculate duplicate statistics (count, percentage)
     * @param {number} totalRecords - Total number of records processed
     * @param {number} duplicateCount - Number of duplicates found
     * @returns {Object} Duplicate statistics
     */
    calculateDuplicateStatistics(totalRecords, duplicateCount) {
        if (totalRecords <= 0) {
            return {
                totalRecords: 0,
                duplicateCount: 0,
                duplicatePercentage: 0,
                newRecordCount: 0,
                newRecordPercentage: 0
            };
        }

        const duplicatePercentage = (duplicateCount / totalRecords) * 100;
        const newRecordCount = totalRecords - duplicateCount;
        const newRecordPercentage = (newRecordCount / totalRecords) * 100;

        return {
            totalRecords,
            duplicateCount,
            duplicatePercentage: Math.round(duplicatePercentage * 100) / 100,
            newRecordCount,
            newRecordPercentage: Math.round(newRecordPercentage * 100) / 100
        };
    }

    /**
     * Generate duplicate metadata for extraction reports
     * @param {Object} duplicateCheckResult - Result from checkForDuplicates
     * @param {string} sourceFile - Source file name
     * @returns {Object} Duplicate metadata for extraction reports
     */
    generateDuplicateMetadata(duplicateCheckResult, sourceFile = null) {
        try {
            const timestamp = new Date().toISOString();
            const statistics = this.calculateDuplicateStatistics(
                duplicateCheckResult.totalRecords,
                duplicateCheckResult.duplicateCount
            );

            const metadata = {
                timestamp,
                sourceFile,
                duplicateDetection: {
                    enabled: true,
                    method: 'batch_sql_query',
                    batchSize: this.batchSize
                },
                statistics,
                duplicateDetails: {
                    duplicateIds: duplicateCheckResult.duplicateIds || [],
                    newRecordIds: duplicateCheckResult.newRecordIds || [],
                    checkTime: duplicateCheckResult.checkTime || 0
                },
                recommendations: this.generateRecommendations(duplicateCheckResult.duplicates || []),
                performanceMetrics: this.getMetrics()
            };

            return metadata;

        } catch (error) {
            console.error('Error generating duplicate metadata:', error.message);
            return {
                timestamp: new Date().toISOString(),
                sourceFile,
                error: error.message,
                duplicateDetection: { enabled: false }
            };
        }
    }

    /**
     * Calculate phone number frequency in duplicates
     * @param {Array} duplicateEntries - Array of duplicate entries
     * @returns {Object} Phone number frequency map
     */
    calculatePhoneFrequency(duplicateEntries) {
        const frequency = {};

        for (const entry of duplicateEntries) {
            const phone = entry.phone;
            frequency[phone] = (frequency[phone] || 0) + 1;
        }

        // Sort by frequency (descending)
        const sortedFrequency = Object.entries(frequency)
            .sort(([, a], [, b]) => b - a)
            .reduce((obj, [phone, count]) => {
                obj[phone] = count;
                return obj;
            }, {});

        return sortedFrequency;
    }

    /**
     * Calculate average duplicates per file
     * @param {Object} duplicatesBySourceFile - Duplicates grouped by source file
     * @returns {number} Average duplicates per file
     */
    calculateAverageDuplicatesPerFile(duplicatesBySourceFile) {
        const sourceFiles = Object.keys(duplicatesBySourceFile);

        if (sourceFiles.length === 0) {
            return 0;
        }

        const totalDuplicates = sourceFiles.reduce((sum, file) => {
            return sum + duplicatesBySourceFile[file].count;
        }, 0);

        return Math.round((totalDuplicates / sourceFiles.length) * 100) / 100;
    }

    /**
     * Generate recommendations based on duplicate analysis
     * @param {Array} duplicateEntries - Array of duplicate entries
     * @returns {Array} Array of recommendation strings
     */
    generateRecommendations(duplicateEntries) {
        const recommendations = [];

        if (duplicateEntries.length === 0) {
            recommendations.push('No duplicates found. All records are new.');
            return recommendations;
        }

        const duplicatesBySourceFile = this.groupDuplicatesBySourceFile(duplicateEntries);
        const sourceFileCount = Object.keys(duplicatesBySourceFile).length;
        const phoneFrequency = this.calculatePhoneFrequency(duplicateEntries);
        const multipleOccurrences = Object.values(phoneFrequency).filter(count => count > 1).length;

        // High duplicate rate recommendation
        const totalDuplicates = duplicateEntries.length;
        if (totalDuplicates > 100) {
            recommendations.push(`High number of duplicates detected (${totalDuplicates}). Consider reviewing data sources for overlap.`);
        }

        // Multiple source files recommendation
        if (sourceFileCount > 1) {
            recommendations.push(`Duplicates found across ${sourceFileCount} different source files. Consider data deduplication at source.`);
        }

        // Phone number frequency recommendation
        if (multipleOccurrences > 0) {
            recommendations.push(`${multipleOccurrences} phone numbers appear multiple times. Review for data quality issues.`);
        }

        // Performance recommendation
        if (totalDuplicates > 1000) {
            recommendations.push('Large number of duplicates may impact performance. Consider implementing data validation at upload time.');
        }

        return recommendations;
    }

    /**
     * Store duplicate log entry for external logging systems
     * @param {Object} logEntry - Structured log entry
     */
    storeDuplicateLogEntry(logEntry) {
        // This method can be extended to integrate with external logging systems
        // For now, we'll store in memory for potential retrieval

        if (!this.duplicateLogEntries) {
            this.duplicateLogEntries = [];
        }

        this.duplicateLogEntries.push(logEntry);

        // Keep only last 1000 entries to prevent memory issues
        if (this.duplicateLogEntries.length > 1000) {
            this.duplicateLogEntries.shift();
        }
    }

    /**
     * Enhanced logging for duplicate report generation
     * @param {Object} report - Generated duplicate report
     * @param {string} operationId - Operation identifier
     */
    logDuplicateReportGeneration(report, operationId) {
        try {
            const summary = report.summary;
            const metadata = report.processingMetadata;

            // Main report log
            this.logOperation('duplicate_report_generated', {
                operationId,
                sourceFile: report.sourceFile,
                totalDuplicates: summary.totalDuplicates,
                uniquePhoneNumbers: summary.uniquePhoneNumbers,
                sourceFilesInvolved: Object.keys(summary.duplicatesBySourceFile).length,
                averageDuplicatesPerFile: summary.averageDuplicatesPerFile,
                generationTime: metadata.generationTime,
                detectionMethod: metadata.detectionMethod
            });

            // Detailed performance logging
            if (this.logging.performanceLogging) {
                this.logPerformanceMetrics({
                    operation: 'duplicate_report_generation',
                    sourceFile: report.sourceFile,
                    duplicateCount: summary.totalDuplicates,
                    generationTime: metadata.generationTime,
                    performanceMetrics: metadata.performanceMetrics,
                    errorStats: metadata.errorStats
                });
            }

            // Log recommendations if any
            if (report.recommendations && report.recommendations.length > 0) {
                this.logOperation('duplicate_report_recommendations', {
                    operationId,
                    sourceFile: report.sourceFile,
                    recommendations: report.recommendations
                });
            }

            // Log high duplicate scenarios
            if (summary.totalDuplicates > 100) {
                this.logOperation('high_duplicate_count_detected', {
                    operationId,
                    sourceFile: report.sourceFile,
                    duplicateCount: summary.totalDuplicates,
                    duplicatePercentage: report.duplicateEntries.length > 0 ?
                        (summary.totalDuplicates / report.duplicateEntries.length) * 100 : 0
                });
            }

            // Console logging with enhanced format
            console.log(`[DUPLICATE_REPORT] ${report.timestamp} - Generated for ${report.sourceFile || 'unknown source'}: ${summary.totalDuplicates} duplicates found`);

            if (summary.totalDuplicates > 0) {
                console.log(`  - Unique phone numbers: ${summary.uniquePhoneNumbers}`);
                console.log(`  - Source files involved: ${Object.keys(summary.duplicatesBySourceFile).length}`);
                console.log(`  - Average duplicates per file: ${summary.averageDuplicatesPerFile}`);
                console.log(`  - Generation time: ${metadata.generationTime}ms`);
                console.log(`  - Detection method: ${metadata.detectionMethod}`);
            }

        } catch (error) {
            this.logOperation('duplicate_report_logging_error', {
                operationId,
                error: error.message
            });
        }
    }

    /**
     * Legacy method for backward compatibility
     * @param {Object} report - Generated duplicate report
     */
    logDuplicateReport(report) {
        this.logDuplicateReportGeneration(report, report.operationId || this.generateOperationId());
    }

    /**
     * Get recent duplicate log entries
     * @param {number} limit - Maximum number of entries to return
     * @returns {Array} Array of recent duplicate log entries
     */
    getRecentDuplicateLogEntries(limit = 100) {
        if (!this.duplicateLogEntries) {
            return [];
        }

        return this.duplicateLogEntries
            .slice(-limit)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    /**
     * Clear duplicate log entries
     */
    clearDuplicateLogEntries() {
        this.duplicateLogEntries = [];
    }

    // ==================== ERROR HANDLING METHODS ====================

    /**
     * Generate unique operation ID for tracking
     * @returns {string} Unique operation identifier
     */
    generateOperationId() {
        return `dup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Extract and validate IDs from records with error handling
     * @param {Array} records - Array of records
     * @returns {Array} Array of valid IDs
     */
    extractAndValidateIds(records) {
        const validIds = [];
        const invalidRecords = [];

        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            const recordId = record.id || record.Id;

            if (recordId && typeof recordId === 'string' && recordId.trim().length > 0) {
                validIds.push(recordId.trim());
            } else {
                invalidRecords.push({ index: i, record });
            }
        }

        if (invalidRecords.length > 0) {
            this.logOperation('invalid_records_detected', {
                count: invalidRecords.length,
                totalRecords: records.length,
                percentage: Math.round((invalidRecords.length / records.length) * 100)
            });
        }

        return validIds;
    }

    /**
     * Batch check existing IDs with comprehensive error handling
     * @param {Array} recordIds - Array of IDs to check
     * @param {string} operationId - Operation identifier
     * @returns {Promise<Object>} Result with error handling information
     */
    async batchCheckExistingIdsWithErrorHandling(recordIds, operationId) {
        const result = {
            duplicateIds: [],
            errorHandling: {
                fallbackUsed: false,
                gracefulDegradation: false,
                retryAttempts: 0,
                errors: []
            }
        };

        if (!Array.isArray(recordIds) || recordIds.length === 0) {
            return result;
        }

        let attempt = 0;
        let lastError = null;

        while (attempt <= this.errorHandling.maxRetries) {
            try {
                this.logOperation('duplicate_query_attempt', {
                    operationId,
                    attempt: attempt + 1,
                    recordCount: recordIds.length
                });

                const duplicateIds = await this.batchCheckExistingIds(recordIds);
                result.duplicateIds = duplicateIds;
                result.errorHandling.retryAttempts = attempt;

                if (attempt > 0) {
                    this.logOperation('duplicate_query_retry_success', {
                        operationId,
                        successfulAttempt: attempt + 1,
                        totalAttempts: attempt + 1
                    });
                }

                return result;

            } catch (error) {
                lastError = error;
                attempt++;
                result.errorHandling.retryAttempts = attempt;
                result.errorHandling.errors.push({
                    attempt,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });

                this.updateErrorStats('query_failure', error);

                this.logOperation('duplicate_query_error', {
                    operationId,
                    attempt,
                    error: error.message,
                    willRetry: attempt <= this.errorHandling.maxRetries
                });

                if (attempt <= this.errorHandling.maxRetries) {
                    await this.delay(this.errorHandling.retryDelay * attempt);
                }
            }
        }

        // All retries exhausted, try fallback mechanisms
        if (this.errorHandling.fallbackEnabled) {
            try {
                this.logOperation('duplicate_detection_fallback_start', { operationId });

                const fallbackResult = await this.fallbackDuplicateDetection(recordIds, operationId);
                result.duplicateIds = fallbackResult.duplicateIds;
                result.errorHandling.fallbackUsed = true;
                result.errorHandling.errors.push(...fallbackResult.errors);

                this.updateErrorStats('fallback_used', lastError);

                this.logOperation('duplicate_detection_fallback_success', {
                    operationId,
                    fallbackMethod: fallbackResult.method,
                    duplicatesFound: fallbackResult.duplicateIds.length
                });

                return result;

            } catch (fallbackError) {
                this.logOperation('duplicate_detection_fallback_failed', {
                    operationId,
                    error: fallbackError.message
                });

                result.errorHandling.errors.push({
                    type: 'fallback_failure',
                    error: fallbackError.message,
                    timestamp: new Date().toISOString()
                });
            }
        }

        // Graceful degradation - return empty result but continue processing
        if (this.errorHandling.gracefulDegradation) {
            this.logOperation('duplicate_detection_graceful_degradation', {
                operationId,
                message: 'Continuing with empty duplicate detection result'
            });

            result.errorHandling.gracefulDegradation = true;
            result.duplicateIds = [];

            this.updateErrorStats('graceful_degradation', lastError);

            return result;
        }

        // If graceful degradation is disabled, throw the error
        throw new Error(`Duplicate detection failed after ${this.errorHandling.maxRetries} retries: ${lastError.message}`);
    }

    /**
     * Fallback duplicate detection using alternative methods
     * @param {Array} recordIds - Array of IDs to check
     * @param {string} operationId - Operation identifier
     * @returns {Promise<Object>} Fallback detection result
     */
    async fallbackDuplicateDetection(recordIds, operationId) {
        const fallbackResult = {
            duplicateIds: [],
            method: 'unknown',
            errors: []
        };

        // Fallback 1: Individual ID checking
        try {
            this.logOperation('fallback_individual_queries', { operationId });

            const duplicates = [];
            const batchSize = 10; // Smaller batches for fallback

            for (let i = 0; i < recordIds.length; i += batchSize) {
                const batch = recordIds.slice(i, i + batchSize);

                for (const id of batch) {
                    try {
                        const isDuplicate = await this.isDuplicateId(id);
                        if (isDuplicate) {
                            duplicates.push(id);
                        }
                    } catch (individualError) {
                        fallbackResult.errors.push({
                            type: 'individual_query_error',
                            id,
                            error: individualError.message
                        });
                    }
                }

                // Small delay between batches to avoid overwhelming the database
                if (i + batchSize < recordIds.length) {
                    await this.delay(100);
                }
            }

            fallbackResult.duplicateIds = duplicates;
            fallbackResult.method = 'individual_queries';
            return fallbackResult;

        } catch (individualError) {
            fallbackResult.errors.push({
                type: 'individual_fallback_failed',
                error: individualError.message
            });
        }

        // Fallback 2: Use database manager's fallback method
        try {
            this.logOperation('fallback_database_manager', { operationId });

            const dbFallbackResult = await databaseManager.fallbackDuplicateDetection(recordIds, {
                useIndividualQueries: true,
                useCachedResults: true,
                maxRetries: 2,
                retryDelay: 500
            });

            fallbackResult.duplicateIds = dbFallbackResult.duplicateIds;
            fallbackResult.method = dbFallbackResult.method;
            fallbackResult.errors.push(...dbFallbackResult.errors.map(err => ({
                type: 'database_manager_fallback',
                error: err
            })));

            return fallbackResult;

        } catch (dbFallbackError) {
            fallbackResult.errors.push({
                type: 'database_manager_fallback_failed',
                error: dbFallbackError.message
            });
        }

        // If all fallbacks fail, return empty result
        fallbackResult.method = 'failed_all_fallbacks';
        return fallbackResult;
    }

    /**
     * Handle duplicate detection errors with proper error messages
     * @param {Error} error - The error that occurred
     * @param {Array} records - Original records being processed
     * @param {string} operationId - Operation identifier
     * @param {number} startTime - Operation start time
     * @returns {Promise<Object>} Error handling result
     */
    async handleDuplicateDetectionError(error, records, operationId, startTime) {
        const errorResult = {
            duplicates: [],
            newRecords: records || [],
            duplicateIds: [],
            newRecordIds: (records || []).map(r => r.id || r.Id).filter(id => id),
            totalRecords: (records || []).length,
            duplicateCount: 0,
            newRecordCount: (records || []).length,
            checkTime: Date.now() - startTime,
            operationId,
            errorHandling: {
                fallbackUsed: false,
                gracefulDegradation: true,
                error: error.message,
                timestamp: new Date().toISOString()
            }
        };

        this.updateErrorStats('detection_error', error);

        // Create proper error messages for different error types
        const errorMessage = this.createDuplicateErrorMessage(error, records?.length || 0);

        this.logOperation('duplicate_detection_error', {
            operationId,
            error: errorMessage,
            recordCount: records?.length || 0,
            errorType: error.constructor.name,
            gracefulDegradation: this.errorHandling.gracefulDegradation
        });

        if (this.errorHandling.gracefulDegradation) {
            // Continue processing without duplicate detection
            this.logOperation('duplicate_detection_graceful_degradation', {
                operationId,
                message: 'Continuing processing without duplicate detection',
                assumeAllNew: true
            });

            return errorResult;
        } else {
            // Re-throw error if graceful degradation is disabled
            throw new Error(errorMessage);
        }
    }

    /**
     * Create proper error messages for duplicate-related issues
     * @param {Error} error - The original error
     * @param {number} recordCount - Number of records being processed
     * @returns {string} User-friendly error message
     */
    createDuplicateErrorMessage(error, recordCount) {
        const baseMessage = `Duplicate detection failed for ${recordCount} records`;

        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            return `${baseMessage}: Database connection unavailable. Please check database connectivity.`;
        }

        // PostgreSQL error codes (removed MySQL-specific codes)
        if (error.code === '28000' || error.code === '28P01') {
            return `${baseMessage}: Database access denied. Please check database permissions.`;
        }

        if (error.code === 'ETIMEDOUT' || error.code === '57014') {
            return `${baseMessage}: Database operation timed out. The system may be under heavy load.`;
        }

        // Note: backup_table is not used in PostgreSQL schema
        if (error.message.includes('check_table')) {
            return `${baseMessage}: Unable to access check table for duplicate checking.`;
        }

        if (error.message.includes('memory') || error.message.includes('Memory')) {
            return `${baseMessage}: Insufficient memory for duplicate detection. Consider processing smaller batches.`;
        }

        return `${baseMessage}: ${error.message}`;
    }

    /**
     * Update error statistics for monitoring
     * @param {string} errorType - Type of error
     * @param {Error} error - The error object
     */
    updateErrorStats(errorType, error) {
        this.errorStats.lastErrorTimestamp = new Date().toISOString();

        switch (errorType) {
            case 'query_failure':
                this.errorStats.queryFailures++;
                break;
            case 'fallback_used':
                this.errorStats.fallbacksUsed++;
                break;
            case 'graceful_degradation':
                this.errorStats.gracefulDegradations++;
                break;
        }

        const errorKey = error.code || error.constructor.name || 'unknown';
        this.errorStats.errorTypes[errorKey] = (this.errorStats.errorTypes[errorKey] || 0) + 1;
    }

    /**
     * Delay utility for retry mechanisms
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} Promise that resolves after delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get error statistics for monitoring
     * @returns {Object} Error statistics
     */
    getErrorStats() {
        return {
            ...this.errorStats,
            errorRate: this.metrics.batchChecks > 0 ?
                (this.errorStats.queryFailures / this.metrics.batchChecks) * 100 : 0,
            fallbackRate: this.metrics.batchChecks > 0 ?
                (this.errorStats.fallbacksUsed / this.metrics.batchChecks) * 100 : 0
        };
    }

    /**
     * Reset error statistics
     */
    resetErrorStats() {
        this.errorStats = {
            queryFailures: 0,
            fallbacksUsed: 0,
            gracefulDegradations: 0,
            lastErrorTimestamp: null,
            errorTypes: {}
        };
    }

    // ==================== LOGGING METHODS ====================

    /**
     * Log duplicate detection operations with structured format
     * @param {string} operation - Operation type
     * @param {Object} details - Operation details
     */
    logOperation(operation, details = {}) {
        if (!this.logging.enabled) return;

        const logEntry = {
            timestamp: new Date().toISOString(),
            service: 'DuplicateDetectionService',
            operation,
            level: this.getLogLevel(operation),
            ...details
        };

        // Console logging with appropriate level
        switch (logEntry.level) {
            case 'DEBUG':
                if (this.logging.logLevel === 'DEBUG') {
                    console.debug(`[DUPLICATE_DEBUG] ${logEntry.timestamp} - ${operation}:`, details);
                }
                break;
            case 'INFO':
                if (['DEBUG', 'INFO'].includes(this.logging.logLevel)) {
                    console.log(`[DUPLICATE_INFO] ${logEntry.timestamp} - ${operation}:`, details);
                }
                break;
            case 'WARN':
                if (['DEBUG', 'INFO', 'WARN'].includes(this.logging.logLevel)) {
                    console.warn(`[DUPLICATE_WARN] ${logEntry.timestamp} - ${operation}:`, details);
                }
                break;
            case 'ERROR':
                console.error(`[DUPLICATE_ERROR] ${logEntry.timestamp} - ${operation}:`, details);
                break;
        }

        // Store for audit trail if enabled
        if (this.logging.auditTrail) {
            this.storeAuditLogEntry(logEntry);
        }
    }

    /**
     * Get appropriate log level for operation
     * @param {string} operation - Operation type
     * @returns {string} Log level
     */
    getLogLevel(operation) {
        const errorOperations = [
            'duplicate_detection_error',
            'duplicate_query_error',
            'duplicate_detection_fallback_failed'
        ];

        const warnOperations = [
            'invalid_records_detected',
            'duplicate_detection_fallback_start',
            'duplicate_detection_graceful_degradation'
        ];

        const debugOperations = [
            'duplicate_detection_start',
            'duplicate_query_attempt',
            'fallback_individual_queries'
        ];

        if (errorOperations.includes(operation)) return 'ERROR';
        if (warnOperations.includes(operation)) return 'WARN';
        if (debugOperations.includes(operation)) return 'DEBUG';
        return 'INFO';
    }

    /**
     * Log performance metrics for duplicate detection queries
     * @param {Object} performanceData - Performance metrics
     */
    logPerformanceMetrics(performanceData) {
        if (!this.logging.performanceLogging) return;

        const perfLog = {
            timestamp: new Date().toISOString(),
            type: 'performance_metrics',
            service: 'DuplicateDetectionService',
            ...performanceData
        };

        // Log slow operations
        if (performanceData.checkTime > 5000) {
            console.warn(`[DUPLICATE_PERF] Slow duplicate detection: ${performanceData.checkTime}ms for ${performanceData.recordCount} records`);
        }

        // Log high error rates
        const errorStats = this.getErrorStats();
        if (errorStats.errorRate > 10) {
            console.warn(`[DUPLICATE_PERF] High error rate detected: ${errorStats.errorRate.toFixed(2)}%`);
        }

        this.storePerformanceLogEntry(perfLog);
    }

    /**
     * Create audit trail for duplicate handling decisions
     * @param {Object} decision - Duplicate handling decision
     */
    createAuditTrail(decision) {
        if (!this.logging.auditTrail) return;

        const auditEntry = {
            timestamp: new Date().toISOString(),
            type: 'duplicate_handling_decision',
            service: 'DuplicateDetectionService',
            decision: decision.type,
            recordId: decision.recordId,
            sourceFile: decision.sourceFile,
            action: decision.action,
            reason: decision.reason,
            metadata: decision.metadata || {}
        };

        console.log(`[DUPLICATE_AUDIT] ${auditEntry.timestamp} - Decision: ${decision.type} for record ${decision.recordId}`);
        this.storeAuditLogEntry(auditEntry);
    }

    /**
     * Log monitoring information for duplicate statistics and trends
     * @param {Object} stats - Duplicate statistics
     */
    logMonitoringStats(stats) {
        const monitoringLog = {
            timestamp: new Date().toISOString(),
            type: 'monitoring_stats',
            service: 'DuplicateDetectionService',
            stats: {
                ...stats,
                errorStats: this.getErrorStats(),
                performanceMetrics: this.getMetrics()
            }
        };

        console.log(`[DUPLICATE_MONITOR] ${monitoringLog.timestamp} - Stats:`, monitoringLog.stats);
        this.storeMonitoringLogEntry(monitoringLog);
    }

    /**
     * Store audit log entry for external systems
     * @param {Object} logEntry - Audit log entry
     */
    storeAuditLogEntry(logEntry) {
        // Initialize audit log storage if not exists
        if (!this.auditLogEntries) {
            this.auditLogEntries = [];
        }

        this.auditLogEntries.push(logEntry);

        // Keep only last 1000 audit entries to prevent memory issues
        if (this.auditLogEntries.length > 1000) {
            this.auditLogEntries.shift();
        }
    }

    /**
     * Store performance log entry
     * @param {Object} logEntry - Performance log entry
     */
    storePerformanceLogEntry(logEntry) {
        if (!this.performanceLogEntries) {
            this.performanceLogEntries = [];
        }

        this.performanceLogEntries.push(logEntry);

        // Keep only last 500 performance entries
        if (this.performanceLogEntries.length > 500) {
            this.performanceLogEntries.shift();
        }
    }

    /**
     * Store monitoring log entry
     * @param {Object} logEntry - Monitoring log entry
     */
    storeMonitoringLogEntry(logEntry) {
        if (!this.monitoringLogEntries) {
            this.monitoringLogEntries = [];
        }

        this.monitoringLogEntries.push(logEntry);

        // Keep only last 200 monitoring entries
        if (this.monitoringLogEntries.length > 200) {
            this.monitoringLogEntries.shift();
        }
    }

    /**
     * Get recent audit log entries
     * @param {number} limit - Maximum number of entries to return
     * @returns {Array} Array of recent audit log entries
     */
    getRecentAuditLogEntries(limit = 100) {
        if (!this.auditLogEntries) {
            return [];
        }

        return this.auditLogEntries
            .slice(-limit)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    /**
     * Get recent performance log entries
     * @param {number} limit - Maximum number of entries to return
     * @returns {Array} Array of recent performance log entries
     */
    getRecentPerformanceLogEntries(limit = 50) {
        if (!this.performanceLogEntries) {
            return [];
        }

        return this.performanceLogEntries
            .slice(-limit)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    /**
     * Get recent monitoring log entries
     * @param {number} limit - Maximum number of entries to return
     * @returns {Array} Array of recent monitoring log entries
     */
    getRecentMonitoringLogEntries(limit = 20) {
        if (!this.monitoringLogEntries) {
            return [];
        }

        return this.monitoringLogEntries
            .slice(-limit)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    /**
     * Clear all log entries
     */
    clearAllLogEntries() {
        this.auditLogEntries = [];
        this.performanceLogEntries = [];
        this.monitoringLogEntries = [];
        this.duplicateLogEntries = [];
    }

    /**
     * Configure error handling settings
     * @param {Object} config - Error handling configuration
     */
    configureErrorHandling(config) {
        this.errorHandling = {
            ...this.errorHandling,
            ...config
        };

        this.logOperation('error_handling_configured', {
            newConfig: this.errorHandling
        });
    }

    /**
     * Configure logging settings
     * @param {Object} config - Logging configuration
     */
    configureLogging(config) {
        this.logging = {
            ...this.logging,
            ...config
        };

        this.logOperation('logging_configured', {
            newConfig: this.logging
        });
    }

    /**
     * Generate comprehensive monitoring report with trends and statistics
     * @returns {Object} Comprehensive monitoring report
     */
    generateMonitoringReport() {
        const timestamp = new Date().toISOString();
        const operationId = this.generateOperationId();

        const report = {
            timestamp,
            operationId,
            service: 'DuplicateDetectionService',
            performanceMetrics: this.getMetrics(),
            errorStatistics: this.getErrorStats(),
            configurationStatus: {
                errorHandling: this.errorHandling,
                logging: this.logging,
                batchSize: this.batchSize
            },
            recentActivity: {
                auditEntries: this.getRecentAuditLogEntries(10),
                performanceEntries: this.getRecentPerformanceLogEntries(5),
                monitoringEntries: this.getRecentMonitoringLogEntries(3)
            },
            healthStatus: this.assessHealthStatus(),
            recommendations: this.generateMonitoringRecommendations()
        };

        this.logOperation('monitoring_report_generated', {
            operationId,
            reportSections: Object.keys(report),
            healthStatus: report.healthStatus.overall,
            errorRate: report.errorStatistics.errorRate,
            averageCheckTime: report.performanceMetrics.averageCheckTimeMs
        });

        return report;
    }

    /**
     * Assess the health status of the duplicate detection service
     * @returns {Object} Health status assessment
     */
    assessHealthStatus() {
        const metrics = this.getMetrics();
        const errorStats = this.getErrorStats();

        const health = {
            overall: 'healthy',
            performance: 'good',
            errorRate: 'acceptable',
            availability: 'operational',
            issues: [],
            warnings: []
        };

        // Check performance health
        if (metrics.averageCheckTimeMs > 5000) {
            health.performance = 'degraded';
            health.issues.push('Average check time exceeds 5 seconds');
        } else if (metrics.averageCheckTimeMs > 2000) {
            health.performance = 'acceptable';
            health.warnings.push('Average check time is elevated (>2 seconds)');
        }

        // Check error rate health
        if (errorStats.errorRate > 10) {
            health.errorRate = 'high';
            health.issues.push(`Error rate is high: ${errorStats.errorRate.toFixed(2)}%`);
        } else if (errorStats.errorRate > 5) {
            health.errorRate = 'elevated';
            health.warnings.push(`Error rate is elevated: ${errorStats.errorRate.toFixed(2)}%`);
        }

        // Check fallback usage
        if (errorStats.fallbackRate > 20) {
            health.availability = 'degraded';
            health.issues.push(`High fallback usage: ${errorStats.fallbackRate.toFixed(2)}%`);
        } else if (errorStats.fallbackRate > 10) {
            health.warnings.push(`Elevated fallback usage: ${errorStats.fallbackRate.toFixed(2)}%`);
        }

        // Overall health assessment
        if (health.issues.length > 0) {
            health.overall = 'unhealthy';
        } else if (health.warnings.length > 0) {
            health.overall = 'warning';
        }

        return health;
    }

    /**
     * Generate monitoring recommendations based on current status
     * @returns {Array} Array of monitoring recommendations
     */
    generateMonitoringRecommendations() {
        const recommendations = [];
        const metrics = this.getMetrics();
        const errorStats = this.getErrorStats();
        const health = this.assessHealthStatus();

        // Performance recommendations
        if (metrics.averageCheckTimeMs > 5000) {
            recommendations.push({
                type: 'performance',
                priority: 'high',
                message: 'Consider optimizing database queries or reducing batch size',
                action: 'optimize_performance'
            });
        }

        // Error rate recommendations
        if (errorStats.errorRate > 10) {
            recommendations.push({
                type: 'reliability',
                priority: 'high',
                message: 'Investigate and address high error rate',
                action: 'investigate_errors'
            });
        }

        // Fallback usage recommendations
        if (errorStats.fallbackRate > 20) {
            recommendations.push({
                type: 'availability',
                priority: 'medium',
                message: 'High fallback usage indicates database connectivity issues',
                action: 'check_database_connectivity'
            });
        }

        // Configuration recommendations
        if (!this.logging.performanceLogging) {
            recommendations.push({
                type: 'monitoring',
                priority: 'low',
                message: 'Enable performance logging for better monitoring',
                action: 'enable_performance_logging'
            });
        }

        // Capacity recommendations
        if (metrics.totalChecks > 1000000) {
            recommendations.push({
                type: 'capacity',
                priority: 'medium',
                message: 'Consider implementing caching for frequently checked IDs',
                action: 'implement_caching'
            });
        }

        return recommendations;
    }

    /**
     * Log comprehensive duplicate detection trends and statistics
     * @param {Object} customStats - Additional statistics to include
     */
    logDuplicateTrends(customStats = {}) {
        const operationId = this.generateOperationId();
        const timestamp = new Date().toISOString();

        const trendData = {
            timestamp,
            operationId,
            performanceMetrics: this.getMetrics(),
            errorStatistics: this.getErrorStats(),
            healthStatus: this.assessHealthStatus(),
            customStatistics: customStats,
            trends: {
                duplicateRate: this.metrics.totalChecks > 0 ?
                    (this.metrics.duplicatesFound / this.metrics.totalChecks) * 100 : 0,
                averageProcessingTime: this.metrics.averageCheckTimeMs,
                errorTrend: this.errorStats.errorRate,
                fallbackTrend: this.errorStats.fallbackRate
            }
        };

        this.logOperation('duplicate_trends_analysis', trendData);

        // Log monitoring statistics
        this.logMonitoringStats({
            operation: 'trend_analysis',
            ...trendData.trends,
            healthStatus: trendData.healthStatus.overall,
            totalOperations: this.metrics.batchChecks,
            totalRecordsProcessed: this.metrics.totalChecks
        });

        console.log(`[DUPLICATE_TRENDS] ${timestamp} - Trend Analysis:`);
        console.log(`  - Duplicate Rate: ${trendData.trends.duplicateRate.toFixed(2)}%`);
        console.log(`  - Average Processing Time: ${trendData.trends.averageProcessingTime}ms`);
        console.log(`  - Error Rate: ${trendData.trends.errorTrend.toFixed(2)}%`);
        console.log(`  - Health Status: ${trendData.healthStatus.overall}`);

        if (trendData.healthStatus.issues.length > 0) {
            console.warn(`  - Issues: ${trendData.healthStatus.issues.join(', ')}`);
        }

        if (trendData.healthStatus.warnings.length > 0) {
            console.warn(`  - Warnings: ${trendData.healthStatus.warnings.join(', ')}`);
        }

        return trendData;
    }

    /**
     * Export all logs and statistics for external analysis
     * @returns {Object} Complete log export
     */
    exportLogsAndStatistics() {
        const exportData = {
            timestamp: new Date().toISOString(),
            service: 'DuplicateDetectionService',
            configuration: {
                errorHandling: this.errorHandling,
                logging: this.logging,
                batchSize: this.batchSize
            },
            metrics: this.getMetrics(),
            errorStatistics: this.getErrorStats(),
            logs: {
                auditEntries: this.getRecentAuditLogEntries(1000),
                performanceEntries: this.getRecentPerformanceLogEntries(500),
                monitoringEntries: this.getRecentMonitoringLogEntries(200),
                duplicateEntries: this.getRecentDuplicateLogEntries(1000)
            },
            healthStatus: this.assessHealthStatus(),
            monitoringReport: this.generateMonitoringReport()
        };

        this.logOperation('logs_and_statistics_exported', {
            exportSize: JSON.stringify(exportData).length,
            auditEntries: exportData.logs.auditEntries.length,
            performanceEntries: exportData.logs.performanceEntries.length,
            monitoringEntries: exportData.logs.monitoringEntries.length,
            duplicateEntries: exportData.logs.duplicateEntries.length
        });

        return exportData;
    }
}

module.exports = DuplicateDetectionService;
