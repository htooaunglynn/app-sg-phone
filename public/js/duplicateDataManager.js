/**
 * Frontend Duplicate Phone Number Data Loading and Caching Manager
 * Handles loading duplicate phone information from the server and client-side caching
 * Provides efficient data structures for storing duplicate phone mappings
 */
class DuplicateDataManager {
    constructor() {
        // Configuration
        this.config = {
            // API endpoints
            endpoints: {
                checkRecords: '/check',
                duplicateInfo: '/api/duplicate-info', // Future endpoint for dedicated duplicate data
                backupRecords: '/api/backup-records' // Future endpoint for backup table access
            },
            
            // Caching settings
            cache: {
                enabled: true,
                timeout: 300000, // 5 minutes
                maxSize: 50000, // Maximum number of cached records
                refreshInterval: 60000, // 1 minute auto-refresh
                persistToStorage: true // Use localStorage for persistence
            },
            
            // Loading settings
            loading: {
                batchSize: 1000,
                maxRetries: 3,
                retryDelay: 1000,
                timeout: 30000, // 30 seconds
                enableProgressTracking: true
            },
            
            // Performance settings
            performance: {
                enableLazyLoading: true,
                enableCompression: false, // For future implementation
                enableDeltaUpdates: true, // Only load changed records
                maxConcurrentRequests: 3,
                // Large dataset optimizations
                largeDatasetThreshold: 5000,
                enableBackgroundProcessing: true,
                enableProgressiveLoading: true,
                chunkProcessingDelay: 10, // ms between chunks
                maxMemoryUsage: 100 * 1024 * 1024, // 100MB
                enableMemoryMonitoring: true
            }
        };

        // Cache storage
        this.duplicateInfoCache = new Map();
        this.recordsCache = new Map();
        this.metadataCache = new Map();
        
        // State management
        this.state = {
            isLoading: false,
            lastLoadTime: null,
            lastRefreshTime: null,
            loadProgress: 0,
            totalRecords: 0,
            duplicateRecords: 0,
            errors: []
        };

        // Event listeners for cache updates
        this.eventListeners = new Map();
        
        // Auto-refresh timer
        this.refreshTimer = null;

        // Initialize the manager
        this.initialize();
    }

    /**
     * Initialize the duplicate data manager
     */
    initialize() {
        console.log('Duplicate Data Manager initialized');
        
        // Load cached data from localStorage if enabled
        if (this.config.cache.persistToStorage) {
            this.loadFromLocalStorage();
        }
        
        // Setup auto-refresh if enabled
        if (this.config.cache.refreshInterval > 0) {
            this.setupAutoRefresh();
        }

        // Setup event listeners for page visibility changes
        this.setupVisibilityHandling();
    }

    /**
     * Load duplicate phone information from server with comprehensive error handling
     * @param {Object} options - Loading options
     * @returns {Promise<Object>} Duplicate information result
     */
    async loadDuplicatePhoneInformation(options = {}) {
        const loadOptions = {
            forceRefresh: false,
            includeMetadata: true,
            batchSize: this.config.loading.batchSize,
            enableGracefulDegradation: true,
            ...options
        };

        const startTime = Date.now();
        this.state.isLoading = true;
        this.state.loadProgress = 0;
        this.state.errors = [];

        try {
            // Check cache first unless force refresh is requested
            if (!loadOptions.forceRefresh && this.isCacheValid()) {
                console.log('Using cached duplicate information');
                const cachedResult = this.getCachedDuplicateInfo();
                this.state.isLoading = false;
                this.notifyListeners('duplicateInfoLoaded', cachedResult);
                return cachedResult;
            }

            console.log('Loading duplicate phone information from server...');
            
            // Load records from check table with error handling
            const checkRecords = await this.loadCheckTableRecordsWithErrorHandling(loadOptions);
            this.state.loadProgress = 50;

            // Process records for duplicate detection with error handling
            const duplicateInfo = await this.processDuplicateInformationWithErrorHandling(checkRecords, loadOptions);
            this.state.loadProgress = 80;

            // Cache the results if successful
            if (!duplicateInfo.errorHandling?.hasErrors) {
                await this.cacheDuplicateInformation(duplicateInfo);
            }
            this.state.loadProgress = 100;

            // Update state
            const loadTime = Date.now() - startTime;
            this.state.isLoading = false;
            this.state.lastLoadTime = Date.now();
            this.state.totalRecords = checkRecords.length;
            this.state.duplicateRecords = duplicateInfo.duplicateRecordIds.length;

            console.log(`Duplicate information loaded in ${loadTime}ms`, {
                totalRecords: this.state.totalRecords,
                duplicateRecords: this.state.duplicateRecords,
                duplicatePhones: duplicateInfo.duplicatePhoneNumbers.size,
                hasErrors: duplicateInfo.errorHandling?.hasErrors || false
            });

            // Notify listeners
            this.notifyListeners('duplicateInfoLoaded', duplicateInfo);
            
            return duplicateInfo;

        } catch (error) {
            return await this.handleLoadingError(error, loadOptions, startTime);
        }
    }

