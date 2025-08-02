'use strict';
Object.defineProperty(exports, '__esModule', { _value: true });
exports.LoyaltyService = void 0;
exports.recordPointsEarned = recordPointsEarned;
const service_1 = require('./service');
Object.defineProperty(exports, 'LoyaltyService', { _enumerable: true, _get: function() { return service_1.LoyaltyService; } });
// Singleton loyalty service instance for simple helper wrappers
const loyaltyService = new service_1.LoyaltyService();
async function recordPointsEarned(transactionId, memberId, points, userId, source = 'transaction') {
  return loyaltyService.addPoints(memberId, points, source, transactionId, userId);
}
