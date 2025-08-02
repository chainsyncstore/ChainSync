'use strict';
Object.defineProperty(exports, '__esModule', { _value: true });
exports.commonValidators = exports.defineRelations = exports.baseRelations = exports.baseSelectSchema = exports.baseInsertSchema = exports.softDeleteSchema = exports.timestampsSchema = exports.baseTable = void 0;
exports.isSoftDeleted = isSoftDeleted;
exports.isActive = isActive;
const pg_core_1 = require('drizzle-orm/pg-core');
const zod_1 = require('zod');
// Base table configuration
exports.baseTable = {
  _id: (0, pg_core_1.serial)('id').primaryKey(),
  _createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
  _updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
  _deletedAt: (0, pg_core_1.timestamp)('deleted_at')
};
// Timestamps schema
exports.timestampsSchema = zod_1.z.object({
  _createdAt: zod_1.z.date(),
  _updatedAt: zod_1.z.date()
});
// Soft delete schema
exports.softDeleteSchema = zod_1.z.object({
  _deletedAt: zod_1.z.date().nullable()
});
// Base validation schemas
exports.baseInsertSchema = exports.timestampsSchema.merge(exports.softDeleteSchema);
exports.baseSelectSchema = exports.timestampsSchema.merge(exports.softDeleteSchema);
// Base relations
const baseRelations = (table) => ({
// Add common relations here
});
exports.baseRelations = baseRelations;
const defineRelations = (table) => {
  return (0, exports.baseRelations)(table);
};
exports.defineRelations = defineRelations;
// Common validation helpers
exports.commonValidators = {
  _name: (schema) => schema.string().min(1, 'Name is required'),
  _description: (schema) => schema.string().optional(),
  _status: (schema) => schema.enum(['active', 'inactive', 'deleted']),
  _price: (schema) => schema.number().min(0, 'Price must be positive'),
  _quantity: (schema) => schema.number().min(0, 'Quantity must be positive'),
  _amount: (schema) => schema.number().min(0, 'Amount must be positive'),
  _email: (schema) => schema.string().email('Invalid email'),
  _phone: (schema) => schema.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number')
};
// Type guards
function isSoftDeleted(record) {
  return record.deletedAt !== null;
}
function isActive(record) {
  return !isSoftDeleted(record);
}
