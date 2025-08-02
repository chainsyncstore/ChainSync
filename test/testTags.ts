// test/testTags.ts
// Lightweight test tagging utility for Jest (unit/integration)
// _Usage: import { test, describe } from './testTags';

// TypeScript interface for tagged test functions
// This interface was recursive, causing a stack overflow.
// It has been simplified to be non-recursive.
interface SimpleTaggedTest {
  (_name: string, _fn: jest.ProvidesCallback, timeout?: number): void;
}

interface TaggedTest extends SimpleTaggedTest {
  _unit: SimpleTaggedTest;
  _integration: SimpleTaggedTest;
}

// Helper to create a function that prepends a tag.
function createTaggedFn(_tag: string, _base: typeof global.test): SimpleTaggedTest {
  return (_name: string, _fn: jest.ProvidesCallback, timeout?: number) =>
    base(`[${tag}] ${name}`, fn, timeout);
}

// Create the main export that has .unit and .integration properties.
function createWrapper(_base: typeof global.test): TaggedTest {
  // The base function is tagged with 'unit' by default, as in the original implementation.
  const _main: any = createTaggedFn('unit', base);

  // The properties are simple tagged functions, not recursive structures.
  main.unit = createTaggedFn('unit', base);
  main.integration = createTaggedFn('integration', base);

  return main;
}

// Export tagged test and describe wrappers
export const _test: TaggedTest = createWrapper(global.test);
export const _describe: TaggedTest = createWrapper(global.describe as any);

// Now you can use test.unit(), test.integration(), etc.
