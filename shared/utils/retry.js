export class RetryStrategy {
    constructor(maxRetries = 3, baseDelay = 1000, // 1 second
    maxDelay = 10000 // 10 seconds
    ) {
        this.maxRetries = maxRetries;
        this.baseDelay = baseDelay;
        this.maxDelay = maxDelay;
    }
    calculateDelay(attempt) {
        const delay = Math.min(this.baseDelay * Math.pow(2, attempt), this.maxDelay);
        return Math.floor(delay * (1 + Math.random() * 0.2)); // Add 0-20% jitter
    }
    async retry(operation, errorFilter = (error) => {
        const appError = error;
        return appError.retryable !== undefined;
    }, onRetry) {
        let attempt = 0;
        while (attempt < this.maxRetries) {
            try {
                return await operation();
            }
            catch (error) {
                const typedError = error instanceof Error ? error : new Error(String(error));
                if (!errorFilter(typedError)) {
                    throw typedError;
                }
                if (attempt === this.maxRetries - 1) {
                    throw typedError;
                }
                const delay = this.calculateDelay(attempt);
                if (onRetry) {
                    onRetry(typedError, attempt);
                }
                await new Promise(resolve => setTimeout(resolve, delay));
                attempt++;
            }
        }
        throw new Error('Max retries exceeded');
    }
    static isRetryableError(error) {
        const appError = error;
        return appError.retryable !== undefined;
    }
    static getRetryAfter(error) {
        const appError = error;
        return appError.retryAfter;
    }
}
//# sourceMappingURL=retry.js.map