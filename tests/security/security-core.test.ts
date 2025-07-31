import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { validateJWT, requireRole, generateJWT } from '../../server/middleware/jwt';
import { validateBody, sanitizeInput } from '../../server/middleware/validation';
import { schemas } from '../../server/schemas/validation';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../server/config/env';

describe('Core Security Tests', () => {
  describe('Authentication Tests', () => {
    describe('JWT Token Validation', () => {
      it('should validate valid JWT tokens', async () => {
        const testUser = {
          id: '1',
          email: 'test@example.com',
          role: 'admin'
        };

        const token = generateJWT(testUser);

        const req: any = {
          headers: {
            authorization: `Bearer ${token}`
          }
        };
        const res: any = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis()
        };
        const next = jest.fn();

        await validateJWT(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.user).toBeDefined();
        expect(req.user.id).toBe(testUser.id);
        expect(req.user.role).toBe(testUser.role);
      });

      it('should reject requests without authorization header', async () => {
        const req: any = { headers: {} };
        const res: any = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis()
        };
        const next = jest.fn();

        await validateJWT(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Access token required',
          code: 'MISSING_TOKEN'
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should reject requests with invalid token format', async () => {
        const req: any = {
          headers: {
            authorization: 'InvalidToken'
          }
        };
        const res: any = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis()
        };
        const next = jest.fn();

        await validateJWT(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Access token required',
          code: 'MISSING_TOKEN'
        });
      });

      it('should reject expired tokens', async () => {
        const expiredToken = jwt.sign(
          { id: '1', email: 'test@example.com', role: 'admin' },
          env.JWT_SECRET,
          { expiresIn: '-1h' }
        );

        const req: any = {
          headers: {
            authorization: `Bearer ${expiredToken}`
          }
        };
        const res: any = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis()
        };
        const next = jest.fn();

        await validateJWT(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Invalid or expired token',
          code: 'INVALID_TOKEN'
        });
      });

      it('should reject tokens with invalid signature', async () => {
        const invalidToken = jwt.sign(
          { id: '1', email: 'test@example.com', role: 'admin' },
          'wrong-secret',
          { expiresIn: '1h' }
        );

        const req: any = {
          headers: {
            authorization: `Bearer ${invalidToken}`
          }
        };
        const res: any = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis()
        };
        const next = jest.fn();

        await validateJWT(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Invalid or expired token',
          code: 'INVALID_TOKEN'
        });
      });
    });

    describe('Password Security', () => {
      it('should hash passwords correctly', async () => {
        const password = 'TestPassword123!';
        const hashedPassword = await bcrypt.hash(password, 10);

        expect(hashedPassword).not.toBe(password);
        expect(hashedPassword).toHaveLength(60); // bcrypt hash length

        const isValid = await bcrypt.compare(password, hashedPassword);
        expect(isValid).toBe(true);
      });

      it('should validate password strength', async () => {
        const weakPasswords = [
          '123456',
          'password',
          'abc123',
          'qwerty',
          'test'
        ];

        const strongPassword = 'StrongPassword123!';

        // Test weak passwords
        for (const weakPassword of weakPasswords) {
          const result = schemas.userRegistration.safeParse({
            email: 'test@example.com',
            password: weakPassword,
            confirmPassword: weakPassword,
            firstName: 'Test',
            lastName: 'User'
          });

          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some(issue => 
              issue.path.includes('password')
            )).toBe(true);
          }
        }

        // Test strong password
        const result = schemas.userRegistration.safeParse({
          email: 'test@example.com',
          password: strongPassword,
          confirmPassword: strongPassword,
          firstName: 'Test',
          lastName: 'User'
        });

        expect(result.success).toBe(true);
      });
    });
  });

  describe('Authorization Tests', () => {
    describe('Role-Based Access Control', () => {
      it('should allow admin access to admin-only endpoints', async () => {
        const req: any = {
          user: { id: '1', role: 'admin', email: 'admin@test.com' }
        };
        const res: any = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis()
        };
        const next = jest.fn();

        const adminMiddleware = requireRole(['admin']);
        await adminMiddleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should deny non-admin access to admin-only endpoints', async () => {
        const req: any = {
          user: { id: '1', role: 'cashier', email: 'cashier@test.com' }
        };
        const res: any = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis()
        };
        const next = jest.fn();

        const adminMiddleware = requireRole(['admin']);
        await adminMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Access denied. Required roles: admin',
          code: 'FORBIDDEN'
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should allow manager access to manager endpoints', async () => {
        const req: any = {
          user: { id: '1', role: 'manager', email: 'manager@test.com' }
        };
        const res: any = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis()
        };
        const next = jest.fn();

        const managerMiddleware = requireRole(['admin', 'manager']);
        await managerMiddleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should deny unauthorized access when no user is present', async () => {
        const req: any = {};
        const res: any = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis()
        };
        const next = jest.fn();

        const adminMiddleware = requireRole(['admin']);
        await adminMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Authentication required',
          code: 'UNAUTHORIZED'
        });
        expect(next).not.toHaveBeenCalled();
      });
    });
  });

  describe('Input Validation Tests', () => {
    describe('Request Body Validation', () => {
      it('should validate user registration data', async () => {
        const validData = {
          email: 'test@example.com',
          password: 'ValidPassword123!',
          confirmPassword: 'ValidPassword123!',
          firstName: 'John',
          lastName: 'Doe'
        };

        const result = schemas.userRegistration.safeParse(validData);
        expect(result.success).toBe(true);

        const invalidData = {
          email: 'invalid-email',
          password: 'weak',
          confirmPassword: 'weak',
          firstName: 'J',
          lastName: 'D'
        };

        const invalidResult = schemas.userRegistration.safeParse(invalidData);
        expect(invalidResult.success).toBe(false);
      });

      it('should validate product creation data', async () => {
        const validData = {
          name: 'Test Product',
          sku: 'SKU-001',
          category: 'Electronics',
          unit: 'piece',
          costPrice: 10.00,
          sellingPrice: 15.00,
          storeId: 1
        };

        const result = schemas.productCreate.safeParse(validData);
        expect(result.success).toBe(true);

        const invalidData = {
          name: '', // Empty name
          sku: 'SK', // Too short
          costPrice: -10, // Negative price
          sellingPrice: 0 // Zero price
        };

        const invalidResult = schemas.productCreate.safeParse(invalidData);
        expect(invalidResult.success).toBe(false);
      });

      it('should validate transaction data', async () => {
        const validData = {
          items: [
            {
              productId: 1,
              quantity: 2,
              unitPrice: 10.00,
              discount: 0
            }
          ],
          paymentMethod: 'cash',
          totalAmount: 20.00,
          taxAmount: 2.00,
          discountAmount: 0,
          storeId: 1
        };

        const result = schemas.transactionCreate.safeParse(validData);
        expect(result.success).toBe(true);

        const invalidData = {
          items: [], // Empty items array
          paymentMethod: 'invalid_method',
          totalAmount: -10 // Negative amount
        };

        const invalidResult = schemas.transactionCreate.safeParse(invalidData);
        expect(invalidResult.success).toBe(false);
      });
    });

    describe('Input Sanitization', () => {
      it('should sanitize XSS attempts', async () => {
        const req: any = {
          body: {
            name: '<script>alert("xss")</script>',
            description: 'javascript:alert("xss")',
            email: 'test@example.com<script>alert("xss")</script>'
          },
          query: {
            search: '<img src="x" onerror="alert(\'xss\')">'
          },
          params: {
            id: '123<script>alert("xss")</script>'
          }
        };
        const res: any = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis()
        };
        const next = jest.fn();

        await sanitizeInput(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.body.name).toBe('alert("xss")');
        expect(req.body.description).toBe('alert("xss")');
        expect(req.body.email).toBe('test@example.comalert("xss")');
        expect(req.query.search).toBe('alert(\'xss\')');
        expect(req.params.id).toBe('123alert("xss")');
      });

      it('should handle non-string values correctly', async () => {
        const req: any = {
          body: {
            number: 123,
            boolean: true,
            array: [1, 2, 3],
            object: { key: 'value' },
            null: null
          }
        };
        const res: any = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis()
        };
        const next = jest.fn();

        await sanitizeInput(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.body.number).toBe(123);
        expect(req.body.boolean).toBe(true);
        expect(req.body.array).toEqual([1, 2, 3]);
        expect(req.body.object).toEqual({ key: 'value' });
        expect(req.body.null).toBe(null);
      });
    });
  });

  describe('Schema Validation Tests', () => {
    it('should validate email format', async () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org'
      ];

      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user.example.com'
      ];

      for (const email of validEmails) {
        const result = schemas.userLogin.safeParse({
          email,
          password: 'password123'
        });
        expect(result.success).toBe(true);
      }

      for (const email of invalidEmails) {
        const result = schemas.userLogin.safeParse({
          email,
          password: 'password123'
        });
        expect(result.success).toBe(false);
      }
    });

    it('should validate phone number format', async () => {
      const validPhones = [
        '+1234567890',
        '+1 (234) 567-8900',
        '123-456-7890',
        '+44 20 7946 0958'
      ];

      const invalidPhones = [
        '123',
        'abc',
        '+',
        ''
      ];

      for (const phone of validPhones) {
        const result = schemas.customerCreate.safeParse({
          firstName: 'John',
          lastName: 'Doe',
          phone,
          storeId: 1
        });
        expect(result.success).toBe(true);
      }

      for (const phone of invalidPhones) {
        const result = schemas.customerCreate.safeParse({
          firstName: 'John',
          lastName: 'Doe',
          phone,
          storeId: 1
        });
        expect(result.success).toBe(false);
      }
    });

    it('should validate UUID format', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const invalidUuid = 'invalid-uuid';

      const result1 = schemas.baseId.safeParse({ id: validUuid });
      expect(result1.success).toBe(true);

      const result2 = schemas.baseId.safeParse({ id: invalidUuid });
      expect(result2.success).toBe(false);
    });

    it('should validate pagination parameters', async () => {
      const validPagination = {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      };

      const invalidPagination = {
        page: 0, // Invalid: must be >= 1
        limit: 200, // Invalid: must be <= 100
        sortOrder: 'invalid' // Invalid: must be 'asc' or 'desc'
      };

      const result1 = schemas.pagination.safeParse(validPagination);
      expect(result1.success).toBe(true);

      const result2 = schemas.pagination.safeParse(invalidPagination);
      expect(result2.success).toBe(false);
    });
  });

  describe('Security Configuration Tests', () => {
    it('should have required environment variables', () => {
      expect(env.JWT_SECRET).toBeDefined();
      expect(env.JWT_SECRET).not.toBe('');
      expect(env.SESSION_SECRET).toBeDefined();
      expect(env.SESSION_SECRET).not.toBe('');
    });

    it('should have secure JWT configuration', () => {
      expect(env.JWT_EXPIRES_IN).toBeDefined();
      expect(env.REFRESH_TOKEN_EXPIRES_IN).toBeDefined();
    });

    it('should have rate limiting configuration', () => {
      expect(env.RATE_LIMIT_WINDOW_MS).toBeDefined();
      expect(env.RATE_LIMIT_MAX_REQUESTS).toBeDefined();
      expect(env.RATE_LIMIT_WINDOW_MS).toBeGreaterThan(0);
      expect(env.RATE_LIMIT_MAX_REQUESTS).toBeGreaterThan(0);
    });

    it('should have CORS configuration', () => {
      expect(env.ALLOWED_ORIGINS).toBeDefined();
      expect(env.ALLOWED_METHODS).toBeDefined();
      expect(env.ALLOWED_HEADERS).toBeDefined();
    });
  });
}); 