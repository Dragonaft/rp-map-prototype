import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { AppDataSource as AppDataSourceDev } from '../db/data-source';
import { AppDataSource as AppDataSourceProd } from '../db/data-source.prod';
import { GameIcon } from '../icons/entities/game-icon.entity';
import { sniffImageMime } from '../users/users.service';
import { colors, logger } from '../utils/logger';

const env = process.env.NODE_ENV;
if (env !== 'development' && env !== 'production') {
  console.error(`NODE_ENV must be "development" or "production", got: "${env}"`);
  process.exit(1);
}
const AppDataSource = env === 'production' ? AppDataSourceProd : AppDataSourceDev;

const LOG_CTX = 'SeedIcons';

interface ManifestRow {
  kind: string;
  key: string;
  file: string;
}

function validateRow(obj: unknown, index: number): obj is ManifestRow {
  if (!obj || typeof obj !== 'object') {
    logger.error(`Row ${index}: must be an object`, LOG_CTX);
    return false;
  }
  const row = obj as Record<string, unknown>;
  if (typeof row.kind !== 'string' || !row.kind.length) {
    logger.error(`Row ${index}: "kind" must be a non-empty string`, LOG_CTX);
    return false;
  }
  if (typeof row.key !== 'string' || !row.key.length) {
    logger.error(`Row ${index}: "key" must be a non-empty string`, LOG_CTX);
    return false;
  }
  if (typeof row.file !== 'string' || !row.file.length) {
    logger.error(`Row ${index}: "file" must be a non-empty string`, LOG_CTX);
    return false;
  }
  return true;
}

async function seedIcons() {
  const dataDirPath = path.join(__dirname, '../../data/icons');
  const manifestPath = path.join(dataDirPath, 'manifest.json');

  if (!fs.existsSync(manifestPath)) {
    logger.error(`File not found: ${manifestPath}`, LOG_CTX);
    process.exit(1);
  }

  let data: unknown;
  try {
    data = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(`Failed to parse manifest.json: ${msg}`, LOG_CTX);
    process.exit(1);
  }

  if (!Array.isArray(data) || data.length === 0) {
    logger.error('manifest.json must be a non-empty array', LOG_CTX);
    process.exit(1);
  }

  const rows: ManifestRow[] = [];
  for (let i = 0; i < data.length; i++) {
    if (validateRow(data[i], i)) {
      rows.push(data[i]);
    }
  }

  const seenSlots = new Set<string>();
  const validRows: ManifestRow[] = [];
  for (const row of rows) {
    const slot = `${row.kind}/${row.key}`;
    if (seenSlots.has(slot)) {
      logger.error(`Duplicate (kind, key) in manifest.json: ${slot}`, LOG_CTX);
      continue;
    }
    seenSlots.add(slot);

    const filePath = path.join(dataDirPath, row.file);
    if (!fs.existsSync(filePath)) {
      logger.error(`${row.file}: referenced by manifest.json but not found in ${dataDirPath}`, LOG_CTX);
      continue;
    }

    const bytes = fs.readFileSync(filePath);
    if (!sniffImageMime(bytes)) {
      logger.error(`${row.file}: not a recognized PNG/JPEG/WebP image (magic-byte check failed)`, LOG_CTX);
      continue;
    }

    validRows.push(row);
  }

  if (validRows.length === 0) {
    logger.error('No valid icon rows in manifest.json', LOG_CTX);
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

  const repo = AppDataSource.getRepository(GameIcon);
  let created = 0;
  let updated = 0;

  for (const row of validRows) {
    const bytes = fs.readFileSync(path.join(dataDirPath, row.file));
    const mime = sniffImageMime(bytes)!; // already validated above
    const icon_hash = createHash('sha256').update(bytes).digest('hex');
    const patch = { icon_data: bytes, icon_mime: mime, icon_hash };

    const existing = await repo.find({ where: { kind: row.kind, key: row.key } });

    if (existing.length === 0) {
      await repo.save(repo.create({ kind: row.kind, key: row.key, ...patch }));
      created++;
      logger.verbose(`Created ${row.kind}/${row.key} — ${row.file}`, LOG_CTX);
    } else {
      for (const r of existing) {
        await repo.update(r.id, patch);
      }
      updated += existing.length;
      logger.verbose(`Updated ${existing.length} row(s) for ${row.kind}/${row.key}`, LOG_CTX);
    }
  }

  console.log('');
  logger.log(`${colors.green}========== ICON SEED SUMMARY ==========${colors.reset}`, LOG_CTX);
  logger.log(`Rows in manifest: ${colors.blue}${data.length}${colors.reset}`, LOG_CTX);
  logger.log(`Valid rows applied: ${colors.blue}${validRows.length}${colors.reset}`, LOG_CTX);
  logger.log(`Created: ${colors.green}${created}${colors.reset}`, LOG_CTX);
  logger.log(`Rows updated: ${colors.green}${updated}${colors.reset}`, LOG_CTX);
  logger.log(`${colors.green}========================================${colors.reset}`, LOG_CTX);
  console.log('');

  await AppDataSource.destroy();
  logger.log('Database connection closed', LOG_CTX);
  process.exit(0);
}

seedIcons().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  logger.error(`Fatal: ${msg}`, LOG_CTX);
  console.error(e);
  process.exit(1);
});
