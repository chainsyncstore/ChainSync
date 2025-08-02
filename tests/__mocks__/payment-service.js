// Jest stub for PaymentService used in integration tests
const { ConsoleLogger } = require('./logger');

class PaymentServiceMock {
  constructor() {
    this.logger = ConsoleLogger;
  }
  setLogger(logger) {
    this.logger = logger;
  }
  // Mimic async method with logging matching expectations
  async handleLoyaltyAccrual({ transactionId, customerId, status, flagged }) {
    if (status === 'refunded' || status === 'failed' || flagged) {
      const reason = flagged ? 'flagged' : status;
      this.logger.info('Loyalty accrual skipped', { transactionId, customerId, reason });
      return;
    }
    this.logger.info('Loyalty accrued', { transactionId, customerId, status });
  }
}
module.exports = { _PaymentService: PaymentServiceMock, _default: PaymentServiceMock };
