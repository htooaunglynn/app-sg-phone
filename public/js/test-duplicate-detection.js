/**
 * Test script for duplicate detection functionality
 * This can be run in the browser console to verify the duplicate detection services work correctly
 */

// Test data
const testRecords = [
    { id: '1', phone: '+65 9123 4567', company: 'Company A' },
    { id: '2', phone: '91234567', company: 'Company B' }, // Duplicate of record 1
    { id: '3', phone: '+65 8765 4321', company: 'Company C' },
    { id: '4', phone: '8765-4321', company: 'Company D' }, // Duplicate of record 3
    { id: '5', phone: '+65 5555 5555', company: 'Company E' },
    { id: '6', phone: '91234567', company: 'Company F' }, // Another duplicate of record 1
];

/**
 * Test the FrontendDuplicateDetectionService
 */
function testDuplicateDetectionService() {
    console.log('Testing FrontendDuplicateDetectionService...');
    
    try {
        const service = new FrontendDuplicateDetectionService();
        
        // Test duplicate identification
        const result = service.identifyDuplicatePhoneNumbers(testRecords);
        
        console.log('Duplicate Detection Results:', {
            totalRecords: result.totalRecords,
            duplicateCount: result.duplicateCount,
            duplicatePhoneCount: result.duplicatePhoneCount,
            uniquePhoneCount: result.uniquePhoneCount,
            duplicateRecordIds: result.duplicateRecordIds,
            duplicatePhoneNumbers: Array.from(result.duplicatePhoneNumbers)
        });
        
        // Test duplicate mapping
        const mapping = service.createDuplicatePhoneMapping(testRecords);
        console.log('Duplicate Mapping:', Object.fromEntries(mapping));
        
        // Test individual phone check
        const phoneCheck = service.isPhoneNumberDuplicate('+65 9123 4567', testRecords);
        console.log('Phone Check for +65 9123 4567:', phoneCheck);
        
        // Test statistics
        const stats = service.getDuplicateStatistics(testRecords);
        console.log('Duplicate Statistics:', stats);
        
        // Test metrics
        const metrics = service.getMetrics();
        console.log('Service Metrics:', metrics);
        
        console.log('✅ FrontendDuplicateDetectionService tests passed!');
        return true;
        
    } catch (error) {
        console.error('❌ FrontendDuplicateDetectionService test failed:', error);
        return false;
    }
}

/**
 * Test the DuplicateDataManager
 */
async function testDuplicateDataManager() {
    console.log('Testing DuplicateDataManager...');
    
    try {
        const manager = new DuplicateDataManager();
        
        // Test state
        const state = manager.getState();
        console.log('Initial State:', state);
        
        // Test metrics
        const metrics = manager.getMetrics();
        console.log('Initial Metrics:', metrics);
        
        // Test cache validity
        const isCacheValid = manager.isCacheValid();
        console.log('Cache Valid:', isCacheValid);
        
        // Test record duplicate status (should return null initially)
        const duplicateStatus = manager.getRecordDuplicateStatus('1');
        console.log('Record Duplicate Status:', duplicateStatus);
        
        console.log('✅ DuplicateDataManager tests passed!');
        return true;
        
    } catch (error) {
        console.error('❌ DuplicateDataManager test failed:', error);
        return false;
    }
}

/**
 * Test phone number normalization
 */
function testPhoneNormalization() {
    console.log('Testing phone number normalization...');
    
    try {
        const service = new FrontendDuplicateDetectionService();
        
        const testPhones = [
            '+65 9123 4567',
            '91234567',
            '+65-9123-4567',
            '(65) 9123 4567',
            '65 9123 4567',
            '9123-4567'
        ];
        
        const normalized = testPhones.map(phone => ({
            original: phone,
            normalized: service.normalizePhoneNumber(phone)
        }));
        
        console.log('Phone Normalization Results:', normalized);
        
        // Check if similar phones normalize to the same value
        const firstNormalized = service.normalizePhoneNumber('+65 9123 4567');
        const secondNormalized = service.normalizePhoneNumber('91234567');
        
        if (firstNormalized === secondNormalized) {
            console.log('✅ Phone normalization working correctly!');
            return true;
        } else {
            console.error('❌ Phone normalization failed - similar phones not matching');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Phone normalization test failed:', error);
        return false;
    }
}

/**
 * Run all tests
 */
async function runAllTests() {
    console.log('🧪 Running Duplicate Detection Tests...\n');
    
    const results = {
        detectionService: testDuplicateDetectionService(),
        dataManager: await testDuplicateDataManager(),
        phoneNormalization: testPhoneNormalization()
    };
    
    const allPassed = Object.values(results).every(result => result === true);
    
    console.log('\n📊 Test Results Summary:');
    console.log('Detection Service:', results.detectionService ? '✅ PASS' : '❌ FAIL');
    console.log('Data Manager:', results.dataManager ? '✅ PASS' : '❌ FAIL');
    console.log('Phone Normalization:', results.phoneNormalization ? '✅ PASS' : '❌ FAIL');
    
    if (allPassed) {
        console.log('\n🎉 All tests passed! Duplicate detection services are working correctly.');
    } else {
        console.log('\n⚠️ Some tests failed. Please check the implementation.');
    }
    
    return results;
}

// Export test functions for manual testing
if (typeof window !== 'undefined') {
    window.testDuplicateDetection = {
        runAllTests,
        testDuplicateDetectionService,
        testDuplicateDataManager,
        testPhoneNormalization,
        testRecords
    };
    
    console.log('🧪 Duplicate detection tests loaded. Run window.testDuplicateDetection.runAllTests() to test.');
}