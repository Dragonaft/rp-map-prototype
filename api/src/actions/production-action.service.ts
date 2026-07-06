import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { UserGameState } from './user-state-loader.service';
import { UserResourcesService } from '../resources/user-resources.service';
import { UserGoodsService } from '../goods/user-goods.service';

/**
 * Runs once per scheduled queue tick alongside income; credits good production
 * for buildings with isProduction=true. If production_requirement_resource is
 * set, the building only produces on turns where the owner currently holds any
 * of that resource (a gate, not a spend — see user-resources.service.ts);
 * if it's null, the building produces unconditionally (e.g. CAPITAL).
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

    const resourceQuantities = await this.userResourcesService.getQuantitiesForUsers(
      manager, users.map((u) => u.id),
    );

    for (const user of users) {
      const userProvinces = provincesByUser.get(user.id) ?? [];
      const userResources = resourceQuantities.get(user.id);

      for (const province of userProvinces) {
        for (const building of province.buildings ?? []) {
          if (!building.isProduction || !building.production_good_id) continue;

          if (building.production_requirement_resource) {
            const available = userResources?.get(building.production_requirement_resource) ?? 0;
            if (available <= 0) continue;
          }

          const amount = building.production_amount ?? 1;
          await this.userGoodsService.adjustQuantity(manager, user.id, building.production_good_id, amount);
        }
      }
    }

    this.logger.log('Production credited for all users');
  }
}
