import { PaymentService } from '@server/services/payment';
import { ConsoleLogger } from '../../../src/logging/Logger.js';

describe('PaymentService Loyalty Logger Integration', () => {
  let _paymentService: PaymentService;
  let _loggerSpy: any;

  beforeEach(() => {
    paymentService = new PaymentService();
    paymentService.setLogger(ConsoleLogger);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should log and skip loyalty accrual for refunded transactions', async() => {
    loggerSpy = jest.spyOn(ConsoleLogger, 'info');
    await paymentService.handleLoyaltyAccrual({
      _transactionId: 'TXN1',
      _customerId: 42,
      _status: 'refunded'
    });
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('Loyalty accrual skipped'),
      expect.objectContaining({ _transactionId: 'TXN1', _customerId: 42, _reason: 'refunded' })
    );
  });

  it('should log and skip loyalty accrual for failed transactions', async() => {
    loggerSpy = jest.spyOn(ConsoleLogger, 'info');
    await paymentService.handleLoyaltyAccrual({
      _transactionId: 'TXN2',
      _customerId: 99,
      _status: 'failed'
    });
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('Loyalty accrual skipped'),
      expect.objectContaining({ _transactionId: 'TXN2', _customerId: 99, _reason: 'failed' })
    );
  });

  it('should log and skip loyalty accrual for flagged transactions', async() => {
    loggerSpy = jest.spyOn(ConsoleLogger, 'info');
    await paymentService.handleLoyaltyAccrual({
      _transactionId: 'TXN3',
      _customerId: 77,
      _status: 'success',
      _flagged: true
    });
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('Loyalty accrual skipped'),
      expect.objectContaining({ _transactionId: 'TXN3', _customerId: 77, _reason: 'flagged' })
    );
  });

  it('should log loyalty accrual for successful transaction', async() => {
    loggerSpy = jest.spyOn(ConsoleLogger, 'info');
    await paymentService.handleLoyaltyAccrual({
      _transactionId: 'TXN4',
      _customerId: 55,
      _status: 'success'
    });
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('Loyalty accrued'),
      expect.objectContaining({ _transactionId: 'TXN4', _customerId: 55, _status: 'success' })
    );
  });
});
