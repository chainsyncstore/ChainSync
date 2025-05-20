declare module 'lru-cache' {
  export interface Options<T> {
    max?: number;
    maxAge?: number;
    updateAgeOnGet?: boolean;
    dispose?: (value: T, key: string) => void;
  }

  export default class LRUCache<T> {
    constructor(options?: Options<T>);
    get(key: string): T | undefined;
    set(key: string, value: T): void;
    delete(key: string): boolean;
    reset(): void;
    has(key: string): boolean;
    peek(key: string): T | undefined;
    keys(): string[];
    values(): T[];
    length(): number;
    itemSize(): number;
    maxSize(): number;
  }
}
