import * as fs from 'fs';
import * as path from 'path';
import { AppDataSource as AppDataSourceDev } from '../db/data-source';
import { AppDataSource as AppDataSourceProd } from '../db/data-source.prod';
import { Tech } from '../techs/entities/tech.entity';
import { colors, logger } from '../utils/logger';

const LOG_CTX = 'SeedTechs';

const env = process.env.NODE_ENV;
if (env !== 'development' && env !== 'production') {
  console.error(`NODE_ENV must be "development" or "production", got: "${env}"`);
  process.exit(1);
}
const AppDataSource = env === 'production' ? AppDataSourceProd : AppDataSourceDev;

interface TechSeedRow {
  key: string;
  name: string;
  description: string;
  branch: string;
  isClassRoot: boolean;
  cost: number;
  prerequisites: string[];
}

function validateRow(obj: unknown, index: number): obj is TechSeedRow {
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
  if (typeof row.branch !== 'string' || !row.branch.length) {
    logger.error(`Row ${index}: "branch" must be a non-empty string`, LOG_CTX);
    return false;
  }
  return true;
}

async function seedTechs() {
  const dataFilePath = path.join(__dirname, '../../data/techs.json');

  if (!fs.existsSync(dataFilePath)) {
    logger.error(`File not found: ${dataFilePath}`, LOG_CTX);
    process.exit(1);
  }

  let data: unknown;
  try {
    data = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(`Failed to parse techs.json: ${msg}`, LOG_CTX);
    process.exit(1);
  }

  if (!Array.isArray(data) || data.length === 0) {
    logger.error('techs.json must be a non-empty array', LOG_CTX);
    process.exit(1);
  }

  const rows: TechSeedRow[] = [];
  for (let i = 0; i < data.length; i++) {
    if (validateRow(data[i], i)) {
      rows.push(data[i] as TechSeedRow);
    }
  }

  if (rows.length === 0) {
    logger.error('No valid tech rows in techs.json', LOG_CTX);
    process.exit(1);
  }

  try {
    await AppDataSource.initialize();
    logger.log('Database connected', LOG_CTX);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(`Failed to connect: ${msg}`, LOG_CTX);
    process.exit(1);
  }

  const repo = AppDataSource.getRepository(Tech);
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const patch = {
      name: row.name,
      description: row.description,
      branch: row.branch,
      isClassRoot: row.isClassRoot ?? false,
      cost: row.cost ?? 0,
      prerequisites: row.prerequisites ?? [],
    };

    const existing = await repo.findOne({ where: { key: row.key } });

    if (!existing) {
      await repo.save(repo.create({ key: row.key, ...patch }));
      created++;
      logger.verbose(`Created tech: ${row.key} — ${row.name}`, LOG_CTX);
    } else {
      await repo.update(existing.id, patch);
      updated++;
      logger.verbose(`Updated tech: ${row.key} — ${row.name}`, LOG_CTX);
    }
  }

  console.log('');
  logger.log(`${colors.green}========== TECH SEED SUMMARY ==========${colors.reset}`, LOG_CTX);
  logger.log(`Rows in file: ${colors.blue}${data.length}${colors.reset}`, LOG_CTX);
  logger.log(`Valid rows applied: ${colors.blue}${rows.length}${colors.reset}`, LOG_CTX);
  logger.log(`Created: ${colors.green}${created}${colors.reset}`, LOG_CTX);
  logger.log(`Updated: ${colors.green}${updated}${colors.reset}`, LOG_CTX);
  logger.log(`${colors.green}========================================${colors.reset}`, LOG_CTX);
  console.log('');

  await AppDataSource.destroy();
  logger.log('Database connection closed', LOG_CTX);
  process.exit(0);
}

seedTechs().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  logger.error(`Fatal: ${msg}`, LOG_CTX);
  console.error(e);
  process.exit(1);
});