    /**
     * Handle loading errors with graceful degradation
     * @param {Error} error - The error that occurred
     * @param {Object} loadOptions - Loading options
     * @param {number} startTime - Start time of operation
     * @returns {Promise<Object>} Error handling result
     */
    async handleLoadingError(error, loadOptions, startTime) {
        this.state.isLoading = false;
        this.state.errors.push({
            message: error.message,
            timestamp: Date.now(),
            context: 'loadDuplicatePhoneInformation',
            errorType: error.constructor.name
        });
        
        console.error('Failed to load duplicate phone information:', error);
        this.notifyListeners('duplicateInfoError', error);

        // Try graceful degradation approaches
        if (loadOptions.enableGracefulDegradation) {
            // Fallback 1: Return cached data if available
            if (this.duplicateInfoCache.size > 0) {
                console.log('Using cached data as fallback after error');
                const cachedResult = this.getCachedDuplicateInfo();
                if (cachedResult) {
                    cachedResult.errorHandling = {
                        hasErrors: true,
                        fallbackUsed: true,
                        fallbackMethod: 'cached_data',
                        originalError: error.message,
                        timestamp: new Date().toISOString()
                    };
                    return cachedResult;
                }
            }

            // Fallback 2: Return empty result to allow UI to continue
            console.log('Using empty result as graceful degradation');
            const fallbackResult = this.createEmptyDuplicateResult();
            fallbackResult.errorHandling = {
                hasErrors: true,
                gracefulDegradation: true,
                fallbackMethod: 'empty_result',
                originalError: error.message,
                loadTime: Date.now() - startTime,
                timestamp: new Date().toISOString()
            };
            
            this.notifyListeners('duplicateInfoFallback', fallbackResult);
            return fallbackResult;
        }
        
        // If graceful degradation is disabled, re-throw the error
        throw error;
    }

    /**
     * Load check table records with error handling
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of check table records
     */
    async loadCheckTableRecordsWithErrorHandling(options = {}) {
        try {
            return await this.loadCheckTableRecords(options);
        } catch (error) {
            console.warn('Error loading check table records, attempting fallback:', error);
            
            // Try fallback loading with reduced batch size
            const fallbackOptions = {
                ...options,
                batchSize: Math.min(100, options.batchSize || 100)
            };
            
            try {
                console.log('Attempting fallback loading with smaller batch size');
                return await this.loadCheckTableRecords(fallbackOptions);
            } catch (fallbackError) {
                console.error('Fallback loading also failed:', fallbackError);
                
                // Return empty array to allow processing to continue
                if (options.enableGracefulDegradation !== false) {
                    console.log('Returning empty records array for graceful degradation');
                    return [];
                }
                
                throw fallbackError;
            }
        }
    }

    /**
     * Process duplicate information with error handling
     * @param {Array} records - Records to process
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} Processed duplicate information
     */
    async processDuplicateInformationWithErrorHandling(records, options = {}) {
        try {
            return await this.processDuplicateInformation(records, options);
        } catch (error) {
            console.warn('Error processing duplicate information, using fallback:', error);
            
            // Fallback to basic duplicate detection
            const fallbackResult = this.basicDuplicateDetectionWithErrorHandling(records);
            fallbackResult.errorHandling = {
                hasErrors: true,
                fallbackUsed: true,
                fallbackMethod: 'basic_detection',
                originalError: error.message,
                timestamp: new Date().toISOString()
            };
            
            return fallbackResult;
        }
    }

