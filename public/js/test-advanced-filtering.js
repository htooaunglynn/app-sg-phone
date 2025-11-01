/**
 * Test script for advanced filtering and pattern matching functionality
 * Tests the implementation of task 3: Implement advanced filtering and pattern matching
 */

// Test data matching the CheckTable structure
const testRecords = [
    {
        Id: 'SG COM-2001',
        Phone: '+65 6123 4567',
        Status: true,
        CompanyName: 'Singapore Tech Solutions',
        PhysicalAddress: '123 Orchard Road, Singapore 238858',
        Email: 'info@sgtech.com.sg',
        Website: 'https://www.sgtech.com.sg',
        created_at: '2024-01-15T10:30:00Z'
    },
    {
        Id: 'SG COM-2002',
        Phone: '+65 6234 5678',
        Status: false,
        CompanyName: 'Global Trading Pte Ltd',
        PhysicalAddress: '456 Marina Bay, Singapore 018956',
        Email: 'contact@globaltrading.sg',
        Website: 'https://www.globaltrading.sg',
        created_at: '2024-01-16T14:20:00Z'
    },
    {
        Id: 'SG COM-2003',
        Phone: '+65 6345 6789',
        Status: true,
        CompanyName: 'Innovation Hub Singapore',
        PhysicalAddress: '789 Raffles Place, Singapore 048619',
        Email: 'hello@innovationhub.sg',
        Website: 'https://www.innovationhub.sg',
        created_at: '2024-01-17T09:15:00Z'
    },
    {
        Id: 'SG COM-2010',
        Phone: '+65 6456 7890',
        Status: true,
        CompanyName: 'Digital Solutions Co',
        PhysicalAddress: '321 Clarke Quay, Singapore 179024',
        Email: 'support@digitalsolutions.com.sg',
        Website: 'https://www.digitalsolutions.com.sg',
        created_at: '2024-01-20T16:45:00Z'
    }
];

/**
 * Test the FilterEngine multi-criteria filtering
 */
function testFilterEngine() {
    console.log('=== Testing FilterEngine ===');
    
    const filterEngine = new FilterEngine();
    
    // Test 1: ID filter with wildcard
    console.log('Test 1: ID filter with wildcard "SG COM-200*"');
    const wildcardResults = filterEngine.filterById(testRecords, 'SG COM-200*');
    console.log(`Results: ${wildcardResults.length} records`);
    console.log('IDs:', wildcardResults.map(r => r.Id));
    
    // Test 2: Status filter
    console.log('\nTest 2: Status filter for valid Singapore phones');
    const validResults = filterEngine.filterByStatus(testRecords, 'valid');
    console.log(`Results: ${validResults.length} records`);
    console.log('Valid records:', validResults.map(r => `${r.Id} (${r.Status})`));
    
    // Test 3: Company name filter
    console.log('\nTest 3: Company name filter for "Singapore"');
    const companyResults = filterEngine.filterByCompanyName(testRecords, 'Singapore');
    console.log(`Results: ${companyResults.length} records`);
    console.log('Companies:', companyResults.map(r => r.CompanyName));
    
    // Test 4: Combined filters
    console.log('\nTest 4: Combined filters (Status=valid AND Company contains "Singapore")');
    const filters = {
        status: 'valid',
        companyName: 'Singapore'
    };
    
    filterEngine.apply(testRecords, filters).then(combinedResults => {
        console.log(`Results: ${combinedResults.length} records`);
        console.log('Combined results:', combinedResults.map(r => `${r.Id} - ${r.CompanyName}`));
    });
}

/**
 * Test the PatternMatcher algorithms
 */
