export type ErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'conflict'
  | 'rate_limited'
  | 'unavailable'
  | 'internal';

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status = 500,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json(
      {
        error: err.message,
        code: err.code,
        ...(err.details ? { details: err.details } : {}),
      },
      { status: err.status },
    );
  }
  console.error('[errorResponse] uncaught:', err);
  return Response.json(
    { error: 'Internal error', code: 'internal' as const },
    { status: 500 },
  );
}
