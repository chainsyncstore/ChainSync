import request from 'supertest';
import { app } from '../../server/app';
import { setupTestDatabase, teardownTestDatabase } from '../setup/integration-setup';
import { mockCustomerData } from '../factories/customer';

describe('API Contract Tests', () => {
  let _testDb: any;
  let _authToken: string;

  beforeAll(async() => {
    testDb = await setupTestDatabase();

    // Create test user and get auth token
    const customerData = mockCustomerData();
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(customerData);

    authToken = registerResponse.body.token;
  });

  afterAll(async() => {
    await teardownTestDatabase(testDb);
  });

  describe('Authentication API Contract', () => {
    it('should maintain register endpoint contract', async() => {
      const userData = {
        _email: 'contract-test@example.com',
        _password: 'TestPassword123!',
        _name: 'Contract Test User',
        _phone: '+1234567890'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);

      // Verify response structure
      expect(response.body).toMatchObject({
        _success: true,
        _user: {
          _id: expect.any(String),
          _email: userData.email,
          _name: userData.name,
          _phone: userData.phone,
          _createdAt: expect.any(String),
          _updatedAt: expect.any(String)
        },
        _token: expect.any(String)
      });

      // Verify user object doesn't contain password
      expect(response.body.user.password).toBeUndefined();
    });

    it('should maintain login endpoint contract', async() => {
      const loginData = {
        _email: 'contract-test@example.com',
        _password: 'TestPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(200);

      expect(response.body).toMatchObject({
        _success: true,
        _user: {
          _id: expect.any(String),
          _email: loginData.email,
          _name: expect.any(String),
          _phone: expect.any(String),
          _createdAt: expect.any(String),
          _updatedAt: expect.any(String)
        },
        _token: expect.any(String)
      });
    });

    it('should maintain error response contract', async() => {
      const invalidData = {
        _email: 'invalid-email',
        _password: '123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidData);

      expect(response.status).toBe(400);

      expect(response.body).toMatchObject({
        _success: false,
        _error: expect.any(String),
        _details: expect.any(Array)
      });
    });
  });

  describe('Payment API Contract', () => {
    it('should maintain payment intent creation contract', async() => {
      const intentData = {
        _amount: 100.00,
        _currency: 'USD',
        _paymentMethod: 'credit_card'
      };

      const response = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send(intentData);

      expect(response.status).toBe(200);

      expect(response.body).toMatchObject({
        _success: true,
        _id: expect.any(String),
        _clientSecret: expect.any(String),
        _amount: intentData.amount,
        _currency: intentData.currency,
        _status: 'requires_payment_method',
        _createdAt: expect.any(String)
      });
    });

    it('should maintain payment processing contract', async() => {
      // First create payment intent
      const intentResponse = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          _amount: 50.00,
          _currency: 'USD',
          _paymentMethod: 'credit_card'
        });

      const paymentData = {
        _paymentIntentId: intentResponse.body.id,
        _paymentMethod: {
          type: 'credit_card',
          _number: '4242424242424242',
          _expiryMonth: '12',
          _expiryYear: '2025',
          _cvv: '123'
        }
      };

      const response = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData);

      expect(response.status).toBe(200);

      expect(response.body).toMatchObject({
        _success: true,
        _paymentId: expect.any(String),
        _transactionId: expect.any(String),
        _amount: 50.00,
        _currency: 'USD',
        _status: 'completed',
        _processingFees: expect.any(Number),
        _netAmount: expect.any(Number),
        _createdAt: expect.any(String)
      });
    });

    it('should maintain payment history contract', async() => {
      const response = await request(app)
        .get('/api/payments/history')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ _limit: 10, _offset: 0 });

      expect(response.status).toBe(200);

      expect(response.body).toMatchObject({
        _success: true,
        _payments: expect.any(Array),
        _pagination: {
          _total: expect.any(Number),
          _limit: 10,
          _offset: 0,
          _hasMore: expect.any(Boolean)
        }
      });

      if (response.body.payments.length > 0) {
        expect(response.body.payments[0]).toMatchObject({
          _id: expect.any(String),
          _amount: expect.any(Number),
          _currency: expect.any(String),
          _status: expect.any(String),
          _paymentMethod: expect.any(String),
          _createdAt: expect.any(String)
        });
      }
    });
  });

  describe('Inventory API Contract', () => {
    it('should maintain inventory item contract', async() => {
      const response = await request(app)
        .get('/api/inventory/items')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ _limit: 5 });

      expect(response.status).toBe(200);

      expect(response.body).toMatchObject({
        _success: true,
        _items: expect.any(Array),
        _pagination: {
          _total: expect.any(Number),
          _limit: 5,
          _offset: 0,
          _hasMore: expect.any(Boolean)
        }
      });

      if (response.body.items.length > 0) {
        expect(response.body.items[0]).toMatchObject({
          _id: expect.any(String),
          _productId: expect.any(String),
          _name: expect.any(String),
          _sku: expect.any(String),
          _quantity: expect.any(Number),
          _price: expect.any(Number),
          _category: expect.any(String),
          _status: expect.any(String),
          _createdAt: expect.any(String),
          _updatedAt: expect.any(String)
        });
      }
    });

    it('should maintain inventory update contract', async() => {
      const updateData = {
        _quantity: 10,
        _price: 25.99,
        _status: 'active'
      };

      const response = await request(app)
        .put('/api/inventory/items/test-item-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);

      expect(response.body).toMatchObject({
        _success: true,
        _item: {
          _id: expect.any(String),
          _quantity: updateData.quantity,
          _price: updateData.price,
          _status: updateData.status,
          _updatedAt: expect.any(String)
        }
      });
    });
  });

  describe('Analytics API Contract', () => {
    it('should maintain sales analytics contract', async() => {
      const response = await request(app)
        .get('/api/analytics/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          _startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          _endDate: new Date().toISOString()
        });

      expect(response.status).toBe(200);

      expect(response.body).toMatchObject({
        _success: true,
        _data: {
          _totalSales: expect.any(Number),
          _totalOrders: expect.any(Number),
          _averageOrderValue: expect.any(Number),
          _salesByDay: expect.any(Array),
          _topProducts: expect.any(Array),
          _salesByCategory: expect.any(Array)
        },
        _period: {
          _startDate: expect.any(String),
          _endDate: expect.any(String)
        }
      });
    });

    it('should maintain inventory analytics contract', async() => {
      const response = await request(app)
        .get('/api/analytics/inventory')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);

      expect(response.body).toMatchObject({
        _success: true,
        _data: {
          _totalItems: expect.any(Number),
          _lowStockItems: expect.any(Number),
          _outOfStockItems: expect.any(Number),
          _totalValue: expect.any(Number),
          _turnoverRate: expect.any(Number),
          _itemsByCategory: expect.any(Array)
        }
      });
    });
  });

  describe('Error Response Contract', () => {
    it('should maintain 404 error contract', async() => {
      const response = await request(app)
        .get('/api/non-existent-endpoint')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);

      expect(response.body).toMatchObject({
        _success: false,
        _error: 'Not Found',
        _message: expect.any(String),
        _path: '/api/non-existent-endpoint'
      });
    });

    it('should maintain 401 error contract', async() => {
      const response = await request(app)
        .get('/api/payments/history');

      expect(response.status).toBe(401);

      expect(response.body).toMatchObject({
        _success: false,
        _error: 'Unauthorized',
        _message: expect.any(String)
      });
    });

    it('should maintain 403 error contract', async() => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);

      expect(response.body).toMatchObject({
        _success: false,
        _error: 'Forbidden',
        _message: expect.any(String)
      });
    });

    it('should maintain validation error contract', async() => {
      const response = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          _amount: -100,
          _currency: 'INVALID',
          _paymentMethod: 'invalid_method'
        });

      expect(response.status).toBe(400);

      expect(response.body).toMatchObject({
        _success: false,
        _error: 'Validation Error',
        _details: expect.any(Array)
      });

      expect(response.body.details).toHaveLength(3);
      expect(response.body.details[0]).toMatchObject({
        _field: expect.any(String),
        _message: expect.any(String),
        _value: expect.anything()
      });
    });
  });

  describe('Pagination Contract', () => {
    it('should maintain pagination contract across all list endpoints', async() => {
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
          .query({ _limit: 5, _offset: 0 });

        if (response.status === 200) {
          expect(response.body.pagination).toMatchObject({
            _total: expect.any(Number),
            _limit: 5,
            _offset: 0,
            _hasMore: expect.any(Boolean)
          });
        }
      }
    });
  });

  describe('Date Format Contract', () => {
    it('should maintain consistent date format across all endpoints', async() => {
      const response = await request(app)
        .get('/api/payments/history')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ _limit: 1 });

      if (response.status === 200 && response.body.payments.length > 0) {
        const payment = response.body.payments[0];

        // Verify date format is ISO 8601
        expect(payment.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        expect(payment.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      }
    });
  });
});
