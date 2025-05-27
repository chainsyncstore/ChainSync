import { getCacheValue, setCacheValue, deleteCachePattern } from './redis';
import { getLogger } from '../logging';

const logger = getLogger().child({ component: 'cache-strategy' });

// Cache TTL settings (in seconds)
export const CACHE_TTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 3600, // 1 hour
  DAY: 86400, // 1 day
};

// Cache key prefixes by entity type
export const CACHE_PREFIX = {
  PRODUCT: 'product',
  INVENTORY: 'inventory',
  STORE: 'store',
  USER: 'user',
  CUSTOMER: 'customer',
  TRANSACTION: 'transaction',
  LOYALTY: 'loyalty',
  STATS: 'stats',
  DASHBOARD: 'dashboard',
};

/**
 * Generate a cache key for a specific entity
 */
export function generateEntityCacheKey(
  entityType: keyof typeof CACHE_PREFIX,
  entityId: string | number,
  suffix?: string
): string {
  return `${CACHE_PREFIX[entityType]}:${entityId}${suffix ? `:${suffix}` : ''}`;
}

/**
 * Generate a cache key for a collection/list
 */
export function generateListCacheKey(
  entityType: keyof typeof CACHE_PREFIX,
  filters: Record<string, any> = {}
): string {
  const filterString = Object.keys(filters).length 
    ? `:${Object.entries(filters)
        .map(([key, value]) => `${key}=${value}`)
        .sort()
        .join('&')}`
    : '';
  
  return `${CACHE_PREFIX[entityType]}:list${filterString}`;
}

/**
 * Fetch data from cache or execute the data fetching function and cache the result
 */
export async function getCachedOrFetch<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  ttl = CACHE_TTL.MEDIUM
): Promise<T> {
  try {
    // Try to get from cache first
    const cachedData = await getCacheValue<T>(cacheKey);
    if (cachedData !== null) {
      logger.debug('Cache hit', { cacheKey });
      return cachedData;
    }

    // Cache miss, fetch data
    logger.debug('Cache miss, fetching data', { cacheKey });
    const data = await fetchFn();
    
    // Cache the result
    await setCacheValue<T>(cacheKey, data, ttl);
    
    return data;
  } catch (error) {
    logger.error('Cache fetch error', { cacheKey, error });
    // On error, fallback to fetching the data directly
    return fetchFn();
  }
}

/**
 * Invalidate cache for an entity
 */
export async function invalidateEntityCache(
  entityType: keyof typeof CACHE_PREFIX,
  entityId: string | number
): Promise<void> {
  const pattern = `${CACHE_PREFIX[entityType]}:${entityId}*`;
  await deleteCachePattern(pattern);
  logger.debug('Entity cache invalidated', { entityType, entityId, pattern });
}

/**
 * Invalidate cache for a list/collection
 */
export async function invalidateListCache(
  entityType: keyof typeof CACHE_PREFIX
): Promise<void> {
  const pattern = `${CACHE_PREFIX[entityType]}:list*`;
  await deleteCachePattern(pattern);
  logger.debug('List cache invalidated', { entityType, pattern });
}

/**
 * Middleware for caching Express API responses
 */
export function cacheMiddleware(
  keyFn: (req: any) => string,
  ttl = CACHE_TTL.MEDIUM
) {
  return async (req: any, res: any, next: any) => {
    if (req.method !== 'GET') {
      return next();
    }

    try {
      const cacheKey = keyFn(req);
      const cachedResponse = await getCacheValue<{
        statusCode: number;
        data: any;
      }>(cacheKey);

      if (cachedResponse) {
        logger.debug('API cache hit', { 
          path: req.path, 
          cacheKey 
        });
        return res.status(cachedResponse.statusCode).json(cachedResponse.data);
      }

      // Store the original send function
      const originalSend = res.send;

      // Override the send function
      res.send = function(body: any) {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const responseData = JSON.parse(body);
          setCacheValue(
            cacheKey, 
            { 
              statusCode: res.statusCode, 
              data: responseData 
            }, 
            ttl
          ).catch(err => {
            logger.error('Error caching API response', { 
              path: req.path, 
              cacheKey, 
              error: err 
            });
          });
        }
        return originalSend.call(res, body);
      };

      next();
    } catch (error) {
      // In case of error, proceed without caching
      logger.error('Cache middleware error', { 
        path: req.path, 
        error 
      });
      next();
    }
  };
}

/**
 * Higher-order function for wrapping a service method with caching
 */
export function withCaching<T, Args extends any[]>(
  serviceFn: (...args: Args) => Promise<T>,
  cacheKeyFn: (...args: Args) => string,
  ttl = CACHE_TTL.MEDIUM
): (...args: Args) => Promise<T> {
  return async (...args: Args): Promise<T> => {
    const cacheKey = cacheKeyFn(...args);
    return getCachedOrFetch<T>(
      cacheKey,
      () => serviceFn(...args),
      ttl
    );
  };
}
