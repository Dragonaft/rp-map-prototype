import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserGood } from './entities/user-good.entity';
import { Good } from './entities/good.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class UserGoodsService {
  constructor(
    @InjectRepository(UserGood)
    private readonly userGoodRepo: Repository<UserGood>,
    @InjectRepository(Good)
    private readonly goodRepo: Repository<Good>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async getForUser(userId: string): Promise<UserGood[]> {
    return this.userGoodRepo.find({ where: { user_id: userId } });
  }

  /** Backfills a zero-quantity row for every existing user so the new good shows up in everyone's storage. */
  async createRowsForNewGood(good: Good): Promise<void> {
    const users = await this.userRepo.find({ select: ['id'] });
    if (!users.length) return;

    const rows = users.map((user) =>
      this.userGoodRepo.create({ user_id: user.id, good_id: good.id, quantity: 0 }),
    );
    await this.userGoodRepo.save(rows);
  }

  /** Backfills a zero-quantity row for every existing good so a new user has a full storage from the start. */
  async createRowsForNewUser(user: User): Promise<void> {
    const goods = await this.goodRepo.find({ select: ['id'] });
    if (!goods.length) return;

    const rows = goods.map((good) =>
      this.userGoodRepo.create({ user_id: user.id, good_id: good.id, quantity: 0 }),
    );
    await this.userGoodRepo.save(rows);
  }
}
