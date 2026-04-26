import * as fs from 'fs';
import * as path from 'path';
import { AppDataSource as AppDataSourceDev } from '../db/data-source';
import { AppDataSource as AppDataSourceProd } from '../db/data-source.prod';
import { TroopType, TroopCategory } from '../armies/entities/troop-type.entity';
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
  upkeep_per_100: number;
  tech_requirement: string | null;
  building_requirement: string | null;
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
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const patch = {
      name: row.name,
      description: row.description,
      category: row.category,
      cost_per_100: row.cost_per_100,
      attack: row.attack,
      defense: row.defense,
      upkeep_per_100: row.upkeep_per_100,
      tech_requirement: row.tech_requirement ?? null,
      building_requirement: row.building_requirement ?? null,
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
