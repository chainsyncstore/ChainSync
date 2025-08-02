declare module 'lru-cache' {
  interface CacheOptions<K, V> {
    max?: number;
    maxAge?: number;
    length?: (_value: V, _key: K) => number;
    dispose?: (_key: K, _value: V) => void;
    updateAgeOnGet?: boolean;
    allowStale?: boolean;
    stale?: boolean;
    noDisposeOnSet?: boolean;
  }

  interface Cache<K, V> {
    set(_key: K, _value: V, maxAge?: number): V;
    get(_key: K): V | undefined;
    peek(_key: K): V | undefined;
    has(_key: K): boolean;
    delete(_key: K): boolean;
    reset(): void;
    clear(): void;
    keys(): K[];
    values(): V[];
    entries(): Array<[K, V]>;
    forEach(callback: (_value: V, _key: K, _cache: Cache<K, V>) => void): void;
    size(): number;
    length(): number;
    maxSize(): number;
    maxAge(): number;
    dispose(): void;
  }

  export default function createCache<K, V>(options?: CacheOptions<K, V>): Cache<K, V>;
}