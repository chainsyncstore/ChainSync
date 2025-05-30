import { Logger } from '../logger';
import { db } from '@db';

export abstract class BaseService {
  protected constructor(protected readonly logger: Logger) {}

  protected async withTransaction<T>(
    callback: (trx: unknown) => Promise<T>
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