function testPatternMatcher() {
    console.log('\n=== Testing PatternMatcher ===');
    
    const patternMatcher = new PatternMatcher();
    
    // Test 1: Wildcard pattern
    console.log('Test 1: Wildcard pattern "SG COM-200*"');
    const wildcardQuery = patternMatcher.parseQuery('SG COM-200*');
    console.log('Parsed query:', wildcardQuery);
    const wildcardMatches = patternMatcher.match(testRecords, wildcardQuery);
    console.log(`Matches: ${wildcardMatches.length} records`);
    
    // Test 2: Range pattern
    console.log('\nTest 2: Range pattern "SG COM-2001 to SG COM-2003"');
    const rangeQuery = patternMatcher.parseQuery('SG COM-2001 to SG COM-2003');
    console.log('Parsed query:', rangeQuery);
    const rangeMatches = patternMatcher.match(testRecords, rangeQuery);
    console.log(`Matches: ${rangeMatches.length} records`);
    console.log('Range matches:', rangeMatches.map(r => r.Id));
    
    // Test 3: Contains pattern
    console.log('\nTest 3: Contains pattern "Tech"');
    const containsQuery = patternMatcher.parseQuery('Tech');
    console.log('Parsed query:', containsQuery);
    const containsMatches = patternMatcher.match(testRecords, containsQuery);
    console.log(`Matches: ${containsMatches.length} records`);
    console.log('Contains matches:', containsMatches.map(r => `${r.Id} - ${r.CompanyName}`));
}

/**
 * Test the SearchResultHighlighter
 */
function testSearchResultHighlighter() {
    console.log('\n=== Testing SearchResultHighlighter ===');
    
    const highlighter = new SearchResultHighlighter();
    
    // Test 1: Basic highlighting
    console.log('Test 1: Basic text highlighting');
    const text = 'Singapore Tech Solutions Pte Ltd';
    const highlighted = highlighter.highlightSearchMatches(text, 'Tech');
    console.log('Original:', text);
    console.log('Highlighted:', highlighted);
    
    // Test 2: Table results highlighting
    console.log('\nTest 2: Table results highlighting');
    const highlightedRecords = highlighter.highlightTableResults(testRecords, 'Singapore');
    console.log('Highlighted records count:', highlightedRecords.length);
    console.log('Sample highlighted company:', highlightedRecords[0]?.CompanyName);
    
    // Test 3: Statistics
    console.log('\nTest 3: Highlighting statistics');
    const stats = highlighter.getStatistics();
    console.log('Statistics:', stats);
}

/**
 * Test the complete SearchEngine integration
 */
async function testSearchEngineIntegration() {
    console.log('\n=== Testing SearchEngine Integration ===');
    
    const searchEngine = new SearchEngine(testRecords);
    
    // Test 1: Basic search with highlighting
    console.log('Test 1: Search for "Singapore" with highlighting');
    const searchResults = await searchEngine.search('Singapore', {}, { highlight: true });
    console.log('Search results:', {
        totalCount: searchResults.totalCount,
        executionTime: searchResults.executionTime,
        highlightingEnabled: searchResults.highlighting.enabled,
        highlightStats: searchResults.highlighting.stats
    });
    
    // Test 2: Wildcard search
    console.log('\nTest 2: Wildcard search "SG COM-200*"');
    const wildcardResults = await searchEngine.search('SG COM-200*');
    console.log('Wildcard results:', {
        totalCount: wildcardResults.totalCount,
        queryType: wildcardResults.query.type,
        recordIds: wildcardResults.records.map(r => r.Id || r.id)
    });
    
    // Test 3: Search with filters
    console.log('\nTest 3: Search with status filter');
    const filteredResults = await searchEngine.search('', { status: 'valid' });
    console.log('Filtered results:', {
        totalCount: filteredResults.totalCount,
        validRecords: filteredResults.records.map(r => `${r.Id} (${r.Status})`)
    });
}

/**
 * Run all tests
 */
async function runAllTests() {
    console.log('Starting Advanced Filtering and Pattern Matching Tests...\n');
    
    try {
        testFilterEngine();
        testPatternMatcher();
        testSearchResultHighlighter();
        await testSearchEngineIntegration();
        
        console.log('\n=== All Tests Completed Successfully ===');
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Export test functions for use in browser console or other scripts
if (typeof window !== 'undefined') {
    window.testAdvancedFiltering = {
        runAllTests,
        testFilterEngine,
        testPatternMatcher,
        testSearchResultHighlighter,
        testSearchEngineIntegration,
        testRecords
    };
}

// Auto-run tests if this script is loaded directly
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('Advanced Filtering Test Script Loaded');
        console.log('Run window.testAdvancedFiltering.runAllTests() to execute all tests');
    });
}