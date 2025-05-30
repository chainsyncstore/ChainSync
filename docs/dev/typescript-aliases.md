# TypeScript Path Aliases

This document outlines the standardized path aliases used throughout the ChainSync project to simplify imports and ensure consistent module resolution.

## Available Aliases

The following path aliases are configured in the project:

| Alias | Path | Description |
|-------|------|-------------|
| `@src/*` | `server/*` | Server-side code |
| `@shared/*` | `shared/*` | Shared utilities and types |
| `@db/*` | `server/db/*` | Database-related code |
| `@services/*` | `server/services/*` | Service implementations |
| `@utils/*` | `server/utils/*` | Utility functions |

## Usage Examples

Before:
```typescript
import { UserService } from '../../services/user/user-service';
import { DbClient } from '../../../db/client';
```

After:
```typescript
import { UserService } from '@services/user/user-service';
import { DbClient } from '@db/client';
```

## Configuration

Path aliases are centrally defined in `tsconfig.paths.json` and included in the project configurations:

- `tsconfig.json` - Main project configuration
- `tsconfig.server.json` - Server-specific configuration
- `jest.config.cjs` - Test configuration

## Adding New Aliases

If you need to add a new path alias:

1. Update `tsconfig.paths.json` with the new alias
2. Run the import migration script to update existing imports: `node scripts/migrate-imports.js`
3. Update this documentation with the new alias

## Benefits

- Shorter, more readable import statements
- No need for complex relative paths (../../..)
- More maintainable when files are moved or renamed
- Easier to understand the module's source at a glance

## Tooling Support

The path aliases are supported by the following tools:

- **TypeScript Compiler**: Through `tsconfig.paths.json`
- **Jest**: Using `pathsToModuleNameMapper` utility
- **ESLint**: Using `eslint-import-resolver-typescript`

## Migration

To convert existing imports to use the new path aliases, run:

```bash
node scripts/migrate-imports.js
```

This script will automatically convert appropriate relative imports to use the standardized aliases.
