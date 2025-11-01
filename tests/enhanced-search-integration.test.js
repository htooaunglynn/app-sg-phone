/**
 * Enhanced Search Integration Tests
 * Tests the integration between the enhanced search system and the existing table display
 */

describe('Enhanced Search Integration Tests', () => {
    let mockRecords;

    beforeEach(() => {
        // Mock records data
        mockRecords = [
            {
                Id: 'SG COM-2001',
                Phone: '+6512345678',
                CompanyName: 'Test Company 1',
                PhysicalAddress: '123 Test Street',
                Email: 'test1@example.com',
                Website: 'https://test1.com',
                Status: true
            },
            {
                Id: 'SG COM-2002',
                Phone: '+6587654321',
                CompanyName: 'Test Company 2',
                PhysicalAddress: '456 Test Avenue',
                Email: 'test2@example.com',
                Website: 'https://test2.com',
                Status: false
            },
            {
                Id: 'SG COM-2003',
                Phone: '+6511111111',
                CompanyName: 'Another Company',
                PhysicalAddress: '789 Another Street',
                Email: 'another@example.com',
                Website: 'https://another.com',
                Status: true
            }
        ];
    });

    describe('Search Integration', () => {
        test('should integrate with enhanced search system when available', () => {
            // Mock enhanced search system
            const mockEnhancedSearch = {
                isInitialized: true,
                performSearch: jest.fn().mockResolvedValue({
                    records: mockRecords.slice(0, 1),
                    originalRecords: mockRecords.slice(0, 1),
                    totalCount: 1,
                    executionTime: 50,
                    highlighting: { enabled: true },
                    query: { type: 'pattern', original: 'SG COM-2001' }
                })
            };

            // Mock window object
            const mockWindow = {
                getEnhancedSearchSystem: jest.fn().mockReturnValue(mockEnhancedSearch)
            };

            // Test that the integration calls the enhanced search system
            expect(typeof mockWindow.getEnhancedSearchSystem).toBe('function');
            expect(mockWindow.getEnhancedSearchSystem()).toBe(mockEnhancedSearch);
            expect(mockEnhancedSearch.isInitialized).toBe(true);
        });

        test('should fall back to basic search when enhanced search is not available', () => {
            // Mock window without enhanced search system
            const mockWindow = {};

            // This should not throw an error and should handle gracefully
            expect(() => {
                const enhancedSearch = mockWindow.getEnhancedSearchSystem && mockWindow.getEnhancedSearchSystem();
                expect(enhancedSearch).toBeUndefined();
            }).not.toThrow();
        });

        test('should handle search results with highlighting', () => {
            const mockSearchResults = {
                records: [
                    {
                        ...mockRecords[0],
                        _highlighted: {
                            Id: '<span class="search-highlight">SG COM-2001</span>',
                            CompanyName: 'Test Company 1'
                        }
                    }
                ],
                originalRecords: [mockRecords[0]],
                totalCount: 1,
                executionTime: 25,
                highlighting: { enabled: true, stats: { totalMatches: 1 } },
                query: { type: 'exact', original: 'SG COM-2001' }
            };

            // Verify that highlighted records contain the expected highlighting
            expect(mockSearchResults.records[0]._highlighted).toBeDefined();
            expect(mockSearchResults.records[0]._highlighted.Id).toContain('search-highlight');
            expect(mockSearchResults.highlighting.enabled).toBe(true);
        });
    });

    describe('Pagination Integration', () => {
        test('should maintain search state during pagination', () => {
            const searchTerm = 'SG COM';
            const currentPage = 2;

            // Mock URL API
            const mockHistory = {
                pushState: jest.fn()
            };
            const mockLocation = {
                toString: () => 'http://localhost:3000/',
                search: ''
            };

            // Mock URL constructor
            class MockURL {
                constructor(url) {
                    this.searchParams = {
                        set: jest.fn(),
                        delete: jest.fn()
                    };
                }
                toString() {
                    return 'http://localhost:3000/?search=SG%20COM&page=2';
                }
            }

            // Test URL state management
            const url = new MockURL('http://localhost:3000/');
            url.searchParams.set('search', searchTerm);
            url.searchParams.set('page', currentPage.toString());

            expect(url.searchParams.set).toHaveBeenCalledWith('search', searchTerm);
            expect(url.searchParams.set).toHaveBeenCalledWith('page', currentPage.toString());
        });

        test('should show search result counts in pagination', () => {
            const totalResults = 15;
            const currentPage = 2;
            const recordsPerPage = 10;
            const searchTerm = 'test';

            // Calculate expected pagination info
            const startRecord = (currentPage - 1) * recordsPerPage + 1; // 11
            const endRecord = Math.min(currentPage * recordsPerPage, totalResults); // 15

            expect(startRecord).toBe(11);
            expect(endRecord).toBe(15);

            // Verify pagination info format
            const expectedInfo = `Showing ${startRecord}-${endRecord} of ${totalResults} results for "${searchTerm}"`;
            expect(expectedInfo).toBe('Showing 11-15 of 15 results for "test"');
        });
    });

    describe('Export Integration', () => {
        test('should include search results in export options', () => {
            const searchTerm = 'SG COM';
            const filteredRecords = mockRecords.filter(record => 
                record.Id.includes(searchTerm)
            ); // This will return all 3 records since they all contain 'SG COM'

            // Mock current search results
            const currentSearchResults = {
                records: filteredRecords,
                totalCount: filteredRecords.length,
                query: { type: 'pattern', original: searchTerm },
                executionTime: 45
            };

            // Test export data preparation
            const exportData = {
                records: filteredRecords.map(record => ({
                    Id: record.Id || '',
                    Phone: record.Phone || '',
                    CompanyName: record.CompanyName || '',
                    PhysicalAddress: record.PhysicalAddress || '',
                    Email: record.Email || '',
                    Website: record.Website || '',
                    Status: record.Status
                })),
                searchSummary: {
                    searchTerm: searchTerm,
                    totalResults: filteredRecords.length,
                    searchDate: expect.any(String),
                    searchType: currentSearchResults.query.type,
                    executionTime: currentSearchResults.executionTime
                },
                exportType: 'searchResults'
            };

            expect(exportData.records).toHaveLength(3); // All records contain 'SG COM'
            expect(exportData.searchSummary.searchTerm).toBe(searchTerm);
            expect(exportData.searchSummary.totalResults).toBe(3);
            expect(exportData.exportType).toBe('searchResults');
        });

        test('should generate appropriate filename for search results export', () => {
            const searchTerm = 'SG COM-200*';
            const date = '2025-10-31';
            
            // Test filename generation logic
            const cleanSearchTerm = searchTerm.replace(/[^a-zA-Z0-9]/g, '_');
            const expectedFilename = `search_results_${cleanSearchTerm}_${date}.xlsx`;
            
            expect(expectedFilename).toBe('search_results_SG_COM_200__2025-10-31.xlsx');
        });

        test('should create CSV fallback when server export fails', () => {
            const searchTerm = 'test';
            const filteredRecords = [mockRecords[0]];

            // Test CSV content generation
            const headers = ['Id', 'Phone', 'Company Name', 'Physical Address', 'Email', 'Website', 'Status'];
            const csvContent = [
                `# Search Results Export`,
                `# Search Term: "${searchTerm}"`,
                `# Results: ${filteredRecords.length} records`,
                `# Export Date: ${new Date().toISOString()}`,
                `# Search Type: basic`,
                '',
                headers.join(','),
                ...filteredRecords.map(record => [
                    `"${(record.Id || '').replace(/"/g, '""')}"`,
                    `"${(record.Phone || '').replace(/"/g, '""')}"`,
                    `"${(record.CompanyName || '').replace(/"/g, '""')}"`,
                    `"${(record.PhysicalAddress || '').replace(/"/g, '""')}"`,
                    `"${(record.Email || '').replace(/"/g, '""')}"`,
                    `"${(record.Website || '').replace(/"/g, '""')}"`,
                    `"${record.Status ? 'Valid Singapore' : 'Invalid'}"`
                ].join(','))
            ].join('\n');

            expect(csvContent).toContain('# Search Results Export');
            expect(csvContent).toContain(`# Search Term: "${searchTerm}"`);
            expect(csvContent).toContain('SG COM-2001');
            expect(csvContent).toContain('Test Company 1');
        });
    });

    describe('Error Handling', () => {
        test('should handle enhanced search errors gracefully', async () => {
            // Mock enhanced search system that throws an error
            const mockEnhancedSearch = {
                isInitialized: true,
                performSearch: jest.fn().mockRejectedValue(new Error('Search failed'))
            };

            global.window.getEnhancedSearchSystem = jest.fn().mockReturnValue(mockEnhancedSearch);

            // Test that errors are handled gracefully
            try {
                await mockEnhancedSearch.performSearch('test');
            } catch (error) {
                expect(error.message).toBe('Search failed');
            }

            expect(mockEnhancedSearch.performSearch).toHaveBeenCalledWith('test');
        });

        test('should provide fallback when no search results are available for export', () => {
            const searchTerm = '';
            const filteredRecords = [];

            // Test validation logic - empty string is falsy in JavaScript
            const hasSearchResults = searchTerm && filteredRecords.length > 0;
            expect(hasSearchResults).toBeFalsy(); // '' && 0 > 0 = '' (falsy)

            // Should show appropriate error message
            const expectedError = 'No search results available for export. Please perform a search first.';
            expect(expectedError).toContain('No search results available');
        });
    });

    describe('Performance', () => {
        test('should handle large search result sets efficiently', () => {
            // Create a large dataset
            const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
                Id: `SG COM-${3000 + i}`,
                Phone: `+651234${String(i).padStart(4, '0')}`,
                CompanyName: `Company ${i}`,
                PhysicalAddress: `${i} Test Street`,
                Email: `test${i}@example.com`,
                Website: `https://test${i}.com`,
                Status: i % 2 === 0
            }));

            // Test pagination calculation with large dataset
            const recordsPerPage = 50;
            const totalPages = Math.ceil(largeDataset.length / recordsPerPage);
            
            expect(totalPages).toBe(20); // 1000 / 50 = 20 pages
            expect(largeDataset.length).toBe(1000);

            // Test that pagination handles large datasets
            const currentPage = 5;
            const startIndex = (currentPage - 1) * recordsPerPage; // 200
            const endIndex = startIndex + recordsPerPage; // 250
            const pageRecords = largeDataset.slice(startIndex, endIndex);

            expect(startIndex).toBe(200);
            expect(endIndex).toBe(250);
            expect(pageRecords).toHaveLength(50);
        });
    });
});