    /**
     * Basic duplicate detection with error handling fallback
     * @param {Array} records - Records to process
     * @returns {Object} Basic duplicate information
     */
    basicDuplicateDetectionWithErrorHandling(records) {
        try {
            return this.basicDuplicateDetection(records);
        } catch (error) {
            console.error('Even basic duplicate detection failed:', error);
            
            // Return empty result as final fallback
            const emptyResult = this.createEmptyDuplicateResult();
            emptyResult.totalRecords = records.length;
            emptyResult.errorHandling = {
                hasErrors: true,
                gracefulDegradation: true,
                fallbackMethod: 'empty_result',
                originalError: error.message,
                timestamp: new Date().toISOString()
            };
            
            return emptyResult;
        }
    }

    /**
     * Create empty duplicate result for fallback scenarios
     * @returns {Object} Empty duplicate result
     */
    createEmptyDuplicateResult() {
        return {
            duplicatePhoneNumbers: new Set(),
            duplicateRecordIds: [],
            duplicateRecordMap: new Map(),
            phoneMap: new Map(),
            totalRecords: 0,
            duplicateCount: 0,
            uniquePhoneCount: 0,
            duplicatePhoneCount: 0,
            metadata: {
                processedAt: Date.now(),
                source: 'fallback-empty'
            }
        };
    }

    /**
     * Load records from check table with performance optimizations
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of check table records
     */
    async loadCheckTableRecords(options = {}) {
        const { batchSize, includeMetadata } = options;
        
        // Determine if we should use optimized loading for large datasets
        const shouldUseOptimizedLoading = await this.shouldUseOptimizedLoading();
        
        if (shouldUseOptimizedLoading) {
            return await this.loadCheckTableRecordsOptimized(options);
        } else {
            return await this.loadCheckTableRecordsStandard(options);
        }
    }

    /**
     * Check if optimized loading should be used
     * @returns {Promise<boolean>} True if optimized loading should be used
     */
    async shouldUseOptimizedLoading() {
        try {
            // Quick check to estimate total records
            const estimateUrl = `${this.config.endpoints.checkRecords}?limit=1&page=1`;
            const response = await fetch(estimateUrl);
            
            if (response.ok) {
                const data = await response.json();
                const totalRecords = data.data?.pagination?.total || 0;
                return totalRecords >= this.config.performance.largeDatasetThreshold;
            }
        } catch (error) {
            console.warn('Failed to estimate dataset size, using standard loading:', error);
        }
        
        return false;
    }

    /**
     * Standard loading for smaller datasets
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of check table records
     */
    async loadCheckTableRecordsStandard(options = {}) {
        const { batchSize, includeMetadata } = options;
        let allRecords = [];
        let currentPage = 1;
        let hasMoreRecords = true;

        while (hasMoreRecords) {
            try {
                const url = `${this.config.endpoints.checkRecords}?limit=${batchSize}&page=${currentPage}`;
                const response = await this.fetchWithRetry(url);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                
                if (data.success && data.data && data.data.records) {
                    const records = data.data.records;
                    allRecords.push(...records);
                    
                    // Update progress
                    if (data.data.pagination && data.data.pagination.total) {
                        this.state.loadProgress = Math.min(40, (allRecords.length / data.data.pagination.total) * 40);
                    }
                    
                    // Check if there are more records
                    hasMoreRecords = records.length === batchSize && 
                                   (!data.data.pagination || currentPage < data.data.pagination.totalPages);
                    currentPage++;
                    
                    // Small delay to prevent overwhelming the server
                    if (hasMoreRecords) {
                        await this.delay(100);
                    }
                } else {
                    hasMoreRecords = false;
                }
                
            } catch (error) {
                console.error(`Failed to load page ${currentPage}:`, error);
                
                // Retry logic for failed pages
                if (currentPage === 1) {
                    throw error; // Fail completely if first page fails
                } else {
                    // Continue with what we have
                    hasMoreRecords = false;
                }
            }
        }

        // Cache the records
        this.recordsCache.set('checkTableRecords', {
            records: allRecords,
            timestamp: Date.now(),
            metadata: includeMetadata ? {
                totalRecords: allRecords.length,
                loadTime: Date.now(),
                source: 'checkTable'
            } : null
        });

        return allRecords;
    }

