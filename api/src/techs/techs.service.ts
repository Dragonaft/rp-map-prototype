import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tech } from './entities/tech.entity';
import { User } from "../users/entities/user.entity";
import { UserTechProgressService } from './user-tech-progress.service';
import { ClassesService } from '../classes/classes.service';

@Injectable()
export class TechsService {
  constructor(
    @InjectRepository(Tech)
    private readonly techRepo: Repository<Tech>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly userTechProgressService: UserTechProgressService,
    private readonly classesService: ClassesService,
  ) {}

  async getAll(): Promise<Tech[]> {
    return this.techRepo.find();
  }

  /** Returns techs visible to a user based on their current class, each annotated with the
   *  caller's saved research progress (0 if never started).
   *  - hidden classes (is_visible = false): their branch's techs are never returned, to anyone
   *  - common branch (not a class key at all, e.g. economy/military): always visible
   *  - class root techs: visible only if user has no class yet
   *  - class-specific branch: visible only if it matches user's class
   */
  async getAvailableForUser(userData): Promise<Array<Record<string, unknown>>> {
    const [all, classKeys, hiddenKeys, user, progressRows] = await Promise.all([
      this.techRepo.find(),
      this.classesService.getClassKeys(),
      this.classesService.getHiddenKeys(),
      this.usersRepository.findOne({ where: { id: userData.id } }),
      this.userTechProgressService.getForUser(userData.id),
    ]);

    const progressByKey = new Map(progressRows.map((row) => [row.tech_key, row.progress]));
    const withProgress = (tech: Tech) => ({ ...tech, progress: progressByKey.get(tech.key) ?? 0 });

    const visible = all.filter((tech) => !hiddenKeys.has(tech.branch));

    if (user.class === null) return visible.map(withProgress);

    return visible
      .filter((tech) => {
        if (!classKeys.has(tech.branch)) return true;
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
    const [classKeys, hiddenKeys] = await Promise.all([
      this.classesService.getClassKeys(),
      this.classesService.getHiddenKeys(),
    ]);

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

      // Defends the direct API path — hidden-class techs aren't sent to the client at all,
      // but a caller could still try to POST the key directly.
      if (hiddenKeys.has(tech.branch)) {
        throw new BadRequestException(`This tech's class is not currently available: ${tech.branch}`);
      }

      const missingPrereq = (tech.prerequisites ?? []).find((prereq) => !completed.includes(prereq));
      if (missingPrereq) {
        throw new BadRequestException(`Missing prerequisite tech: ${missingPrereq}`);
      }

      if (tech.isClassRoot) {
        if (user.class !== null && user.class !== undefined) {
          throw new BadRequestException('Class already selected, cannot research another class root tech');
        }
      } else if (classKeys.has(tech.branch)) {
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
