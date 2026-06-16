import { AppDataSource as AppDataSourceDev } from '../db/data-source';
import { AppDataSource as AppDataSourceProd } from '../db/data-source.prod';
import { Province } from '../provinces/entities/province.entity';
import * as fs from 'fs';
import * as path from 'path';
import { colors, logger } from '../utils/logger';

const env = process.env.NODE_ENV;
if (env !== 'development' && env !== 'production') {
  console.error(`NODE_ENV must be "development" or "production", got: "${env}"`);
  process.exit(1);
}
const AppDataSource = env === 'production' ? AppDataSourceProd : AppDataSourceDev;

// --dry-run: compute and report the changes without writing to the DB.
// --file=<path>: override the default fix file location.
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const fileArg = args.find((a) => a.startsWith('--file='));
const DEFAULT_FILE = path.join(__dirname, '../../data/provinces-fix.json');
const dataFilePath = fileArg ? path.resolve(fileArg.slice('--file='.length)) : DEFAULT_FILE;

const LOG_CTX = 'FixProvinceNeighbors';

interface ProvinceFixInput {
  region_id: string;
  neighbor_regions?: string[];
}

function isValidFixRow(obj: any, index: number): obj is ProvinceFixInput {
  if (!obj || typeof obj !== 'object') {
    logger.error(`Row at index ${index}: not an object`, LOG_CTX);
    return false;
  }
  if (typeof obj.region_id !== 'string' || obj.region_id.length === 0) {
    logger.error(`Row at index ${index}: missing or invalid 'region_id'`, LOG_CTX);
    return false;
  }
  if (obj.neighbor_regions !== undefined && !Array.isArray(obj.neighbor_regions)) {
    logger.error(`Row at index ${index} (${obj.region_id}): 'neighbor_regions' must be an array when present`, LOG_CTX);
    return false;
  }
  if (Array.isArray(obj.neighbor_regions) && obj.neighbor_regions.some((n: any) => typeof n !== 'string')) {
    logger.error(`Row at index ${index} (${obj.region_id}): 'neighbor_regions' must contain only strings`, LOG_CTX);
    return false;
  }
  return true;
}

/** True when two neighbor id lists are equal regardless of order. */
function sameNeighbors(a: string[] | null, b: string[]): boolean {
  const left = a ?? [];
  if (left.length !== b.length) return false;
  const sortedA = [...left].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}

