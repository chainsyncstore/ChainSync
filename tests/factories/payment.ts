import { faker } from '@faker-js/faker';

export interface PaymentData {
  id: string;
  customerId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  status: string;
  transactionId: string;
  createdAt: Date;
  updatedAt: Date;
  refunded?: boolean;
  refundAmount?: number;
  processingFees?: number;
  metadata?: Record<string, any>;
}

export interface TransactionData {
  id: string;
  paymentId: string;
  type: string;
  amount: number;
  status: string;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export const mockPaymentData = (overrides: Partial<PaymentData> = {}): PaymentData => ({
  id: faker.string.uuid(),
  customerId: faker.string.uuid(),
  amount: faker.number.float({ min: 1, max: 1000 }),
  currency: 'USD',
  paymentMethod: ['credit_card', 'bank_transfer', 'paypal'][Math.floor(Math.random() * 3)] || 'credit_card',
  status: ['pending', 'completed', 'failed', 'refunded'][Math.floor(Math.random() * 4)] || 'pending',
  transactionId: faker.string.uuid().replace(/-/g, '').substring(0, 16),
  createdAt: faker.date.past(),
  updatedAt: faker.date.past(),
  refunded: false,
  refundAmount: 0,
  processingFees: faker.number.float({ min: 0.30, max: 5.00 }),
  metadata: {
    cardLast4: faker.string.uuid().replace(/-/g, '').substring(0, 4),
    cardBrand: ['visa', 'mastercard', 'amex'][Math.floor(Math.random() * 3)],
    billingAddress: {
      line1: faker.location.street(),
      city: faker.location.city(),
      state: faker.location.state(),
      postalCode: faker.location.zipCode(),
      country: faker.location.country()
    }
  },
  ...overrides
});

export const mockTransactionData = (overrides: Partial<TransactionData> = {}): TransactionData => ({
  id: faker.string.uuid(),
  paymentId: faker.string.uuid(),
  type: ['payment', 'refund', 'chargeback'][Math.floor(Math.random() * 3)] || 'payment',
  amount: faker.number.float({ min: 1, max: 1000 }),
  status: ['pending', 'completed', 'failed'][Math.floor(Math.random() * 3)] || 'pending',
  createdAt: faker.date.past(),
  metadata: {
    processor: ['stripe', 'paypal', 'square'][Math.floor(Math.random() * 3)],
    gatewayResponse: 'approved',
    responseCode: '000'
  },
  ...overrides
});

export const mockPaymentMethodData = () => ({
  type: ['credit_card', 'bank_transfer', 'paypal'][Math.floor(Math.random() * 3)],
  number: [
    '4111111111111111', // Visa
    '5555555555554444', // Mastercard
    '378282246310005'   // Amex
  ][Math.floor(Math.random() * 3)],
  expiryMonth: faker.number.int({ min: 1, max: 12 }).toString().padStart(2, '0'),
  expiryYear: faker.number.int({ min: 2024, max: 2030 }).toString(),
  cvv: faker.string.uuid().replace(/-/g, '').substring(0, 3),
  cardholderName: faker.person.fullName()
});

export const mockBankTransferData = () => ({
  type: 'bank_transfer',
  accountNumber: faker.string.uuid().replace(/-/g, '').substring(0, 10),
  routingNumber: faker.string.uuid().replace(/-/g, '').substring(0, 9),
  accountType: ['checking', 'savings'][Math.floor(Math.random() * 2)],
  accountHolderName: faker.person.fullName()
});

export const mockPaymentReceiptData = (payment: PaymentData, customer: any) => ({
  receiptNumber: faker.string.uuid().replace(/-/g, '').substring(0, 12).toUpperCase(),
  paymentId: payment.id,
  customerName: customer.name,
  customerEmail: customer.email,
  amount: payment.amount,
  currency: payment.currency,
  paymentMethod: payment.paymentMethod,
  timestamp: payment.createdAt,
  items: [
    {
      name: faker.commerce.productName(),
      quantity: faker.number.int({ min: 1, max: 5 }),
      price: faker.number.float({ min: 10, max: 100 }),
      total: faker.number.float({ min: 10, max: 500 })
    }
  ],
  subtotal: payment.amount - (payment.processingFees || 0),
  processingFees: payment.processingFees || 0,
  total: payment.amount
});

export const mockPaymentErrorData = () => ({
  errorCode: [
    'card_declined',
    'insufficient_funds',
    'invalid_card',
    'expired_card',
    'processing_error'
  ][Math.floor(Math.random() * 5)],
  errorMessage: faker.lorem.sentence(),
  declineCode: [
    'generic_decline',
    'do_not_honor',
    'insufficient_funds',
    'lost_card',
    'stolen_card'
  ][Math.floor(Math.random() * 5)],
  processorResponse: faker.lorem.sentence()
}); 