    /**
     * Optimized loading for large datasets with lazy loading and background processing
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of check table records
     */
    async loadCheckTableRecordsOptimized(options = {}) {
        console.log('Using optimized loading for large dataset');
        
        const { batchSize, includeMetadata } = options;
        let allRecords = [];
        let currentPage = 1;
        let hasMoreRecords = true;
        let totalRecords = 0;
        let loadedInBackground = false;

        // First, load initial batch for immediate display
        const initialBatchSize = Math.min(batchSize || 100, 500);
        
        try {
            const initialUrl = `${this.config.endpoints.checkRecords}?limit=${initialBatchSize}&page=1`;
            const initialResponse = await this.fetchWithRetry(initialUrl);
            
            if (initialResponse.ok) {
                const initialData = await initialResponse.json();
                
                if (initialData.success && initialData.data && initialData.data.records) {
                    allRecords = initialData.data.records;
                    totalRecords = initialData.data.pagination?.total || 0;
                    currentPage = 2;
                    
                    this.state.loadProgress = Math.min(40, (allRecords.length / totalRecords) * 40);
                    
                    // Check if there are more records to load
                    hasMoreRecords = allRecords.length < totalRecords;
                    
                    console.log(`Initial batch loaded: ${allRecords.length}/${totalRecords} records`);
                }
            }
        } catch (error) {
            console.error('Failed to load initial batch:', error);
            throw error;
        }

        // If there are more records and background processing is enabled, load them in background
        if (hasMoreRecords && this.config.performance.enableBackgroundProcessing) {
            this.loadRemainingRecordsInBackground(currentPage, totalRecords, batchSize, allRecords);
            loadedInBackground = true;
        } else if (hasMoreRecords) {
            // Load remaining records synchronously with progressive loading
            const remainingRecords = await this.loadRemainingRecordsProgressive(currentPage, totalRecords, batchSize);
            allRecords.push(...remainingRecords);
        }

        // Cache the records (initial batch or complete set)
        this.recordsCache.set('checkTableRecords', {
            records: allRecords,
            timestamp: Date.now(),
            metadata: includeMetadata ? {
                totalRecords: allRecords.length,
                estimatedTotal: totalRecords,
                loadTime: Date.now(),
                source: 'checkTable',
                optimizedLoading: true,
                backgroundLoading: loadedInBackground
            } : null
        });

        return allRecords;
    }

