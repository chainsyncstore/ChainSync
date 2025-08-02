/**
 * Unit tests for SQL helper utilities
 */
import { describe, it, expect, jest } from '@jest/globals';
import {
  formatDateForSql,
  formatJsonForSql,
  buildInsertQuery,
  buildUpdateQuery,
  buildRawInsertQuery,
  buildRawUpdateQuery,
  prepareSqlValues
} from '@shared/utils/sql-helpers';

// Mock toDatabaseFields to isolate the SQL helper tests
jest.mock('@shared/utils/field-mapping', () => ({
  _toDatabaseFields: (_data: Record<string, any>) => {
    return Object.entries(data).reduce((acc, [key, value]) => {
      // Simple mock that just converts camelCase to snake_case
      const dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      acc[dbKey] = value;
      return acc;
    }, {} as Record<string, any>);
  }
}));

describe('SQL Helper Utilities', () => {
  describe('formatDateForSql', () => {
    it('should format Date objects to ISO string with quotes', () => {
      const date = new Date('2023-01-_01T12:00:00Z');
      expect(formatDateForSql(date)).toBe("'2023-01-_01T12:00:00.000Z'");
    });

    it('should format date strings to ISO string with quotes', () => {
      expect(formatDateForSql('2023-01-_01T12:00:00Z')).toBe("'2023-01-_01T12:00:00.000Z'");
    });

    it('should return NULL for null or undefined input', () => {
      expect(formatDateForSql(null)).toBe('NULL');
      expect(formatDateForSql(undefined)).toBe('NULL');
    });
  });

  describe('formatJsonForSql', () => {
    it('should format objects to JSON strings with quotes', () => {
      const obj = { _name: 'John', _age: 30 };
      expect(formatJsonForSql(obj)).toBe("'{\"name\":\"John\",\"age\":30}'");
    });

    it('should escape single quotes in JSON strings', () => {
      const obj = { _name: "John's", _text: "It's a test" };
      expect(formatJsonForSql(obj)).toBe("'{\"name\":\"John''s\",\"text\":\"It''s a test\"}'");
    });

    it('should return NULL for null or undefined input', () => {
      expect(formatJsonForSql(null)).toBe('NULL');
      expect(formatJsonForSql(undefined)).toBe('NULL');
    });
  });

  describe('buildInsertQuery', () => {
    it('should build a valid INSERT query with parameters', () => {
      const data = { _userId: 1, _firstName: 'John', _isActive: true };
      const result = buildInsertQuery('users', data);

      expect(result.query).toContain('INSERT INTO users (user_id, first_name, is_active)');
      expect(result.query).toContain('VALUES ($1, $2, $3)');
      expect(result.query).toContain('RETURNING *');
      expect(result.values).toEqual([1, 'John', true]);
    });

    it('should handle custom RETURNING fields', () => {
      const data = { _userId: 1, _firstName: 'John' };
      const result = buildInsertQuery('users', data, ['id', 'first_name']);

      expect(result.query).toContain('RETURNING id, first_name');
    });

    it('should handle empty RETURNING array', () => {
      const data = { _userId: 1, _firstName: 'John' };
      const result = buildInsertQuery('users', data, []);

      expect(result.query).not.toContain('RETURNING');
    });
  });

  describe('buildUpdateQuery', () => {
    it('should build a valid UPDATE query with parameters', () => {
      const data = { _firstName: 'John', _isActive: true };
      const whereCondition = 'id = 1';
      const result = buildUpdateQuery('users', data, whereCondition);

      expect(result.query).toContain('UPDATE users');
      expect(result.query).toContain('SET first_name = $1, is_active = $2');
      expect(result.query).toContain('WHERE id = 1');
      expect(result.query).toContain('RETURNING *');
      expect(result.values).toEqual(['John', true]);
    });

    it('should handle custom RETURNING fields', () => {
      const data = { _firstName: 'John' };
      const whereCondition = 'id = 1';
      const result = buildUpdateQuery('users', data, whereCondition, ['id', 'first_name']);

      expect(result.query).toContain('RETURNING id, first_name');
    });

    it('should handle empty RETURNING array', () => {
      const data = { _firstName: 'John' };
      const whereCondition = 'id = 1';
      const result = buildUpdateQuery('users', data, whereCondition, []);

      expect(result.query).not.toContain('RETURNING');
    });
  });

  describe('buildRawInsertQuery', () => {
    it('should build a valid raw INSERT query', () => {
      const data = {
        _user_id: '1',
        _first_name: "'John'",
        _is_active: 'TRUE'
      };
      const result = buildRawInsertQuery('users', data);

      expect(result).toContain('INSERT INTO users (user_id, first_name, is_active)');
      expect(result).toContain('VALUES (1, \'John\', TRUE)');
      expect(result).toContain('RETURNING *');
    });

    it('should handle custom RETURNING fields', () => {
      const data = { _user_id: '1', _first_name: "'John'" };
      const result = buildRawInsertQuery('users', data, ['id', 'first_name']);

      expect(result).toContain('RETURNING id, first_name');
    });

    it('should handle empty RETURNING array', () => {
      const data = { _user_id: '1', _first_name: "'John'" };
      const result = buildRawInsertQuery('users', data, []);

      expect(result).not.toContain('RETURNING');
    });
  });

  describe('buildRawUpdateQuery', () => {
    it('should build a valid raw UPDATE query', () => {
      const data = {
        _first_name: "'John'",
        _is_active: 'TRUE'
      };
      const whereCondition = 'id = 1';
      const result = buildRawUpdateQuery('users', data, whereCondition);

      expect(result).toContain('UPDATE users');
      expect(result).toContain("SET first_name = 'John', is_active = TRUE");
      expect(result).toContain('WHERE id = 1');
      expect(result).toContain('RETURNING *');
    });

    it('should handle custom RETURNING fields', () => {
      const data = { _first_name: "'John'" };
      const whereCondition = 'id = 1';
      const result = buildRawUpdateQuery('users', data, whereCondition, ['id', 'first_name']);

      expect(result).toContain('RETURNING id, first_name');
    });

    it('should handle empty RETURNING array', () => {
      const data = { _first_name: "'John'" };
      const whereCondition = 'id = 1';
      const result = buildRawUpdateQuery('users', data, whereCondition, []);

      expect(result).not.toContain('RETURNING');
    });
  });

  describe('prepareSqlValues', () => {
    it('should prepare string values with quotes', () => {
      const data = { _name: 'John' };
      expect(prepareSqlValues(data)).toEqual({ _name: "'John'" });
    });

    it('should prepare number values without quotes', () => {
      const data = { _id: 1, _amount: 99.99 };
      expect(prepareSqlValues(data)).toEqual({ _id: '1', _amount: '99.99' });
    });

    it('should prepare boolean values as TRUE/FALSE', () => {
      const data = { _isActive: true, _isDeleted: false };
      expect(prepareSqlValues(data)).toEqual({ _isActive: 'TRUE', _isDeleted: 'FALSE' });
    });

    it('should prepare Date values as SQL date strings', () => {
      const date = new Date('2023-01-_01T12:00:00Z');
      const data = { _createdAt: date };
      expect(prepareSqlValues(data)).toEqual({ _createdAt: "'2023-01-_01T12:00:00.000Z'" });
    });

    it('should prepare object values as JSON strings', () => {
      const data = { _metadata: { key: 'value' } };
      expect(prepareSqlValues(data)).toEqual({ _metadata: "'{\"key\":\"value\"}'" });
    });

    it('should prepare null values as NULL', () => {
      const data = { _id: 1, _name: null };
      expect(prepareSqlValues(data)).toEqual({ _id: '1', _name: 'NULL' });
    });

    it('should skip undefined values', () => {
      const data = { _id: 1, _name: undefined };
      expect(prepareSqlValues(data)).toEqual({ _id: '1' });
    });

    it('should escape single quotes in string values', () => {
      const data = { _name: "John's" };
      expect(prepareSqlValues(data)).toEqual({ _name: "'John''s'" });
    });
  });
});
