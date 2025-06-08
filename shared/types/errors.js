export class AppError extends Error {
  constructor(message, category, code) {
    super(message);
    this.category = category;
    this.code = code;
  }
}
export const ErrorCategory = {
  SYSTEM: 'SYSTEM',
  // ...add more as needed
};
export const ErrorCode = {
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  // ...add more as needed
};
