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
  amount: faker.number.float({ min: 1, max: 1000, precision: 0.01 }),
  currency: 'USD',
  paymentMethod: faker.helpers.arrayElement(['credit_card', 'bank_transfer', 'paypal']),
  status: faker.helpers.arrayElement(['pending', 'completed', 'failed', 'refunded']),
  transactionId: faker.string.alphanumeric(16),
  createdAt: faker.date.recent(),
  updatedAt: faker.date.recent(),
  refunded: false,
  refundAmount: 0,
  processingFees: faker.number.float({ min: 0.30, max: 5.00, precision: 0.01 }),
  metadata: {
    cardLast4: faker.string.numeric(4),
    cardBrand: faker.helpers.arrayElement(['visa', 'mastercard', 'amex']),
    billingAddress: {
      line1: faker.location.streetAddress(),
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
  type: faker.helpers.arrayElement(['payment', 'refund', 'chargeback']),
  amount: faker.number.float({ min: 1, max: 1000, precision: 0.01 }),
  status: faker.helpers.arrayElement(['pending', 'completed', 'failed']),
  createdAt: faker.date.recent(),
  metadata: {
    processor: faker.helpers.arrayElement(['stripe', 'paypal', 'square']),
    gatewayResponse: 'approved',
    responseCode: '000'
  },
  ...overrides
});

export const mockPaymentMethodData = () => ({
  type: faker.helpers.arrayElement(['credit_card', 'bank_transfer', 'paypal']),
  number: faker.helpers.arrayElement([
    '4111111111111111', // Visa
    '5555555555554444', // Mastercard
    '378282246310005'   // Amex
  ]),
  expiryMonth: faker.number.int({ min: 1, max: 12 }).toString().padStart(2, '0'),
  expiryYear: faker.number.int({ min: 2024, max: 2030 }).toString(),
  cvv: faker.string.numeric(3),
  cardholderName: faker.person.fullName()
});

export const mockBankTransferData = () => ({
  type: 'bank_transfer',
  accountNumber: faker.string.numeric(10),
  routingNumber: faker.string.numeric(9),
  accountType: faker.helpers.arrayElement(['checking', 'savings']),
  accountHolderName: faker.person.fullName()
});

export const mockPaymentReceiptData = (payment: PaymentData, customer: any) => ({
  receiptNumber: faker.string.alphanumeric(12).toUpperCase(),
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
      price: faker.number.float({ min: 10, max: 100, precision: 0.01 }),
      total: faker.number.float({ min: 10, max: 500, precision: 0.01 })
    }
  ],
  subtotal: payment.amount - (payment.processingFees || 0),
  processingFees: payment.processingFees || 0,
  total: payment.amount
});

export const mockPaymentErrorData = () => ({
  errorCode: faker.helpers.arrayElement([
    'card_declined',
    'insufficient_funds',
    'invalid_card',
    'expired_card',
    'processing_error'
  ]),
  errorMessage: faker.lorem.sentence(),
  declineCode: faker.helpers.arrayElement([
    'generic_decline',
    'do_not_honor',
    'insufficient_funds',
    'lost_card',
    'stolen_card'
  ]),
  processorResponse: faker.lorem.sentence()
}); 