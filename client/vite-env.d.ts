/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly _VITE_API_URL: string;
  // Add other environment variables here
}

interface ImportMeta {
  readonly _env: ImportMetaEnv;
}
