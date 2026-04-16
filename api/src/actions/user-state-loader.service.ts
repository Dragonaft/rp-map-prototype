import { Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { Province } from '../provinces/entities/province.entity';
import { User } from '../users/entities/user.entity';

export interface UserGameState {
  users: User[];
  provincesByUser: Map<string, Province[]>;
}

/** Loads all users and their owned provinces (with buildings) in a single query pair. */
@Injectable()
export class UserStateLoaderService {
  async load(manager: EntityManager): Promise<UserGameState> {
    const users = await manager.find(User);
    if (users.length === 0) {
      return { users: [], provincesByUser: new Map() };
    }

    const userIds = users.map((u) => u.id);
    const ownedProvinces = await manager.find(Province, {
      where: { user_id: In(userIds) },
      relations: ['buildings'],
    });

    const provincesByUser = new Map<string, Province[]>();
    for (const p of ownedProvinces) {
      if (!p.user_id) continue;
      const list = provincesByUser.get(p.user_id) ?? [];
      list.push(p);
      provincesByUser.set(p.user_id, list);
    }

    return { users, provincesByUser };
  }
}
