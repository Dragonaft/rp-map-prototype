import { AppDataSource as AppDataSourceDev } from '../db/data-source';
import { AppDataSource as AppDataSourceProd } from '../db/data-source.prod';
import { Province } from '../provinces/entities/province.entity';
import * as fs from 'fs';
import * as path from 'path';
import { colors, logger } from "../utils/logger";

const env = process.env.NODE_ENV;
if (env !== 'development' && env !== 'production') {
  console.error(`NODE_ENV must be "development" or "production", got: "${env}"`);
  process.exit(1);
}
const AppDataSource = env === 'production' ? AppDataSourceProd : AppDataSourceDev;


interface ProvinceInput {
  polygon: string;
  type: string;
  landscape: string;
  local_troops: number;
  resource_type: string | null;
  user_id: string | null;
  region_id: string;
  neighbor_regions?: string[];
}

function validateProvinceObject(obj: any, index: number): obj is ProvinceInput {
  const requiredFields = ['polygon', 'type', 'landscape', 'region_id'];

  for (const field of requiredFields) {
    if (!(field in obj)) {
      logger.error(`Province at index ${index}: missing required field '${field}'`);
      return false;
    }
    if (typeof obj[field] !== 'string') {
      logger.error(`Province at index ${index}: field '${field}' must be a string`);
      return false;
    }
  }

  if ('local_troops' in obj && typeof obj.local_troops !== 'number') {
    logger.error(`Province at index ${index}: field 'local_troops' must be a number`);
    return false;
  }

  if ('resource_type' in obj && obj.resource_type !== null && typeof obj.resource_type !== 'string') {
    logger.error(`Province at index ${index}: field 'resource_type' must be a string or null`);
    return false;
  }

  if ('user_id' in obj && obj.user_id !== null && typeof obj.user_id !== 'string') {
    logger.error(`Province at index ${index}: field 'user_id' must be a string or null`);
    return false;
  }

  return true;
}

