import request from 'supertest';
import { app } from '../../server/app';
import { setupTestDatabase, teardownTestDatabase } from '../setup/integration-setup';

describe('Security Tests', () => {
  let testDb: any;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase(testDb);
  });

  describe('Authentication Security', () => {
    it('should prevent brute force attacks', async () => {
      const loginAttempts = [];
      
      // Attempt multiple failed logins
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword'
          });
        
        loginAttempts.push(response.status);
      }

      // Should start blocking after 5 attempts
      const blockedAttempts = loginAttempts.filter(status => status === 429);
      expect(blockedAttempts.length).toBeGreaterThan(0);
    });

    it('should enforce strong password requirements', async () => {
      const weakPasswords = [
        '123',
        'password',
        'abc123',
        'qwerty',
        '123456789'
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            password: password,
            name: 'Test User'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('password');
      }
    });

    it('should prevent SQL injection in login', async () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; INSERT INTO users VALUES ('hacker', 'password'); --",
        "' UNION SELECT * FROM users --"
      ];

      for (const attempt of sqlInjectionAttempts) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: attempt,
            password: 'password'
          });

        expect(response.status).toBe(400);
      }
    });

    it('should validate JWT tokens properly', async () => {
      const invalidTokens = [
        'invalid.token.here',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        'expired.token.here',
        ''
      ];

      for (const token of invalidTokens) {
        const response = await request(app)
          .get('/api/auth/profile')
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(401);
      }
    });
  });

  describe('Authorization Security', () => {
    it('should prevent unauthorized access to admin endpoints', async () => {
      // Register regular user
      const userResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'user@example.com',
          password: 'UserPassword123!',
          name: 'Regular User'
        });

      const userToken = userResponse.body.token;

      // Try to access admin endpoints
      const adminEndpoints = [
        '/api/admin/users',
        '/api/admin/analytics',
        '/api/admin/system-settings',
        '/api/admin/logs'
      ];

      for (const endpoint of adminEndpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(403);
      }
    });

    it('should prevent user data access by other users', async () => {
      // Create two users
      const user1Response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'user1@example.com',
          password: 'User1Password123!',
          name: 'User 1'
        });

      const user2Response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'user2@example.com',
          password: 'User2Password123!',
          name: 'User 2'
        });

      const user1Token = user1Response.body.token;
      const user2Id = user2Response.body.user.id;

      // User 1 tries to access User 2's data
      const response = await request(app)
        .get(`/api/users/${user2Id}/profile`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(403);
    });

    it('should validate resource ownership', async () => {
      // Create user and payment
      const userResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'owner@example.com',
          password: 'OwnerPassword123!',
          name: 'Resource Owner'
        });

      const userToken = userResponse.body.token;

      // Create payment for user
      const paymentResponse = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          amount: 100,
          currency: 'USD',
          paymentMethod: 'credit_card'
        });

      const paymentId = paymentResponse.body.id;

      // Create another user
      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'other@example.com',
          password: 'OtherPassword123!',
          name: 'Other User'
        });

      const otherUserToken = otherUserResponse.body.token;

      // Other user tries to access the payment
      const response = await request(app)
        .get(`/api/payments/${paymentId}`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('Input Validation Security', () => {
    it('should prevent XSS attacks', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        'javascript:alert("XSS")',
        '<img src="x" onerror="alert(\'XSS\')">',
        '"><script>alert("XSS")</script>',
        '&#60;script&#62;alert("XSS")&#60;/script&#62;'
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            password: 'TestPassword123!',
            name: payload
          });

        // Should either reject or sanitize the input
        expect([400, 201]).toContain(response.status);
        
        if (response.status === 201) {
          // If accepted, should be sanitized
          expect(response.body.user.name).not.toContain('<script>');
          expect(response.body.user.name).not.toContain('javascript:');
        }
      }
    });

    it('should prevent NoSQL injection', async () => {
      const nosqlInjectionAttempts = [
        { email: { $ne: '' }, password: { $ne: '' } },
        { email: { $gt: '' }, password: { $gt: '' } },
        { email: { $regex: '.*' }, password: { $regex: '.*' } }
      ];

      for (const attempt of nosqlInjectionAttempts) {
        const response = await request(app)
          .post('/api/auth/login')
          .send(attempt);

        expect(response.status).toBe(400);
      }
    });

    it('should validate file uploads', async () => {
      const maliciousFiles = [
        { filename: 'malicious.php', content: '<?php system($_GET["cmd"]); ?>' },
        { filename: 'malicious.js', content: 'alert("malicious")' },
        { filename: 'malicious.exe', content: 'binary content' },
        { filename: 'malicious.sh', content: '#!/bin/bash\nrm -rf /' }
      ];

      for (const file of maliciousFiles) {
        const response = await request(app)
          .post('/api/inventory/import')
          .attach('file', Buffer.from(file.content), file.filename);

        expect(response.status).toBe(400);
      }
    });

    it('should prevent path traversal attacks', async () => {
      const pathTraversalAttempts = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
      ];

      for (const attempt of pathTraversalAttempts) {
        const response = await request(app)
          .get(`/api/files/${attempt}`);

        expect(response.status).toBe(404);
      }
    });
  });

  describe('API Security', () => {
    it('should implement rate limiting', async () => {
      const requests = [];
      
      // Make many requests quickly
      for (let i = 0; i < 100; i++) {
        const response = await request(app)
          .get('/api/products');
        
        requests.push(response.status);
      }

      // Should start rate limiting
      const rateLimited = requests.filter(status => status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it('should prevent CSRF attacks', async () => {
      const response = await request(app)
        .post('/api/payments/process')
        .send({
          amount: 100,
          paymentMethod: 'credit_card'
        })
        .set('Origin', 'https://malicious-site.com');

      expect(response.status).toBe(403);
    });

    it('should validate content types', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'text/plain')
        .send('invalid json content');

      expect(response.status).toBe(400);
    });

    it('should implement proper CORS', async () => {
      const response = await request(app)
        .options('/api/products')
        .set('Origin', 'https://malicious-site.com')
        .set('Access-Control-Request-Method', 'GET');

      expect(response.headers['access-control-allow-origin']).not.toBe('*');
    });
  });

  describe('Data Security', () => {
    it('should encrypt sensitive data', async () => {
      const userResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'encrypt@example.com',
          password: 'EncryptPassword123!',
          name: 'Encrypt User',
          phone: '+1234567890'
        });

      // Check database for encrypted data
      const user = await testDb.user.findFirst({
        where: { email: 'encrypt@example.com' }
      });

      expect(user.password).not.toBe('EncryptPassword123!');
      expect(user.password).toMatch(/^\$2[aby]\$\d{1,2}\$[./A-Za-z0-9]{53}$/); // bcrypt hash
    });

    it('should not expose sensitive data in responses', async () => {
      const userResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'sensitive@example.com',
          password: 'SensitivePassword123!',
          name: 'Sensitive User'
        });

      const user = userResponse.body.user;

      expect(user.password).toBeUndefined();
      expect(user.passwordHash).toBeUndefined();
      expect(user.salt).toBeUndefined();
    });

    it('should implement proper session management', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'session@example.com',
          password: 'SessionPassword123!'
        });

      const token = loginResponse.body.token;

      // Check token expiration
      const decodedToken = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      const now = Math.floor(Date.now() / 1000);
      
      expect(decodedToken.exp).toBeGreaterThan(now);
      expect(decodedToken.exp - now).toBeLessThanOrEqual(3600); // 1 hour max
    });
  });

  describe('Infrastructure Security', () => {
    it('should have proper security headers', async () => {
      const response = await request(app)
        .get('/api/products');

      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['strict-transport-security']).toContain('max-age=');
    });

    it('should prevent information disclosure', async () => {
      const response = await request(app)
        .get('/api/non-existent-endpoint');

      expect(response.body).not.toContain('stack trace');
      expect(response.body).not.toContain('error details');
      expect(response.body.error).toBe('Not Found');
    });

    it('should validate request size limits', async () => {
      const largePayload = 'x'.repeat(1024 * 1024); // 1MB

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'large@example.com',
          password: 'LargePassword123!',
          name: largePayload
        });

      expect(response.status).toBe(413);
    });
  });
}); 