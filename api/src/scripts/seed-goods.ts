import * as fs from 'fs';
import * as path from 'path';
import { AppDataSource as AppDataSourceDev } from '../db/data-source';
import { AppDataSource as AppDataSourceProd } from '../db/data-source.prod';
import { Good } from '../goods/entities/good.entity';
import { GoodTypes } from '../goods/types/good.types';
import { colors, logger } from '../utils/logger';

const env = process.env.NODE_ENV;
if (env !== 'development' && env !== 'production') {
  console.error(`NODE_ENV must be "development" or "production", got: "${env}"`);
  process.exit(1);
}
const AppDataSource = env === 'production' ? AppDataSourceProd : AppDataSourceDev;

const LOG_CTX = 'SeedGoods';

interface GoodSeedRow {
  name: string;
  type: GoodTypes;
  price_per_one: number;
}

const GOOD_TYPE_VALUES = new Set<string>(Object.values(GoodTypes));

function validateRow(obj: unknown, index: number): obj is GoodSeedRow {
  if (!obj || typeof obj !== 'object') {
    logger.error(`Row ${index}: must be an object`, LOG_CTX);
    return false;
  }
  const row = obj as Record<string, unknown>;
  if (typeof row.name !== 'string' || !row.name.length) {
    logger.error(`Row ${index}: "name" must be a non-empty string`, LOG_CTX);
    return false;
  }
  if (typeof row.type !== 'string' || !GOOD_TYPE_VALUES.has(row.type)) {
    logger.error(
      `Row ${index}: "type" must be one of ${[...GOOD_TYPE_VALUES].join(', ')}`,
      LOG_CTX,
    );
    return false;
  }
  if (typeof row.price_per_one !== 'number') {
    logger.error(`Row ${index}: "price_per_one" must be a number`, LOG_CTX);
    return false;
  }
  return true;
}

async function seedGoods() {
  const dataFilePath = path.join(__dirname, '../../data/goods.json');

  if (!fs.existsSync(dataFilePath)) {
    logger.error(`File not found: ${dataFilePath}`, LOG_CTX);
    process.exit(1);
  }

  let data: unknown;
  try {
    data = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(`Failed to parse goods.json: ${msg}`, LOG_CTX);
    process.exit(1);
  }

  if (!Array.isArray(data) || data.length === 0) {
    logger.error('goods.json must be a non-empty array', LOG_CTX);
    process.exit(1);
  }

  const rows: GoodSeedRow[] = [];
  for (let i = 0; i < data.length; i++) {
    if (validateRow(data[i], i)) {
      rows.push(data[i]);
    }
  }

  if (rows.length === 0) {
    logger.error('No valid good rows in goods.json', LOG_CTX);
    process.exit(1);
  }

  const seenNames = new Set<string>();
  for (const row of rows) {
    if (seenNames.has(row.name)) {
      logger.error(`Duplicate "name" in goods.json: ${row.name}`, LOG_CTX);
      process.exit(1);
    }
    seenNames.add(row.name);
  }

  try {
    await AppDataSource.initialize();
    logger.log('Database connected', LOG_CTX);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(`Failed to connect: ${msg}`, LOG_CTX);
    process.exit(1);
  }

  // Good has no natural key like Resource does, so seeding is keyed on `name`.
  const repo = AppDataSource.getRepository(Good);
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const patch = {
      type: row.type,
      price_per_one: row.price_per_one,
    };

    const existing = await repo.find({ where: { name: row.name } });

    if (existing.length === 0) {
      await repo.save(repo.create({ name: row.name, ...patch }));
      created++;
      logger.verbose(`Created ${row.name}`, LOG_CTX);
    } else {
      for (const g of existing) {
        await repo.update(g.id, patch);
      }
      updated += existing.length;
      logger.verbose(`Updated ${existing.length} row(s) for ${row.name}`, LOG_CTX);
    }
  }

  console.log('');
  logger.log(`${colors.green}========== GOOD SEED SUMMARY ==========${colors.reset}`, LOG_CTX);
  logger.log(`Rows in file: ${colors.blue}${data.length}${colors.reset}`, LOG_CTX);
  logger.log(`Valid rows applied: ${colors.blue}${rows.length}${colors.reset}`, LOG_CTX);
  logger.log(`Created: ${colors.green}${created}${colors.reset}`, LOG_CTX);
  logger.log(`Rows updated: ${colors.green}${updated}${colors.reset}`, LOG_CTX);
  logger.log(`${colors.green}========================================${colors.reset}`, LOG_CTX);
  console.log('');

  await AppDataSource.destroy();
  logger.log('Database connection closed', LOG_CTX);
  process.exit(0);
}

seedGoods().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  logger.error(`Fatal: ${msg}`, LOG_CTX);
  console.error(e);
  process.exit(1);
});