    /**
     * Load remaining records in background without blocking UI
     * @param {number} startPage - Page to start loading from
     * @param {number} totalRecords - Total number of records
     * @param {number} batchSize - Batch size for loading
     * @param {Array} existingRecords - Existing records array to append to
     */
    async loadRemainingRecordsInBackground(startPage, totalRecords, batchSize, existingRecords) {
        console.log('Loading remaining records in background');
        
        let currentPage = startPage;
        let hasMoreRecords = true;
        
        // Use setTimeout to ensure this runs asynchronously
        setTimeout(async () => {
            try {
                while (hasMoreRecords && existingRecords.length < totalRecords) {
                    try {
                        const url = `${this.config.endpoints.checkRecords}?limit=${batchSize}&page=${currentPage}`;
                        const response = await this.fetchWithRetry(url);
                        
                        if (response.ok) {
                            const data = await response.json();
                            
                            if (data.success && data.data && data.data.records) {
                                const records = data.data.records;
                                existingRecords.push(...records);
                                
                                // Update progress
                                this.state.loadProgress = Math.min(40, (existingRecords.length / totalRecords) * 40);
                                
                                // Notify listeners of progress
                                this.notifyListeners('backgroundLoadingProgress', {
                                    loaded: existingRecords.length,
                                    total: totalRecords,
                                    progress: (existingRecords.length / totalRecords) * 100
                                });
                                
                                hasMoreRecords = records.length === batchSize && existingRecords.length < totalRecords;
                                currentPage++;
                                
                                // Delay between requests to prevent overwhelming the server
                                if (hasMoreRecords) {
                                    await this.delay(this.config.performance.chunkProcessingDelay);
                                }
                            } else {
                                hasMoreRecords = false;
                            }
                        } else {
                            hasMoreRecords = false;
                        }
                        
                    } catch (pageError) {
                        console.warn(`Background loading failed for page ${currentPage}:`, pageError);
                        // Continue with next page
                        currentPage++;
                        
                        if (currentPage > totalRecords / batchSize + 10) { // Safety check
                            hasMoreRecords = false;
                        }
                    }
                }
                
                console.log(`Background loading completed: ${existingRecords.length} total records`);
                this.notifyListeners('backgroundLoadingComplete', {
                    totalRecords: existingRecords.length
                });
                
                // Update cache with complete dataset
                this.recordsCache.set('checkTableRecords', {
                    records: existingRecords,
                    timestamp: Date.now(),
                    metadata: {
                        totalRecords: existingRecords.length,
                        loadTime: Date.now(),
                        source: 'checkTable',
                        backgroundLoaded: true
                    }
                });
                
            } catch (backgroundError) {
                console.error('Background loading failed:', backgroundError);
                this.notifyListeners('backgroundLoadingError', backgroundError);
            }
        }, 0);
    }

    /**
     * Load remaining records progressively with yield points
     * @param {number} startPage - Page to start loading from
     * @param {number} totalRecords - Total number of records
     * @param {number} batchSize - Batch size for loading
     * @returns {Promise<Array>} Array of remaining records
     */
    async loadRemainingRecordsProgressive(startPage, totalRecords, batchSize) {
        console.log('Loading remaining records progressively');
        
        const remainingRecords = [];
        let currentPage = startPage;
        let hasMoreRecords = true;
        
        while (hasMoreRecords) {
            try {
                const url = `${this.config.endpoints.checkRecords}?limit=${batchSize}&page=${currentPage}`;
                const response = await this.fetchWithRetry(url);
                
                if (response.ok) {
                    const data = await response.json();
                    
                    if (data.success && data.data && data.data.records) {
                        const records = data.data.records;
                        remainingRecords.push(...records);
                        
                        hasMoreRecords = records.length === batchSize && 
                                       (remainingRecords.length + startPage * batchSize) < totalRecords;
                        currentPage++;
                        
                        // Yield control periodically to prevent UI blocking
                        if (currentPage % 5 === 0) {
                            await this.yieldControl();
                        }
                        
                        // Small delay between requests
                        if (hasMoreRecords) {
                            await this.delay(this.config.performance.chunkProcessingDelay);
                        }
                    } else {
                        hasMoreRecords = false;
                    }
                } else {
                    hasMoreRecords = false;
                }
                
            } catch (pageError) {
                console.warn(`Progressive loading failed for page ${currentPage}:`, pageError);
                hasMoreRecords = false;
            }
        }
        
        return remainingRecords;
    }

    /**
     * Yield control to prevent UI blocking
     * @returns {Promise} Promise that resolves after yielding
     */
    yieldControl() {
        return new Promise(resolve => setTimeout(resolve, 0));
    }

    /**
     * Process records for duplicate information using the detection service
     * @param {Array} records - Records to process
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} Processed duplicate information
     */
    async processDuplicateInformation(records, options = {}) {
        // Use the FrontendDuplicateDetectionService if available
        if (typeof FrontendDuplicateDetectionService !== 'undefined') {
            const detectionService = new FrontendDuplicateDetectionService();
            const duplicateInfo = detectionService.identifyDuplicatePhoneNumbers(records);
            
            // Add additional metadata
            duplicateInfo.metadata = {
                processedAt: Date.now(),
                recordCount: records.length,
                processingTime: duplicateInfo.detectionTime,
                source: 'frontend-detection'
            };
            
            return duplicateInfo;
        } else {
            // Fallback to basic duplicate detection
            console.warn('FrontendDuplicateDetectionService not available, using basic detection');
            return this.basicDuplicateDetection(records);
        }
    }

