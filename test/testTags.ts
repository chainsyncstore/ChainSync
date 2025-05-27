// test/testTags.ts
// Lightweight test tagging utility for Jest (unit/integration)
// Usage: import { test, describe } from './testTags';

// TypeScript interface for a function that runs a test with a tag
interface TaggedTestRunner {
  (name: string, fn: jest.ProvidesCallback, timeout?: number): void;
  // Add .only, .skip, .todo if you use them with tags
  only: TaggedTestRunner;
  skip: TaggedTestRunner;
  todo: (name: string) => void;
}

// Interface for the exported 'test' object
interface TaggedTest extends TaggedTestRunner {
  unit: TaggedTestRunner;
  integration: TaggedTestRunner;
}

// TypeScript interface for a function that runs a describe block with a tag
interface TaggedDescribeRunner {
  (name: string, fn: jest.EmptyFunction): void;
  // Add .only, .skip if you use them with tags
  only: TaggedDescribeRunner;
  skip: TaggedDescribeRunner;
}

// Interface for the exported 'describe' object
interface TaggedDescribe extends TaggedDescribeRunner {
  unit: TaggedDescribeRunner;
  integration: TaggedDescribeRunner;
}

// Helper to create a *specific* tagged test function with .only, .skip, .todo
function createSpecificTaggedTest(tag: string, base: typeof global.test): TaggedTestRunner {
  const runner: TaggedTestRunner = ((name: string, fn: jest.ProvidesCallback, timeout?: number) =>
    base(`[${tag}] ${name}`, fn, timeout)) as TaggedTestRunner;
  
  runner.only = ((name: string, fn: jest.ProvidesCallback, timeout?: number) =>
    base.only(`[${tag}] ${name}`, fn, timeout)) as TaggedTestRunner;
  runner.skip = ((name: string, fn: jest.ProvidesCallback, timeout?: number) =>
    base.skip(`[${tag}] ${name}`, fn, timeout)) as TaggedTestRunner;
  runner.todo = (name: string) => base.todo(`[${tag}] ${name}`);
  
  return runner;
}

// Helper to create a *specific* tagged describe function with .only, .skip
function createSpecificTaggedDescribe(tag: string, base: typeof global.describe): TaggedDescribeRunner {
  const runner: TaggedDescribeRunner = ((name: string, fn: jest.EmptyFunction) =>
    base(`[${tag}] ${name}`, fn)) as TaggedDescribeRunner;

  runner.only = ((name: string, fn: jest.EmptyFunction) =>
    base.only(`[${tag}] ${name}`, fn)) as TaggedDescribeRunner;
  runner.skip = ((name: string, fn: jest.EmptyFunction) =>
    base.skip(`[${tag}] ${name}`, fn)) as TaggedDescribeRunner;
    
  return runner;
}

// Create the main 'test' export
// Calls to test() will use 'unit' tag by default, matching original implicit behavior
const mainTestRunner = createSpecificTaggedTest('unit', global.test);
const testExport = mainTestRunner as TaggedTest; // Cast to allow adding properties

// Assign specific tag runners
testExport.unit = createSpecificTaggedTest('unit', global.test);
testExport.integration = createSpecificTaggedTest('integration', global.test);

// Create the main 'describe' export
// Calls to describe() will use 'unit' tag by default
const mainDescribeRunner = createSpecificTaggedDescribe('unit', global.describe);
const describeExport = mainDescribeRunner as TaggedDescribe; // Cast to allow adding properties

// Assign specific tag runners
describeExport.unit = createSpecificTaggedDescribe('unit', global.describe);
describeExport.integration = createSpecificTaggedDescribe('integration', global.describe);

export const test = testExport;
export const describe = describeExport;

// Now you can use:
// test('[my default tag - unit] name', () => { ... });
// test.unit('[unit] name', () => { ... });
// test.integration('[integration] name', () => { ... });
// describe.unit('[unit] block', () => { ... });
// describe.integration('[integration] block', () => { ... });
