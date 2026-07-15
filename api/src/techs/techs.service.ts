import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tech } from './entities/tech.entity';
import { User } from "../users/entities/user.entity";
import { UserClasses } from '../users/types/users.types';
import { UserTechProgressService } from './user-tech-progress.service';

/** Tech branches that are gated behind selecting a matching player class. */
const CLASS_BRANCHES = new Set<string>([
  UserClasses.GUILD,
  UserClasses.HOLY,
  UserClasses.NOBLE,
]);

@Injectable()
export class TechsService {
  constructor(
    @InjectRepository(Tech)
    private readonly techRepo: Repository<Tech>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly userTechProgressService: UserTechProgressService,
  ) {}

  async getAll(): Promise<Tech[]> {
    return this.techRepo.find();
  }

  /** Returns techs visible to a user based on their current class, each annotated with the
   *  caller's saved research progress (0 if never started).
   *  - common branch: always visible
   *  - class root techs: visible only if user has no class yet
   *  - class-specific branch: visible only if it matches user's class
   */
  async getAvailableForUser(userData): Promise<Array<Record<string, unknown>>> {
    const all = await this.techRepo.find();
    const [user, progressRows] = await Promise.all([
      this.usersRepository.findOne({ where: { id: userData.id } }),
      this.userTechProgressService.getForUser(userData.id),
    ]);

    const progressByKey = new Map(progressRows.map((row) => [row.tech_key, row.progress]));
    const withProgress = (tech: Tech) => ({ ...tech, progress: progressByKey.get(tech.key) ?? 0 });

    if (user.class === null) return all.map(withProgress);

    return all
      .filter((tech) => {
        if (tech.branch === 'economy' || tech.branch === 'military') return true;
        if (tech.isClassRoot) return (user.completed_research ?? []).includes(tech.key);
        return tech.branch === user.class;
      })
      .map(withProgress);
  }

  async getByKey(key: string): Promise<Tech> {
    const tech = await this.techRepo.findOne({ where: { key } });
    if (!tech) {
      throw new NotFoundException(`Tech not found: ${key}`);
    }
    return tech;
  }

  /**
   * Sets a user's active research slot immediately (not queued — unlike other actions,
   * research selection can't wait for the next turn tick, since every tick of delay is a
   * tick of research the player never gets back). Progress accrual and completion still
   * happen turn-by-turn in `IncomeActionService`.
   */
  async selectActiveResearch(userId: string, techKey: string): Promise<string> {
    return this.usersRepository.manager.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const tech = await this.getByKey(techKey);
      const completed = user.completed_research ?? [];

      if (completed.includes(techKey)) {
        throw new BadRequestException(`Tech already researched: ${techKey}`);
      }

      const missingPrereq = (tech.prerequisites ?? []).find((prereq) => !completed.includes(prereq));
      if (missingPrereq) {
        throw new BadRequestException(`Missing prerequisite tech: ${missingPrereq}`);
      }

      if (tech.isClassRoot) {
        if (user.class !== null && user.class !== undefined) {
          throw new BadRequestException('Class already selected, cannot research another class root tech');
        }
      } else if (CLASS_BRANCHES.has(tech.branch)) {
        if (!user.class || user.class !== tech.branch) {
          throw new BadRequestException(`This tech requires class: ${tech.branch}`);
        }
      }

      user.active_research_key = techKey;
      await manager.save(User, user);
      return techKey;
    });
  }
}
