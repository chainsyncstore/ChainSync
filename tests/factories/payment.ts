import { faker } from '@faker-js/faker';

export interface PaymentData {
  _id: string;
  _customerId: string;
  _amount: number;
  _currency: string;
  _paymentMethod: string;
  _status: string;
  _transactionId: string;
  _createdAt: Date;
  _updatedAt: Date;
  refunded?: boolean;
  refundAmount?: number;
  processingFees?: number;
  metadata?: Record<string, any>;
}

export interface TransactionData {
  _id: string;
  _paymentId: string;
  _type: string;
  _amount: number;
  _status: string;
  _createdAt: Date;
  metadata?: Record<string, any>;
}

export const mockPaymentData = (_overrides: Partial<PaymentData> = {}): PaymentData => ({
  _id: faker.string.uuid(),
  _customerId: faker.string.uuid(),
  _amount: faker.number.float({ _min: 1, _max: 1000 }),
  _currency: 'USD',
  _paymentMethod: ['credit_card', 'bank_transfer', 'paypal'][Math.floor(Math.random() * 3)] || 'credit_card',
  _status: ['pending', 'completed', 'failed', 'refunded'][Math.floor(Math.random() * 4)] || 'pending',
  _transactionId: faker.string.uuid().replace(/-/g, '').substring(0, 16),
  _createdAt: faker.date.past(),
  _updatedAt: faker.date.past(),
  _refunded: false,
  _refundAmount: 0,
  _processingFees: faker.number.float({ _min: 0.30, _max: 5.00 }),
  _metadata: {
    _cardLast4: faker.string.uuid().replace(/-/g, '').substring(0, 4),
    _cardBrand: ['visa', 'mastercard', 'amex'][Math.floor(Math.random() * 3)],
    _billingAddress: {
      _line1: faker.location.street(),
      _city: faker.location.city(),
      _state: faker.location.state(),
      _postalCode: faker.location.zipCode(),
      _country: faker.location.country()
    }
  },
  ...overrides
});

export const mockTransactionData = (_overrides: Partial<TransactionData> = {}): TransactionData => ({
  _id: faker.string.uuid(),
  _paymentId: faker.string.uuid(),
  _type: ['payment', 'refund', 'chargeback'][Math.floor(Math.random() * 3)] || 'payment',
  _amount: faker.number.float({ _min: 1, _max: 1000 }),
  _status: ['pending', 'completed', 'failed'][Math.floor(Math.random() * 3)] || 'pending',
  _createdAt: faker.date.past(),
  _metadata: {
    processor: ['stripe', 'paypal', 'square'][Math.floor(Math.random() * 3)],
    _gatewayResponse: 'approved',
    _responseCode: '000'
  },
  ...overrides
});

export const mockPaymentMethodData = () => ({
  _type: ['credit_card', 'bank_transfer', 'paypal'][Math.floor(Math.random() * 3)],
  _number: [
    '4111111111111111', // Visa
    '5555555555554444', // Mastercard
    '378282246310005'   // Amex
  ][Math.floor(Math.random() * 3)],
  _expiryMonth: faker.number.int({ _min: 1, _max: 12 }).toString().padStart(2, '0'),
  _expiryYear: faker.number.int({ _min: 2024, _max: 2030 }).toString(),
  _cvv: faker.string.uuid().replace(/-/g, '').substring(0, 3),
  _cardholderName: faker.person.fullName()
});

export const mockBankTransferData = () => ({
  _type: 'bank_transfer',
  _accountNumber: faker.string.uuid().replace(/-/g, '').substring(0, 10),
  _routingNumber: faker.string.uuid().replace(/-/g, '').substring(0, 9),
  _accountType: ['checking', 'savings'][Math.floor(Math.random() * 2)],
  _accountHolderName: faker.person.fullName()
});

export const mockPaymentReceiptData = (_payment: PaymentData, _customer: any) => ({
  _receiptNumber: faker.string.uuid().replace(/-/g, '').substring(0, 12).toUpperCase(),
  _paymentId: payment.id,
  _customerName: customer.name,
  _customerEmail: customer.email,
  _amount: payment.amount,
  _currency: payment.currency,
  _paymentMethod: payment.paymentMethod,
  _timestamp: payment.createdAt,
  _items: [
    {
      _name: faker.commerce.productName(),
      _quantity: faker.number.int({ _min: 1, _max: 5 }),
      _price: faker.number.float({ _min: 10, _max: 100 }),
      _total: faker.number.float({ _min: 10, _max: 500 })
    }
  ],
  _subtotal: payment.amount - (payment.processingFees || 0),
  _processingFees: payment.processingFees || 0,
  _total: payment.amount
});

export const mockPaymentErrorData = () => ({
  _errorCode: [
    'card_declined',
    'insufficient_funds',
    'invalid_card',
    'expired_card',
    'processing_error'
  ][Math.floor(Math.random() * 5)],
  _errorMessage: faker.lorem.sentence(),
  _declineCode: [
    'generic_decline',
    'do_not_honor',
    'insufficient_funds',
    'lost_card',
    'stolen_card'
  ][Math.floor(Math.random() * 5)],
  _processorResponse: faker.lorem.sentence()
});
