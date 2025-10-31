/**
 * Jest Test Setup
 * Global test configuration and mocks
 */

// Mock console methods to reduce test output noise
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

// Mock setTimeout and setInterval for testing
jest.useFakeTimers();

// Global test utilities
global.testUtils = {
  createMockRecord: (id, phone, options = {}) => ({
    id,
    phone,
    company: options.company || `Company ${id}`,
    status: options.status !== undefined ? options.status : true,
    ...options
  }),

  createMockRecords: (count, duplicateRate = 0.2) => {
    const records = [];
    const basePhones = ['+65 9123 4567', '+65 8765 4321', '+65 5555 5555'];
    
    for (let i = 0; i < count; i++) {
      const shouldBeDuplicate = Math.random() < duplicateRate;
      const phone = shouldBeDuplicate 
        ? basePhones[i % basePhones.length]
        : `+65 ${String(i).padStart(8, '0')}`;
      
      records.push({
        id: `TEST_${i}`,
        phone,
        company: `Company ${i}`,
        status: i % 2 === 0
      });
    }
    
    return records;
  },

  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};

// Mock browser environment for frontend tests
global.window = {
  setTimeout,
  setInterval,
  clearTimeout,
  clearInterval
};

// Mock process for Node.js environment checks
if (!global.process) {
  global.process = {
    memoryUsage: () => ({
      heapUsed: 1024 * 1024 * 10, // 10MB
      heapTotal: 1024 * 1024 * 20, // 20MB
      external: 1024 * 1024 * 5,   // 5MB
      rss: 1024 * 1024 * 30        // 30MB
    })
  };
}

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});