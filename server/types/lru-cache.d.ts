declare module 'lru-cache' {
  class LRUCache<K, V> {
    constructor(options?: {
      max?: number;
      maxAge?: number;
    });

    set(key: K, value: V): boolean;
    get(key: K): V | undefined;
    delete(key: K): boolean;
    clear(): void;
    prune(): void;
    size: number;
  }
}
