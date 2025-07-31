// src/resilience/index.ts
export { 
  CircuitBreaker, 
  CircuitBreakerFactory, 
  CircuitBreakerOpenError,
  CircuitState,
  type CircuitBreakerConfig,
  type CircuitStats
} from './circuit-breaker.js';

export {
  GracefulDegradationManager,
  DegradationLevel,
  type ServiceHealth,
  type FallbackConfig,
  withGracefulDegradation,
  isSystemHealthy,
  getSystemStatus
} from './graceful-degradation.js';

export {
  DisasterRecoveryManager,
  getDisasterRecoveryManager
} from './disaster-recovery.js';

/**
 * Initialize all resilience components
 */
export function initializeResilience(): void {
  // Circuit breakers are initialized automatically when created
  // Graceful degradation manager is a singleton
  // Disaster recovery manager is a singleton
  
  console.log('Resilience components initialized');
}

/**
 * Get comprehensive system resilience status
 */
export async function getResilienceStatus(): Promise<{
  circuitBreakers: Record<string, any>;
  degradationLevel: string;
  systemHealth: {
    database: boolean;
    cache: boolean;
    overall: boolean;
  };
}> {
  const { CircuitBreakerFactory } = await import('./circuit-breaker.js');
  const { getSystemStatus } = await import('./graceful-degradation.js');
  const { getDisasterRecoveryManager } = await import('./disaster-recovery.js');

  const degradationStatus = getSystemStatus();
  const disasterRecovery = getDisasterRecoveryManager();
  const systemHealth = await disasterRecovery.getSystemHealth();

  return {
    circuitBreakers: CircuitBreakerFactory.getStats(),
    degradationLevel: degradationStatus.degradationLevel,
    systemHealth,
  };
} 