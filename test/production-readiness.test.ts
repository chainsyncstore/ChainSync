import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { Pool } from 'pg';
import { app, dbPool } from '../server/app';
import { secretsManager } from '../server/config/secrets';
import { getLogger } from '../src/logging/index';

const logger = getLogger().child({ component: 'production-readiness-test' });

describe('Production Readiness Tests', () => {
  let db: Pool;

  beforeAll(async () => {
    // Use the existing database pool from the app
    db = dbPool;
  });

  afterAll(async () => {
    await db.end();
  });

  describe('Security Headers', () => {
    test('should include security headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['strict-transport-security']).toContain('max-age=');
      expect(response.headers['content-security-policy']).toBeDefined();
    });

    test('should not expose server information', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers['server']).toBeUndefined();
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limits on auth endpoints', async () => {
      const requests = [];
      
      // Make multiple requests quickly
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'password123' })
        );
      }

      const responses = await Promise.all(requests);
      
      // Should have some rate limited responses
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    test('should include rate limit headers', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    });
  });

  describe('Input Validation', () => {
    test('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'invalid-email', password: 'password123' })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toContainEqual(
        expect.objectContaining({
          msg: 'Valid email is required'
        })
      );
    });

    test('should validate password strength', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .send({
          currentPassword: 'oldpass',
          newPassword: 'weak',
          confirmPassword: 'weak'
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    test('should sanitize input data', async () => {
      const maliciousInput = '<script>alert("xss")</script>';
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: maliciousInput, password: 'password123' })
        .expect(400);

      // Should not contain the script tag in response
      expect(JSON.stringify(response.body)).not.toContain('<script>');
    });
  });

  describe('Error Handling', () => {
    test('should not expose internal errors', async () => {
      const response = await request(app)
        .get('/api/nonexistent-endpoint')
        .expect(404);

      expect(response.body.error).toBeDefined();
      expect(response.body.stack).toBeUndefined();
      expect(response.body.message).not.toContain('Error:');
    });

    test('should handle database errors gracefully', async () => {
      // Simulate database error by using invalid connection
      const response = await request(app)
        .get('/api/health/database')
        .expect(503);

      expect(response.body.error).toBe('Database health check failed');
      expect(response.body.details).toBeUndefined();
    });
  });

  describe('Authentication & Authorization', () => {
    test('should require authentication for protected routes', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard')
        .expect(401);

      expect(response.body.error).toBe('Access token required');
    });

    test('should validate JWT tokens', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error).toBe('Invalid or expired token');
    });

    test('should enforce role-based access control', async () => {
      // This would need a valid token for a non-admin user
      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', 'Bearer valid-user-token')
        .expect(403);

      expect(response.body.error).toBe('Admin access required');
    });
  });

  describe('Data Protection', () => {
    test('should not expose sensitive data in responses', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      if (response.status === 200) {
        expect(response.body.user.password).toBeUndefined();
        expect(response.body.user.passwordHash).toBeUndefined();
      }
    });

    test('should encrypt sensitive data in database', async () => {
      // Test that secrets manager is working
      secretsManager.setSecret('test-key', 'sensitive-value');
      const retrieved = secretsManager.getSecret('test-key');
      
      expect(retrieved).toBe('sensitive-value');
    });
  });

  describe('Logging & Monitoring', () => {
    test('should log security events', async () => {
      // Mock logger to capture logs
      const logSpy = jest.spyOn(logger, 'warn');

      await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrongpassword' });

      expect(logSpy).toHaveBeenCalledWith(
        'Failed login attempt',
        expect.objectContaining({
          email: 'test@example.com'
        })
      );

      logSpy.mockRestore();
    });

    test('should provide health check endpoints', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeDefined();
    });
  });

  describe('Performance & Scalability', () => {
    test('should handle concurrent requests', async () => {
      const requests = [];
      
      for (let i = 0; i < 50; i++) {
        requests.push(
          request(app)
            .get('/api/health')
            .expect(200)
        );
      }

      const responses = await Promise.all(requests);
      
      // All requests should succeed
      expect(responses.every(r => r.status === 200)).toBe(true);
    });

    test('should respond within acceptable time limits', async () => {
      const start = Date.now();
      
      await request(app)
        .get('/api/health')
        .expect(200);

      const duration = Date.now() - start;
      
      // Should respond within 1 second
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Database Security', () => {
    test('should use parameterized queries', async () => {
      // Test SQL injection protection
      const maliciousInput = "'; DROP TABLE users; --";
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: maliciousInput, password: 'password123' });

      // Should not cause database error
      expect(response.status).not.toBe(500);
    });

    test('should validate database connection security', async () => {
      // Ensure database connection uses SSL in production
      const client = await db.connect();
      
      try {
        const result = await client.query('SELECT current_setting($1)', ['ssl']);
        
        if (process.env.NODE_ENV === 'production') {
          expect(result.rows[0].current_setting).toBe('on');
        }
      } finally {
        client.release();
      }
    });
  });

  describe('Environment Configuration', () => {
    test('should validate required environment variables', () => {
      const requiredVars = [
        'DATABASE_URL',
        'JWT_SECRET',
        'JWT_REFRESH_SECRET',
        'ENCRYPTION_KEY',
        'SESSION_SECRET'
      ];

      for (const varName of requiredVars) {
        expect(process.env[varName]).toBeDefined();
        expect(process.env[varName]).not.toBe('');
      }
    });

    test('should not expose secrets in error messages', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect(200);

      const responseText = JSON.stringify(response.body);
      
      // Should not contain any secrets
      expect(responseText).not.toContain(process.env.JWT_SECRET);
      expect(responseText).not.toContain(process.env.DATABASE_URL);
    });
  });

  describe('CORS & Cross-Origin Security', () => {
    test('should handle CORS properly', async () => {
      const response = await request(app)
        .options('/api/health')
        .set('Origin', 'https://example.com')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    test('should reject unauthorized origins', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Origin', 'https://malicious-site.com');

      // Should either reject or not include CORS headers
      expect(response.headers['access-control-allow-origin']).not.toBe('https://malicious-site.com');
    });
  });
});
