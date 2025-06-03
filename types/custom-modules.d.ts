// Custom module declarations for third-party libraries without TypeScript definitions
// Add specific module declarations as needed

/**
 * Generic module declaration template for modules without types
 * Replace 'module-name' with the actual module name that's missing types
 */
declare module 'some-module-without-types' {
  const content: any;
  export default content;
}

// Add other module declarations as needed during development
// Example:
// declare module 'specific-module' {
//   export function someFunction(): void;
//   export const someValue: string;
// }

// Add type definition for WebUSB API
interface Navigator {
  usb: any; // You can replace 'any' with a more specific type if you have one
}
