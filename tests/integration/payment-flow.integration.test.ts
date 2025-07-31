import request from 'supertest';
import { app } from '../../server/app';
import { setupTestDatabase, teardownTestDatabase } from '../setup/integration-setup';
import { mockPaymentData, mockCustomerData } from '../factories/payment';
import { mockInventoryItemData } from '../factories/inventoryItem';

describe('Payment Flow Integration Tests', () => {
  let testDb: any;
  let authToken: string;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
    
    // Create test customer and get auth token
    const customerData = mockCustomerData();
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(customerData);
    
    authToken = registerResponse.body.token;
  });

  afterAll(async () => {
    await teardownTestDatabase(testDb);
  });

  beforeEach(async () => {
    // Clear test data before each test
    await testDb.payment.deleteMany();
    await testDb.transaction.deleteMany();
  });

  describe('Complete Payment Flow', () => {
    it('should process a complete payment from cart to receipt', async () => {
      // 1. Add items to cart
      const cartItems = [
        { productId: 'product-1', quantity: 2, price: 25.00 },
        { productId: 'product-2', quantity: 1, price: 50.00 }
      ];

      const cartResponse = await request(app)
        .post('/api/cart/add')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ items: cartItems });

      expect(cartResponse.status).toBe(200);
      expect(cartResponse.body.total).toBe(100.00);

      // 2. Create payment intent
      const paymentIntentResponse = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 100.00,
          currency: 'USD',
          paymentMethod: 'credit_card'
        });

      expect(paymentIntentResponse.status).toBe(200);
      expect(paymentIntentResponse.body.clientSecret).toBeDefined();

      // 3. Process payment
      const paymentData = {
        paymentIntentId: paymentIntentResponse.body.id,
        paymentMethod: {
          type: 'credit_card',
          number: '4242424242424242',
          expiryMonth: '12',
          expiryYear: '2025',
          cvv: '123'
        }
      };

      const paymentResponse = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData);

      expect(paymentResponse.status).toBe(200);
      expect(paymentResponse.body.success).toBe(true);
      expect(paymentResponse.body.paymentId).toBeDefined();

      // 4. Verify payment in database
      const payment = await testDb.payment.findFirst({
        where: { id: paymentResponse.body.paymentId }
      });

      expect(payment).toBeDefined();
      expect(payment.status).toBe('completed');
      expect(payment.amount).toBe(100.00);

      // 5. Verify inventory updated
      const inventory1 = await testDb.inventoryItem.findFirst({
        where: { productId: 'product-1' }
      });
      const inventory2 = await testDb.inventoryItem.findFirst({
        where: { productId: 'product-2' }
      });

      expect(inventory1.quantity).toBeLessThan(inventory1.originalQuantity);
      expect(inventory2.quantity).toBeLessThan(inventory2.originalQuantity);

      // 6. Generate receipt
      const receiptResponse = await request(app)
        .get(`/api/payments/${paymentResponse.body.paymentId}/receipt`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(receiptResponse.status).toBe(200);
      expect(receiptResponse.body.receiptNumber).toBeDefined();
      expect(receiptResponse.body.items).toHaveLength(2);
    });

    it('should handle payment failure gracefully', async () => {
      // Create payment intent
      const paymentIntentResponse = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 50.00,
          currency: 'USD',
          paymentMethod: 'credit_card'
        });

      // Process payment with declined card
      const paymentData = {
        paymentIntentId: paymentIntentResponse.body.id,
        paymentMethod: {
          type: 'credit_card',
          number: '4000000000000002', // Declined card
          expiryMonth: '12',
          expiryYear: '2025',
          cvv: '123'
        }
      };

      const paymentResponse = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData);

      expect(paymentResponse.status).toBe(400);
      expect(paymentResponse.body.success).toBe(false);
      expect(paymentResponse.body.error).toContain('card_declined');

      // Verify payment status in database
      const payment = await testDb.payment.findFirst({
        where: { paymentIntentId: paymentIntentResponse.body.id }
      });

      expect(payment.status).toBe('failed');
    });

    it('should process refund successfully', async () => {
      // First create a successful payment
      const paymentIntentResponse = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 75.00,
          currency: 'USD',
          paymentMethod: 'credit_card'
        });

      const paymentResponse = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentIntentId: paymentIntentResponse.body.id,
          paymentMethod: {
            type: 'credit_card',
            number: '4242424242424242',
            expiryMonth: '12',
            expiryYear: '2025',
            cvv: '123'
          }
        });

      const paymentId = paymentResponse.body.paymentId;

      // Process refund
      const refundResponse = await request(app)
        .post(`/api/payments/${paymentId}/refund`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 25.00,
          reason: 'Customer request'
        });

      expect(refundResponse.status).toBe(200);
      expect(refundResponse.body.success).toBe(true);
      expect(refundResponse.body.refundId).toBeDefined();

      // Verify refund in database
      const refund = await testDb.transaction.findFirst({
        where: { 
          paymentId,
          type: 'refund'
        }
      });

      expect(refund).toBeDefined();
      expect(refund.amount).toBe(25.00);
      expect(refund.status).toBe('completed');

      // Verify original payment updated
      const payment = await testDb.payment.findFirst({
        where: { id: paymentId }
      });

      expect(payment.refunded).toBe(true);
      expect(payment.refundAmount).toBe(25.00);
    });
  });

  describe('Payment Validation', () => {
    it('should validate payment amount limits', async () => {
      const response = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 100000.00, // Exceeds limit
          currency: 'USD',
          paymentMethod: 'credit_card'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Amount exceeds maximum limit');
    });

    it('should validate payment method', async () => {
      const response = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentIntentId: 'test-intent',
          paymentMethod: {
            type: 'invalid_method',
            number: '1234567890123456'
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Unsupported payment method');
    });
  });

  describe('Payment Security', () => {
    it('should prevent duplicate payment processing', async () => {
      // Create and process payment
      const paymentIntentResponse = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 50.00,
          currency: 'USD',
          paymentMethod: 'credit_card'
        });

      const paymentData = {
        paymentIntentId: paymentIntentResponse.body.id,
        paymentMethod: {
          type: 'credit_card',
          number: '4242424242424242',
          expiryMonth: '12',
          expiryYear: '2025',
          cvv: '123'
        }
      };

      // First payment should succeed
      const firstPayment = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData);

      expect(firstPayment.status).toBe(200);

      // Second payment with same intent should fail
      const secondPayment = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData);

      expect(secondPayment.status).toBe(400);
      expect(secondPayment.body.error).toContain('Payment already processed');
    });

    it('should validate user ownership of payment', async () => {
      // Create payment for user
      const paymentIntentResponse = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 50.00,
          currency: 'USD',
          paymentMethod: 'credit_card'
        });

      const paymentResponse = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentIntentId: paymentIntentResponse.body.id,
          paymentMethod: {
            type: 'credit_card',
            number: '4242424242424242',
            expiryMonth: '12',
            expiryYear: '2025',
            cvv: '123'
          }
        });

      const paymentId = paymentResponse.body.paymentId;

      // Try to access payment with different user token
      const otherUserToken = 'different-user-token';
      const unauthorizedResponse = await request(app)
        .get(`/api/payments/${paymentId}`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(unauthorizedResponse.status).toBe(403);
    });
  });

  describe('Payment Analytics', () => {
    it('should track payment metrics', async () => {
      // Process multiple payments
      for (let i = 0; i < 3; i++) {
        const paymentIntentResponse = await request(app)
          .post('/api/payments/create-intent')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            amount: 50.00 + (i * 10),
            currency: 'USD',
            paymentMethod: 'credit_card'
          });

        await request(app)
          .post('/api/payments/process')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            paymentIntentId: paymentIntentResponse.body.id,
            paymentMethod: {
              type: 'credit_card',
              number: '4242424242424242',
              expiryMonth: '12',
              expiryYear: '2025',
              cvv: '123'
            }
          });
      }

      // Get payment analytics
      const analyticsResponse = await request(app)
        .get('/api/analytics/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        });

      expect(analyticsResponse.status).toBe(200);
      expect(analyticsResponse.body.totalPayments).toBe(3);
      expect(analyticsResponse.body.totalAmount).toBe(180.00);
      expect(analyticsResponse.body.successRate).toBe(100);
    });
  });
}); 