declare module 'lru-cache' {
  interface CacheOptions<K, V> {
    max?: number;
    maxAge?: number;
    length?: (value: V, key: K) => number;
    dispose?: (key: K, value: V) => void;
    updateAgeOnGet?: boolean;
    allowStale?: boolean;
    stale?: boolean;
    noDisposeOnSet?: boolean;
  }

  interface Cache<K, V> {
    set(key: K, value: V, maxAge?: number): V;
    get(key: K): V | undefined;
    peek(key: K): V | undefined;
    has(key: K): boolean;
    delete(key: K): boolean;
    reset(): void;
    clear(): void;
    keys(): K[];
    values(): V[];
    entries(): Array<[K, V]>;
    forEach(callback: (value: V, key: K, cache: Cache<K, V>) => void): void;
    size(): number;
    length(): number;
    maxSize(): number;
    maxAge(): number;
    dispose(): void;
  }

  export default function createCache<K, V>(options?: CacheOptions<K, V>): Cache<K, V>;
}