    /**
     * Basic duplicate detection fallback
     * @param {Array} records - Records to process
     * @returns {Object} Basic duplicate information
     */
    basicDuplicateDetection(records) {
        const phoneMap = new Map();
        const duplicatePhoneNumbers = new Set();
        const duplicateRecordIds = [];
        const duplicateRecordMap = new Map();

        // Simple phone normalization and duplicate detection
        for (const record of records) {
            const phone = record.phone || record.Phone || record.phoneNumber || '';
            const recordId = record.id || record.Id || record.ID || '';
            
            if (!phone) continue;
            
            // Basic normalization
            const normalizedPhone = phone.replace(/[\s\-\(\)\+]/g, '').toLowerCase();
            
            if (!phoneMap.has(normalizedPhone)) {
                phoneMap.set(normalizedPhone, []);
            }
            
            phoneMap.get(normalizedPhone).push(recordId);
        }

        // Identify duplicates
        for (const [phone, recordIds] of phoneMap) {
            if (recordIds.length > 1) {
                duplicatePhoneNumbers.add(phone);
                duplicateRecordIds.push(...recordIds);
                duplicateRecordMap.set(phone, recordIds);
            }
        }

        return {
            duplicatePhoneNumbers,
            duplicateRecordIds,
            duplicateRecordMap,
            phoneMap,
            totalRecords: records.length,
            duplicateCount: duplicateRecordIds.length,
            uniquePhoneCount: phoneMap.size,
            duplicatePhoneCount: duplicatePhoneNumbers.size,
            metadata: {
                processedAt: Date.now(),
                recordCount: records.length,
                source: 'basic-detection'
            }
        };
    }

    /**
     * Cache duplicate information with efficient data structures
     * @param {Object} duplicateInfo - Duplicate information to cache
     */
    async cacheDuplicateInformation(duplicateInfo) {
        // Store in memory cache
        this.duplicateInfoCache.set('current', {
            data: duplicateInfo,
            timestamp: Date.now()
        });

        // Create efficient lookup structures
        const recordDuplicateMap = new Map();
        
        // Map each record ID to its duplicate status
        for (const [phone, recordIds] of duplicateInfo.duplicateRecordMap) {
            for (const recordId of recordIds) {
                recordDuplicateMap.set(recordId, {
                    isDuplicate: true,
                    duplicatePhone: phone,
                    duplicateGroup: recordIds,
                    duplicateCount: recordIds.length
                });
            }
        }

        // Cache the lookup map
        this.duplicateInfoCache.set('recordLookup', {
            data: recordDuplicateMap,
            timestamp: Date.now()
        });

        // Persist to localStorage if enabled
        if (this.config.cache.persistToStorage) {
            await this.saveToLocalStorage(duplicateInfo);
        }

        // Cleanup old cache entries
        this.cleanupCache();
    }

    /**
     * Get cached duplicate information
     * @returns {Object|null} Cached duplicate information or null
     */
    getCachedDuplicateInfo() {
        const cached = this.duplicateInfoCache.get('current');
        if (cached && this.isCacheEntryValid(cached)) {
            return cached.data;
        }
        return null;
    }

    /**
     * Get duplicate status for a specific record ID
     * @param {string} recordId - Record ID to check
     * @returns {Object|null} Duplicate status or null
     */
    getRecordDuplicateStatus(recordId) {
        const lookupCache = this.duplicateInfoCache.get('recordLookup');
        if (lookupCache && this.isCacheEntryValid(lookupCache)) {
            return lookupCache.data.get(recordId) || {
                isDuplicate: false,
                duplicatePhone: null,
                duplicateGroup: [recordId],
                duplicateCount: 1
            };
        }
        return null;
    }

    /**
     * Refresh duplicate information when table data changes
     * @param {Object} options - Refresh options
     * @returns {Promise<Object>} Refreshed duplicate information
     */
    async refreshDuplicateInformation(options = {}) {
        const refreshOptions = {
            forceRefresh: true,
            reason: 'manual-refresh',
            ...options
        };

        console.log('Refreshing duplicate information...', refreshOptions);
        
        this.state.lastRefreshTime = Date.now();
        
        try {
            const result = await this.loadDuplicatePhoneInformation(refreshOptions);
            this.notifyListeners('duplicateInfoRefreshed', result);
            return result;
        } catch (error) {
            console.error('Failed to refresh duplicate information:', error);
            this.notifyListeners('duplicateInfoRefreshError', error);
            throw error;
        }
    }

