/**
 * Unit Tests for Numeric ID Extraction Feature
 * Tests CheckTable model enhancements for numeric_id functionality
 */

const CheckTable = require('../src/models/CheckTable');

// Mock the database manager to avoid actual database calls
jest.mock('../src/utils/database', () => ({
  query: jest.fn()
}));

const databaseManager = require('../src/utils/database');

describe('CheckTable Numeric ID Extraction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('extractNumericId static method', () => {
    describe('valid ID formats', () => {
      test('should extract numeric ID from SG COM-2001 format', () => {
        expect(CheckTable.extractNumericId('SG COM-2001')).toBe(2001);
      });

      test('should extract numeric ID from SG COM-2002 format', () => {
        expect(CheckTable.extractNumericId('SG COM-2002')).toBe(2002);
      });

      test('should extract numeric ID from different prefix formats', () => {
        expect(CheckTable.extractNumericId('TEST-123')).toBe(123);
        expect(CheckTable.extractNumericId('PREFIX_456')).toBe(456);
        expect(CheckTable.extractNumericId('COMPANY 789')).toBe(789);
      });

      test('should extract large numeric IDs', () => {
        expect(CheckTable.extractNumericId('SG COM-999999')).toBe(999999);
      });

      test('should extract single digit numeric IDs', () => {
        expect(CheckTable.extractNumericId('SG COM-1')).toBe(1);
      });

      test('should handle leading zeros in numeric portion', () => {
        expect(CheckTable.extractNumericId('SG COM-0001')).toBe(1);
        expect(CheckTable.extractNumericId('SG COM-0123')).toBe(123);
      });
    });

    describe('edge cases', () => {
      test('should return null for IDs with no numbers', () => {
        expect(CheckTable.extractNumericId('SG COM')).toBeNull();
        expect(CheckTable.extractNumericId('NO NUMBERS HERE')).toBeNull();
        expect(CheckTable.extractNumericId('TEST-ABC')).toBeNull();
      });

      test('should extract only trailing numeric sequence when multiple numbers exist', () => {
        expect(CheckTable.extractNumericId('SG 123 COM-456')).toBe(456);
        expect(CheckTable.extractNumericId('TEST 2023-789')).toBe(789);
        expect(CheckTable.extractNumericId('V1.2.3-999')).toBe(999);
      });

      test('should handle IDs ending with zero', () => {
        expect(CheckTable.extractNumericId('SG COM-2000')).toBe(2000);
        expect(CheckTable.extractNumericId('TEST-0')).toBe(0);
      });
    });

    describe('invalid input handling', () => {
      test('should return null for null input', () => {
        expect(CheckTable.extractNumericId(null)).toBeNull();
      });

      test('should return null for undefined input', () => {
        expect(CheckTable.extractNumericId(undefined)).toBeNull();
      });

      test('should return null for non-string inputs', () => {
        expect(CheckTable.extractNumericId(123)).toBeNull();
        expect(CheckTable.extractNumericId({})).toBeNull();
        expect(CheckTable.extractNumericId([])).toBeNull();
        expect(CheckTable.extractNumericId(true)).toBeNull();
      });

      test('should return null for empty string', () => {
        expect(CheckTable.extractNumericId('')).toBeNull();
      });

      test('should return null for whitespace-only string', () => {
        expect(CheckTable.extractNumericId('   ')).toBeNull();
      });
    });
  });

  describe('constructor auto-extraction functionality', () => {
    test('should auto-extract numeric_id in constructor for valid ID', () => {
      const record = new CheckTable('SG COM-2001', '+65 9123 4567', true);
      expect(record.numeric_id).toBe(2001);
    });

    test('should auto-extract numeric_id for different ID formats', () => {
      const record1 = new CheckTable('TEST-456', '+65 9123 4567', true);
      expect(record1.numeric_id).toBe(456);

      const record2 = new CheckTable('PREFIX_789', '+65 9123 4567', false);
      expect(record2.numeric_id).toBe(789);
    });

    test('should set numeric_id to null for IDs without numbers', () => {
      const record = new CheckTable('NO NUMBERS', '+65 9123 4567', true);
      expect(record.numeric_id).toBeNull();
    });

    test('should handle null ID in constructor', () => {
      const record = new CheckTable(null, '+65 9123 4567', true);
      expect(record.numeric_id).toBeNull();
    });

    test('should preserve all other constructor properties', () => {
      const record = new CheckTable(
        'SG COM-2001', 
        '+65 9123 4567', 
        true, 
        'Test Company',
        '123 Test St',
        'test@example.com',
        'https://test.com'
      );
      
      expect(record.id).toBe('SG COM-2001');
      expect(record.phone).toBe('+65 9123 4567');
      expect(record.status).toBe(true);
      expect(record.companyName).toBe('Test Company');
      expect(record.physicalAddress).toBe('123 Test St');
      expect(record.email).toBe('test@example.com');
      expect(record.website).toBe('https://test.com');
      expect(record.numeric_id).toBe(2001);
    });
  });

  describe('insert method with numeric_id population', () => {
    test('should include numeric_id in insert SQL query', async () => {
      const mockResult = { affectedRows: 1 };
      databaseManager.query.mockResolvedValue(mockResult);

      const record = new CheckTable('SG COM-2001', '+65 9123 4567', true, 'Test Company');
      await record.insert();

      expect(databaseManager.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO check_table (Id, numeric_id, Phone, Status, CompanyName, PhysicalAddress, Email, Website)'),
        ['SG COM-2001', 2001, '+65 9123 4567', true, 'Test Company', null, null, null]
      );
    });

    test('should insert with null numeric_id for IDs without numbers', async () => {
      const mockResult = { affectedRows: 1 };
      databaseManager.query.mockResolvedValue(mockResult);

      const record = new CheckTable('NO NUMBERS', '+65 9123 4567', true);
      await record.insert();

      expect(databaseManager.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO check_table'),
        ['NO NUMBERS', null, '+65 9123 4567', true, null, null, null, null]
      );
    });

    test('should handle database errors during insert', async () => {
      const mockError = new Error('Database connection failed');
      databaseManager.query.mockRejectedValue(mockError);

      const record = new CheckTable('SG COM-2001', '+65 9123 4567', true);
      
      await expect(record.insert()).rejects.toThrow('Database connection failed');
    });

    test('should handle duplicate entry errors with proper error messages', async () => {
      const mockError = new Error('Duplicate entry');
      mockError.code = 'ER_DUP_ENTRY';
      databaseManager.query.mockRejectedValue(mockError);

      const record = new CheckTable('SG COM-2001', '+65 9123 4567', true);
      
      await expect(record.insert()).rejects.toThrow('Record with Id SG COM-2001 already exists');
    });

    test('should handle duplicate email errors', async () => {
      const mockError = new Error('Duplicate entry for key unique_email');
      mockError.code = 'ER_DUP_ENTRY';
      databaseManager.query.mockRejectedValue(mockError);

      const record = new CheckTable('SG COM-2001', '+65 9123 4567', true, null, null, 'test@example.com');
      
      await expect(record.insert()).rejects.toThrow('Email address already exists: test@example.com');
    });
  });

  describe('updateNumericId method for data consistency', () => {
    test('should recalculate and update numeric_id', async () => {
      const mockResult = { affectedRows: 1 };
      databaseManager.query.mockResolvedValue(mockResult);

      const record = new CheckTable('SG COM-2001', '+65 9123 4567', true);
      // Simulate ID change
      record.id = 'SG COM-3000';
      
      const result = await record.updateNumericId();

      expect(record.numeric_id).toBe(3000);
      expect(databaseManager.query).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE check_table\s+SET numeric_id = \?, updated_at = CURRENT_TIMESTAMP\s+WHERE Id = \?/),
        [3000, 'SG COM-3000']
      );
      expect(result.success).toBe(true);
    });

    test('should update numeric_id to null for IDs without numbers', async () => {
      const mockResult = { affectedRows: 1 };
      databaseManager.query.mockResolvedValue(mockResult);

      const record = new CheckTable('SG COM-2001', '+65 9123 4567', true);
      record.id = 'NO NUMBERS';
      
      await record.updateNumericId();

      expect(record.numeric_id).toBeNull();
      expect(databaseManager.query).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE check_table\s+SET numeric_id = \?, updated_at = CURRENT_TIMESTAMP\s+WHERE Id = \?/),
        [null, 'NO NUMBERS']
      );
    });

    test('should return failure when record not found', async () => {
      const mockResult = { affectedRows: 0 };
      databaseManager.query.mockResolvedValue(mockResult);

      const record = new CheckTable('NONEXISTENT', '+65 9123 4567', true);
      const result = await record.updateNumericId();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Record not found');
    });

    test('should handle database errors during update', async () => {
      const mockError = new Error('Database connection failed');
      databaseManager.query.mockRejectedValue(mockError);

      const record = new CheckTable('SG COM-2001', '+65 9123 4567', true);
      
      await expect(record.updateNumericId()).rejects.toThrow('Database connection failed');
    });
  });

  describe('updateCompanyInfo method consistency', () => {
    test('should not affect numeric_id when updating company info', async () => {
      const mockResult = { affectedRows: 1 };
      databaseManager.query.mockResolvedValue(mockResult);

      const record = new CheckTable('SG COM-2001', '+65 9123 4567', true, 'Old Company');
      const originalNumericId = record.numeric_id;
      
      record.companyName = 'New Company';
      record.email = 'new@example.com';
      
      await record.updateCompanyInfo();

      // numeric_id should remain unchanged
      expect(record.numeric_id).toBe(originalNumericId);
      expect(record.numeric_id).toBe(2001);
      
      // Verify the update query doesn't include numeric_id
      expect(databaseManager.query).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE check_table\s+SET CompanyName = \?, PhysicalAddress = \?, Email = \?, Website = \?, updated_at = CURRENT_TIMESTAMP\s+WHERE Id = \?/),
        ['New Company', null, 'new@example.com', null, 'SG COM-2001']
      );
    });
  });

  describe('batchInsert with numeric_id extraction', () => {
    test('should extract numeric_id for each record during batch insert', async () => {
      const mockResult = { affectedRows: 1 };
      databaseManager.query.mockResolvedValue(mockResult);

      const records = [
        { id: 'SG COM-2001', phone: '+65 9123 4567', status: true },
        { id: 'SG COM-2002', phone: '+65 9123 4568', status: false },
        { id: 'NO NUMBERS', phone: '+65 9123 4569', status: true }
      ];

      await CheckTable.batchInsert(records);

      // Verify each record was processed with correct numeric_id
      expect(databaseManager.query).toHaveBeenCalledTimes(3);
      
      // First record
      expect(databaseManager.query).toHaveBeenNthCalledWith(1,
        expect.stringContaining('INSERT INTO check_table'),
        ['SG COM-2001', 2001, '+65 9123 4567', true, null, null, null, null]
      );
      
      // Second record
      expect(databaseManager.query).toHaveBeenNthCalledWith(2,
        expect.stringContaining('INSERT INTO check_table'),
        ['SG COM-2002', 2002, '+65 9123 4568', false, null, null, null, null]
      );
      
      // Third record (no numeric ID)
      expect(databaseManager.query).toHaveBeenNthCalledWith(3,
        expect.stringContaining('INSERT INTO check_table'),
        ['NO NUMBERS', null, '+65 9123 4569', true, null, null, null, null]
      );
    });
  });
});