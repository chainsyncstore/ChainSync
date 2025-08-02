declare module 'lru-cache' {
  export interface Options<T> {
    max?: number;
    maxAge?: number;
    updateAgeOnGet?: boolean;
    dispose?: (_value: T, _key: string) => void;
  }

  export default class LRUCache<T> {
    constructor(options?: Options<T>);
    get(_key: string): T | undefined;
    set(_key: string, _value: T): void;
    delete(_key: string): boolean;
    reset(): void;
    has(_key: string): boolean;
    peek(_key: string): T | undefined;
    keys(): string[];
    values(): T[];
    length(): number;
    itemSize(): number;
    maxSize(): number;
  }
}
