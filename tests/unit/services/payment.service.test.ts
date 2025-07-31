import { PaymentService } from '../../../server/services/payment/payment.service';
import { mockPaymentData, mockTransactionData } from '../../factories/payment';
import { mockCustomerData } from '../../factories/customer';
import { mockInventoryItemData } from '../../factories/inventoryItem';

describe('PaymentService Unit Tests', () => {
  let paymentService: PaymentService;
  let mockDb: any;
  let mockLogger: any;

  beforeEach(() => {
    mockDb = {
      transaction: jest.fn(),
      payment: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      },
      customer: {
        findFirst: jest.fn(),
        update: jest.fn()
      },
      inventoryItem: {
        findFirst: jest.fn(),
        update: jest.fn()
      }
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };

    paymentService = new PaymentService(mockDb, mockLogger);
  });

  describe('processPayment', () => {
    it('should successfully process a payment', async () => {
      const paymentData = mockPaymentData();
      const customerData = mockCustomerData();
      const inventoryData = mockInventoryItemData();

      mockDb.transaction.mockResolvedValue({
        payment: { create: jest.fn().mockResolvedValue(paymentData) },
        customer: { update: jest.fn().mockResolvedValue(customerData) },
        inventoryItem: { update: jest.fn().mockResolvedValue(inventoryData) }
      });

      const result = await paymentService.processPayment(paymentData);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Payment processed successfully', {
        paymentId: paymentData.id,
        amount: paymentData.amount
      });
    });

    it('should handle payment processing errors', async () => {
      const paymentData = mockPaymentData();
      const error = new Error('Payment processing failed');

      mockDb.transaction.mockRejectedValue(error);

      const result = await paymentService.processPayment(paymentData);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalledWith('Payment processing failed', {
        error: error.message,
        paymentData
      });
    });

    it('should validate payment data before processing', async () => {
      const invalidPaymentData = { ...mockPaymentData(), amount: -100 };

      const result = await paymentService.processPayment(invalidPaymentData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid payment amount');
    });
  });

  describe('getPaymentHistory', () => {
    it('should retrieve payment history for a customer', async () => {
      const customerId = 'customer-123';
      const payments = [mockPaymentData(), mockPaymentData()];

      mockDb.payment.findMany.mockResolvedValue(payments);

      const result = await paymentService.getPaymentHistory(customerId);

      expect(result).toEqual(payments);
      expect(mockDb.payment.findMany).toHaveBeenCalledWith({
        where: { customerId },
        orderBy: { createdAt: 'desc' }
      });
    });

    it('should handle empty payment history', async () => {
      const customerId = 'customer-123';

      mockDb.payment.findMany.mockResolvedValue([]);

      const result = await paymentService.getPaymentHistory(customerId);

      expect(result).toEqual([]);
    });
  });

  describe('refundPayment', () => {
    it('should successfully refund a payment', async () => {
      const paymentId = 'payment-123';
      const refundAmount = 50;
      const originalPayment = mockPaymentData({ amount: 100 });

      mockDb.payment.findFirst.mockResolvedValue(originalPayment);
      mockDb.transaction.mockResolvedValue({
        payment: { update: jest.fn().mockResolvedValue({ ...originalPayment, refunded: true }) }
      });

      const result = await paymentService.refundPayment(paymentId, refundAmount);

      expect(result.success).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Payment refunded successfully', {
        paymentId,
        refundAmount
      });
    });

    it('should prevent refunding more than original amount', async () => {
      const paymentId = 'payment-123';
      const refundAmount = 150;
      const originalPayment = mockPaymentData({ amount: 100 });

      mockDb.payment.findFirst.mockResolvedValue(originalPayment);

      const result = await paymentService.refundPayment(paymentId, refundAmount);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Refund amount exceeds original payment');
    });

    it('should handle refund of non-existent payment', async () => {
      const paymentId = 'non-existent';
      const refundAmount = 50;

      mockDb.payment.findFirst.mockResolvedValue(null);

      const result = await paymentService.refundPayment(paymentId, refundAmount);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Payment not found');
    });
  });

  describe('validatePaymentMethod', () => {
    it('should validate credit card payment method', () => {
      const validCard = {
        type: 'credit_card',
        number: '4111111111111111',
        expiryMonth: '12',
        expiryYear: '2025',
        cvv: '123'
      };

      const result = paymentService.validatePaymentMethod(validCard);

      expect(result.isValid).toBe(true);
    });

    it('should reject invalid credit card number', () => {
      const invalidCard = {
        type: 'credit_card',
        number: '1234567890123456',
        expiryMonth: '12',
        expiryYear: '2025',
        cvv: '123'
      };

      const result = paymentService.validatePaymentMethod(invalidCard);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid credit card number');
    });

    it('should validate bank transfer payment method', () => {
      const validTransfer = {
        type: 'bank_transfer',
        accountNumber: '1234567890',
        routingNumber: '021000021',
        accountType: 'checking'
      };

      const result = paymentService.validatePaymentMethod(validTransfer);

      expect(result.isValid).toBe(true);
    });
  });

  describe('calculateFees', () => {
    it('should calculate correct processing fees', () => {
      const amount = 100;
      const paymentMethod = 'credit_card';

      const fees = paymentService.calculateFees(amount, paymentMethod);

      expect(fees.processingFee).toBe(2.9);
      expect(fees.fixedFee).toBe(0.30);
      expect(fees.totalFees).toBe(3.20);
      expect(fees.netAmount).toBe(96.80);
    });

    it('should apply different fees for different payment methods', () => {
      const amount = 100;
      const bankTransfer = 'bank_transfer';

      const fees = paymentService.calculateFees(amount, bankTransfer);

      expect(fees.processingFee).toBe(0.8);
      expect(fees.fixedFee).toBe(0.25);
    });
  });

  describe('generateReceipt', () => {
    it('should generate a receipt for a payment', async () => {
      const payment = mockPaymentData();
      const customer = mockCustomerData();

      const receipt = await paymentService.generateReceipt(payment, customer);

      expect(receipt).toHaveProperty('receiptNumber');
      expect(receipt).toHaveProperty('paymentId', payment.id);
      expect(receipt).toHaveProperty('customerName', customer.name);
      expect(receipt).toHaveProperty('amount', payment.amount);
      expect(receipt).toHaveProperty('timestamp');
    });
  });
}); 