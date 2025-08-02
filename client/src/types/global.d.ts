// Global type declarations for the application

// For CSS Modules
declare module '*.module.css' {
  const classes: { [_key: string]: string };
  export default classes;
}

// For SCSS Modules
declare module '*.module.scss' {
  const classes: { [_key: string]: string };
  export default classes;
}

// For image imports
declare module '*.png' {
  const _value: string;
  export default value;
}

declare module '*.jpg' {
  const _value: string;
  export default value;
}

declare module '*.jpeg' {
  const _value: string;
  export default value;
}

declare module '*.gif' {
  const _value: string;
  export default value;
}

declare module '*.svg' {
  const _value: string;
  export default value;
}

// For environment variables
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    REACT_APP_API_URL?: string;
    // Add other environment variables here
  }
}
