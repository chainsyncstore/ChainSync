import { logger as Logger } from '../logger';
import { db } from '@db';

export abstract class BaseService {
  protected constructor(protected readonly _logger: typeof Logger) {}

  protected async withTransaction<T>(
    _callback: (_trx: any) => Promise<T>
  ): Promise<T> {
    return db.transaction(async(trx) => {
      return await callback(trx);
    });
  }
}

export class ServiceError extends Error {
  constructor(
    public readonly _code: string,
    _message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}
