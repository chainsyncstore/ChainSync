import { Logger } from '../logger';
import { db } from '@db';

import { Transaction } from 'drizzle-orm';

export abstract class BaseService {
  protected constructor(protected readonly logger: Logger) {}

  protected async withTransaction<T>(
    callback: (trx: Transaction<any, any, any, any>) => Promise<T>
  ): Promise<T> {
    return db.transaction(async (trx) => {
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
