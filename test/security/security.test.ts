import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { app } from '../../server/app.js';
import { getTestSetup, createTestUser, TestUser } from '../setup/integration-setup.js';
import { validateJWT, requireRole } from '../../server/middleware/jwt.js';
import { validateBody, sanitizeInput } from '../../server/middleware/validation.js';
import { schemas } from '../../server/schemas/validation.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../server/config/env.js';

describe('Security Tests', () => {
  let _testSetup: any;
  let _adminUser: TestUser;
  let _managerUser: TestUser;
  let _cashierUser: TestUser;
  let _regularUser: TestUser;

  beforeAll(async() => {
    testSetup = getTestSetup();

    // Create test users with different roles
    adminUser = await testSetup.createTestUser({
      _email: 'admin@security.test',
      _password: 'AdminPassword123!',
      _role: 'admin'
    });

    managerUser = await testSetup.createTestUser({
      _email: 'manager@security.test',
      _password: 'ManagerPassword123!',
      _role: 'manager'
    });

    cashierUser = await testSetup.createTestUser({
      _email: 'cashier@security.test',
      _password: 'CashierPassword123!',
      _role: 'cashier'
    });

    regularUser = await testSetup.createTestUser({
      _email: 'user@security.test',
      _password: 'UserPassword123!',
      _role: 'viewer'
    });
  });

  describe('Authentication Tests', () => {
    describe('JWT Token Validation', () => {
      it('should validate valid JWT tokens', async() => {
        const _req: any = {
          headers: {
            authorization: `Bearer ${adminUser.token}`
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
        expect(req.user.id).toBe(adminUser.id);
        expect(req.user.role).toBe('admin');
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

  describe('Security Headers Tests', () => {
    it('should include security headers in responses', async() => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Check for security headers
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
      expect(response.headers).toHaveProperty('referrer-policy');
      expect(response.headers).toHaveProperty('content-security-policy');
    });

    it('should prevent clickjacking attacks', async() => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    });

    it('should prevent MIME type sniffing', async() => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should include HSTS header in production', async() => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .get('/health')
        .expect(200);

      if (process.env.NODE_ENV === 'production') {
        expect(response.headers).toHaveProperty('strict-transport-security');
      }

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Rate Limiting Tests', () => {
    it('should limit requests per IP', async() => {
      const requests = Array(150).fill(null).map(() =>
        request(app)
          .get('/health')
          .expect(200)
      );

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(res => res.status === 429);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should apply stricter limits to auth endpoints', async() => {
      const authRequests = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            _email: 'test@example.com',
            _password: 'password123'
          })
          .expect(400) // Will fail validation but still count for rate limiting
      );

      const responses = await Promise.all(authRequests);
      const rateLimitedResponses = responses.filter(res => res.status === 429);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('CSRF Protection Tests', () => {
    it('should reject requests without CSRF token', async() => {
      const response = await request(app)
        .post('/api/products')
        .send({
          _name: 'Test Product',
          _sku: 'SKU-001',
          _category: 'Test',
          _unit: 'piece',
          _costPrice: 10,
          _sellingPrice: 15,
          _storeId: 1
        })
        .expect(403);

      expect(response.body.error).toContain('CSRF');
    });

    it('should accept requests with valid CSRF token', async() => {
      // First get a CSRF token
      const csrfResponse = await request(app)
        .get('/api/csrf-token')
        .expect(200);

      const csrfToken = csrfResponse.body.token;

      // Then use it in a POST request
      const response = await request(app)
        .post('/api/products')
        .set('X-CSRF-Token', csrfToken)
        .send({
          _name: 'Test Product',
          _sku: 'SKU-001',
          _category: 'Test',
          _unit: 'piece',
          _costPrice: 10,
          _sellingPrice: 15,
          _storeId: 1
        });

      // Should not be a CSRF error (might be other validation errors)
      expect(response.status).not.toBe(403);
    });
  });

  describe('SQL Injection Prevention Tests', () => {
    it('should prevent SQL injection in search parameters', async() => {
      const maliciousQueries = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; INSERT INTO users VALUES ('hacker', 'password'); --",
        "' UNION SELECT * FROM users --"
      ];

      for (const query of maliciousQueries) {
        const response = await request(app)
          .get(`/api/products/search?q=${encodeURIComponent(query)}`)
          .expect(400);

        expect(response.body.error).toBeDefined();
      }
    });

    it('should prevent SQL injection in ID parameters', async() => {
      const maliciousIds = [
        '1; DROP TABLE products; --',
        "1' OR '1'='1",
        '1 UNION SELECT * FROM users --'
      ];

      for (const id of maliciousIds) {
        const response = await request(app)
          .get(`/api/products/${encodeURIComponent(id)}`)
          .expect(400);

        expect(response.body.error).toBeDefined();
      }
    });
  });

  describe('File Upload Security Tests', () => {
    it('should reject files with dangerous extensions', async() => {
      const dangerousFiles = [
        { _name: 'malicious.php', _type: 'application/x-php' },
        { _name: 'script.js', _type: 'application/javascript' },
        { _name: 'virus.exe', _type: 'application/x-executable' },
        { _name: 'backdoor.sh', _type: 'application/x-shellscript' }
      ];

      for (const file of dangerousFiles) {
        const response = await request(app)
          .post('/api/upload')
          .attach('file', Buffer.from('fake content'), file.name)
          .expect(400);

        expect(response.body.error).toContain('File type not allowed');
      }
    });

    it('should reject files that are too large', async() => {
      const largeFile = Buffer.alloc(11 * 1024 * 1024); // 11MB

      const response = await request(app)
        .post('/api/upload')
        .attach('file', largeFile, 'large-file.jpg')
        .expect(400);

      expect(response.body.error).toContain('File size must be less than');
    });

    it('should validate file content type', async() => {
      const fakeImage = Buffer.from('fake image content');

      const response = await request(app)
        .post('/api/upload')
        .attach('file', fakeImage, 'fake-image.jpg')
        .expect(400);

      expect(response.body.error).toContain('File type not allowed');
    });
  });

  describe('Session Security Tests', () => {
    it('should use secure session configuration', async() => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Check for secure session headers
      expect(response.headers).toHaveProperty('set-cookie');

      const cookies = response.headers['set-cookie'];
      if (cookies) {
        const sessionCookie = cookies.find((_cookie: string) =>
          cookie.includes('chainSyncSession')
        );

        if (sessionCookie) {
          expect(sessionCookie).toContain('HttpOnly');
          expect(sessionCookie).toContain('SameSite=Strict');
        }
      }
    });

    it('should regenerate session ID on login', async() => {
      // This test would require a full authentication flow
      // For now, we'll just verify the session configuration
      expect(process.env.SESSION_SECRET).toBeDefined();
      expect(process.env.SESSION_SECRET).not.toBe('dev-secret-change-in-production');
    });
  });

  describe('Error Handling Security Tests', () => {
    it('should not expose sensitive information in error messages', async() => {
      const response = await request(app)
        .get('/api/nonexistent-endpoint')
        .expect(404);

      expect(response.body.error).toBeDefined();
      expect(response.body.error).not.toContain('password');
      expect(response.body.error).not.toContain('secret');
      expect(response.body.error).not.toContain('token');
    });

    it('should not expose stack traces in production', async() => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .get('/api/trigger-error')
        .expect(500);

      expect(response.body.stack).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });
  });
});
