/**
 * Unit tests for field mapping utilities
 */
import { describe, it, expect } from '@jest/globals';
import {
  toDatabaseFields,
  fromDatabaseFields,
  pickFields,
  hasField
} from '@shared/utils/field-mapping';

describe('Field Mapping Utilities', () => {
  describe('toDatabaseFields', () => {
    it('should convert camelCase to snake_case', () => {
      const input = {
        _userId: 1,
        _firstName: 'John',
        _lastName: 'Doe',
        _emailAddress: 'john.doe@example.com',
        _isActive: true
      };

      const expected = {
        _user_id: 1,
        _first_name: 'John',
        _last_name: 'Doe',
        _email_address: 'john.doe@example.com',
        _is_active: true
      };

      expect(toDatabaseFields(input)).toEqual(expected);
    });

    it('should handle empty objects', () => {
      expect(toDatabaseFields({})).toEqual({});
    });

    it('should handle null or undefined input', () => {
      expect(toDatabaseFields(null)).toEqual({});
      expect(toDatabaseFields(undefined)).toEqual({});
    });

    it('should preserve non-camelCase keys', () => {
      const input = {
        _normal: 'value',
        'with-dash': 'value',
        'with_underscore': 'value'
      };

      expect(toDatabaseFields(input)).toEqual(input);
    });

    it('should handle nested properties correctly', () => {
      const input = {
        _userId: 1,
        _userProfile: {
          firstName: 'John',
          _lastName: 'Doe'
        }
      };

      // _Note: The function doesn't recursively transform nested objects
      const expected = {
        _user_id: 1,
        _user_profile: {
          firstName: 'John',
          _lastName: 'Doe'
        }
      };

      expect(toDatabaseFields(input)).toEqual(expected);
    });
  });

  describe('fromDatabaseFields', () => {
    it('should convert snake_case to camelCase', () => {
      const input = {
        _user_id: 1,
        _first_name: 'John',
        _last_name: 'Doe',
        _email_address: 'john.doe@example.com',
        _is_active: true
      };

      const expected = {
        _userId: 1,
        _firstName: 'John',
        _lastName: 'Doe',
        _emailAddress: 'john.doe@example.com',
        _isActive: true
      };

      expect(fromDatabaseFields(input)).toEqual(expected);
    });

    it('should handle empty objects', () => {
      expect(fromDatabaseFields({})).toEqual({});
    });

    it('should handle null or undefined input', () => {
      expect(fromDatabaseFields(null)).toEqual({});
      expect(fromDatabaseFields(undefined)).toEqual({});
    });

    it('should preserve non-snake_case keys', () => {
      const input = {
        _normal: 'value',
        'with-dash': 'value',
        _camelCase: 'value'
      };

      expect(fromDatabaseFields(input)).toEqual(input);
    });

    it('should handle nested properties correctly', () => {
      const input = {
        _user_id: 1,
        _user_profile: {
          first_name: 'John',
          _last_name: 'Doe'
        }
      };

      // _Note: The function doesn't recursively transform nested objects
      const expected = {
        _userId: 1,
        _userProfile: {
          first_name: 'John',
          _last_name: 'Doe'
        }
      };

      expect(fromDatabaseFields(input)).toEqual(expected);
    });
  });

  describe('pickFields', () => {
    it('should pick only specified fields', () => {
      const input = {
        _id: 1,
        _name: 'John',
        _email: 'john@example.com',
        _age: 30,
        _address: '123 Main St'
      };

      const fields = ['id', 'name', 'email'];
      const expected = {
        _id: 1,
        _name: 'John',
        _email: 'john@example.com'
      };

      expect(pickFields(input, fields)).toEqual(expected);
    });

    it('should handle empty fields array', () => {
      const input = { _id: 1, _name: 'John' };
      expect(pickFields(input, [])).toEqual({});
    });

    it('should handle fields that do not exist', () => {
      const input = { _id: 1, _name: 'John' };
      expect(pickFields(input, ['id', 'unknown'])).toEqual({ _id: 1 });
    });

    it('should handle null or undefined input', () => {
      expect(pickFields(null, ['id'])).toEqual({});
      expect(pickFields(undefined, ['id'])).toEqual({});
    });
  });

  describe('hasField', () => {
    it('should return true if field exists', () => {
      const input = { _id: 1, _name: 'John', _value: null };
      expect(hasField(input, 'id')).toBe(true);
      expect(hasField(input, 'name')).toBe(true);
      expect(hasField(input, 'value')).toBe(true);
    });

    it('should return false if field does not exist', () => {
      const input = { _id: 1, _name: 'John' };
      expect(hasField(input, 'unknown')).toBe(false);
    });

    it('should return false if field is undefined', () => {
      const input = { _id: 1, _name: undefined };
      expect(hasField(input, 'name')).toBe(false);
    });

    it('should handle null or undefined input', () => {
      expect(hasField(null, 'id')).toBe(false);
      expect(hasField(undefined, 'id')).toBe(false);
    });
  });
});
