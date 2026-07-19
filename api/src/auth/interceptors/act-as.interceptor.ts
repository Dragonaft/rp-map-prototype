import { CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Observable } from 'rxjs';
import { User } from '../../users/entities/user.entity';
import { UserRoles } from '../../users/types/users.types';

const ACT_AS_HEADER = 'x-act-as-user';

/**
 * Lets an ADMIN/MODERATOR "play" an NPC country through the normal player API surface
 * (the mod layer's MOD-switch-OFF path). When the X-Act-As-User header names an NPC's
 * user id, req.user is swapped to that NPC (id + role) for the rest of the request, so
 * every existing `req.user.id` call site across the game controllers (actions, armies,
 * users, etc.) works unmodified — BUILD/ARMY_MOVE/etc get queued and resolved on the turn
 * tick exactly as if the NPC itself had submitted them, with normal costs/validation. The
 * real actor is preserved on req.realUser for anything that still needs to know who's
 * actually driving. Live-player impersonation is never allowed — only rows with
 * is_npc = true can be acted-as.
 *
 * Registered globally (see AuthModule), but a no-op whenever the header is absent, and
 * only takes effect once req.user is already populated by an auth guard — so it never
 * interferes with public/unauthenticated routes. Guards run before interceptors in Nest's
 * pipeline, so anything gated by RolesGuard (e.g. /admin/*) always evaluates against the
 * real actor's role first; the swap can only ever narrow an NPC's effective permissions
 * (always PLAYER), never escalate them.
 */
@Injectable()
export class ActAsInterceptor implements NestInterceptor {
  constructor(@InjectRepository(User) private readonly userRepo: Repository<User>) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const actAsId = request.headers?.[ACT_AS_HEADER];

    if (typeof actAsId === 'string' && actAsId && request.user) {
      const actor = request.user;
      if (actor.role !== UserRoles.ADMIN && actor.role !== UserRoles.MODERATOR) {
        throw new ForbiddenException('Only an ADMIN or MODERATOR may act as another country');
      }

      const target = await this.userRepo.findOne({ where: { id: actAsId } });
      if (!target || !target.is_npc) {
        throw new ForbiddenException('Can only act as an NPC country');
      }

      request.realUser = actor;
      request.user = { id: target.id, role: target.role };
    }

    return next.handle();
  }
}
