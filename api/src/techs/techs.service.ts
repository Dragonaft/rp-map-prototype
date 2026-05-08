import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tech } from './entities/tech.entity';
import { User } from "../users/entities/user.entity";

@Injectable()
export class TechsService {
  constructor(
    @InjectRepository(Tech)
    private readonly techRepo: Repository<Tech>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async getAll(): Promise<Tech[]> {
    return this.techRepo.find();
  }

  /** Returns techs visible to a user based on their current class.
   *  - common branch: always visible
   *  - class root techs: visible only if user has no class yet
   *  - class-specific branch: visible only if it matches user's class
   */
  async getAvailableForUser(userData): Promise<Tech[]> {
    const all = await this.techRepo.find();
    const [user] = await Promise.all([
      this.usersRepository.findOne({ where: { id: userData.id } }),
    ]);

    if (user.class === null) return all;

    return all.filter((tech) => {
      if (tech.branch === 'economy' || tech.branch === 'military') return true;
      if (tech.isClassRoot) return (user.completed_research ?? []).includes(tech.key);
      return tech.branch === user.class;
    });
  }

  async getByKey(key: string): Promise<Tech> {
    const tech = await this.techRepo.findOne({ where: { key } });
    if (!tech) {
      throw new NotFoundException(`Tech not found: ${key}`);
    }
    return tech;
  }
}
