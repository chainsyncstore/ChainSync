# Authentication Service

This service implements the standard service pattern for authentication functionality in ChainSync.

## Features

- Redis-based token storage for cross-instance and restart persistence
- Secure password hashing with bcrypt
- JWT token generation and validation
- Session management with activity tracking
- Security event logging

## Migration Notes

This service was migrated from the legacy auth-service.ts implementation to follow the standardized service pattern.

Key improvements:

- Proper dependency injection
- Consistent error handling with ServiceError class
- Redis integration with proper key prefixing
- Security event logging
- Proper typing with TypeScript interfaces

## Usage

```typescript
// Create service instance using factory
const authService = serviceFactory.getService(AuthService);

// Authenticate a user
const result = await authService.authenticate({
  email: 'user@example.com',
  password: 'password123',
});

// Validate a token
const payload = await authService.validateToken(token);
```
