// src/frontend/optimization.ts
import { getLogger } from '../logging/index.js';

const logger = getLogger().child({ component: 'frontend-optimization' });

/**
 * Frontend performance optimization utilities
 */
export class FrontendOptimizer {
  /**
   * Code splitting configuration
   */
  static readonly CODE_SPLITTING_CONFIG = {
    ROUTES: {
      // Routes will be dynamically imported based on usage
    },
    COMPONENTS: {
      // Components will be dynamically imported based on usage
    },
  };
  
  /**
   * Lazy loading configuration
   */
  static readonly LAZY_LOADING_CONFIG = {
    IMAGES: {
      threshold: 0.1,
      rootMargin: '50px',
    },
    COMPONENTS: {
      threshold: 0.5,
      rootMargin: '100px',
    },
  };
  
  /**
   * Bundle optimization configuration
   */
  static readonly BUNDLE_CONFIG = {
    CHUNKS: {
      vendor: ['react', 'react-dom'],
      ui: ['@radix-ui/react-*'],
      utils: ['date-fns', 'zod'],
    },
  };
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  /**
   * Track Core Web Vitals
   */
  static trackCoreWebVitals() {
    // Largest Contentful Paint (LCP)
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      
      if (lastEntry) {
        const lcp = lastEntry.startTime;
        logger.info('LCP measured', { lcp });
        this.sendMetric('LCP', lcp);
      }
    }).observe({ entryTypes: ['largest-contentful-paint'] });
    
    // First Input Delay (FID)
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      entries.forEach((entry) => {
        const fid = (entry as any).processingStart - entry.startTime;
        logger.info('FID measured', { fid });
        this.sendMetric('FID', fid);
      });
    }).observe({ entryTypes: ['first-input'] });
  }
  
  /**
   * Send performance metrics
   */
  private static sendMetric(name: string, value: number) {
    fetch('/api/v1/metrics/performance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, value, timestamp: Date.now() }),
    }).catch(error => {
      logger.error('Failed to send performance metric', error instanceof Error ? error : new Error(String(error)));
    });
  }
}

 