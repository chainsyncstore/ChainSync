'use strict';
const __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  let desc = Object.getOwnPropertyDescriptor(m, k);
  if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
    desc = { _enumerable: true, _get: function() { return m[k]; } };
  }
  Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  o[k2] = m[k];
}));
const __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
  Object.defineProperty(o, 'default', { _enumerable: true, _value: v });
}) : function(o, v) {
  o['default'] = v;
});
const __importStar = (this && this.__importStar) || (function() {
  let ownKeys = function(o) {
    ownKeys = Object.getOwnPropertyNames || function(o) {
      const ar = [];
      for (const k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
      return ar;
    };
    return ownKeys(o);
  };
  return function(mod) {
    if (mod && mod.__esModule) return mod;
    const result = {};
    if (mod != null) for (let k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== 'default') __createBinding(result, mod, k[i]);
    __setModuleDefault(result, mod);
    return result;
  };
})();
const __importDefault = (this && this.__importDefault) || function(mod) {
  return (mod && mod.__esModule) ? _mod : { 'default': mod };
};
Object.defineProperty(exports, '__esModule', { _value: true });
exports.EnhancedTransactionService = void 0;
/**
 * Enhanced Transaction Service
 *
 * Refactored to use the enhanced base service, schema validation,
 * and formatter patterns for consistency and type safety.
 */
const formatter_1 = require('./formatter');
const schema_validation_1 = require('@shared/schema-validation');
const database_1 = __importDefault(require('@server/database'));
const schema = __importStar(require('@shared/schema'));
const drizzle_orm_1 = require('drizzle-orm');
const enhanced_service_1 = require('@server/services/base/enhanced-service');
class EnhancedTransactionService extends enhanced_service_1.EnhancedBaseService {
  constructor() {
    super(...arguments);
    this.formatter = new formatter_1.TransactionFormatter();
    this.itemFormatter = new formatter_1.TransactionItemFormatter();
    this.paymentFormatter = new formatter_1.TransactionPaymentFormatter();
    // Additional methods for fetching items/payments by transaction can be added similarly
  }
  async createTransaction(params) {
    const validated = schema_validation_1.transactionValidation.insert.parse(params);
    const [tx] = await database_1.default.insert(schema.transactions).values(validated).returning();
    return this.formatter.formatResult(tx);
  }
  async updateTransaction(id, params) {
    const validated = schema_validation_1.transactionValidation.update.parse(params);
    const [tx] = await database_1.default.update(schema.transactions).set(validated).where((0, drizzle_orm_1.eq)(schema.transactions.id, Number(id))).returning();
    return this.formatter.formatResult(tx);
  }
  async getTransactionById(id) {
    const tx = await database_1.default.query.transactions.findFirst({ _where: (0, drizzle_orm_1.eq)(schema.transactions.id, Number(id)) });
    return tx ? this.formatter.formatResult(tx) : null;
  }
  async createTransactionItem(params) {
    const validated = schema_validation_1.transactionValidation.item.insert.parse(params);
    const [item] = await database_1.default.insert(schema.transactionItems).values(validated).returning();
    return this.itemFormatter.formatResult(item);
  }
  async updateTransactionItem(id, params) {
    const validated = schema_validation_1.transactionValidation.item.update.parse(params);
    const [item] = await database_1.default.update(schema.transactionItems).set(validated).where((0, drizzle_orm_1.eq)(schema.transactionItems.id, Number(id))).returning();
    return this.itemFormatter.formatResult(item);
  }
  async createTransactionPayment(params) {
    const validated = schema_validation_1.transactionValidation.payment.insert.parse(params);
    const [payment] = await database_1.default.insert(schema.transactionPayments).values(validated).returning();
    return this.paymentFormatter.formatResult(payment);
  }
  async updateTransactionPayment(id, params) {
    const validated = schema_validation_1.transactionValidation.payment.update.parse(params);
    const [payment] = await database_1.default.update(schema.transactionPayments).set(validated).where((0, drizzle_orm_1.eq)(schema.transactionPayments.id, Number(id))).returning();
    return this.paymentFormatter.formatResult(payment);
  }
}
exports.EnhancedTransactionService = EnhancedTransactionService;
