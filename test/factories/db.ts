// test/factories/db.ts
// Utility to create a deeply-mocked PrismaClient instance
// import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import type { PrismaClient } from '@prisma/client';

export type MockPrismaClient = DeepMockProxy<PrismaClient>;

export function makeMockDb(): MockPrismaClient {
  return mockDeep<PrismaClient>();
}
