import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlayerClass } from './entities/player-class.entity';

@Injectable()
export class ClassesService {
  constructor(
    @InjectRepository(PlayerClass)
    private readonly classRepo: Repository<PlayerClass>,
  ) {}

  /** Full list, including hidden classes — used by admin CRUD. */
  async findAll(): Promise<PlayerClass[]> {
    return this.classRepo.find();
  }

  async findAllVisible(): Promise<PlayerClass[]> {
    return this.classRepo.find({ where: { is_visible: true } });
  }

  /** Every known class key, visible or not — replaces the old hard-coded CLASS_BRANCHES set. */
  async getClassKeys(): Promise<Set<string>> {
    const all = await this.classRepo.find();
    return new Set(all.map((c) => c.key));
  }

  /** Keys of classes currently hidden from players (is_visible = false). */
  async getHiddenKeys(): Promise<Set<string>> {
    const hidden = await this.classRepo.find({ where: { is_visible: false } });
    return new Set(hidden.map((c) => c.key));
  }
}
