import * as fs from 'fs';
import * as path from 'path';
import { AppDataSource as AppDataSourceDev } from '../db/data-source';
import { AppDataSource as AppDataSourceProd } from '../db/data-source.prod';
import { Building } from '../buildings/entities/building.entity';
import { BuildingTypes } from '../buildings/types/building.types';
import { colors, logger } from '../utils/logger';

const env = process.env.NODE_ENV;
if (env !== 'development' && env !== 'production') {
  console.error(`NODE_ENV must be "development" or "production", got: "${env}"`);
  process.exit(1);
}
const AppDataSource = env === 'production' ? AppDataSourceProd : AppDataSourceDev;

const LOG_CTX = 'SeedBuildings';

interface BuildingSeedRow {
  type: string;
  name: string;
  description: string;
  income: number | null;
  upkeep: number | null;
  modifier: string | null;
  cost: number | null;
  upgrade_to: BuildingTypes | null;
  requirement_tech: string[] | null;
  requirement_building: BuildingTypes | null;
}

const BUILDING_TYPE_VALUES = new Set<string>(Object.values(BuildingTypes));

function validateRow(obj: unknown, index: number): obj is BuildingSeedRow {
  if (!obj || typeof obj !== 'object') {
    logger.error(`Row ${index}: must be an object`, LOG_CTX);
    return false;
  }
  const row = obj as Record<string, unknown>;
  if (typeof row.type !== 'string' || !BUILDING_TYPE_VALUES.has(row.type)) {
    logger.error(
      `Row ${index}: "type" must be one of ${[...BUILDING_TYPE_VALUES].join(', ')}`,
      LOG_CTX,
    );
    return false;
  }
  if (typeof row.name !== 'string' || !row.name.length) {
    logger.error(`Row ${index}: "name" must be a non-empty string`, LOG_CTX);
    return false;
  }
  for (const key of ['modifier'] as const) {
    const v = row[key];
    if (v !== null && v !== undefined && typeof v !== 'string') {
      logger.error(`Row ${index}: "${key}" must be a string or null`, LOG_CTX);
      return false;
    }
  }
  return true;
}

async function seedBuildings() {
  const dataFilePath = path.join(__dirname, '../../data/buildings.json');

  if (!fs.existsSync(dataFilePath)) {
    logger.error(`File not found: ${dataFilePath}`, LOG_CTX);
    process.exit(1);
  }

  let data: unknown;
  try {
    data = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(`Failed to parse buildings.json: ${msg}`, LOG_CTX);
    process.exit(1);
  }

  if (!Array.isArray(data) || data.length === 0) {
    logger.error('buildings.json must be a non-empty array', LOG_CTX);
    process.exit(1);
  }

  const rows: BuildingSeedRow[] = [];
  for (let i = 0; i < data.length; i++) {
    if (validateRow(data[i], i)) {
      rows.push(data[i]);
    }
  }

  if (rows.length === 0) {
    logger.error('No valid building rows in buildings.json', LOG_CTX);
    process.exit(1);
  }

  const seenTypes = new Set<string>();
  for (const row of rows) {
    if (seenTypes.has(row.type)) {
      logger.error(`Duplicate "type" in buildings.json: ${row.type}`, LOG_CTX);
      process.exit(1);
    }
    seenTypes.add(row.type);
  }

  try {
    await AppDataSource.initialize();
    logger.log('Database connected', LOG_CTX);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(`Failed to connect: ${msg}`, LOG_CTX);
    process.exit(1);
  }

  const repo = AppDataSource.getRepository(Building);
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const patch = {
      name: row.name,
      description: row.description,
      income: row.income,
      upkeep: row.upkeep,
      modifier: row.modifier,
      cost: row.cost,
      upgrade_to: row.upgrade_to,
      requirement_tech: row.requirement_tech,
      requirement_building: row.requirement_building,
    };

    const existing = await repo.find({
      where: { type: row.type as BuildingTypes },
    });

    if (existing.length === 0) {
      await repo.save(
        repo.create({
          type: row.type as BuildingTypes,
          ...patch,
        }),
      );
      created++;
      logger.verbose(`Created ${row.type} — ${row.name}`, LOG_CTX);
    } else {
      for (const b of existing) {
        await repo.update(b.id, patch);
      }
      updated += existing.length;
      logger.verbose(`Updated ${existing.length} row(s) for ${row.type}`, LOG_CTX);
    }
  }

  console.log('');
  logger.log(`${colors.green}========== BUILDING SEED SUMMARY ==========${colors.reset}`, LOG_CTX);
  logger.log(`Rows in file: ${colors.blue}${data.length}${colors.reset}`, LOG_CTX);
  logger.log(`Valid rows applied: ${colors.blue}${rows.length}${colors.reset}`, LOG_CTX);
  logger.log(`Created: ${colors.green}${created}${colors.reset}`, LOG_CTX);
  logger.log(`Rows updated: ${colors.green}${updated}${colors.reset}`, LOG_CTX);
  logger.log(`${colors.green}===========================================${colors.reset}`, LOG_CTX);
  console.log('');

  await AppDataSource.destroy();
  logger.log('Database connection closed', LOG_CTX);
  process.exit(0);
}

seedBuildings().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  logger.error(`Fatal: ${msg}`, LOG_CTX);
  console.error(e);
  process.exit(1);
});