async function importProvinces() {
  const dataFilePath = path.join(__dirname, '../../data/provinces.json');

  // Step 1: Check if file exists
  logger.log('Checking if provinces.json exists...');
  if (!fs.existsSync(dataFilePath)) {
    logger.error(`File not found: ${dataFilePath}`);
    process.exit(1);
  }
  logger.log(`File found: ${dataFilePath}`);

  // Step 2: Read and parse file
  logger.log('Reading provinces.json...');
  let data: any;
  try {
    const fileContent = fs.readFileSync(dataFilePath, 'utf-8');
    data = JSON.parse(fileContent);
  } catch (error) {
    logger.error(`Failed to parse JSON file: ${error.message}`);
    process.exit(1);
  }

  // Step 3: Validate file structure
  logger.log('Validating file structure...');
  if (!Array.isArray(data)) {
    logger.error('provinces.json must contain an array');
    process.exit(1);
  }

  if (data.length === 0) {
    logger.error('provinces.json array is empty');
    process.exit(1);
  }

  logger.log(`Found ${data.length} provinces in file`);

  // Validate each province object
  let validCount = 0;
  const validProvinces: ProvinceInput[] = [];

  for (let i = 0; i < data.length; i++) {
    if (validateProvinceObject(data[i], i)) {
      validProvinces.push(data[i]);
      validCount++;
    }
  }

  if (validCount === 0) {
    logger.error('No valid provinces found in file');
    process.exit(1);
  }

  if (validCount < data.length) {
    logger.warn(`Only ${validCount} out of ${data.length} provinces are valid`);
    logger.log('Continuing with valid provinces only...');
  } else {
    logger.log('All provinces are valid');
  }

  // Step 4: Connect to database
  logger.log('Connecting to database...');
  try {
    await AppDataSource.initialize();
    logger.log('Database connected successfully');
  } catch (error) {
    logger.error(`Failed to connect to database: ${error.message}`);
    process.exit(1);
  }

  const provinceRepository = AppDataSource.getRepository(Province);

  // Step 5: Clear existing provinces and relations
  logger.log('Clearing existing provinces and relations...');
  try {
    // Clear provinces_buildings junction table first (relation)
    await AppDataSource.query('DELETE FROM provinces_buildings');
    logger.log('Cleared provinces_buildings junction table');

    // Clear provinces table
    await AppDataSource.query('DELETE FROM provinces');
    const count = await provinceRepository.count();
    logger.log(`Cleared provinces table (${count === 0 ? 'all rows deleted' : `${count} rows remaining`})`);
  } catch (error) {
    logger.error(`Failed to clear provinces table: ${error.message}`);
    await AppDataSource.destroy();
    process.exit(1);
  }

  // Step 6: Import provinces (first pass - without neighbors)
  logger.log('Starting import...');

  let importedCount = 0;
  let errorCount = 0;
  const regionToIdMap = new Map<string, string>();

  for (let i = 0; i < validProvinces.length; i++) {
    const provinceData = validProvinces[i];

    try {
      const province = provinceRepository.create({
        polygon: provinceData.polygon,
        type: provinceData.type,
        landscape: provinceData.landscape,
        local_troops: provinceData.local_troops ?? 0,
        resource_type: provinceData.resource_type,
        user_id: provinceData.user_id,
        region_id: provinceData.region_id,
        neighbor_ids: null, // Will be populated in second pass
      });

      const saved = await provinceRepository.save(province);
      regionToIdMap.set(saved.region_id, saved.id);
      importedCount++;

      logger.verbose(`Imported province ${importedCount}/${validProvinces.length} - Region: ${provinceData.region_id}, Type: ${provinceData.type}, Landscape: ${provinceData.landscape}`);
    } catch (error) {
      errorCount++;
      logger.error(`Failed to import province at index ${i}: ${error.message}`);
    }
  }

  // Step 7: Update neighbors (second pass)
  if (importedCount > 0) {
    logger.log('Updating neighbor relationships...');
    let neighborsUpdated = 0;
    let neighborsSkipped = 0;

    for (let i = 0; i < validProvinces.length; i++) {
      const provinceData = validProvinces[i];

      if (!provinceData.neighbor_regions || provinceData.neighbor_regions.length === 0) {
        neighborsSkipped++;
        continue;
      }

      const provinceId = regionToIdMap.get(provinceData.region_id);
      if (!provinceId) continue;

      // Convert neighbor region_ids to province UUIDs
      const neighborIds: string[] = [];
      for (const neighborRegion of provinceData.neighbor_regions) {
        const neighborId = regionToIdMap.get(neighborRegion);
        if (neighborId) {
          neighborIds.push(neighborId);
        }
      }

      if (neighborIds.length > 0) {
        try {
          await provinceRepository.update(provinceId, { neighbor_ids: neighborIds });
          neighborsUpdated++;
          logger.verbose(`Updated neighbors for ${provinceData.region_id}: ${neighborIds.length} neighbors`);
        } catch (error) {
          logger.error(`Failed to update neighbors for ${provinceData.region_id}: ${error.message}`);
        }
      }
    }

    logger.log(`Neighbor relationships updated: ${colors.green}${neighborsUpdated}${colors.reset}`);
    logger.log(`Provinces without neighbors: ${colors.blue}${neighborsSkipped}${colors.reset}`);
  }

  // Step 8: Summary
  console.log('');
  logger.log(`${colors.green}========== IMPORT SUMMARY ==========${colors.reset}`);
  logger.log(`Total provinces in file: ${colors.blue}${data.length}${colors.reset}`);
  logger.log(`Valid provinces: ${colors.blue}${validCount}${colors.reset}`);
  logger.log(`Successfully imported: ${colors.green}${importedCount}${colors.reset}`);
  logger.log(`Errors: ${errorCount > 0 ? colors.red : colors.green}${errorCount}${colors.reset}`);
  logger.log(`${colors.green}====================================${colors.reset}`);
  console.log('');

  await AppDataSource.destroy();
  logger.log('Database connection closed');

  if (importedCount > 0) {
    logger.log('Import completed successfully');
    process.exit(0);
  } else {
    logger.error('No provinces were imported');
    process.exit(1);
  }
}

importProvinces().catch((error) => {
  logger.error(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
