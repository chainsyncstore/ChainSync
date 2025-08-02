// Stub declarations for third-party modules without type definitions
// This allows the TypeScript compiler to treat imports as 'any'.

declare module 'react-day-picker';
declare module 'embla-carousel-react';
declare module 'cmdk';
declare module 'vaul';
declare module 'input-otp';
declare module 'react-resizable-panels';
declare module 'framer-motion';
declare module '@sentry/react';
declare module 'react-router-dom';

declare module 'jest';
declare module '@playwright/test';

// Jest types stub
declare module 'jest' {
  export type Config = {
    [_key: string]: any;
  };
}

// Additional stubs
declare module 'jest-mock-extended' {
  export function mockDeep<T>(): T & DeepMockProxy<T>;
  export interface DeepMockProxy<T> extends Record<string, any> {}
}
declare module '@prisma/client' {
  export class PrismaClient {}
  export type PrismaClientKnownRequestError = any;
  export type PrismaClientInitializationError = any;
  export type PrismaClientValidationError = any;
}
declare module 'connect-pg-simple';
