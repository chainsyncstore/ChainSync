export class AppError extends Error {
  constructor(code: string, message: string, cause?: Error);
  code: string;
  cause?: Error;
}

export const ErrorCode: {
  PROGRAM_NOT_FOUND: 'PROGRAM_NOT_FOUND';
  MEMBER_NOT_FOUND: 'MEMBER_NOT_FOUND';
  REWARD_NOT_FOUND: 'REWARD_NOT_FOUND';
  INVALID_POINTS: 'INVALID_POINTS';
  INSUFFICIENT_POINTS: 'INSUFFICIENT_POINTS';
  INVALID_TRANSACTION: 'INVALID_TRANSACTION';
  INVALID_MEMBER: 'INVALID_MEMBER';
  DATABASE_ERROR: 'DATABASE_ERROR';
};
