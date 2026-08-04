import * as fs from 'fs';
import * as path from 'path';
import { AppDataSource as AppDataSourceDev } from '../db/data-source';
import { AppDataSource as AppDataSourceProd } from '../db/data-source.prod';
import { TroopType, TroopCategory } from '../armies/entities/troop-type.entity';
import { Good } from '../goods/entities/good.entity';
import { colors, logger } from '../utils/logger';

const env = process.env.NODE_ENV;
if (env !== 'development' && env !== 'production') {
  console.error(`NODE_ENV must be "development" or "production", got: "${env}"`);
  process.exit(1);
}
const AppDataSource = env === 'production' ? AppDataSourceProd : AppDataSourceDev;

const LOG_CTX = 'SeedTroopTypes';

interface TroopTypeSeedRow {
  key: string;
  name: string;
  description: string;
  category: TroopCategory;
  cost_per_100: number;
  attack: number;
  defense: number;
  /** Power multiplier applied while fighting on water (default 1.0 = no penalty). */
  water_combat_modifier?: number;
  upkeep_per_100: number;
  tech_requirement: string | null;
  building_requirement: string | null;
  /** Good.name to resolve to required_goods at seed time — one-time cost per 100 troops, like cost_per_100 but paid in goods. */
  required_goods_name?: string | null;
  goods_amount?: number | null;
  /** Good.name to resolve to supply_good_id at seed time — per-turn food cost per 100 troops, scaled by SupplyActionService's distance multiplier. */
  supply_good_name?: string | null;
  supply_per_100?: number | null;
}

const VALID_CATEGORIES = new Set<string>(Object.values(TroopCategory));

function validateRow(obj: unknown, index: number): obj is TroopTypeSeedRow {
  if (!obj || typeof obj !== 'object') {
    logger.error(`Row ${index}: must be an object`, LOG_CTX);
    return false;
  }
  const row = obj as Record<string, unknown>;

  if (typeof row.key !== 'string' || !row.key.length) {
    logger.error(`Row ${index}: "key" must be a non-empty string`, LOG_CTX);
    return false;
  }
  if (typeof row.name !== 'string' || !row.name.length) {
    logger.error(`Row ${index}: "name" must be a non-empty string`, LOG_CTX);
    return false;
  }
  if (typeof row.category !== 'string' || !VALID_CATEGORIES.has(row.category)) {
    logger.error(
      `Row ${index}: "category" must be one of ${[...VALID_CATEGORIES].join(', ')}`,
      LOG_CTX,
    );
    return false;
  }
  for (const field of ['cost_per_100', 'attack', 'defense', 'upkeep_per_100'] as const) {
    if (typeof row[field] !== 'number') {
      logger.error(`Row ${index}: "${field}" must be a number`, LOG_CTX);
      return false;
    }
  }
  return true;
}

async function seedTroopTypes() {
  const dataFilePath = path.join(__dirname, '../../data/troop-types.json');

  if (!fs.existsSync(dataFilePath)) {
    logger.error(`File not found: ${dataFilePath}`, LOG_CTX);
    process.exit(1);
  }

  let data: unknown;
  try {
    data = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(`Failed to parse troop-types.json: ${msg}`, LOG_CTX);
    process.exit(1);
  }

  if (!Array.isArray(data) || data.length === 0) {
    logger.error('troop-types.json must be a non-empty array', LOG_CTX);
    process.exit(1);
  }

  const rows: TroopTypeSeedRow[] = [];
  for (let i = 0; i < data.length; i++) {
    if (validateRow(data[i], i)) rows.push(data[i]);
  }

  if (rows.length === 0) {
    logger.error('No valid troop type rows found', LOG_CTX);
    process.exit(1);
  }

  const seenKeys = new Set<string>();
  for (const row of rows) {
    if (seenKeys.has(row.key)) {
      logger.error(`Duplicate "key" in troop-types.json: ${row.key}`, LOG_CTX);
      process.exit(1);
    }
    seenKeys.add(row.key);
  }

  try {
    await AppDataSource.initialize();
    logger.log('Database connected', LOG_CTX);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(`Failed to connect: ${msg}`, LOG_CTX);
    process.exit(1);
  }

  const repo = AppDataSource.getRepository(TroopType);
  const goodRepo = AppDataSource.getRepository(Good);
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    let required_goods: string | null = null;
    if (row.required_goods_name) {
      const good = await goodRepo.findOne({ where: { name: row.required_goods_name } });
      if (!good) {
        logger.error(
          `Row for ${row.key}: required_goods_name "${row.required_goods_name}" not found — run seed:goods before seed:troop-types`,
          LOG_CTX,
        );
        process.exit(1);
      }
      required_goods = good.id;
    }

    let supply_good_id: string | null = null;
    if (row.supply_good_name) {
      const good = await goodRepo.findOne({ where: { name: row.supply_good_name } });
      if (!good) {
        logger.error(
          `Row for ${row.key}: supply_good_name "${row.supply_good_name}" not found — run seed:goods before seed:troop-types`,
          LOG_CTX,
        );
        process.exit(1);
      }
      supply_good_id = good.id;
    }

    const patch = {
      name: row.name,
      description: row.description,
      category: row.category,
      cost_per_100: row.cost_per_100,
      attack: row.attack,
      defense: row.defense,
      water_combat_modifier: row.water_combat_modifier ?? 1.0,
      upkeep_per_100: row.upkeep_per_100,
      tech_requirement: row.tech_requirement ?? null,
      building_requirement: row.building_requirement ?? null,
      required_goods,
      goods_amount: row.goods_amount ?? null,
      supply_good_id,
      supply_per_100: row.supply_per_100 ?? null,
    };

    const existing = await repo.findOne({ where: { key: row.key } });
    if (!existing) {
      await repo.save(repo.create({ key: row.key, ...patch }));
      created++;
      logger.verbose(`Created ${row.key} — ${row.name}`, LOG_CTX);
    } else {
      await repo.update(existing.id, patch);
      updated++;
      logger.verbose(`Updated ${row.key} — ${row.name}`, LOG_CTX);
    }
  }

  console.log('');
  logger.log(`${colors.green}========== TROOP TYPE SEED SUMMARY ==========${colors.reset}`, LOG_CTX);
  logger.log(`Rows in file: ${colors.blue}${data.length}${colors.reset}`, LOG_CTX);
  logger.log(`Valid rows applied: ${colors.blue}${rows.length}${colors.reset}`, LOG_CTX);
  logger.log(`Created: ${colors.green}${created}${colors.reset}`, LOG_CTX);
  logger.log(`Updated: ${colors.green}${updated}${colors.reset}`, LOG_CTX);
  logger.log(`${colors.green}==============================================${colors.reset}`, LOG_CTX);
  console.log('');

  await AppDataSource.destroy();
  logger.log('Database connection closed', LOG_CTX);
  process.exit(0);
}

seedTroopTypes().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  logger.error(`Fatal: ${msg}`, LOG_CTX);
  console.error(e);
  process.exit(1);
});
