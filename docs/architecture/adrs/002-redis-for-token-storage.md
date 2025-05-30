# ADR-002: Redis for Token Storage

## Date

2025-05-15

## Status

Accepted

## Context

The ChainSync authentication system initially used in-memory storage for JWT tokens and session data. While functional for development and small-scale deployments, this approach had several limitations:

1. **Persistence Issues**: Token and session data was lost on application restart, forcing users to re-authenticate
2. **Scalability Limitations**: In-memory storage couldn't be shared across multiple application instances
3. **Memory Usage Concerns**: High user counts could lead to excessive memory usage
4. **No Automatic Cleanup**: Expired tokens and sessions accumulated without TTL-based expiration
5. **Limited Session Metadata**: Minimal metadata was stored about user sessions
6. **Single Point of Failure**: Token data was confined to a single application instance

As part of the security improvement plan (Phase A - Task 4), we needed to improve the token and session management to support production readiness.

## Decision

We have decided to migrate the authentication system's token and session storage from in-memory to Redis. This includes:

1. **Redis as Token Store**: Using Redis for JWT token storage with proper key prefixing
2. **Redis as Session Store**: Using Redis for session data with metadata
3. **TTL-based Expiration**: Leveraging Redis's built-in TTL capabilities for automatic cleanup
4. **Enhanced Session Tracking**: Storing additional metadata about sessions
5. **Resilient Implementation**: Adding fallback mechanisms for scenarios where Redis is temporarily unavailable

The implementation includes the following key patterns:

- Key Prefixing: Using `auth:token:` and `auth:session:` prefixes for organization
- Metadata Enrichment: Storing creation time, last activity, device info, etc.
- Automatic Expiration: Setting appropriate TTLs to match token lifetimes
- Graceful Degradation: Implementing fallbacks when Redis is unavailable

## Alternatives Considered

### 1. Database Storage (PostgreSQL)

**Pros**:
- Consistent storage with other application data
- Strong ACID guarantees
- Familiar query patterns

**Cons**:
- Higher latency than Redis
- No built-in TTL mechanism
- More complex query patterns for token validation
- Higher overhead for simple key-value operations

### 2. Distributed Cache (Memcached)

**Pros**:
- High performance
- Distributed architecture
- Low latency

**Cons**:
- Less feature-rich than Redis (no built-in data structures)
- Less persistent than Redis
- No transaction support
- Limited metadata capabilities

### 3. JWT Without Storage

**Pros**:
- Truly stateless
- No storage requirements
- Simpler implementation

**Cons**:
- Cannot revoke tokens before expiration
- No session tracking capabilities
- Security limitations for sensitive operations
- No way to force logout across devices

## Consequences

### Positive

1. **Improved User Experience**:
   - Sessions persist across application restarts
   - Users don't need to re-authenticate unnecessarily
   - Better multi-device session management

2. **Enhanced Scalability**:
   - Multiple application instances can share authentication state
   - Horizontal scaling is now possible for the API layer
   - Token validation performance is improved

3. **Better Security**:
   - Tokens can be explicitly revoked when needed
   - Security events can trigger token/session invalidation
   - More detailed tracking of session activity

4. **Operational Benefits**:
   - Automatic cleanup of expired tokens and sessions
   - Better visibility into active sessions
   - Reduced memory pressure on application servers

### Negative

1. **Additional Dependency**:
   - Redis becomes a critical infrastructure component
   - Redis failures can impact authentication
   - Requires Redis monitoring and management

2. **Implementation Complexity**:
   - More complex code for token and session management
   - Need for fallback mechanisms
   - Additional configuration requirements

3. **Operational Complexity**:
   - Redis cluster management in production
   - Additional monitoring requirements
   - Backup and recovery considerations for Redis

## Implementation

The migration to Redis for token storage has been implemented through the following steps:

1. **Redis Integration**:
   - Added Redis client configuration
   - Implemented connection pooling and error handling
   - Added health checks for Redis connectivity

2. **Token Storage**:
   - Implemented token storage with Redis SET operations
   - Added TTL-based expiration matching token lifetimes
   - Created token revocation capabilities

3. **Session Management**:
   - Enhanced session data with metadata
   - Implemented session tracking with last activity updates
   - Added session enumeration and management features

4. **Resilience Patterns**:
   - Added fallback for Redis unavailability
   - Implemented connection retry logic
   - Added logging for Redis failures

5. **Migration Path**:
   - Created transparent migration for existing users
   - Implemented dual-write during transition
   - Added cleanup of legacy token storage

The implementation includes proper error handling, logging, and telemetry to ensure operational visibility.

## Related

- [Authentication Service](/server/services/auth/auth-service-standard.ts)
- [Redis Cache Implementation](/server/services/cache.ts)
- [Authentication Component Documentation](/docs/architecture/components/authentication.md)
