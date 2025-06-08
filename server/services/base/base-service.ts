import { Logger } from '../../../src/logging'; // Corrected logger import path
import { db } from '../../database'; // Corrected db import path
// Removed NeonDatabase and schema imports as typeof db will be used

// Define TransactionType using typeof db
type TransactionType = typeof db;

export abstract class BaseService {
  protected constructor(protected readonly logger: Logger) {}

  protected async withTransaction<T>(callback: (trx: TransactionType) => Promise<T>): Promise<T> {
    // The 'trx' in db.transaction callback should be compatible with typeof db
    return db.transaction(async trx => {
      // The trx object from the transaction callback should be assignable to TransactionType (typeof db)
      // If there's still a slight mismatch, an explicit cast might be needed,
      // but ideally Drizzle's typings handle this.
      return await callback(trx);
    });
  }
}

export class ServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}
