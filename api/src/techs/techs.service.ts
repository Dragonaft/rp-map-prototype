import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tech } from './entities/tech.entity';

@Injectable()
export class TechsService {
  constructor(
    @InjectRepository(Tech)
    private readonly techRepo: Repository<Tech>,
  ) {}

  async getAll(): Promise<Tech[]> {
    return this.techRepo.find();
  }

  /** Returns techs visible to a user based on their current class.
   *  - common branch: always visible
   *  - class root techs: visible only if user has no class yet
   *  - class-specific branch: visible only if it matches user's class
   */
  async getAvailableForUser(userClass: string | null): Promise<Tech[]> {
    const all = await this.techRepo.find();
    return all.filter((tech) => {
      if (tech.branch === 'economy' || tech.branch === 'military') return true;
      if (tech.isClassRoot) return userClass === null;
      return userClass !== null && tech.branch === userClass;
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
