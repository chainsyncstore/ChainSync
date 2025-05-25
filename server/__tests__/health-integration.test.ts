// server/__tests__/health-integration.test.ts
import request from 'supertest';
import { app, dbPool } from '../app';
import { getRedisClient } from '../../src/cache/redis';
import { getQueue, QueueType } from '../../src/queue';

// Mock the dependencies
jest.mock('../../src/cache/redis', () => ({
  getRedisClient: jest.fn()
}));

jest.mock('../../src/queue', () => ({
  getQueue: jest.fn(),
  QueueType: {
    NOTIFICATIONS: 'notifications',
    IMPORTS: 'imports',
    EXPORTS: 'exports'
  }
}));

describe('Health Check Endpoints', () => {
  // Mock database
  const mockDbPool = {
    query: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] })
  };
  
  // Mock Redis client
  const mockRedisClient = {
    ping: jest.fn().mockResolvedValue('PONG')
  };
  
  // Mock queue
  const mockQueue = {
    getWaitingCount: jest.fn().mockResolvedValue(0),
    getActiveCount: jest.fn().mockResolvedValue(0),
    getDelayedCount: jest.fn().mockResolvedValue(0),
    getFailedCount: jest.fn().mockResolvedValue(0),
    getCompletedCount: jest.fn().mockResolvedValue(0)
  };
  
  beforeAll(() => {
    // Setup mocks
    (dbPool as any).query = mockDbPool.query;
    (getRedisClient as jest.Mock).mockReturnValue(mockRedisClient);
    (getQueue as jest.Mock).mockReturnValue(mockQueue);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('/healthz (Liveness Probe)', () => {
    it('should always return 200 OK and UP status', async () => {
      const response = await request(app).get('/healthz');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('UP');
      expect(response.body).toHaveProperty('timestamp');
    });
    
    // Even with DB failures, liveness should still return UP
    it('should return UP even when database is down', async () => {
      mockDbPool.query.mockRejectedValueOnce(new Error('DB Connection Failed'));
      
      const response = await request(app).get('/healthz');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('UP');
    });
  });
  
  describe('/readyz (Readiness Probe)', () => {
    it('should return 200 OK when all components are available', async () => {
      const response = await request(app).get('/readyz');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('UP');
      expect(response.body.components.database.status).toBe('UP');
      expect(response.body.components.redis.status).toBe('UP');
    });
    
    it('should return 503 when database is down', async () => {
      mockDbPool.query.mockRejectedValueOnce(new Error('DB Connection Failed'));
      
      const response = await request(app).get('/readyz');
      
      expect(response.status).toBe(503);
      expect(response.body.status).toBe('DOWN');
      expect(response.body.components.database.status).toBe('DOWN');
    });
    
    it('should return 503 when Redis is down (if configured)', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      mockRedisClient.ping.mockRejectedValueOnce(new Error('Redis Connection Failed'));
      
      const response = await request(app).get('/readyz');
      
      expect(response.status).toBe(503);
      expect(response.body.status).toBe('DOWN');
      expect(response.body.components.redis.status).toBe('DOWN');
      
      // Cleanup
      delete process.env.REDIS_URL;
    });
    
    it('should return 200 when Redis is not configured', async () => {
      delete process.env.REDIS_URL;
      (getRedisClient as jest.Mock).mockReturnValueOnce(null);
      
      const response = await request(app).get('/readyz');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('UP');
      expect(response.body.components.redis.status).toBe('DISABLED');
    });
  });
  
  describe('/api/health/details (Detailed Health Check)', () => {
    it('should include all component statuses and system info', async () => {
      const response = await request(app).get('/api/health/details');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('UP');
      expect(response.body.services.database.status).toBe('UP');
      expect(response.body.services.redis.status).toBe('UP');
      expect(response.body.services.queues.status).toBe('UP');
      expect(response.body).toHaveProperty('system');
      expect(response.body).toHaveProperty('responseTime');
    });
    
    it('should return degraded status when a non-critical component is down', async () => {
      // Mock queue failure
      mockQueue.getWaitingCount.mockRejectedValueOnce(new Error('Queue Error'));
      
      const response = await request(app).get('/api/health/details');
      
      expect(response.status).toBe(207);
      expect(response.body.status).toBe('DEGRADED');
      expect(response.body.services.queues.status).toBe('DEGRADED');
    });
  });
  
  describe('Headers Security', () => {
    it('should set security headers on health endpoints', async () => {
      const response = await request(app).get('/healthz');
      
      // Check security headers
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      
      expect(response.headers).toHaveProperty('content-security-policy');
      
      // If using Helmet, these should also be present
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('strict-transport-security');
    });
  });
});
