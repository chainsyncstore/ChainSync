import { jest } from '@jest/globals';
import { PaymentService } from '@server/services/payment/payment-service';
import { ConsoleLogger } from '../../../src/logging/Logger'; // Reverted to relative path

describe('PaymentService Loyalty Logger Integration', () => {
  let paymentService: PaymentService;
  let consoleLoggerInstance: ConsoleLogger;
  let loggerSpy: jest.SpiedFunction<typeof consoleLoggerInstance.info>; // More precise type

  beforeEach(() => {
    consoleLoggerInstance = new ConsoleLogger(); // Create an instance
    paymentService = new PaymentService();
    paymentService.setLogger(consoleLoggerInstance); // Set the instance
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should log and skip loyalty accrual for refunded transactions', async () => {
    loggerSpy = jest.spyOn(consoleLoggerInstance, 'info');
    await paymentService.handleLoyaltyAccrual({
      transactionId: 'TXN1',
      customerId: 42,
      status: 'refunded',
    });
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('Loyalty accrual skipped'),
      expect.objectContaining({ transactionId: 'TXN1', customerId: 42, reason: 'refunded' })
    );
  });

  it('should log and skip loyalty accrual for failed transactions', async () => {
    loggerSpy = jest.spyOn(consoleLoggerInstance, 'info');
    await paymentService.handleLoyaltyAccrual({
      transactionId: 'TXN2',
      customerId: 99,
      status: 'failed',
    });
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('Loyalty accrual skipped'),
      expect.objectContaining({ transactionId: 'TXN2', customerId: 99, reason: 'failed' })
    );
  });

  it('should log and skip loyalty accrual for flagged transactions', async () => {
    loggerSpy = jest.spyOn(consoleLoggerInstance, 'info');
    await paymentService.handleLoyaltyAccrual({
      transactionId: 'TXN3',
      customerId: 77,
      status: 'success',
      flagged: true,
    });
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('Loyalty accrual skipped'),
      expect.objectContaining({ transactionId: 'TXN3', customerId: 77, reason: 'flagged' })
    );
  });

  it('should log loyalty accrual for successful transaction', async () => {
    loggerSpy = jest.spyOn(consoleLoggerInstance, 'info');
    await paymentService.handleLoyaltyAccrual({
      transactionId: 'TXN4',
      customerId: 55,
      status: 'success',
    });
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('Loyalty accrued'),
      expect.objectContaining({ transactionId: 'TXN4', customerId: 55, status: 'success' })
    );
  });
});
