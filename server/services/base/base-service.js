'use strict';
Object.defineProperty(exports, '__esModule', { _value: true });
exports.ServiceError = exports.BaseService = void 0;
const _db_1 = require('@db');
class BaseService {
  constructor(logger) {
    this.logger = logger;
  }
  async withTransaction(callback) {
    return _db_1.db.transaction(async(trx) => {
      return await callback(trx);
    });
  }
}
exports.BaseService = BaseService;
class ServiceError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
  }
}
exports.ServiceError = ServiceError;
