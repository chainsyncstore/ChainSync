declare module 'lru-cache' {
  class LRUCache<K, V> {
    constructor(options?: {
      max?: number;
      maxAge?: number;
    });

    set(_key: K, _value: V): boolean;
    get(_key: K): V | undefined;
    delete(_key: K): boolean;
    clear(): void;
    prune(): void;
    _size: number;
  }
}
