import * as bcrypt from 'bcrypt';
import { EntityManager, In } from 'typeorm';
import { AppDataSource as AppDataSourceDev } from '../db/data-source';
import { AppDataSource as AppDataSourceProd } from '../db/data-source.prod';
import { Province } from '../provinces/entities/province.entity';
import { User } from '../users/entities/user.entity';
import { UserRoles } from '../users/types/users.types';
import { Building } from '../buildings/entities/building.entity';
import { ProvinceBuilding } from '../buildings/entities/province-building.entity';
import { BuildingTypes } from '../buildings/types/building.types';
import { computeBuildingCap } from '../techs/research-effects';
import { colors, logger } from '../utils/logger';

const env = process.env.NODE_ENV ?? 'development';
if (env !== 'development' && env !== 'production') {
  console.error(`NODE_ENV must be "development" or "production", got: "${env}"`);
  process.exit(1);
}
const AppDataSource = env === 'production' ? AppDataSourceProd : AppDataSourceDev;

const LOG_CTX = 'SeedTestCountries';
const PROVINCES_PER_COUNTRY = Number.parseInt(process.env.TEST_COUNTRY_SIZE ?? '10', 10);
const TEST_PASSWORD = process.env.TEST_COUNTRY_PASSWORD ?? 'test123';
const RNG_SEED = process.env.TEST_COUNTRY_SEED ?? 'red-blue-test-countries';
const STARTING_MONEY = Number.parseInt(process.env.TEST_COUNTRY_MONEY ?? '50000', 10);
const STARTING_TROOPS = Number.parseInt(process.env.TEST_COUNTRY_TROOPS ?? '3000', 10);
const MIN_MINE_PROVINCES_PER_COUNTRY = 1;

const MINE_RESOURCE_TYPES = new Set(['iron', 'gold', 'stone']);
const REQUIRED_BUILDING_TYPES = [
  BuildingTypes.BAZAAR,
  BuildingTypes.BARRACKS,
  BuildingTypes.GARDEN,
  BuildingTypes.MINE,
] as const;

interface TestCountryConfig {
  login: string;
  countryName: string;
  color: string;
}

interface ClusterPair {
  redIds: Set<string>;
  blueIds: Set<string>;
}

const TEST_COUNTRIES: [TestCountryConfig, TestCountryConfig] = [
  {
    login: process.env.TEST_RED_LOGIN ?? 'test-red',
    countryName: process.env.TEST_RED_COUNTRY_NAME ?? 'Red Test Country',
    color: process.env.TEST_RED_COLOR ?? '#d62828',
  },
  {
    login: process.env.TEST_BLUE_LOGIN ?? 'test-blue',
    countryName: process.env.TEST_BLUE_COUNTRY_NAME ?? 'Blue Test Country',
    color: process.env.TEST_BLUE_COLOR ?? '#2563eb',
  },
];

