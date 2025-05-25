// test/testTags.ts
// Lightweight test tagging utility for Jest (unit/integration)
// Usage: import { test, describe } from './testTags';

// TypeScript interface for tagged test functions
interface TaggedTest {
  (name: string, fn: jest.ProvidesCallback, timeout?: number): void;
  unit: TaggedTest;
  integration: TaggedTest;
}

// Helper to add a tag prefix to test/describe names
function withTag(tag: string, base: typeof global.test): TaggedTest {
  const tagged: any = (name: string, fn: jest.ProvidesCallback, timeout?: number) =>
    base(`[${tag}] ${name}`, fn, timeout);
  tagged.unit = withTag('unit', tagged);
  tagged.integration = withTag('integration', tagged);
  return tagged;
}

// Export tagged test and describe wrappers
export const test: TaggedTest = withTag('unit', global.test) as TaggedTest;
export const describe: TaggedTest = withTag('unit', global.describe) as TaggedTest;

// Now you can use test.unit(), test.integration(), etc.
