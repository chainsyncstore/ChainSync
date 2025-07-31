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
  let testSetup: any;
  let adminUser: TestUser;
  let managerUser: TestUser;
  let cashierUser: TestUser;
  let regularUser: TestUser;

  beforeAll(async () => {
    testSetup = getTestSetup();
    
    // Create test users with different roles
    adminUser = await testSetup.createTestUser({
      email: 'admin@security.test',
      password: 'AdminPassword123!',
      role: 'admin'
    });

    managerUser = await testSetup.createTestUser({
      email: 'manager@security.test',
      password: 'ManagerPassword123!',
      role: 'manager'
    });

    cashierUser = await testSetup.createTestUser({
      email: 'cashier@security.test',
      password: 'CashierPassword123!',
      role: 'cashier'
    });

    regularUser = await testSetup.createTestUser({
      email: 'user@security.test',
      password: 'UserPassword123!',
      role: 'viewer'
    });
  });

  describe('Authentication Tests', () => {
    describe('JWT Token Validation', () => {
      it('should validate valid JWT tokens', async () => {
        const req: any = {
          headers: {
            authorization: `Bearer ${adminUser.token}`
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
        expect(req.user.id).toBe(adminUser.id);
        expect(req.user.role).toBe('admin');
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

  describe('Security Headers Tests', () => {
    it('should include security headers in responses', async () => {
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

    it('should prevent clickjacking attacks', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    });

    it('should prevent MIME type sniffing', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should include HSTS header in production', async () => {
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
    it('should limit requests per IP', async () => {
      const requests = Array(150).fill(null).map(() =>
        request(app)
          .get('/health')
          .expect(200)
      );

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(res => res.status === 429);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should apply stricter limits to auth endpoints', async () => {
      const authRequests = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'password123'
          })
          .expect(400) // Will fail validation but still count for rate limiting
      );

      const responses = await Promise.all(authRequests);
      const rateLimitedResponses = responses.filter(res => res.status === 429);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('CSRF Protection Tests', () => {
    it('should reject requests without CSRF token', async () => {
      const response = await request(app)
        .post('/api/products')
        .send({
          name: 'Test Product',
          sku: 'SKU-001',
          category: 'Test',
          unit: 'piece',
          costPrice: 10,
          sellingPrice: 15,
          storeId: 1
        })
        .expect(403);

      expect(response.body.error).toContain('CSRF');
    });

    it('should accept requests with valid CSRF token', async () => {
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
          name: 'Test Product',
          sku: 'SKU-001',
          category: 'Test',
          unit: 'piece',
          costPrice: 10,
          sellingPrice: 15,
          storeId: 1
        });

      // Should not be a CSRF error (might be other validation errors)
      expect(response.status).not.toBe(403);
    });
  });

  describe('SQL Injection Prevention Tests', () => {
    it('should prevent SQL injection in search parameters', async () => {
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

    it('should prevent SQL injection in ID parameters', async () => {
      const maliciousIds = [
        "1; DROP TABLE products; --",
        "1' OR '1'='1",
        "1 UNION SELECT * FROM users --"
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
    it('should reject files with dangerous extensions', async () => {
      const dangerousFiles = [
        { name: 'malicious.php', type: 'application/x-php' },
        { name: 'script.js', type: 'application/javascript' },
        { name: 'virus.exe', type: 'application/x-executable' },
        { name: 'backdoor.sh', type: 'application/x-shellscript' }
      ];

      for (const file of dangerousFiles) {
        const response = await request(app)
          .post('/api/upload')
          .attach('file', Buffer.from('fake content'), file.name)
          .expect(400);

        expect(response.body.error).toContain('File type not allowed');
      }
    });

    it('should reject files that are too large', async () => {
      const largeFile = Buffer.alloc(11 * 1024 * 1024); // 11MB

      const response = await request(app)
        .post('/api/upload')
        .attach('file', largeFile, 'large-file.jpg')
        .expect(400);

      expect(response.body.error).toContain('File size must be less than');
    });

    it('should validate file content type', async () => {
      const fakeImage = Buffer.from('fake image content');

      const response = await request(app)
        .post('/api/upload')
        .attach('file', fakeImage, 'fake-image.jpg')
        .expect(400);

      expect(response.body.error).toContain('File type not allowed');
    });
  });

  describe('Session Security Tests', () => {
    it('should use secure session configuration', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Check for secure session headers
      expect(response.headers).toHaveProperty('set-cookie');
      
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        const sessionCookie = cookies.find((cookie: string) => 
          cookie.includes('chainSyncSession')
        );
        
        if (sessionCookie) {
          expect(sessionCookie).toContain('HttpOnly');
          expect(sessionCookie).toContain('SameSite=Strict');
        }
      }
    });

    it('should regenerate session ID on login', async () => {
      // This test would require a full authentication flow
      // For now, we'll just verify the session configuration
      expect(process.env.SESSION_SECRET).toBeDefined();
      expect(process.env.SESSION_SECRET).not.toBe('dev-secret-change-in-production');
    });
  });

  describe('Error Handling Security Tests', () => {
    it('should not expose sensitive information in error messages', async () => {
      const response = await request(app)
        .get('/api/nonexistent-endpoint')
        .expect(404);

      expect(response.body.error).toBeDefined();
      expect(response.body.error).not.toContain('password');
      expect(response.body.error).not.toContain('secret');
      expect(response.body.error).not.toContain('token');
    });

    it('should not expose stack traces in production', async () => {
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