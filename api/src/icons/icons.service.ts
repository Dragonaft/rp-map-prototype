import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameIcon } from './entities/game-icon.entity';

export interface IconBinary {
  data: Buffer;
  mime: string;
  hash: string;
}

@Injectable()
export class IconsService {
  constructor(
    @InjectRepository(GameIcon) private readonly iconRepo: Repository<GameIcon>,
  ) {}

  /** Metadata only (kind/key/hash) — the client builds /icons/:kind/:key?v=hash itself, same
   *  convention as UsersService.buildFlagUrl. No row is seeded for a slot with no art yet, so
   *  this list is exactly "what has art" — the admin panel merges it against the live
   *  building/resource/landscape key universe to find gaps. */
  findAllMeta() {
    return this.iconRepo.find();
  }

  /** Explicitly re-selects icon_data (excluded from ordinary reads via `select: false`) for the
   *  binary route. Null when no row exists for this (kind, key). */
  async getIconBinary(kind: string, key: string): Promise<IconBinary | null> {
    const icon = await this.iconRepo.findOne({
      where: { kind, key },
      select: ['id', 'icon_data', 'icon_mime', 'icon_hash'],
    });
    if (!icon) {
      return null;
    }
    return { data: icon.icon_data, mime: icon.icon_mime, hash: icon.icon_hash };
  }
}
