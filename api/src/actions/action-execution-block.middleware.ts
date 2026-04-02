import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { ActionExecutionStateService } from './action-execution-state.service';

/**
 * Paths that stay available while the action queue is executing (otherwise clients could not poll or refresh tokens).
 */
const ALLOW_WHEN_PROCESSING = new Set([
  '/actions/execution-status',
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
]);

function normalizePath(url: string): string {
  const [path] = url.split('?');
  return path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
}

@Injectable()
export class ActionExecutionBlockMiddleware implements NestMiddleware {
  constructor(private readonly actionExecutionState: ActionExecutionStateService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    if (process.env.DISABLE_ACTION_EXECUTION_GATE === 'true') {
      next();
      return;
    }

    if (!this.actionExecutionState.isProcessing()) {
      next();
      return;
    }

    if (req.method === 'OPTIONS') {
      next();
      return;
    }

    const path = normalizePath(req.originalUrl ?? req.url ?? '');

    if (ALLOW_WHEN_PROCESSING.has(path)) {
      next();
      return;
    }

    res.status(503).json({
      error: 'Service Unavailable',
      message: 'Action queue is processing. Try again shortly.',
      code: 'ACTION_EXECUTION_IN_PROGRESS',
    });
  }
}
