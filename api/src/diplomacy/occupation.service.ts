import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Province } from '../provinces/entities/province.entity';
import { UserResourcesService } from '../resources/user-resources.service';
import { UserGoodsService } from '../goods/user-goods.service';
import { DiplomacyService } from './diplomacy.service';

@Injectable()
export class OccupationService {
  constructor(
    private readonly diplomacyService: DiplomacyService,
    private readonly userResourcesService: UserResourcesService,
    private readonly userGoodsService: UserGoodsService,
  ) {}

  /**
   * Moves a conquered/ceded province's one-time requirement_resource /
   * requirement_good_id BUILD-cost reservations between ledgers. Per-turn
   * resource/goods production is never transferred here — it's derived fresh
   * each turn from whoever currently owns the building.
   */
  async transferProvinceResourceFootprint(
    manager: EntityManager, province: Province, fromUserId: string | null, toUserId: string,
  ): Promise<void> {
    for (const building of province.buildings ?? []) {
      if (building.requirement_resource) {
        const amount = building.requirement_resource_amount ?? 1;
        if (fromUserId) await this.userResourcesService.adjustQuantity(manager, fromUserId, building.requirement_resource, amount);
        await this.userResourcesService.adjustQuantity(manager, toUserId, building.requirement_resource, -amount);
      }
      if (building.requirement_good_id) {
        const amount = building.requirement_good_amount ?? 1;
        if (fromUserId) await this.userGoodsService.adjustQuantity(manager, fromUserId, building.requirement_good_id, amount);
        await this.userGoodsService.adjustQuantity(manager, toUserId, building.requirement_good_id, -amount);
      }
    }
  }

  /**
   * Legal ownership transfer: used both by the 10-turn auto-core tick and by
   * a peace treaty's cede_province article (which may target a province that
   * was never occupied — a direct cession).
   */
  async coreProvince(manager: EntityManager, province: Province, newOwnerId: string): Promise<void> {
    const previousOwnerId = province.user_id ?? null;
    province.user_id = newOwnerId;
    province.occupier_id = null;
    province.occupation_turns = 0;
    await manager.save(Province, province);
    await this.transferProvinceResourceFootprint(manager, province, previousOwnerId, newOwnerId);
  }

  /** Returns an occupied province to its legal owner without changing ownership (peace non-cession, or a friendly retake). */
  async clearOccupation(manager: EntityManager, province: Province): Promise<void> {
    province.occupier_id = null;
    province.occupation_turns = 0;
    await manager.save(Province, province);
  }

  /**
   * The single place that decides claim / retake / occupy whenever a player
   * wins military control of a province (uncontested move, combat victory,
   * or the post-turn ownership-sync safety net).
   */
  async applyControlResult(manager: EntityManager, province: Province, winnerId: string): Promise<void> {
    if (!province.user_id) {
      // Empty land: direct claim, never occupation.
      province.user_id = winnerId;
      province.occupier_id = null;
      province.occupation_turns = 0;
      await manager.save(Province, province);
      return;
    }

    if (province.user_id === winnerId) {
      if (province.occupier_id) {
        // Retake: a friendly army drove the occupier out.
        await this.clearOccupation(manager, province);
      }
      return;
    }

    // Someone else's core province: occupy it, dont annex it.
    const victimId = province.user_id;
    province.occupier_id = winnerId;
    province.occupation_turns = 0;
    await manager.save(Province, province);

    await this.diplomacyService.ensureWarBetween(manager, winnerId, victimId);
  }
}
