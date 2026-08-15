import { AppDataSource as AppDataSourceDev } from '../db/data-source';
import { AppDataSource as AppDataSourceProd } from '../db/data-source.prod';
import { colors, logger } from '../utils/logger';

const env = process.env.NODE_ENV;
if (env !== 'development' && env !== 'production') {
  console.error(`NODE_ENV must be "development" or "production", got: "${env}"`);
  process.exit(1);
}
const AppDataSource = env === 'production' ? AppDataSourceProd : AppDataSourceDev;

const LOG_CTX = 'ResetGameData';

// Tables whose rows must survive a map reset. Everything else is wiped and then
// repopulated by the seed scripts (buildings / techs / troop-types). `provinces`
// is preserved because the import-provinces script manages it directly,
// `migrations` must never be touched or TypeORM would replay every migration,
// `knowledge_articles`/`game_icons` (the Codex and admin-uploaded icon art) are reference
// content unrelated to game/map state — like knowledge_articles, game_icons has no reseed step
// in the RESET branch of the deploy workflow, so wiping it here would blank every building/
// landscape/resource icon (back to the placeholder) after a map reset — and `game_settings` is
// server config, not game-world state: deploy.yml always runs `import:provinces` (which writes
// the map's checksum into this singleton row) *before* `reset:game`, so wiping it here would
// destroy that checksum the instant after it's written, silently breaking the web client's
// layout-cache invalidation on the very next full reset (a client whose cache also reads the
// resulting `map_checksum: null` would then see a false "still valid" match and keep a stale
// layout referencing province IDs that no longer exist). It would also reset `is_paused`/
// `turns_enabled` to their defaults on every full reset, which is never intended.
// `resources` joins this set for the same reason knowledge_articles/game_icons do — but with
// a sharper failure mode: `provinces` (kept) holds a real FK, `Province.resource_id`, into
// `resources` (not kept). Wiping+reseeding resources on every reset gives each row a new UUID,
// silently orphaning every province's resource_id (the FK survives because reset-game disables
// FOREIGN_KEY_CHECKS around its DELETEs) — every province's resourceType then reads as null
// until the next full re-import. seed:resources's upsert-by-key preserves existing row ids for
// unchanged keys, so keeping this table stable is enough; no code elsewhere needs to change.
const KEEP_TABLES = new Set(['users', 'provinces', 'migrations', 'knowledge_articles', 'game_icons', 'game_settings', 'resources']);

async function resetGameData() {
  logger.log('Connecting to database...', LOG_CTX);
  try {
    await AppDataSource.initialize();
    logger.log('Database connected successfully', LOG_CTX);
  } catch (error) {
    logger.error(`Failed to connect to database: ${(error as Error).message}`, LOG_CTX);
    process.exit(1);
  }

  try {
    // Discover the actual tables in the current schema so we never hardcode names.
    const rows: Array<{ table_name?: string; TABLE_NAME?: string }> =
      await AppDataSource.query(
        'SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()',
      );
    const allTables = rows
      .map((r) => r.table_name ?? r.TABLE_NAME)
      .filter((t): t is string => !!t);

    const tablesToClear = allTables.filter((t) => !KEEP_TABLES.has(t));

    logger.log(
      `Clearing ${tablesToClear.length} table(s); keeping: ${[...KEEP_TABLES].join(', ')}`,
      LOG_CTX,
    );

    // Disable FK checks so delete order between related tables does not matter.
    await AppDataSource.query('SET FOREIGN_KEY_CHECKS = 0');
    try {
      for (const table of tablesToClear) {
        await AppDataSource.query(`DELETE FROM \`${table}\``);
        logger.verbose(`Cleared ${table}`, LOG_CTX);
      }
    } finally {
      await AppDataSource.query('SET FOREIGN_KEY_CHECKS = 1');
    }
    logger.log(`${colors.green}Game tables cleared${colors.reset}`, LOG_CTX);

    // Reset every player back to a fresh, classless state. They will re-pick a
    // starting province (is_new = true) which re-grants troops/money/research.
    logger.log('Resetting users to fresh state...', LOG_CTX);
    await AppDataSource.query(
      'UPDATE `users` SET `is_new` = 1, `piety` = 0, `completed_research` = NULL, `class` = NULL',
    );
    logger.log(`${colors.green}Users reset (is_new=1, piety=0, completed_research=NULL, class=NULL)${colors.reset}`, LOG_CTX);

    logger.log(`${colors.green}========== RESET COMPLETE ==========${colors.reset}`, LOG_CTX);
  } catch (error) {
    logger.error(`Reset failed: ${(error as Error).message}`, LOG_CTX);
    await AppDataSource.destroy();
    process.exit(1);
  }

  await AppDataSource.destroy();
  logger.log('Database connection closed', LOG_CTX);
  process.exit(0);
}

resetGameData().catch((error) => {
  logger.error(`Fatal error: ${error.message}`, LOG_CTX);
  console.error(error);
  process.exit(1);
});
