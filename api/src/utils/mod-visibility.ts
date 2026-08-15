import { UserRoles } from '../users/types/users.types';

export const MOD_FULL_VISIBILITY_HEADER = 'x-mod-full-visibility';

/**
 * True only when the client's mod-switch header is present AND the REAL authenticated
 * actor is ADMIN/MODERATOR. "Real" matters because ActAsInterceptor (see
 * api/src/auth/interceptors/act-as.interceptor.ts) swaps req.user to an impersonated NPC
 * (always PLAYER) while preserving the actual actor on req.realUser — so we must check
 * req.realUser first, falling back to req.user when no impersonation is active.
 *
 * The header is never trusted on its own: a PLAYER (or a spoofed header from devtools)
 * gets silently ignored, same as any other role-gated behavior in this codebase — no
 * exception is thrown since this only relaxes what data is returned, not what actions can
 * be taken.
 */
export function resolveModFogBypass(req: any): boolean {
  const headerValue = req.headers?.[MOD_FULL_VISIBILITY_HEADER];
  if (!headerValue || headerValue === 'false') return false;
  const realUser = req.realUser ?? req.user;
  return realUser?.role === UserRoles.ADMIN || realUser?.role === UserRoles.MODERATOR;
}