    /**
     * Check if cache is valid
     * @returns {boolean} True if cache is valid
     */
    isCacheValid() {
        const cached = this.duplicateInfoCache.get('current');
        return cached && this.isCacheEntryValid(cached);
    }

    /**
     * Check if a cache entry is valid
     * @param {Object} cacheEntry - Cache entry to check
     * @returns {boolean} True if cache entry is valid
     */
    isCacheEntryValid(cacheEntry) {
        if (!cacheEntry || !cacheEntry.timestamp) {
            return false;
        }
        
        const age = Date.now() - cacheEntry.timestamp;
        return age < this.config.cache.timeout;
    }

    /**
     * Fetch with retry logic
     * @param {string} url - URL to fetch
     * @param {Object} options - Fetch options
     * @returns {Promise<Response>} Fetch response
     */
    async fetchWithRetry(url, options = {}) {
        const fetchOptions = {
            timeout: this.config.loading.timeout,
            ...options
        };

        let lastError;
        
        for (let attempt = 1; attempt <= this.config.loading.maxRetries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), fetchOptions.timeout);
                
                const response = await fetch(url, {
                    ...fetchOptions,
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                return response;
                
            } catch (error) {
                lastError = error;
                console.warn(`Fetch attempt ${attempt} failed:`, error.message);
                
                if (attempt < this.config.loading.maxRetries) {
                    const delay = this.config.loading.retryDelay * attempt;
                    console.log(`Retrying in ${delay}ms...`);
                    await this.delay(delay);
                }
            }
        }
        
