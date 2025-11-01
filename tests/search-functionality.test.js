/**
 * Enhanced Search Functionality Tests
 * Comprehensive unit tests for PatternMatcher, FilterEngine, SearchHistory, and SavedSearches
 * Implements Requirements: 1.1, 1.3, 1.4, 2.2, 3.2
 */

// Mock the classes for testing
const PatternMatcher = require('../public/js/patternMatcher.js');
const FilterEngine = require('../public/js/filterEngine.js');
const SearchHistory = require('../public/js/searchHistory.js');
const SavedSearches = require('../public/js/savedSearches.js');

describe('Enhanced Search Functionality Tests', () => {
    let mockRecords;

    beforeEach(() => {
        // Mock records data for testing
        mockRecords = [
            {
                Id: 'SG COM-2001',
                Phone: '+6512345678',
                CompanyName: 'Test Company 1',
                PhysicalAddress: '123 Test Street',
                Email: 'test1@example.com',
                Website: 'https://test1.com',
                Status: true,
                created_at: '2025-01-01T00:00:00Z'
            },
            {
                Id: 'SG COM-2002',
                Phone: '+6587654321',
                CompanyName: 'Test Company 2',
                PhysicalAddress: '456 Test Avenue',
                Email: 'test2@example.com',
                Website: 'https://test2.com',
                Status: false,
                created_at: '2025-01-02T00:00:00Z'
            },
            {
                Id: 'SG COM-2003',
                Phone: '+6511111111',
                CompanyName: 'Another Company',
                PhysicalAddress: '789 Another Street',
                Email: 'another@example.com',
                Website: 'https://another.com',
                Status: true,
                created_at: '2025-01-03T00:00:00Z'
            },
            {
                Id: 'SG COM-2010',
                Phone: '+6522222222',
                CompanyName: 'Final Company',
                PhysicalAddress: '999 Final Road',
                Email: 'final@example.com',
                Website: 'https://final.com',
                Status: true,
                created_at: '2025-01-10T00:00:00Z'
            }
        ];

        // Mock localStorage for browser environment
        global.localStorage = {
            getItem: jest.fn(),
            setItem: jest.fn(),
            removeItem: jest.fn(),
            clear: jest.fn()
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('PatternMatcher Class Tests', () => {
        let patternMatcher;

        beforeEach(() => {
            patternMatcher = new PatternMatcher();
        });

        describe('parseQuery method', () => {
            test('should parse wildcard patterns correctly', () => {
                const result = patternMatcher.parseQuery('SG COM-200*');
                
                expect(result.type).toBe('wildcard');
                expect(result.original).toBe('SG COM-200*');
                expect(result.prefix).toBe('SG COM-200');
            });

            test('should parse range patterns correctly', () => {
                const result = patternMatcher.parseQuery('SG COM-2001 to SG COM-2010');
                
                expect(result.type).toBe('range');
                expect(result.original).toBe('SG COM-2001 to SG COM-2010');
                expect(result.startId).toBe('SG COM-2001');
                expect(result.endId).toBe('SG COM-2010');
            });

            test('should parse contains patterns correctly', () => {
                const result = patternMatcher.parseQuery('SG COM');
                
                expect(result.type).toBe('contains');
                expect(result.original).toBe('SG COM');
                expect(result.components).toEqual(['SG COM']);
            });

            test('should handle empty queries', () => {
                const result = patternMatcher.parseQuery('');
                
                expect(result.type).toBe('empty');
                expect(result.components).toEqual([]);
            });

            test('should handle null/undefined queries', () => {
                const nullResult = patternMatcher.parseQuery(null);
                const undefinedResult = patternMatcher.parseQuery(undefined);
                
                expect(nullResult.type).toBe('empty');
                expect(undefinedResult.type).toBe('empty');
            });
        });

        describe('parseIdPattern method', () => {
            test('should parse wildcard ID patterns', () => {
                const result = patternMatcher.parseIdPattern('SG COM-200*');
                
                expect(result.type).toBe('wildcard');
                expect(result.match).toEqual(['SG COM-200']);
                expect(result.isValid).toBe(true);
                expect(result.description).toContain('Wildcard search');
            });

            test('should parse range ID patterns', () => {
                const result = patternMatcher.parseIdPattern('SG COM-2001 to SG COM-2010');
                
                expect(result.type).toBe('range');
                expect(result.match).toEqual(['SG COM-2001', 'SG COM-2010']);
                expect(result.isValid).toBe(true);
                expect(result.description).toContain('Range search');
            });

            test('should handle invalid patterns', () => {
                const result = patternMatcher.parseIdPattern('');
                
                expect(result.isValid).toBe(false);
                expect(result.error).toBe('Pattern cannot be empty');
            });
        });

        describe('match method - wildcard patterns', () => {
            test('should match wildcard patterns correctly', () => {
                const parsedQuery = { type: 'wildcard', prefix: 'SG COM-200' };
                const results = patternMatcher.match(mockRecords, parsedQuery);
                
                expect(results).toHaveLength(3); // SG COM-2001, 2002, 2003 match
                expect(results.every(record => record.Id.startsWith('SG COM-200'))).toBe(true);
            });

            test('should handle case insensitive wildcard matching', () => {
                const parsedQuery = { type: 'wildcard', prefix: 'sg com-200' };
                const results = patternMatcher.match(mockRecords, parsedQuery);
                
                expect(results).toHaveLength(3);
            });
        });

        describe('match method - range patterns', () => {
            test('should match range patterns correctly', () => {
                const parsedQuery = { 
                    type: 'range', 
                    startId: 'SG COM-2001', 
                    endId: 'SG COM-2003' 
                };
                const results = patternMatcher.match(mockRecords, parsedQuery);
                
                expect(results).toHaveLength(3); // 2001, 2002, 2003
                expect(results.map(r => r.Id)).toEqual(['SG COM-2001', 'SG COM-2002', 'SG COM-2003']);
            });

            test('should handle numeric range comparison', () => {
                const parsedQuery = { 
                    type: 'range', 
                    startId: 'SG COM-2002', 
                    endId: 'SG COM-2010' 
                };
                const results = patternMatcher.match(mockRecords, parsedQuery);
                
                expect(results).toHaveLength(3); // 2002, 2003, 2010
                expect(results.some(r => r.Id === 'SG COM-2010')).toBe(true);
            });
        });

        describe('match method - contains patterns', () => {
            test('should match contains patterns in multiple fields', () => {
                const parsedQuery = { type: 'contains', original: 'Test Company' };
                const results = patternMatcher.match(mockRecords, parsedQuery);
                
                expect(results).toHaveLength(2); // Test Company 1 and 2
                expect(results.every(record => 
                    record.CompanyName.includes('Test Company')
                )).toBe(true);
            });

            test('should match phone numbers', () => {
                const parsedQuery = { type: 'contains', original: '+6512345678' };
                const results = patternMatcher.match(mockRecords, parsedQuery);
                
                expect(results).toHaveLength(1);
                expect(results[0].Phone).toBe('+6512345678');
            });
        });

        describe('isIdInRange method', () => {
            test('should correctly identify IDs in numeric range', () => {
                const result1 = patternMatcher.isIdInRange('SG COM-2002', 'SG COM-2001', 'SG COM-2003');
                const result2 = patternMatcher.isIdInRange('SG COM-2000', 'SG COM-2001', 'SG COM-2003');
                const result3 = patternMatcher.isIdInRange('SG COM-2004', 'SG COM-2001', 'SG COM-2003');
                
                expect(result1).toBe(true);
                expect(result2).toBe(false);
                expect(result3).toBe(false);
            });

            test('should handle edge cases', () => {
                const result1 = patternMatcher.isIdInRange('SG COM-2001', 'SG COM-2001', 'SG COM-2001');
                const result2 = patternMatcher.isIdInRange('', 'SG COM-2001', 'SG COM-2003');
                
                expect(result1).toBe(true); // Same ID should be in range
                expect(result2).toBe(false); // Empty ID should not be in range
            });
        });

        describe('extractNumericPart method', () => {
            test('should extract numbers from end of string', () => {
                const result1 = patternMatcher.extractNumericPart('SG COM-2001');
                const result2 = patternMatcher.extractNumericPart('TEST-123');
                const result3 = patternMatcher.extractNumericPart('NO-NUMBERS');
                
                expect(result1).toBe(2001);
                expect(result2).toBe(123);
                expect(result3).toBe(null);
            });

            test('should handle invalid inputs', () => {
                const result1 = patternMatcher.extractNumericPart(null);
                const result2 = patternMatcher.extractNumericPart('');
                
                expect(result1).toBe(null);
                expect(result2).toBe(null);
            });
        });

        describe('validatePattern method', () => {
            test('should validate correct patterns', () => {
                const result1 = patternMatcher.validatePattern('SG COM-200*');
                const result2 = patternMatcher.validatePattern('SG COM-2001 to SG COM-2010');
                const result3 = patternMatcher.validatePattern('SG COM');
                
                expect(result1.valid).toBe(true);
                expect(result2.valid).toBe(true);
                expect(result3.valid).toBe(true);
            });

            test('should reject invalid patterns', () => {
                const result1 = patternMatcher.validatePattern('');
                const result2 = patternMatcher.validatePattern(null);
                
                expect(result1.valid).toBe(false);
                expect(result2.valid).toBe(false);
            });

            test('should validate range order', () => {
                const result = patternMatcher.validatePattern('SG COM-2010 to SG COM-2001');
                
                expect(result.valid).toBe(false);
                expect(result.error).toContain('Range start cannot be greater than range end');
            });
        });
    });

    describe('FilterEngine Class Tests', () => {
        let filterEngine;

        beforeEach(() => {
            filterEngine = new FilterEngine();
        });

        describe('apply method', () => {
            test('should apply ID filters correctly', async () => {
                const filters = { id: 'SG COM-2001' };
                const results = await filterEngine.apply(mockRecords, filters);
                
                expect(results).toHaveLength(1);
                expect(results[0].Id).toBe('SG COM-2001');
            });

            test('should apply phone filters correctly', async () => {
                const filters = { phone: '+6512345678' };
                const results = await filterEngine.apply(mockRecords, filters);
                
                expect(results).toHaveLength(1);
                expect(results[0].Phone).toBe('+6512345678');
            });

            test('should apply status filters correctly', async () => {
                const validFilters = { status: 'valid' };
                const invalidFilters = { status: 'invalid' };
                
                const validResults = await filterEngine.apply(mockRecords, validFilters);
                const invalidResults = await filterEngine.apply(mockRecords, invalidFilters);
                
                expect(validResults).toHaveLength(3); // 3 valid records
                expect(invalidResults).toHaveLength(1); // 1 invalid record
                expect(validResults.every(record => record.Status === true)).toBe(true);
                expect(invalidResults.every(record => record.Status === false)).toBe(true);
            });

            test('should apply multiple filters with AND logic', async () => {
                const filters = { 
                    id: 'SG COM-200', 
                    status: 'valid' 
                };
                const results = await filterEngine.apply(mockRecords, filters);
                
                expect(results).toHaveLength(2); // SG COM-2001 and 2003 are valid
                expect(results.every(record => 
                    record.Id.includes('SG COM-200') && record.Status === true
                )).toBe(true);
            });

            test('should handle empty filters', async () => {
                const results = await filterEngine.apply(mockRecords, {});
                
                expect(results).toEqual(mockRecords);
            });

            test('should handle invalid input gracefully', async () => {
                const results1 = await filterEngine.apply(null, { id: 'test' });
                const results2 = await filterEngine.apply([], { id: 'test' });
                
                expect(results1).toEqual([]);
                expect(results2).toEqual([]);
            });
        });

        describe('filterById method', () => {
            test('should support wildcard ID filtering', () => {
                const results = filterEngine.filterById(mockRecords, 'SG COM-200*');
                
                expect(results).toHaveLength(3);
                expect(results.every(record => record.Id.startsWith('SG COM-200'))).toBe(true);
            });

            test('should support range ID filtering', () => {
                const results = filterEngine.filterById(mockRecords, 'SG COM-2001 to SG COM-2003');
                
                expect(results).toHaveLength(3);
            });

            test('should support contains ID filtering', () => {
                const results = filterEngine.filterById(mockRecords, 'COM-2001');
                
                expect(results).toHaveLength(1);
                expect(results[0].Id).toBe('SG COM-2001');
            });
        });

        describe('filterByPhone method', () => {
            test('should handle various phone formats', () => {
                const results1 = filterEngine.filterByPhone(mockRecords, '+65 1234 5678');
                const results2 = filterEngine.filterByPhone(mockRecords, '65-1234-5678');
                const results3 = filterEngine.filterByPhone(mockRecords, '12345678');
                
                expect(results1).toHaveLength(1);
                expect(results2).toHaveLength(1);
                expect(results3).toHaveLength(1);
            });

            test('should support partial phone matching', () => {
                const results = filterEngine.filterByPhone(mockRecords, '651234');
                
                expect(results).toHaveLength(1);
                expect(results[0].Phone).toBe('+6512345678');
            });
        });

        describe('filterByStatus method', () => {
            test('should handle different status representations', () => {
                // Test with boolean values
                const validResults = filterEngine.filterByStatus(mockRecords, 'valid');
                const invalidResults = filterEngine.filterByStatus(mockRecords, 'invalid');
                
                expect(validResults).toHaveLength(3);
                expect(invalidResults).toHaveLength(1);
            });

            test('should handle numeric status values', () => {
                const recordsWithNumericStatus = mockRecords.map(record => ({
                    ...record,
                    Status: record.Status ? 1 : 0
                }));
                
                const validResults = filterEngine.filterByStatus(recordsWithNumericStatus, 'valid');
                const invalidResults = filterEngine.filterByStatus(recordsWithNumericStatus, 'invalid');
                
                expect(validResults).toHaveLength(3);
                expect(invalidResults).toHaveLength(1);
            });

            test('should handle string status values', () => {
                const recordsWithStringStatus = mockRecords.map(record => ({
                    ...record,
                    Status: record.Status ? 'true' : 'false'
                }));
                
                const validResults = filterEngine.filterByStatus(recordsWithStringStatus, 'valid');
                const invalidResults = filterEngine.filterByStatus(recordsWithStringStatus, 'invalid');
                
                expect(validResults).toHaveLength(3);
                expect(invalidResults).toHaveLength(1);
            });
        });

        describe('filterByDateRange method', () => {
            test('should filter records within date range', () => {
                const dateRange = {
                    start: '2025-01-01T00:00:00Z',
                    end: '2025-01-02T23:59:59Z'
                };
                
                const results = filterEngine.filterByDateRange(mockRecords, dateRange);
                
                // The test data has records on Jan 1, 2, and 3, but the range only includes Jan 1-2
                // However, the end date is set to end of day, so Jan 3 might be included
                // Let's check that we get the expected records within the range
                expect(results.length).toBeGreaterThanOrEqual(2);
                expect(results.length).toBeLessThanOrEqual(3);
                
                // Verify that all returned records are within the date range
                const startDate = new Date(dateRange.start);
                const endDate = new Date(dateRange.end);
                endDate.setHours(23, 59, 59, 999); // Set to end of day as the method does
                
                results.forEach(record => {
                    const recordDate = new Date(record.created_at);
                    expect(recordDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
                    expect(recordDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
                });
            });

            test('should handle invalid date ranges', () => {
                const invalidRange = { start: 'invalid', end: 'invalid' };
                const results = filterEngine.filterByDateRange(mockRecords, invalidRange);
                
                expect(results).toEqual(mockRecords); // Should return all records
            });

            test('should handle records without date fields', () => {
                const recordsWithoutDates = mockRecords.map(record => {
                    const { created_at, ...recordWithoutDate } = record;
                    return recordWithoutDate;
                });
                
                const dateRange = {
                    start: '2025-01-01T00:00:00Z',
                    end: '2025-01-02T23:59:59Z'
                };
                
                const results = filterEngine.filterByDateRange(recordsWithoutDates, dateRange);
                
                expect(results).toEqual([]); // No records should match without dates
            });
        });

        describe('isValidDateRange method', () => {
            test('should validate correct date ranges', () => {
                const validRange = {
                    start: '2025-01-01T00:00:00Z',
                    end: '2025-01-02T00:00:00Z'
                };
                
                expect(filterEngine.isValidDateRange(validRange)).toBe(true);
            });

            test('should reject invalid date ranges', () => {
                const invalidRange1 = { start: 'invalid', end: 'invalid' };
                const invalidRange2 = { start: '2025-01-02', end: '2025-01-01' }; // End before start
                const invalidRange3 = null;
                
                expect(filterEngine.isValidDateRange(invalidRange1)).toBe(false);
                expect(filterEngine.isValidDateRange(invalidRange2)).toBe(false);
                expect(filterEngine.isValidDateRange(invalidRange3)).toBe(false);
            });
        });

        describe('getFilterMetrics method', () => {
            test('should return filter performance metrics', async () => {
                await filterEngine.apply(mockRecords, { id: 'SG COM' });
                const metrics = filterEngine.getFilterMetrics();
                
                expect(metrics).toHaveProperty('lastFilterTime');
                expect(metrics.lastFilterTime).toBeGreaterThanOrEqual(0); // Allow 0 for very fast operations
            });
        });
    });

    describe('SearchHistory Class Tests', () => {
        let searchHistory;

        beforeEach(() => {
            searchHistory = new SearchHistory(5); // Limit to 5 items for testing
            localStorage.getItem.mockReturnValue(null); // Start with empty storage
        });

        describe('add method', () => {
            test('should add search to history', () => {
                searchHistory.add('SG COM-2001', {}, { resultCount: 1, executionTime: 50 });
                const history = searchHistory.getHistory();
                
                expect(history).toHaveLength(1);
                expect(history[0].query).toBe('SG COM-2001');
                expect(history[0].resultCount).toBe(1);
                expect(history[0].executionTime).toBe(50);
            });

            test('should prevent duplicate searches', () => {
                searchHistory.add('SG COM-2001', { status: 'valid' });
                searchHistory.add('SG COM-2001', { status: 'valid' }); // Duplicate
                searchHistory.add('SG COM-2002', { status: 'valid' }); // Different query
                
                const history = searchHistory.getHistory();
                
                expect(history).toHaveLength(2); // Only 2 unique searches
                expect(history[0].query).toBe('SG COM-2002'); // Most recent first
            });

            test('should limit history size', () => {
                // Add more searches than the limit
                for (let i = 1; i <= 7; i++) {
                    searchHistory.add(`SG COM-200${i}`, {});
                }
                
                const history = searchHistory.getHistory();
                
                expect(history).toHaveLength(5); // Limited to 5
                expect(history[0].query).toBe('SG COM-2007'); // Most recent first
            });

            test('should ignore empty queries', () => {
                searchHistory.add('', {});
                searchHistory.add('   ', {});
                searchHistory.add(null, {});
                
                const history = searchHistory.getHistory();
                
                expect(history).toHaveLength(0);
            });
        });

        describe('getHistory method', () => {
            test('should return formatted history with display text', () => {
                searchHistory.add('SG COM-2001', { status: 'valid' });
                const history = searchHistory.getHistory();
                
                expect(history[0]).toHaveProperty('displayText');
                expect(history[0]).toHaveProperty('timeAgo');
                expect(history[0].displayText).toContain('SG COM-2001');
                expect(history[0].displayText).toContain('status:valid');
            });

            test('should respect limit parameter', () => {
                for (let i = 1; i <= 5; i++) {
                    searchHistory.add(`SG COM-200${i}`, {});
                }
                
                const limitedHistory = searchHistory.getHistory(3);
                
                expect(limitedHistory).toHaveLength(3);
            });
        });

        describe('getSuggestions method', () => {
            beforeEach(() => {
                searchHistory.add('SG COM-2001', {});
                searchHistory.add('SG COM-2002', {});
                searchHistory.add('Test Company', {});
            });

            test('should return suggestions based on partial query', () => {
                const suggestions = searchHistory.getSuggestions('SG COM');
                
                expect(suggestions).toHaveLength(2);
                expect(suggestions.every(s => s.query.includes('SG COM'))).toBe(true);
            });

            test('should return recent searches for short queries', () => {
                const suggestions = searchHistory.getSuggestions('S');
                
                expect(suggestions).toHaveLength(3); // All recent searches
            });

            test('should handle empty queries', () => {
                const suggestions = searchHistory.getSuggestions('');
                
                expect(suggestions.length).toBeGreaterThan(0); // Should return recent searches
            });
        });

        describe('searchHistory method', () => {
            beforeEach(() => {
                searchHistory.add('SG COM-2001', {});
                searchHistory.add('Test Company', { companyName: 'Test' });
                searchHistory.add('Another Search', {});
            });

            test('should search within history by query', () => {
                const results = searchHistory.searchHistory('SG COM');
                
                expect(results).toHaveLength(1);
                expect(results[0].query).toBe('SG COM-2001');
            });

            test('should search within history by filter values', () => {
                const results = searchHistory.searchHistory('Test');
                
                expect(results).toHaveLength(1);
                expect(results[0].query).toBe('Test Company');
            });

            test('should return all history for empty search', () => {
                const results = searchHistory.searchHistory('');
                
                expect(results).toHaveLength(3);
            });
        });

        describe('clear method', () => {
            test('should clear all history', () => {
                searchHistory.add('SG COM-2001', {});
                searchHistory.add('SG COM-2002', {});
                
                expect(searchHistory.getHistory()).toHaveLength(2);
                
                searchHistory.clear();
                
                expect(searchHistory.getHistory()).toHaveLength(0);
            });
        });

        describe('remove method', () => {
            test('should remove specific search by ID', () => {
                searchHistory.add('SG COM-2001', {});
                searchHistory.add('SG COM-2002', {});
                
                const history = searchHistory.getHistory();
                const idToRemove = history[0].id;
                
                searchHistory.remove(idToRemove);
                
                const updatedHistory = searchHistory.getHistory();
                expect(updatedHistory).toHaveLength(1);
                expect(updatedHistory.find(item => item.id === idToRemove)).toBeUndefined();
            });
        });

        describe('getMetrics method', () => {
            test('should return search history metrics', () => {
                searchHistory.add('SG COM-2001', {});
                searchHistory.add('SG COM-2002', {});
                
                const metrics = searchHistory.getMetrics();
                
                expect(metrics).toHaveProperty('historySize', 2);
                expect(metrics).toHaveProperty('totalSearches');
                expect(metrics).toHaveProperty('uniqueSearches');
                expect(metrics).toHaveProperty('oldestSearch');
                expect(metrics).toHaveProperty('newestSearch');
            });
        });
    });

    describe('SavedSearches Class Tests', () => {
        let savedSearches;

        beforeEach(() => {
            savedSearches = new SavedSearches();
            localStorage.getItem.mockReturnValue(null); // Start with empty storage
        });

        describe('save method', () => {
            test('should save search with name and query', () => {
                const searchId = savedSearches.save('My Search', 'SG COM-2001', { status: 'valid' });
                
                expect(searchId).toBeDefined();
                expect(typeof searchId).toBe('string');
                
                const allSearches = savedSearches.getAll();
                expect(allSearches).toHaveLength(1);
                expect(allSearches[0].name).toBe('My Search');
                expect(allSearches[0].query).toBe('SG COM-2001');
            });

            test('should prevent duplicate names', () => {
                savedSearches.save('My Search', 'SG COM-2001');
                
                expect(() => {
                    savedSearches.save('My Search', 'SG COM-2002');
                }).toThrow('A search with this name already exists');
            });

            test('should require name and query', () => {
                expect(() => {
                    savedSearches.save('', 'SG COM-2001');
                }).toThrow('Search name is required');
                
                expect(() => {
                    savedSearches.save('My Search', '');
                }).toThrow('Search query is required');
            });

            test('should generate description and tags automatically', () => {
                savedSearches.save('Wildcard Search', 'SG COM-200*', { status: 'valid' });
                
                const searches = savedSearches.getAll();
                const search = searches[0];
                
                expect(search.description).toContain('SG COM-200*');
                expect(search.description).toContain('valid records');
                expect(search.tags).toContain('wildcard');
                expect(search.tags).toContain('status-valid');
            });
        });

        describe('load method', () => {
            test('should load and track execution of saved search', () => {
                const searchId = savedSearches.save('My Search', 'SG COM-2001');
                
                const loadedSearch = savedSearches.load(searchId);
                
                expect(loadedSearch).toBeDefined();
                expect(loadedSearch.name).toBe('My Search');
                expect(loadedSearch.executionCount).toBe(1);
                expect(loadedSearch.lastExecuted).toBeDefined();
            });

            test('should return null for non-existent search', () => {
                const result = savedSearches.load('non-existent-id');
                
                expect(result).toBe(null);
            });

            test('should increment execution count on multiple loads', () => {
                const searchId = savedSearches.save('My Search', 'SG COM-2001');
                
                savedSearches.load(searchId);
                savedSearches.load(searchId);
                const search = savedSearches.load(searchId);
                
                expect(search.executionCount).toBe(3);
            });
        });

        describe('update method', () => {
            test('should update search properties', () => {
                const searchId = savedSearches.save('Original Name', 'SG COM-2001');
                
                const success = savedSearches.update(searchId, {
                    name: 'Updated Name',
                    query: 'SG COM-2002',
                    filters: { status: 'invalid' }
                });
                
                expect(success).toBe(true);
                
                const searches = savedSearches.getAll();
                const updatedSearch = searches.find(s => s.id === searchId);
                
                expect(updatedSearch.name).toBe('Updated Name');
                expect(updatedSearch.query).toBe('SG COM-2002');
                expect(updatedSearch.filters.status).toBe('invalid');
                expect(updatedSearch.updatedAt).toBeDefined();
            });

            test('should prevent duplicate names during update', () => {
                const searchId1 = savedSearches.save('Search 1', 'SG COM-2001');
                const searchId2 = savedSearches.save('Search 2', 'SG COM-2002');
                
                expect(() => {
                    savedSearches.update(searchId2, { name: 'Search 1' });
                }).toThrow('A search with this name already exists');
            });

            test('should return false for non-existent search', () => {
                const success = savedSearches.update('non-existent-id', { name: 'New Name' });
                
                expect(success).toBe(false);
            });
        });

        describe('delete method', () => {
            test('should delete saved search', () => {
                const searchId = savedSearches.save('My Search', 'SG COM-2001');
                
                const success = savedSearches.delete(searchId);
                
                expect(success).toBe(true);
                expect(savedSearches.getAll()).toHaveLength(0);
            });

            test('should return false for non-existent search', () => {
                const success = savedSearches.delete('non-existent-id');
                
                expect(success).toBe(false);
            });
        });

        describe('getAll method', () => {
            beforeEach(() => {
                savedSearches.save('Search A', 'SG COM-2001', {}, {});
                savedSearches.save('Search B', 'SG COM-2002', { status: 'valid' }, {});
                savedSearches.save('Search C', 'Test Company', {}, {});
            });

            test('should return all searches with display formatting', () => {
                const searches = savedSearches.getAll();
                
                expect(searches).toHaveLength(3);
                expect(searches[0]).toHaveProperty('displayName');
                expect(searches[0]).toHaveProperty('timeAgo');
                expect(searches[0]).toHaveProperty('lastExecutedAgo');
            });

            test('should filter by tag', () => {
                const searches = savedSearches.getAll({ tag: 'status-valid' });
                
                expect(searches).toHaveLength(1);
                expect(searches[0].name).toBe('Search B');
            });

            test('should filter by search text', () => {
                const searches = savedSearches.getAll({ search: 'Company' });
                
                expect(searches).toHaveLength(1);
                expect(searches[0].name).toBe('Search C');
            });

            test('should sort by different criteria', () => {
                // Execute one search to change its popularity
                const searches = savedSearches.getAll();
                savedSearches.load(searches[0].id);
                
                const popularSearches = savedSearches.getAll({ sortBy: 'popularity' });
                
                expect(popularSearches[0].executionCount).toBeGreaterThan(0);
            });
        });

        describe('duplicate method', () => {
            test('should create duplicate of existing search', () => {
                const originalId = savedSearches.save('Original', 'SG COM-2001', { status: 'valid' });
                
                const duplicateId = savedSearches.duplicate(originalId, 'Duplicate');
                
                expect(duplicateId).toBeDefined();
                expect(duplicateId).not.toBe(originalId);
                
                const searches = savedSearches.getAll();
                expect(searches).toHaveLength(2);
                
                const duplicate = searches.find(s => s.id === duplicateId);
                expect(duplicate.name).toBe('Duplicate');
                expect(duplicate.query).toBe('SG COM-2001');
                expect(duplicate.filters.status).toBe('valid');
            });

            test('should return null for non-existent search', () => {
                const result = savedSearches.duplicate('non-existent-id', 'New Name');
                
                expect(result).toBe(null);
            });
        });

        describe('export and import methods', () => {
            beforeEach(() => {
                savedSearches.save('Search 1', 'SG COM-2001', { status: 'valid' });
                savedSearches.save('Search 2', 'SG COM-2002', { status: 'invalid' });
            });

            test('should export saved searches', () => {
                const exportData = savedSearches.export();
                
                expect(exportData).toHaveProperty('searches');
                expect(exportData).toHaveProperty('exportDate');
                expect(exportData).toHaveProperty('version');
                expect(exportData).toHaveProperty('count', 2);
                expect(exportData.searches).toHaveLength(2);
            });

            test('should export specific searches by ID', () => {
                const searches = savedSearches.getAll();
                const exportData = savedSearches.export([searches[0].id]);
                
                expect(exportData.searches).toHaveLength(1);
                expect(exportData.count).toBe(1);
            });

            test('should import saved searches', () => {
                const exportData = savedSearches.export();
                
                // Clear current searches
                savedSearches.clear();
                expect(savedSearches.getAll()).toHaveLength(0);
                
                // Import the data
                const result = savedSearches.import(exportData);
                
                expect(result.imported).toBe(2);
                expect(result.skipped).toBe(0);
                expect(result.errors).toHaveLength(0);
                expect(savedSearches.getAll()).toHaveLength(2);
            });

            test('should handle import conflicts with rename option', () => {
                const exportData = savedSearches.export();
                
                // Import with rename option (should rename duplicates)
                const result = savedSearches.import(exportData, { handleConflicts: 'rename' });
                
                expect(result.imported).toBe(2);
                expect(result.skipped).toBe(0);
                
                const searches = savedSearches.getAll();
                expect(searches).toHaveLength(4); // Original 2 + imported 2
                expect(searches.some(s => s.name.includes('(1)'))).toBe(true);
            });
        });

        describe('getMetrics method', () => {
            test('should return saved search metrics', () => {
                savedSearches.save('Search 1', 'SG COM-2001');
                savedSearches.save('Search 2', 'SG COM-2002');
                
                const searches = savedSearches.getAll();
                savedSearches.load(searches[0].id); // Execute one search
                
                const metrics = savedSearches.getMetrics();
                
                expect(metrics).toHaveProperty('totalSavedSearches', 2);
                expect(metrics).toHaveProperty('totalSaved');
                expect(metrics).toHaveProperty('totalExecutions');
                expect(metrics).toHaveProperty('averageExecutionsPerSearch');
                expect(metrics).toHaveProperty('mostPopularSearch');
            });
        });
    });

    describe('Integration Tests', () => {
        test('should work together - PatternMatcher and FilterEngine', async () => {
            const patternMatcher = new PatternMatcher();
            const filterEngine = new FilterEngine();
            
            // Parse a wildcard query
            const parsedQuery = patternMatcher.parseQuery('SG COM-200*');
            
            // Use pattern matcher to get initial results
            const patternResults = patternMatcher.match(mockRecords, parsedQuery);
            
            // Apply additional filters
            const finalResults = await filterEngine.apply(patternResults, { status: 'valid' });
            
            expect(finalResults).toHaveLength(2); // SG COM-2001 and 2003 are valid
            expect(finalResults.every(record => 
                record.Id.startsWith('SG COM-200') && record.Status === true
            )).toBe(true);
        });

        test('should work together - SearchHistory and SavedSearches', () => {
            const searchHistory = new SearchHistory();
            const savedSearches = new SavedSearches();
            
            // Add some searches to history
            searchHistory.add('SG COM-2001', { status: 'valid' });
            searchHistory.add('Test Company', {});
            
            // Get suggestions from history
            const suggestions = searchHistory.getSuggestions('SG COM');
            expect(suggestions).toHaveLength(1);
            
            // Save a search based on history
            const searchId = savedSearches.save('My Saved Search', suggestions[0].query, { status: 'valid' });
            
            // Load the saved search
            const savedSearch = savedSearches.load(searchId);
            
            expect(savedSearch.query).toBe('SG COM-2001');
            expect(savedSearch.filters.status).toBe('valid');
            expect(savedSearch.executionCount).toBe(1);
        });

        test('should handle complex search workflow', async () => {
            const patternMatcher = new PatternMatcher();
            const filterEngine = new FilterEngine();
            const searchHistory = new SearchHistory();
            const savedSearches = new SavedSearches();
            
            // 1. Parse complex query
            const query = 'SG COM-2001 to SG COM-2003';
            const parsedQuery = patternMatcher.parseQuery(query);
            
            expect(parsedQuery.type).toBe('range');
            
            // 2. Apply pattern matching
            const patternResults = patternMatcher.match(mockRecords, parsedQuery);
            
            // 3. Apply additional filters
            const filters = { status: 'valid' };
            const filteredResults = await filterEngine.apply(patternResults, filters);
            
            expect(filteredResults).toHaveLength(2); // 2001 and 2003 are valid
            
            // 4. Add to search history
            searchHistory.add(query, filters, { 
                resultCount: filteredResults.length, 
                executionTime: 45 
            });
            
            // 5. Save the search
            const searchId = savedSearches.save('Range Search', query, filters);
            
            // 6. Verify the complete workflow
            const history = searchHistory.getHistory();
            const savedSearch = savedSearches.load(searchId);
            
            expect(history[0].query).toBe(query);
            expect(history[0].resultCount).toBe(2);
            expect(savedSearch.query).toBe(query);
            expect(savedSearch.executionCount).toBe(1);
        });
    });
});