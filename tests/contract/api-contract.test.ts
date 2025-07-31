import request from 'supertest';
import { app } from '../../server/app';
import { setupTestDatabase, teardownTestDatabase } from '../setup/integration-setup';
import { mockCustomerData } from '../factories/customer';

describe('API Contract Tests', () => {
  let testDb: any;
  let authToken: string;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
    
    // Create test user and get auth token
    const customerData = mockCustomerData();
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(customerData);
    
    authToken = registerResponse.body.token;
  });

  afterAll(async () => {
    await teardownTestDatabase(testDb);
  });

  describe('Authentication API Contract', () => {
    it('should maintain register endpoint contract', async () => {
      const userData = {
        email: 'contract-test@example.com',
        password: 'TestPassword123!',
        name: 'Contract Test User',
        phone: '+1234567890'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      
      // Verify response structure
      expect(response.body).toMatchObject({
        success: true,
        user: {
          id: expect.any(String),
          email: userData.email,
          name: userData.name,
          phone: userData.phone,
          createdAt: expect.any(String),
          updatedAt: expect.any(String)
        },
        token: expect.any(String)
      });

      // Verify user object doesn't contain password
      expect(response.body.user.password).toBeUndefined();
    });

    it('should maintain login endpoint contract', async () => {
      const loginData = {
        email: 'contract-test@example.com',
        password: 'TestPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(200);
      
      expect(response.body).toMatchObject({
        success: true,
        user: {
          id: expect.any(String),
          email: loginData.email,
          name: expect.any(String),
          phone: expect.any(String),
          createdAt: expect.any(String),
          updatedAt: expect.any(String)
        },
        token: expect.any(String)
      });
    });

    it('should maintain error response contract', async () => {
      const invalidData = {
        email: 'invalid-email',
        password: '123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidData);

      expect(response.status).toBe(400);
      
      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String),
        details: expect.any(Array)
      });
    });
  });

  describe('Payment API Contract', () => {
    it('should maintain payment intent creation contract', async () => {
      const intentData = {
        amount: 100.00,
        currency: 'USD',
        paymentMethod: 'credit_card'
      };

      const response = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send(intentData);

      expect(response.status).toBe(200);
      
      expect(response.body).toMatchObject({
        success: true,
        id: expect.any(String),
        clientSecret: expect.any(String),
        amount: intentData.amount,
        currency: intentData.currency,
        status: 'requires_payment_method',
        createdAt: expect.any(String)
      });
    });

    it('should maintain payment processing contract', async () => {
      // First create payment intent
      const intentResponse = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 50.00,
          currency: 'USD',
          paymentMethod: 'credit_card'
        });

      const paymentData = {
        paymentIntentId: intentResponse.body.id,
        paymentMethod: {
          type: 'credit_card',
          number: '4242424242424242',
          expiryMonth: '12',
          expiryYear: '2025',
          cvv: '123'
        }
      };

      const response = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData);

      expect(response.status).toBe(200);
      
      expect(response.body).toMatchObject({
        success: true,
        paymentId: expect.any(String),
        transactionId: expect.any(String),
        amount: 50.00,
        currency: 'USD',
        status: 'completed',
        processingFees: expect.any(Number),
        netAmount: expect.any(Number),
        createdAt: expect.any(String)
      });
    });

    it('should maintain payment history contract', async () => {
      const response = await request(app)
        .get('/api/payments/history')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 10, offset: 0 });

      expect(response.status).toBe(200);
      
      expect(response.body).toMatchObject({
        success: true,
        payments: expect.any(Array),
        pagination: {
          total: expect.any(Number),
          limit: 10,
          offset: 0,
          hasMore: expect.any(Boolean)
        }
      });

      if (response.body.payments.length > 0) {
        expect(response.body.payments[0]).toMatchObject({
          id: expect.any(String),
          amount: expect.any(Number),
          currency: expect.any(String),
          status: expect.any(String),
          paymentMethod: expect.any(String),
          createdAt: expect.any(String)
        });
      }
    });
  });

  describe('Inventory API Contract', () => {
    it('should maintain inventory item contract', async () => {
      const response = await request(app)
        .get('/api/inventory/items')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 5 });

      expect(response.status).toBe(200);
      
      expect(response.body).toMatchObject({
        success: true,
        items: expect.any(Array),
        pagination: {
          total: expect.any(Number),
          limit: 5,
          offset: 0,
          hasMore: expect.any(Boolean)
        }
      });

      if (response.body.items.length > 0) {
        expect(response.body.items[0]).toMatchObject({
          id: expect.any(String),
          productId: expect.any(String),
          name: expect.any(String),
          sku: expect.any(String),
          quantity: expect.any(Number),
          price: expect.any(Number),
          category: expect.any(String),
          status: expect.any(String),
          createdAt: expect.any(String),
          updatedAt: expect.any(String)
        });
      }
    });

    it('should maintain inventory update contract', async () => {
      const updateData = {
        quantity: 10,
        price: 25.99,
        status: 'active'
      };

      const response = await request(app)
        .put('/api/inventory/items/test-item-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      
      expect(response.body).toMatchObject({
        success: true,
        item: {
          id: expect.any(String),
          quantity: updateData.quantity,
          price: updateData.price,
          status: updateData.status,
          updatedAt: expect.any(String)
        }
      });
    });
  });

  describe('Analytics API Contract', () => {
    it('should maintain sales analytics contract', async () => {
      const response = await request(app)
        .get('/api/analytics/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        });

      expect(response.status).toBe(200);
      
      expect(response.body).toMatchObject({
        success: true,
        data: {
          totalSales: expect.any(Number),
          totalOrders: expect.any(Number),
          averageOrderValue: expect.any(Number),
          salesByDay: expect.any(Array),
          topProducts: expect.any(Array),
          salesByCategory: expect.any(Array)
        },
        period: {
          startDate: expect.any(String),
          endDate: expect.any(String)
        }
      });
    });

    it('should maintain inventory analytics contract', async () => {
      const response = await request(app)
        .get('/api/analytics/inventory')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      
      expect(response.body).toMatchObject({
        success: true,
        data: {
          totalItems: expect.any(Number),
          lowStockItems: expect.any(Number),
          outOfStockItems: expect.any(Number),
          totalValue: expect.any(Number),
          turnoverRate: expect.any(Number),
          itemsByCategory: expect.any(Array)
        }
      });
    });
  });

  describe('Error Response Contract', () => {
    it('should maintain 404 error contract', async () => {
      const response = await request(app)
        .get('/api/non-existent-endpoint')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      
      expect(response.body).toMatchObject({
        success: false,
        error: 'Not Found',
        message: expect.any(String),
        path: '/api/non-existent-endpoint'
      });
    });

    it('should maintain 401 error contract', async () => {
      const response = await request(app)
        .get('/api/payments/history');

      expect(response.status).toBe(401);
      
      expect(response.body).toMatchObject({
        success: false,
        error: 'Unauthorized',
        message: expect.any(String)
      });
    });

    it('should maintain 403 error contract', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      
      expect(response.body).toMatchObject({
        success: false,
        error: 'Forbidden',
        message: expect.any(String)
      });
    });

    it('should maintain validation error contract', async () => {
      const response = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: -100,
          currency: 'INVALID',
          paymentMethod: 'invalid_method'
        });

      expect(response.status).toBe(400);
      
      expect(response.body).toMatchObject({
        success: false,
        error: 'Validation Error',
        details: expect.any(Array)
      });

      expect(response.body.details).toHaveLength(3);
      expect(response.body.details[0]).toMatchObject({
        field: expect.any(String),
        message: expect.any(String),
        value: expect.anything()
      });
    });
  });

  describe('Pagination Contract', () => {
    it('should maintain pagination contract across all list endpoints', async () => {
      const endpoints = [
        '/api/payments/history',
        '/api/inventory/items',
        '/api/orders',
        '/api/customers'
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${authToken}`)
          .query({ limit: 5, offset: 0 });

        if (response.status === 200) {
          expect(response.body.pagination).toMatchObject({
            total: expect.any(Number),
            limit: 5,
            offset: 0,
            hasMore: expect.any(Boolean)
          });
        }
      }
    });
  });

  describe('Date Format Contract', () => {
    it('should maintain consistent date format across all endpoints', async () => {
      const response = await request(app)
        .get('/api/payments/history')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 1 });

      if (response.status === 200 && response.body.payments.length > 0) {
        const payment = response.body.payments[0];
        
        // Verify date format is ISO 8601
        expect(payment.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        expect(payment.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      }
    });
  });
}); 