        throw lastError;
    }

    /**
     * Setup auto-refresh timer
     */
    setupAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }
        
        this.refreshTimer = setInterval(async () => {
            if (!this.state.isLoading && document.visibilityState === 'visible') {
                try {
                    await this.refreshDuplicateInformation({ reason: 'auto-refresh' });
                } catch (error) {
                    console.warn('Auto-refresh failed:', error.message);
                }
            }
        }, this.config.cache.refreshInterval);
    }

    /**
     * Setup page visibility handling
     */
    setupVisibilityHandling() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && this.shouldRefreshOnVisible()) {
                this.refreshDuplicateInformation({ reason: 'visibility-change' });
            }
        });
    }

    /**
     * Check if should refresh when page becomes visible
     * @returns {boolean} True if should refresh
     */
    shouldRefreshOnVisible() {
        if (!this.state.lastRefreshTime) {
            return true;
        }
        
        const timeSinceRefresh = Date.now() - this.state.lastRefreshTime;
        return timeSinceRefresh > this.config.cache.refreshInterval;
    }

    /**
     * Save data to localStorage
     * @param {Object} duplicateInfo - Data to save
     */
    async saveToLocalStorage(duplicateInfo) {
        try {
            const storageData = {
                duplicateInfo,
                timestamp: Date.now(),
                version: '1.0'
            };
            
            // Convert Sets and Maps to arrays for JSON serialization
            const serializable = this.makeSerializable(storageData);
            
            localStorage.setItem('duplicatePhoneInfo', JSON.stringify(serializable));
        } catch (error) {
            console.warn('Failed to save to localStorage:', error);
        }
    }

    /**
     * Load data from localStorage
     */
    loadFromLocalStorage() {
        try {
            const stored = localStorage.getItem('duplicatePhoneInfo');
            if (stored) {
                const data = JSON.parse(stored);
                
                // Check if data is still valid
                if (data.timestamp && (Date.now() - data.timestamp) < this.config.cache.timeout) {
                    const duplicateInfo = this.makeDeserializable(data.duplicateInfo);
                    
                    this.duplicateInfoCache.set('current', {
                        data: duplicateInfo,
                        timestamp: data.timestamp
                    });
                    
                    console.log('Loaded duplicate information from localStorage');
                }
            }
        } catch (error) {
            console.warn('Failed to load from localStorage:', error);
        }
    }

    /**
     * Make data serializable for localStorage
     * @param {Object} data - Data to make serializable
     * @returns {Object} Serializable data
     */
    makeSerializable(data) {
        const serializable = { ...data };
        
        if (data.duplicateInfo) {
            serializable.duplicateInfo = {
                ...data.duplicateInfo,
                duplicatePhoneNumbers: Array.from(data.duplicateInfo.duplicatePhoneNumbers || []),
                duplicateRecordMap: Array.from(data.duplicateInfo.duplicateRecordMap || []),
                phoneMap: Array.from(data.duplicateInfo.phoneMap || [])
            };
        }
        
        return serializable;
    }

    /**
     * Make data deserializable from localStorage
     * @param {Object} data - Data to make deserializable
     * @returns {Object} Deserializable data
     */
    makeDeserializable(data) {
        const deserializable = { ...data };
        
        if (data.duplicatePhoneNumbers) {
            deserializable.duplicatePhoneNumbers = new Set(data.duplicatePhoneNumbers);
        }
        
        if (data.duplicateRecordMap) {
            deserializable.duplicateRecordMap = new Map(data.duplicateRecordMap);
        }
        
        if (data.phoneMap) {
            deserializable.phoneMap = new Map(data.phoneMap);
        }
        
        return deserializable;
    }

    /**
     * Clean up old cache entries
     */
    cleanupCache() {
        const now = Date.now();
        
        // Clean up duplicate info cache
        for (const [key, value] of this.duplicateInfoCache) {
            if (!this.isCacheEntryValid(value)) {
                this.duplicateInfoCache.delete(key);
            }
        }
        
        // Clean up records cache
        for (const [key, value] of this.recordsCache) {
            if (now - value.timestamp > this.config.cache.timeout) {
                this.recordsCache.delete(key);
            }
        }
        
        // Limit cache size
        if (this.duplicateInfoCache.size > this.config.cache.maxSize) {
            const entries = Array.from(this.duplicateInfoCache.entries());
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            
            const toDelete = entries.slice(0, entries.length - this.config.cache.maxSize);
            for (const [key] of toDelete) {
                this.duplicateInfoCache.delete(key);
            }
        }
    }

    /**
     * Add event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    addEventListener(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    /**
     * Remove event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    removeEventListener(event, callback) {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * Notify event listeners
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    notifyListeners(event, data) {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            for (const callback of listeners) {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            }
        }
    }

    /**
     * Get current state
     * @returns {Object} Current state
     */
    getState() {
        return {
            ...this.state,
            cacheSize: this.duplicateInfoCache.size,
            recordsCacheSize: this.recordsCache.size,
            isCacheValid: this.isCacheValid()
        };
    }

    /**
     * Get performance metrics
     * @returns {Object} Performance metrics
     */
    getMetrics() {
        return {
            cacheHitRate: this.calculateCacheHitRate(),
            averageLoadTime: this.calculateAverageLoadTime(),
            totalLoads: this.state.totalLoads || 0,
            lastLoadTime: this.state.lastLoadTime,
            lastRefreshTime: this.state.lastRefreshTime,
            errorCount: this.state.errors.length
        };
    }

    /**
     * Calculate cache hit rate
     * @returns {number} Cache hit rate percentage
     */
    calculateCacheHitRate() {
        // This would be implemented based on actual usage tracking
        return 0;
    }

    /**
     * Calculate average load time
     * @returns {number} Average load time in milliseconds
     */
    calculateAverageLoadTime() {
        // This would be implemented based on actual load time tracking
        return 0;
    }

    /**
     * Utility delay function
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} Promise that resolves after delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Destroy the manager and cleanup resources
     */
    destroy() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
        
        this.duplicateInfoCache.clear();
        this.recordsCache.clear();
        this.metadataCache.clear();
        this.eventListeners.clear();
        
        console.log('Duplicate Data Manager destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DuplicateDataManager;
}

// Make available globally in browser
if (typeof window !== 'undefined') {
    window.DuplicateDataManager = DuplicateDataManager;
}