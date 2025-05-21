// This file helps TypeScript understand the path aliases used in the project
declare module "@/*" {
  // This tells TypeScript that modules from @/* are in the client/src directory
  const value: any;
  export default value;
}

declare module "@/components/*" {
  const value: any;
  export default value;
}

declare module "@/lib/*" {
  const value: any;
  export default value;
}

declare module "@/providers/*" {
  const value: any;
  export default value;
}

declare module "@/pages/*" {
  const value: any;
  export default value;
}