function createRng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  return () => {
    h += h << 13;
    h ^= h >>> 7;
    h += h << 3;
    h ^= h >>> 17;
    h += h << 5;
    return (h >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function isLandProvince(province: Province): boolean {
  return province.type?.toLowerCase() !== 'water';
}

function canBuildMine(province: Province): boolean {
  return MINE_RESOURCE_TYPES.has(province.resource_type?.toLowerCase());
}

function growCluster(
  startId: string,
  blockedIds: Set<string>,
  availableIds: Set<string>,
  provinceById: Map<string, Province>,
  rng: () => number,
): Set<string> | null {
  if (!availableIds.has(startId) || blockedIds.has(startId)) {
    return null;
  }

  const selectedIds = new Set<string>([startId]);
  const frontier: string[] = [];
  const frontierIds = new Set<string>();

  const addFrontier = (fromId: string) => {
    const province = provinceById.get(fromId);
    for (const neighborId of province?.neighbor_ids ?? []) {
      if (!availableIds.has(neighborId)) continue;
      if (blockedIds.has(neighborId)) continue;
      if (selectedIds.has(neighborId)) continue;
      if (frontierIds.has(neighborId)) continue;
      frontier.push(neighborId);
      frontierIds.add(neighborId);
    }
  };

  addFrontier(startId);

  while (selectedIds.size < PROVINCES_PER_COUNTRY && frontier.length > 0) {
    const index = Math.floor(rng() * frontier.length);
    const [nextId] = frontier.splice(index, 1);
    frontierIds.delete(nextId);
    selectedIds.add(nextId);
    addFrontier(nextId);
  }

  return selectedIds.size === PROVINCES_PER_COUNTRY ? selectedIds : null;
}

function countMineProvinces(ids: Set<string>, provinceById: Map<string, Province>): number {
  let count = 0;
  for (const id of ids) {
    const province = provinceById.get(id);
    if (province && canBuildMine(province)) {
      count++;
    }
  }
  return count;
}

function findNeighboringClusters(
  provinces: Province[],
  rng: () => number,
  minMineProvinces: number,
): ClusterPair | null {
  const provinceById = new Map(provinces.map((province) => [province.id, province]));
  const availableIds = new Set(
    provinces
      .filter((province) => isLandProvince(province) && !province.user_id)
      .map((province) => province.id),
  );

  const edges: Array<[string, string]> = [];
  for (const province of provinces) {
    if (!availableIds.has(province.id)) continue;
    for (const neighborId of province.neighbor_ids ?? []) {
      if (!availableIds.has(neighborId)) continue;
      if (province.id < neighborId) {
        edges.push([province.id, neighborId]);
      }
    }
  }

  for (const [redStartId, blueStartId] of shuffle(edges, rng)) {
    const redIds = growCluster(
      redStartId,
      new Set([blueStartId]),
      availableIds,
      provinceById,
      rng,
    );
    if (!redIds) continue;

    const blueIds = growCluster(blueStartId, redIds, availableIds, provinceById, rng);
    if (!blueIds) continue;

    if (
      countMineProvinces(redIds, provinceById) < minMineProvinces ||
      countMineProvinces(blueIds, provinceById) < minMineProvinces
    ) {
      continue;
    }

    return { redIds, blueIds };
  }

  return null;
}

function randomBuildingsForProvince(province: Province, rng: () => number): BuildingTypes[] {
  const cap = computeBuildingCap(province.landscape, []);
  const selected: BuildingTypes[] = [];

  if (cap > 0 && canBuildMine(province)) {
    selected.push(BuildingTypes.MINE);
  }

  const fillTypes = [BuildingTypes.BAZAAR, BuildingTypes.BARRACKS, BuildingTypes.GARDEN];
  while (selected.length < cap) {
    selected.push(fillTypes[Math.floor(rng() * fillTypes.length)]);
  }

  return shuffle(selected, rng);
}

async function ensureTestUsers(
  manager: EntityManager,
  passwordHash: string,
): Promise<[User, User]> {
  let userCount = await manager.count(User);
  const users: User[] = [];

  for (const country of TEST_COUNTRIES) {
    let user = await manager.findOne(User, { where: { login: country.login } });
    const role = userCount === 0 ? UserRoles.ADMIN : UserRoles.PLAYER;

    if (!user) {
      user = manager.create(User, {
        login: country.login,
        role,
      });
      userCount++;
    }

    user.password = passwordHash;
    user.country_name = country.countryName;
    user.color = country.color;
    user.is_new = false;
    user.money = STARTING_MONEY;
    user.troops = STARTING_TROOPS;
    user.piety = 0;
    user.research_points = 10;
    user.completed_research = [];
    user.class = null;
    user.role = user.role ?? role;

    users.push(await manager.save(User, user));
  }

  return [users[0], users[1]];
}

async function clearPreviousTestState(manager: EntityManager, userIds: string[]) {
  if (userIds.length === 0) return;

  await manager.query('DELETE FROM `action_queue` WHERE `userId` IN (?)', [userIds]);
  await manager.query(
    'DELETE au FROM `army_units` au INNER JOIN `armies` a ON a.id = au.army_id WHERE a.user_id IN (?)',
    [userIds],
  );
  await manager.query('DELETE FROM `armies` WHERE `user_id` IN (?)', [userIds]);
  await manager.query(
    'DELETE pb FROM `province_building` pb INNER JOIN `provinces` p ON p.id = pb.province_id WHERE p.user_id IN (?)',
    [userIds],
  );
  await manager.query(
    'UPDATE `provinces` SET `user_id` = NULL, `local_troops` = 0 WHERE `user_id` IN (?)',
    [userIds],
  );
}

async function loadBuildingMap(manager: EntityManager): Promise<Map<BuildingTypes, Building>> {
  const buildings = await manager.find(Building, {
    where: REQUIRED_BUILDING_TYPES.map((type) => ({ type })),
  });
  const buildingByType = new Map(buildings.map((building) => [building.type, building]));

  const missingTypes = REQUIRED_BUILDING_TYPES.filter((type) => !buildingByType.has(type));
  if (missingTypes.length > 0) {
    throw new Error(
      `Missing building templates: ${missingTypes.join(', ')}. Run npm run seed:buildings first.`,
    );
  }

  return buildingByType;
}

async function seedTestCountries() {
  if (!Number.isFinite(PROVINCES_PER_COUNTRY) || PROVINCES_PER_COUNTRY <= 0) {
    throw new Error(`TEST_COUNTRY_SIZE must be a positive integer, got: ${PROVINCES_PER_COUNTRY}`);
  }

  logger.log('Connecting to database...', LOG_CTX);
  await AppDataSource.initialize();
  logger.log('Database connected', LOG_CTX);

  const rng = createRng(RNG_SEED);
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  try {
    const result = await AppDataSource.manager.transaction(async (manager) => {
      const buildingByType = await loadBuildingMap(manager);
      const [redUser, blueUser] = await ensureTestUsers(manager, passwordHash);

      await clearPreviousTestState(manager, [redUser.id, blueUser.id]);

      const provinces = await manager.find(Province, {
        select: {
          id: true,
          type: true,
          landscape: true,
          resource_type: true,
          neighbor_ids: true,
          user_id: true,
        },
      });

      let clusterPair = findNeighboringClusters(
        provinces,
        rng,
        MIN_MINE_PROVINCES_PER_COUNTRY,
      );
      if (!clusterPair) {
        logger.warn(
          'Could not guarantee mine-capable provinces for both countries; retrying without that preference.',
          LOG_CTX,
        );
        clusterPair = findNeighboringClusters(provinces, rng, 0);
      }
      if (!clusterPair) {
        throw new Error(
          `Could not find two neighboring land clusters with ${PROVINCES_PER_COUNTRY} free provinces each.`,
        );
      }

      const provinceById = new Map(provinces.map((province) => [province.id, province]));
      const assignments = [
        { user: redUser, ids: clusterPair.redIds, label: TEST_COUNTRIES[0].countryName },
        { user: blueUser, ids: clusterPair.blueIds, label: TEST_COUNTRIES[1].countryName },
      ];

      const selectedIds = assignments.flatMap((assignment) => [...assignment.ids]);
      await manager.query('DELETE FROM `province_building` WHERE `province_id` IN (?)', [
        selectedIds,
      ]);

      const provinceBuildings: ProvinceBuilding[] = [];
      for (const assignment of assignments) {
        await manager.update(
          Province,
          { id: In(Array.from(assignment.ids)) },
          { user_id: assignment.user.id, local_troops: 0 },
        );

        for (const provinceId of assignment.ids) {
          const province = provinceById.get(provinceId);
          if (!province) continue;

          const buildingTypes = randomBuildingsForProvince(province, rng);
          for (const type of buildingTypes) {
            const building = buildingByType.get(type);
            if (!building) {
              throw new Error(`Building template disappeared during seed: ${type}`);
            }
            provinceBuildings.push(
              manager.create(ProvinceBuilding, {
                province_id: province.id,
                building_id: building.id,
              }),
            );
          }
        }
      }

      await manager.save(ProvinceBuilding, provinceBuildings);

      return {
        redUser,
        blueUser,
        redIds: clusterPair.redIds,
        blueIds: clusterPair.blueIds,
        provinceById,
        buildingCount: provinceBuildings.length,
      };
    });

    const redMineCount = countMineProvinces(result.redIds, result.provinceById);
    const blueMineCount = countMineProvinces(result.blueIds, result.provinceById);

    console.log('');
    logger.log(`${colors.green}========== TEST COUNTRIES SEEDED ==========${colors.reset}`, LOG_CTX);
    logger.log(
      `${TEST_COUNTRIES[0].countryName}: ${colors.blue}${result.redIds.size}${colors.reset} provinces, login ${colors.blue}${result.redUser.login}${colors.reset}`,
      LOG_CTX,
    );
    logger.log(
      `${TEST_COUNTRIES[1].countryName}: ${colors.blue}${result.blueIds.size}${colors.reset} provinces, login ${colors.blue}${result.blueUser.login}${colors.reset}`,
      LOG_CTX,
    );
    logger.log(`Shared password: ${colors.blue}${TEST_PASSWORD}${colors.reset}`, LOG_CTX);
    logger.log(`Buildings created: ${colors.blue}${result.buildingCount}${colors.reset}`, LOG_CTX);
    logger.log(
      `Mine-capable provinces: red=${colors.blue}${redMineCount}${colors.reset}, blue=${colors.blue}${blueMineCount}${colors.reset}`,
      LOG_CTX,
    );
    logger.log(`${colors.green}===========================================${colors.reset}`, LOG_CTX);
    console.log('');
  } finally {
    await AppDataSource.destroy();
    logger.log('Database connection closed', LOG_CTX);
  }
}

seedTestCountries().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  logger.error(`Fatal: ${msg}`, LOG_CTX);
  console.error(e);
  process.exit(1);
});
