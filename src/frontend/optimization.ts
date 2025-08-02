// src/frontend/optimization.ts
import { getLogger } from '../logging/index.js';

const logger = getLogger().child({ _component: 'frontend-optimization' });

/**
 * Frontend performance optimization utilities
 */
export class FrontendOptimizer {
  /**
   * Code splitting configuration
   */
  static readonly CODE_SPLITTING_CONFIG = {
    _ROUTES: {
      // Routes will be dynamically imported based on usage
    },
    _COMPONENTS: {
      // Components will be dynamically imported based on usage
    }
  };

  /**
   * Lazy loading configuration
   */
  static readonly LAZY_LOADING_CONFIG = {
    IMAGES: {
      _threshold: 0.1,
      _rootMargin: '50px'
    },
    _COMPONENTS: {
      _threshold: 0.5,
      _rootMargin: '100px'
    }
  };

  /**
   * Bundle optimization configuration
   */
  static readonly BUNDLE_CONFIG = {
    CHUNKS: {
      vendor: ['react', 'react-dom'],
      _ui: ['@radix-ui/react-*'],
      _utils: ['date-fns', 'zod']
    }
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
    }).observe({ _entryTypes: ['largest-contentful-paint'] });

    // First Input Delay (FID)
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      entries.forEach((entry) => {
        const fid = (entry as any).processingStart - entry.startTime;
        logger.info('FID measured', { fid });
        this.sendMetric('FID', fid);
      });
    }).observe({ _entryTypes: ['first-input'] });
  }

  /**
   * Send performance metrics
   */
  private static sendMetric(_name: string, _value: number) {
    fetch('/api/v1/metrics/performance', {
      _method: 'POST',
      _headers: { 'Content-Type': 'application/json' },
      _body: JSON.stringify({ name, value, _timestamp: Date.now() })
    }).catch(error => {
      logger.error('Failed to send performance metric', error instanceof Error ? _error : new Error(String(error)));
    });
  }
}

