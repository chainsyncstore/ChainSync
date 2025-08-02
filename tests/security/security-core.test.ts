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
      it('should validate valid JWT tokens', async() => {
        const testUser = {
          _id: '1',
          _email: 'test@example.com',
          _role: 'admin'
        };

        const token = generateJWT(testUser);

        const _req: any = {
          headers: {
            authorization: `Bearer ${token}`
          }
        };
        const _res: any = {
          _status: jest.fn().mockReturnThis(),
          _json: jest.fn().mockReturnThis()
        };
        const next = jest.fn();

        await validateJWT(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.user).toBeDefined();
        expect(req.user.id).toBe(testUser.id);
        expect(req.user.role).toBe(testUser.role);
      });

      it('should reject requests without authorization header', async() => {
        const _req: any = { headers: {} };
        const _res: any = {
          _status: jest.fn().mockReturnThis(),
          _json: jest.fn().mockReturnThis()
        };
        const next = jest.fn();

        await validateJWT(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          _error: 'Access token required',
          _code: 'MISSING_TOKEN'
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should reject requests with invalid token format', async() => {
        const _req: any = {
          headers: {
            authorization: 'InvalidToken'
          }
        };
        const _res: any = {
          _status: jest.fn().mockReturnThis(),
          _json: jest.fn().mockReturnThis()
        };
        const next = jest.fn();

        await validateJWT(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          _error: 'Access token required',
          _code: 'MISSING_TOKEN'
        });
      });

      it('should reject expired tokens', async() => {
        const expiredToken = jwt.sign(
          { _id: '1', _email: 'test@example.com', _role: 'admin' },
          env.JWT_SECRET,
          { _expiresIn: '-1h' }
        );

        const _req: any = {
          headers: {
            authorization: `Bearer ${expiredToken}`
          }
        };
        const _res: any = {
          _status: jest.fn().mockReturnThis(),
          _json: jest.fn().mockReturnThis()
        };
        const next = jest.fn();

        await validateJWT(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          _error: 'Invalid or expired token',
          _code: 'INVALID_TOKEN'
        });
      });

      it('should reject tokens with invalid signature', async() => {
        const invalidToken = jwt.sign(
          { _id: '1', _email: 'test@example.com', _role: 'admin' },
          'wrong-secret',
          { _expiresIn: '1h' }
        );

        const _req: any = {
          headers: {
            authorization: `Bearer ${invalidToken}`
          }
        };
        const _res: any = {
          _status: jest.fn().mockReturnThis(),
          _json: jest.fn().mockReturnThis()
        };
        const next = jest.fn();

        await validateJWT(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          _error: 'Invalid or expired token',
          _code: 'INVALID_TOKEN'
        });
      });
    });

    describe('Password Security', () => {
      it('should hash passwords correctly', async() => {
        const password = 'TestPassword123!';
        const hashedPassword = await bcrypt.hash(password, 10);

        expect(hashedPassword).not.toBe(password);
        expect(hashedPassword).toHaveLength(60); // bcrypt hash length

        const isValid = await bcrypt.compare(password, hashedPassword);
        expect(isValid).toBe(true);
      });

      it('should validate password strength', async() => {
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
            _email: 'test@example.com',
            _password: weakPassword,
            _confirmPassword: weakPassword,
            _firstName: 'Test',
            _lastName: 'User'
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
          _email: 'test@example.com',
          _password: strongPassword,
          _confirmPassword: strongPassword,
          _firstName: 'Test',
          _lastName: 'User'
        });

        expect(result.success).toBe(true);
      });
    });
  });

  describe('Authorization Tests', () => {
    describe('Role-Based Access Control', () => {
      it('should allow admin access to admin-only endpoints', async() => {
        const _req: any = {
          user: { id: '1', _role: 'admin', _email: 'admin@test.com' }
        };
        const _res: any = {
          _status: jest.fn().mockReturnThis(),
          _json: jest.fn().mockReturnThis()
        };
        const next = jest.fn();

        const adminMiddleware = requireRole(['admin']);
        await adminMiddleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should deny non-admin access to admin-only endpoints', async() => {
        const _req: any = {
          user: { id: '1', _role: 'cashier', _email: 'cashier@test.com' }
        };
        const _res: any = {
          _status: jest.fn().mockReturnThis(),
          _json: jest.fn().mockReturnThis()
        };
        const next = jest.fn();

        const adminMiddleware = requireRole(['admin']);
        await adminMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
          _error: 'Access denied. Required _roles: admin',
          _code: 'FORBIDDEN'
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should allow manager access to manager endpoints', async() => {
        const _req: any = {
          user: { id: '1', _role: 'manager', _email: 'manager@test.com' }
        };
        const _res: any = {
          _status: jest.fn().mockReturnThis(),
          _json: jest.fn().mockReturnThis()
        };
        const next = jest.fn();

        const managerMiddleware = requireRole(['admin', 'manager']);
        await managerMiddleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should deny unauthorized access when no user is present', async() => {
        const _req: any = {};
        const _res: any = {
          _status: jest.fn().mockReturnThis(),
          _json: jest.fn().mockReturnThis()
        };
        const next = jest.fn();

        const adminMiddleware = requireRole(['admin']);
        await adminMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          _error: 'Authentication required',
          _code: 'UNAUTHORIZED'
        });
        expect(next).not.toHaveBeenCalled();
      });
    });
  });

  describe('Input Validation Tests', () => {
    describe('Request Body Validation', () => {
      it('should validate user registration data', async() => {
        const validData = {
          _email: 'test@example.com',
          _password: 'ValidPassword123!',
          _confirmPassword: 'ValidPassword123!',
          _firstName: 'John',
          _lastName: 'Doe'
        };

        const result = schemas.userRegistration.safeParse(validData);
        expect(result.success).toBe(true);

        const invalidData = {
          _email: 'invalid-email',
          _password: 'weak',
          _confirmPassword: 'weak',
          _firstName: 'J',
          _lastName: 'D'
        };

        const invalidResult = schemas.userRegistration.safeParse(invalidData);
        expect(invalidResult.success).toBe(false);
      });

      it('should validate product creation data', async() => {
        const validData = {
          _name: 'Test Product',
          _sku: 'SKU-001',
          _category: 'Electronics',
          _unit: 'piece',
          _costPrice: 10.00,
          _sellingPrice: 15.00,
          _storeId: 1
        };

        const result = schemas.productCreate.safeParse(validData);
        expect(result.success).toBe(true);

        const invalidData = {
          _name: '', // Empty name
          _sku: 'SK', // Too short
          _costPrice: -10, // Negative price
          _sellingPrice: 0 // Zero price
        };

        const invalidResult = schemas.productCreate.safeParse(invalidData);
        expect(invalidResult.success).toBe(false);
      });

      it('should validate transaction data', async() => {
        const validData = {
          _items: [
            {
              _productId: 1,
              _quantity: 2,
              _unitPrice: 10.00,
              _discount: 0
            }
          ],
          _paymentMethod: 'cash',
          _totalAmount: 20.00,
          _taxAmount: 2.00,
          _discountAmount: 0,
          _storeId: 1
        };

        const result = schemas.transactionCreate.safeParse(validData);
        expect(result.success).toBe(true);

        const invalidData = {
          _items: [], // Empty items array
          _paymentMethod: 'invalid_method',
          _totalAmount: -10 // Negative amount
        };

        const invalidResult = schemas.transactionCreate.safeParse(invalidData);
        expect(invalidResult.success).toBe(false);
      });
    });

    describe('Input Sanitization', () => {
      it('should sanitize XSS attempts', async() => {
        const _req: any = {
          body: {
            name: '<script>alert("xss")</script>',
            _description: '_javascript:alert("xss")',
            _email: 'test@example.com<script>alert("xss")</script>'
          },
          _query: {
            search: '<img src="x" onerror="alert(\'xss\')">'
          },
          _params: {
            id: '123<script>alert("xss")</script>'
          }
        };
        const _res: any = {
          _status: jest.fn().mockReturnThis(),
          _json: jest.fn().mockReturnThis()
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

      it('should handle non-string values correctly', async() => {
        const _req: any = {
          body: {
            _number: 123,
            _boolean: true,
            _array: [1, 2, 3],
            _object: { key: 'value' },
            _null: null
          }
        };
        const _res: any = {
          _status: jest.fn().mockReturnThis(),
          _json: jest.fn().mockReturnThis()
        };
        const next = jest.fn();

        await sanitizeInput(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.body.number).toBe(123);
        expect(req.body.boolean).toBe(true);
        expect(req.body.array).toEqual([1, 2, 3]);
        expect(req.body.object).toEqual({ _key: 'value' });
        expect(req.body.null).toBe(null);
      });
    });
  });

  describe('Schema Validation Tests', () => {
    it('should validate email format', async() => {
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
          _password: 'password123'
        });
        expect(result.success).toBe(true);
      }

      for (const email of invalidEmails) {
        const result = schemas.userLogin.safeParse({
          email,
          _password: 'password123'
        });
        expect(result.success).toBe(false);
      }
    });

    it('should validate phone number format', async() => {
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
          _firstName: 'John',
          _lastName: 'Doe',
          phone,
          _storeId: 1
        });
        expect(result.success).toBe(true);
      }

      for (const phone of invalidPhones) {
        const result = schemas.customerCreate.safeParse({
          _firstName: 'John',
          _lastName: 'Doe',
          phone,
          _storeId: 1
        });
        expect(result.success).toBe(false);
      }
    });

    it('should validate UUID format', async() => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const invalidUuid = 'invalid-uuid';

      const result1 = schemas.baseId.safeParse({ _id: validUuid });
      expect(result1.success).toBe(true);

      const result2 = schemas.baseId.safeParse({ _id: invalidUuid });
      expect(result2.success).toBe(false);
    });

    it('should validate pagination parameters', async() => {
      const validPagination = {
        _page: 1,
        _limit: 20,
        _sortBy: 'createdAt',
        _sortOrder: 'desc'
      };

      const invalidPagination = {
        _page: 0, // _Invalid: must be >= 1
        _limit: 200, // _Invalid: must be <= 100
        sortOrder: 'invalid' // _Invalid: must be 'asc' or 'desc'
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