async function fixProvinceNeighbors() {
  logger.log(`Mode: ${DRY_RUN ? `${colors.yellow}DRY RUN (no writes)` : `${colors.green}LIVE`}${colors.reset} | env: ${colors.blue}${env}${colors.reset}`, LOG_CTX);

  // Step 1: Read and parse the fix file
  logger.log(`Reading fix file: ${dataFilePath}`, LOG_CTX);
  if (!fs.existsSync(dataFilePath)) {
    logger.error(`File not found: ${dataFilePath}`, LOG_CTX);
    process.exit(1);
  }

  let data: any;
  try {
    data = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
  } catch (error) {
    logger.error(`Failed to parse JSON file: ${error.message}`, LOG_CTX);
    process.exit(1);
  }

  if (!Array.isArray(data) || data.length === 0) {
    logger.error('Fix file must contain a non-empty array', LOG_CTX);
    process.exit(1);
  }

  // Step 2: Validate rows
  const validRows: ProvinceFixInput[] = [];
  for (let i = 0; i < data.length; i++) {
    if (isValidFixRow(data[i], i)) validRows.push(data[i]);
  }
  if (validRows.length === 0) {
    logger.error('No valid rows found in fix file', LOG_CTX);
    process.exit(1);
  }
  logger.log(`Fix file rows: ${colors.blue}${data.length}${colors.reset}, valid: ${colors.blue}${validRows.length}${colors.reset}`, LOG_CTX);

  // Step 3: Connect to database
  logger.log('Connecting to database...', LOG_CTX);
  try {
    await AppDataSource.initialize();
    logger.log('Database connected successfully', LOG_CTX);
  } catch (error) {
    logger.error(`Failed to connect to database: ${error.message}`, LOG_CTX);
    process.exit(1);
  }

  try {
    const provinceRepository = AppDataSource.getRepository(Province);

    // Step 4: Load existing provinces and build region_id -> id map(s).
    // region_id has no DB unique constraint, so guard against duplicates.
    const existing = await provinceRepository.find({
      select: ['id', 'region_id', 'neighbor_ids'],
    });
    logger.log(`Loaded ${colors.blue}${existing.length}${colors.reset} provinces from DB`, LOG_CTX);

    const regionToIds = new Map<string, string[]>();
    const currentNeighbors = new Map<string, string[] | null>();
    for (const p of existing) {
      const ids = regionToIds.get(p.region_id) ?? [];
      ids.push(p.id);
      regionToIds.set(p.region_id, ids);
      currentNeighbors.set(p.id, p.neighbor_ids ?? null);
    }

    const duplicateRegions = [...regionToIds.entries()].filter(([, ids]) => ids.length > 1);
    if (duplicateRegions.length > 0) {
      logger.warn(
        `${duplicateRegions.length} region_id(s) map to multiple province rows; every matching row will receive the same neighbor_ids: ` +
          duplicateRegions.map(([r, ids]) => `${r}(x${ids.length})`).join(', '),
        LOG_CTX,
      );
    }
    // Canonical id per region for resolving neighbor references.
    const regionToCanonicalId = new Map<string, string>();
    for (const [region, ids] of regionToIds) regionToCanonicalId.set(region, ids[0]);

    // Step 5: Build the update plan.
    interface PlannedUpdate {
      regionId: string;
      provinceIds: string[];
      neighborIds: string[];
    }
    const planned: PlannedUpdate[] = [];

    let notInDb = 0; // fix rows whose region_id has no province in the DB
    let unchanged = 0; // fix rows whose neighbors already match the DB
    let missingNeighborRefs = 0; // neighbor_regions referenced that don't exist in the DB
    const missingNeighborSamples = new Set<string>();

    for (const row of validRows) {
      const provinceIds = regionToIds.get(row.region_id);
      if (!provinceIds) {
        notInDb++;
        continue;
      }

      const neighborIds: string[] = [];
      const seen = new Set<string>();
      for (const neighborRegion of row.neighbor_regions ?? []) {
        const neighborId = regionToCanonicalId.get(neighborRegion);
        if (!neighborId) {
          missingNeighborRefs++;
          if (missingNeighborSamples.size < 10) missingNeighborSamples.add(neighborRegion);
          continue;
        }
        // de-dup in case the fix file lists a neighbor twice
        if (!seen.has(neighborId)) {
          seen.add(neighborId);
          neighborIds.push(neighborId);
        }
      }

      // Skip rows where every DB row for this region already matches.
      const allMatch = provinceIds.every((id) => sameNeighbors(currentNeighbors.get(id) ?? null, neighborIds));
      if (allMatch) {
        unchanged++;
        continue;
      }

      planned.push({ regionId: row.region_id, provinceIds, neighborIds });
    }

    logger.log(`Planned updates: ${colors.green}${planned.length}${colors.reset} region(s) ` +
      `(${planned.reduce((n, p) => n + p.provinceIds.length, 0)} province rows)`, LOG_CTX);
    logger.log(`Already up to date: ${colors.blue}${unchanged}${colors.reset}`, LOG_CTX);
    logger.log(`Fix rows with no matching province in DB: ${notInDb > 0 ? colors.yellow : colors.green}${notInDb}${colors.reset}`, LOG_CTX);
    if (missingNeighborRefs > 0) {
      logger.warn(`Dropped ${missingNeighborRefs} neighbor reference(s) not present in DB ` +
        `(e.g. ${[...missingNeighborSamples].join(', ')}${missingNeighborSamples.size < missingNeighborRefs ? ', …' : ''})`, LOG_CTX);
    }

    // Step 6: Apply (unless dry run), all-or-nothing in a transaction.
    let rowsUpdated = 0;
    if (planned.length === 0) {
      logger.log('Nothing to update.', LOG_CTX);
    } else if (DRY_RUN) {
      logger.log(`${colors.yellow}DRY RUN — no changes written.${colors.reset} Sample of planned updates:`, LOG_CTX);
      for (const p of planned.slice(0, 10)) {
        logger.verbose(`${p.regionId} -> ${p.neighborIds.length} neighbor(s) (${p.provinceIds.length} row(s))`, LOG_CTX);
      }
    } else {
      await AppDataSource.transaction(async (manager) => {
        for (const p of planned) {
          for (const provinceId of p.provinceIds) {
            await manager.update(Province, provinceId, { neighbor_ids: p.neighborIds });
            rowsUpdated++;
          }
          logger.verbose(`Updated ${p.regionId}: ${p.neighborIds.length} neighbor(s)`, LOG_CTX);
        }
      });
      logger.log(`Committed updates for ${colors.green}${rowsUpdated}${colors.reset} province row(s)`, LOG_CTX);
    }

    // Step 7: Summary
    console.log('');
    logger.log(`${colors.green}========== NEIGHBOR FIX SUMMARY ==========${colors.reset}`, LOG_CTX);
    logger.log(`Mode: ${DRY_RUN ? `${colors.yellow}DRY RUN` : `${colors.green}LIVE`}${colors.reset}`, LOG_CTX);
    logger.log(`Fix file rows (valid): ${colors.blue}${validRows.length}${colors.reset}`, LOG_CTX);
    logger.log(`Provinces in DB: ${colors.blue}${existing.length}${colors.reset}`, LOG_CTX);
    logger.log(`Regions planned for update: ${colors.green}${planned.length}${colors.reset}`, LOG_CTX);
    logger.log(`Province rows ${DRY_RUN ? 'that would be' : ''} updated: ${colors.green}${DRY_RUN ? planned.reduce((n, p) => n + p.provinceIds.length, 0) : rowsUpdated}${colors.reset}`, LOG_CTX);
    logger.log(`Already up to date: ${colors.blue}${unchanged}${colors.reset}`, LOG_CTX);
    logger.log(`Fix rows not in DB: ${notInDb > 0 ? colors.yellow : colors.green}${notInDb}${colors.reset}`, LOG_CTX);
    logger.log(`Dropped neighbor refs: ${missingNeighborRefs > 0 ? colors.yellow : colors.green}${missingNeighborRefs}${colors.reset}`, LOG_CTX);
    logger.log(`${colors.green}==========================================${colors.reset}`, LOG_CTX);
    console.log('');
  } finally {
    await AppDataSource.destroy();
    logger.log('Database connection closed', LOG_CTX);
  }
}

fixProvinceNeighbors().catch((error) => {
  logger.error(`Fatal error: ${error.message}`, LOG_CTX);
  console.error(error);
  process.exit(1);
});
