import * as fs from 'fs';
import * as path from 'path';
import { AppDataSource as AppDataSourceDev } from '../db/data-source';
import { AppDataSource as AppDataSourceProd } from '../db/data-source.prod';
import { PlayerClass } from '../classes/entities/player-class.entity';
import { colors, logger } from '../utils/logger';

const env = process.env.NODE_ENV;
if (env !== 'development' && env !== 'production') {
  console.error(`NODE_ENV must be "development" or "production", got: "${env}"`);
  process.exit(1);
}
const AppDataSource = env === 'production' ? AppDataSourceProd : AppDataSourceDev;

const LOG_CTX = 'SeedClasses';

interface ClassSeedRow {
  key: string;
  name: string;
  is_visible: boolean;
}

function validateRow(obj: unknown, index: number): obj is ClassSeedRow {
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
  if (typeof row.is_visible !== 'boolean') {
    logger.error(`Row ${index}: "is_visible" must be a boolean`, LOG_CTX);
    return false;
  }
  return true;
}

async function seedClasses() {
  const dataFilePath = path.join(__dirname, '../../data/classes.json');

  if (!fs.existsSync(dataFilePath)) {
    logger.error(`File not found: ${dataFilePath}`, LOG_CTX);
    process.exit(1);
  }

  let data: unknown;
  try {
    data = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(`Failed to parse classes.json: ${msg}`, LOG_CTX);
    process.exit(1);
  }

  if (!Array.isArray(data) || data.length === 0) {
    logger.error('classes.json must be a non-empty array', LOG_CTX);
    process.exit(1);
  }

  const rows: ClassSeedRow[] = [];
  for (let i = 0; i < data.length; i++) {
    if (validateRow(data[i], i)) {
      rows.push(data[i]);
    }
  }

  if (rows.length === 0) {
    logger.error('No valid class rows in classes.json', LOG_CTX);
    process.exit(1);
  }

  const seenKeys = new Set<string>();
  for (const row of rows) {
    if (seenKeys.has(row.key)) {
      logger.error(`Duplicate "key" in classes.json: ${row.key}`, LOG_CTX);
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

  const repo = AppDataSource.getRepository(PlayerClass);
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const patch = {
      name: row.name,
      is_visible: row.is_visible,
    };

    const existing = await repo.find({ where: { key: row.key } });

    if (existing.length === 0) {
      await repo.save(repo.create({ key: row.key, ...patch }));
      created++;
      logger.verbose(`Created ${row.key} — ${row.name}`, LOG_CTX);
    } else {
      for (const r of existing) {
        await repo.update(r.id, patch);
      }
      updated += existing.length;
      logger.verbose(`Updated ${existing.length} row(s) for ${row.key}`, LOG_CTX);
    }
  }

  console.log('');
  logger.log(`${colors.green}========== CLASS SEED SUMMARY ==========${colors.reset}`, LOG_CTX);
  logger.log(`Rows in file: ${colors.blue}${data.length}${colors.reset}`, LOG_CTX);
  logger.log(`Valid rows applied: ${colors.blue}${rows.length}${colors.reset}`, LOG_CTX);
  logger.log(`Created: ${colors.green}${created}${colors.reset}`, LOG_CTX);
  logger.log(`Rows updated: ${colors.green}${updated}${colors.reset}`, LOG_CTX);
  logger.log(`${colors.green}=========================================${colors.reset}`, LOG_CTX);
  console.log('');

  await AppDataSource.destroy();
  logger.log('Database connection closed', LOG_CTX);
  process.exit(0);
}

seedClasses().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  logger.error(`Fatal: ${msg}`, LOG_CTX);
  console.error(e);
  process.exit(1);
});
