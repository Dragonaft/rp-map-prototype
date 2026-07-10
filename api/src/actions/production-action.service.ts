import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { UserGameState } from './user-state-loader.service';
import { UserResourcesService } from '../resources/user-resources.service';
import { UserGoodsService } from '../goods/user-goods.service';
import { isBankruptcyDebuffed } from './combat-calculator';

/**
 * Runs once per scheduled queue tick alongside income, in two passes:
 *
 * 1. Resource production — buildings with resource_production_amount set
 *    (MINE/FORESTRY) credit that amount of the province's resource
 *    (province.resource.key) into the owner's UserResource stockpile.
 *    Unconditional — this is what feeds the stockpile in the first place.
 *
 * 2. Goods production — buildings with isProduction+production_good_id set
 *    atomically reserve production_requirement_resource_amount of
 *    production_requirement_resource (if set) from that same stockpile;
 *    production for that building is skipped this turn if the reservation
 *    fails. On success, production_amount of the good is credited to the
 *    owner's UserGood ledger.
 *
 * Pass 1 always completes before pass 2 starts, so this turn's resource
 * production is available to this turn's goods manufacturing regardless of
 * building iteration order.
 */
@Injectable()
export class ProductionActionService {
  private readonly logger = new Logger(ProductionActionService.name);

  constructor(
    private readonly userResourcesService: UserResourcesService,
    private readonly userGoodsService: UserGoodsService,
  ) {}

  async execute(state: UserGameState, manager: EntityManager): Promise<void> {
    const { users, provincesByUser } = state;
    if (users.length === 0) return;

    for (const user of users) {
      if (isBankruptcyDebuffed(user)) continue; // post-bankruptcy penalty: no resource production
      const userProvinces = provincesByUser.get(user.id) ?? [];
      for (const province of userProvinces) {
        if (province.occupier_id) continue; // occupied: nobody produces from it
        const resourceKey = province.resource?.key;
        if (!resourceKey) continue;

        for (const building of province.buildings ?? []) {
          if (building.resource_production_amount) {
            await this.userResourcesService.adjustQuantity(
              manager, user.id, resourceKey, building.resource_production_amount,
            );
          }
        }
      }
    }

    for (const user of users) {
      if (isBankruptcyDebuffed(user)) continue; // post-bankruptcy penalty: no goods production
      const userProvinces = provincesByUser.get(user.id) ?? [];
      for (const province of userProvinces) {
        if (province.occupier_id) continue; // occupied: nobody produces from it
        for (const building of province.buildings ?? []) {
          if (!building.isProduction || !building.production_good_id) continue;

          if (building.production_requirement_resource) {
            const amount = building.production_requirement_resource_amount ?? 1;
            const { ok } = await this.userResourcesService.tryReserve(
              manager, user.id, building.production_requirement_resource, amount,
            );
            if (!ok) continue;
          }

          const producedAmount = building.production_amount ?? 1;
          await this.userGoodsService.adjustQuantity(manager, user.id, building.production_good_id, producedAmount);
        }
      }
    }

    this.logger.log('Production credited for all users');
  }
}
