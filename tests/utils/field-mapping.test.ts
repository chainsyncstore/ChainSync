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
        userId: 1,
        firstName: 'John',
        lastName: 'Doe',
        emailAddress: 'john.doe@example.com',
        isActive: true
      };
      
      const expected = {
        user_id: 1,
        first_name: 'John',
        last_name: 'Doe',
        email_address: 'john.doe@example.com',
        is_active: true
      };
      
      expect(toDatabaseFields(input)).toEqual(expected);
    });
    
    it('should handle empty objects', () => {
      expect(toDatabaseFields({})).toEqual({});
    });
    
    it('should handle null or undefined input', () => {
      expect(toDatabaseFields(null as any)).toEqual({});
      expect(toDatabaseFields(undefined as any)).toEqual({});
    });
    
    it('should preserve non-camelCase keys', () => {
      const input = {
        normal: 'value',
        'with-dash': 'value',
        'with_underscore': 'value'
      };
      
      expect(toDatabaseFields(input)).toEqual(input);
    });
    
    it('should handle nested properties correctly', () => {
      const input = {
        userId: 1,
        userProfile: {
          firstName: 'John',
          lastName: 'Doe'
        }
      };
      
      // Note: The function doesn't recursively transform nested objects
      const expected = {
        user_id: 1,
        user_profile: {
          firstName: 'John',
          lastName: 'Doe'
        }
      };
      
      expect(toDatabaseFields(input)).toEqual(expected);
    });
  });
  
  describe('fromDatabaseFields', () => {
    it('should convert snake_case to camelCase', () => {
      const input = {
        user_id: 1,
        first_name: 'John',
        last_name: 'Doe',
        email_address: 'john.doe@example.com',
        is_active: true
      };
      
      const expected = {
        userId: 1,
        firstName: 'John',
        lastName: 'Doe',
        emailAddress: 'john.doe@example.com',
        isActive: true
      };
      
      expect(fromDatabaseFields(input)).toEqual(expected);
    });
    
    it('should handle empty objects', () => {
      expect(fromDatabaseFields({})).toEqual({});
    });
    
    it('should handle null or undefined input', () => {
      expect(fromDatabaseFields(null as any)).toEqual({});
      expect(fromDatabaseFields(undefined as any)).toEqual({});
    });
    
    it('should preserve non-snake_case keys', () => {
      const input = {
        normal: 'value',
        'with-dash': 'value',
        camelCase: 'value'
      };
      
      expect(fromDatabaseFields(input)).toEqual(input);
    });
    
    it('should handle nested properties correctly', () => {
      const input = {
        user_id: 1,
        user_profile: {
          first_name: 'John',
          last_name: 'Doe'
        }
      };
      
      // Note: The function doesn't recursively transform nested objects
      const expected = {
        userId: 1,
        userProfile: {
          first_name: 'John',
          last_name: 'Doe'
        }
      };
      
      expect(fromDatabaseFields(input)).toEqual(expected);
    });
  });
  
  describe('pickFields', () => {
    it('should pick only specified fields', () => {
      const input = {
        id: 1,
        name: 'John',
        email: 'john@example.com',
        age: 30,
        address: '123 Main St'
      };
      
      const fields = ['id', 'name', 'email'];
      const expected = {
        id: 1,
        name: 'John',
        email: 'john@example.com'
      };
      
      expect(pickFields(input, fields as any)).toEqual(expected);
    });
    
    it('should handle empty fields array', () => {
      const input = { id: 1, name: 'John' };
      expect(pickFields(input, [])).toEqual({});
    });
    
    it('should handle fields that do not exist', () => {
      const input = { id: 1, name: 'John' };
      expect(pickFields(input, ['id', 'unknown' as any])).toEqual({ id: 1 });
    });
    
    it('should handle null or undefined input', () => {
      expect(pickFields(null as any, ['id'])).toEqual({});
      expect(pickFields(undefined as any, ['id'])).toEqual({});
    });
  });
  
  describe('hasField', () => {
    it('should return true if field exists', () => {
      const input = { id: 1, name: 'John', value: null };
      expect(hasField(input, 'id')).toBe(true);
      expect(hasField(input, 'name')).toBe(true);
      expect(hasField(input, 'value')).toBe(true);
    });
    
    it('should return false if field does not exist', () => {
      const input = { id: 1, name: 'John' };
      expect(hasField(input, 'unknown' as any)).toBe(false);
    });
    
    it('should return false if field is undefined', () => {
      const input = { id: 1, name: undefined };
      expect(hasField(input, 'name')).toBe(false);
    });
    
    it('should handle null or undefined input', () => {
      expect(hasField(null as any, 'id')).toBe(false);
      expect(hasField(undefined as any, 'id')).toBe(false);
    });
  });
});
