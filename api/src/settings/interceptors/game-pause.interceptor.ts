import { CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { GameSettingsService } from '../game-settings.service';
import { UserRoles } from '../../users/types/users.types';

/**
 * Kicks a PLAYER off every authenticated request while the game is paused (the
 * "already logged-in players are logged off" half of pause — the client's axios
 * interceptor forces a logout+redirect on the resulting 403, see web-map/src/api/config.ts).
 *
 * Registered globally as APP_INTERCEPTOR (see SettingsModule), mirroring ActAsInterceptor
 * (api/src/auth/interceptors/act-as.interceptor.ts) — an interceptor, not middleware or a
 * guard, because it needs req.user, which only exists after the auth guards run.
 *
 * A request with no req.user (public routes: /auth/*, /actions/execution-stream,
 * /game-settings) always passes through untouched.
 */
@Injectable()
export class GamePauseInterceptor implements NestInterceptor {
  constructor(private readonly gameSettingsService: GameSettingsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    if (!request.user) {
      return next.handle();
    }

    // Same "prefer the real actor" rule resolveModFogBypass uses: while acting as an NPC,
    // req.user is the impersonated (always PLAYER) NPC, but req.realUser is the actual
    // ADMIN/MODERATOR driving the request, who must stay unaffected by a pause.
    const realUser = request.realUser ?? request.user;
    if (realUser?.role === UserRoles.ADMIN || realUser?.role === UserRoles.MODERATOR) {
      return next.handle();
    }

    return from(this.gameSettingsService.get()).pipe(
      switchMap((settings) => {
        if (settings.is_paused) {
          throw new ForbiddenException({
            error: 'Forbidden',
            message: settings.pause_message || 'The game is currently paused.',
            code: 'GAME_PAUSED',
          });
        }
        return next.handle();
      }),
    );
  }
}
