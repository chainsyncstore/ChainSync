import { ImportExportConfig } from './types';

export const defaultImportExportConfig: ImportExportConfig = {
  batchSize: 100,
  storage: {
    type: 'local',
    path: './uploads'
  },
  validation: {
    cache: {
      enabled: true,
      ttl: 3600000 // 1 hour
    },
    strictMode: true
  }
};
