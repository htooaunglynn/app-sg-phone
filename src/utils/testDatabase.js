const { initializeDatabase, shutdownDatabase } = require('./initDatabase');

/**
 * Test script to verify database setup
 */
async function testDatabaseSetup() {
  console.log('=== Database Setup Test ===');
  
  try {
    // Initialize database
    const result = await initializeDatabase();
    
    if (result.success) {
      console.log('✅ Database initialization successful');
      console.log('Stats:', result.stats);
    } else {
      console.log('❌ Database initialization failed');
      console.log('Error:', result.message);
      return false;
    }
    
    // Test connection status
    const databaseManager = require('./database');
    const status = databaseManager.getConnectionStatus();
    console.log('Connection status:', status);
    
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  } finally {
    // Clean shutdown
    await shutdownDatabase();
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testDatabaseSetup()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testDatabaseSetup };