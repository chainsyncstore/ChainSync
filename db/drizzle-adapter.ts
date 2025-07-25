export class DrizzleAdapter {
  // Placeholder adapter implementation to satisfy TypeScript until
  // a concrete implementation is provided for deployment scripts.
  // Accepts arbitrary params and returns a no-op object.
  constructor(..._args: any[]) {}
async tableExists(_name: string) { return false; }
}
