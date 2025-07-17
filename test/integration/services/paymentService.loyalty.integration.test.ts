import { PaymentService } from '@server/services/payment';
import { ConsoleLogger } from '../../../../src/logging/Logger';

describe('PaymentService Loyalty Logger Integration', () => {
  let paymentService: PaymentService;
  let loggerSpy: any;

  beforeEach(() => {
    paymentService = new PaymentService();
    paymentService.setLogger(ConsoleLogger);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should log and skip loyalty accrual for refunded transactions', async () => {
    loggerSpy = jest.spyOn(ConsoleLogger, 'info');
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
    loggerSpy = jest.spyOn(ConsoleLogger, 'info');
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
    loggerSpy = jest.spyOn(ConsoleLogger, 'info');
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
    loggerSpy = jest.spyOn(ConsoleLogger, 'info');
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
