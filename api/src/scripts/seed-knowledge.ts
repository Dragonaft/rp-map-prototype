import * as fs from 'fs';
import * as path from 'path';
import { AppDataSource as AppDataSourceDev } from '../db/data-source';
import { AppDataSource as AppDataSourceProd } from '../db/data-source.prod';
import { KnowledgeArticle } from '../knowledge/entities/knowledge-article.entity';
import { colors, logger } from '../utils/logger';

const env = process.env.NODE_ENV;
if (env !== 'development' && env !== 'production') {
  console.error(`NODE_ENV must be "development" or "production", got: "${env}"`);
  process.exit(1);
}
const AppDataSource = env === 'production' ? AppDataSourceProd : AppDataSourceDev;

const LOG_CTX = 'SeedKnowledge';

interface KnowledgeSeedRow {
  key: string;
  title: string;
  category: string;
  sort_order: number;
  is_visible: boolean;
  content: string;
}

const KNOWN_FRONTMATTER_KEYS = new Set(['key', 'title', 'category', 'order', 'visible']);

/**
 * Splits a `---\n<key: value lines>\n---\n<body>` markdown file into frontmatter + body.
 * Deliberately minimal (no YAML dependency) — scalar `key: value` lines only, string/int/boolean
 * coercion, no nesting/lists/quoting. Sufficient for this fixed, hand-authored schema.
 */
function parseFrontmatter(raw: string, fileLabel: string): { fm: Record<string, string>; body: string } | null {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    logger.error(`${fileLabel}: missing "---" frontmatter block`, LOG_CTX);
    return null;
  }
  const [, fmBlock, body] = match;
  const fm: Record<string, string> = {};
  for (const line of fmBlock.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const sep = line.indexOf(':');
    if (sep === -1) {
      logger.error(`${fileLabel}: malformed frontmatter line "${line}"`, LOG_CTX);
      return null;
    }
    const key = line.slice(0, sep).trim();
    const value = line.slice(sep + 1).trim();
    if (!KNOWN_FRONTMATTER_KEYS.has(key)) {
      logger.error(`${fileLabel}: unknown frontmatter key "${key}"`, LOG_CTX);
      return null;
    }
    fm[key] = value;
  }
  return { fm, body: body.trim() };
}

function validateRow(filePath: string): KnowledgeSeedRow | null {
  const fileLabel = path.basename(filePath);
  const basenameKey = fileLabel.replace(/\.md$/, '');
  const raw = fs.readFileSync(filePath, 'utf-8');

  const parsed = parseFrontmatter(raw, fileLabel);
  if (!parsed) return null;
  const { fm, body } = parsed;

  if (!fm.key) {
    logger.error(`${fileLabel}: frontmatter "key" is required`, LOG_CTX);
    return null;
  }
  if (fm.key !== basenameKey) {
    logger.error(`${fileLabel}: frontmatter key "${fm.key}" must equal the filename basename "${basenameKey}"`, LOG_CTX);
    return null;
  }
  if (!fm.title) {
    logger.error(`${fileLabel}: frontmatter "title" is required`, LOG_CTX);
    return null;
  }
  if (!fm.category) {
    logger.error(`${fileLabel}: frontmatter "category" is required`, LOG_CTX);
    return null;
  }
  const order = Number(fm.order);
  if (fm.order === undefined || !Number.isFinite(order)) {
    logger.error(`${fileLabel}: frontmatter "order" must be a number`, LOG_CTX);
    return null;
  }
  if (fm.visible !== undefined && fm.visible !== 'true' && fm.visible !== 'false') {
    logger.error(`${fileLabel}: frontmatter "visible" must be "true" or "false"`, LOG_CTX);
    return null;
  }
  if (!body) {
    logger.error(`${fileLabel}: article body is empty`, LOG_CTX);
    return null;
  }

  return {
    key: fm.key,
    title: fm.title,
    category: fm.category,
    sort_order: order,
    is_visible: fm.visible !== 'false',
    content: body,
  };
}

async function seedKnowledge() {
  const dataDirPath = path.join(__dirname, '../../data/knowledge');

  if (!fs.existsSync(dataDirPath)) {
    logger.error(`Directory not found: ${dataDirPath}`, LOG_CTX);
    process.exit(1);
  }

  const files = fs.readdirSync(dataDirPath).filter((f) => f.endsWith('.md')).sort();
  if (files.length === 0) {
    logger.error(`No .md files found in ${dataDirPath}`, LOG_CTX);
    process.exit(1);
  }

  const rows: KnowledgeSeedRow[] = [];
  for (const file of files) {
    const row = validateRow(path.join(dataDirPath, file));
    if (row) rows.push(row);
  }

  if (rows.length === 0) {
    logger.error('No valid knowledge articles found', LOG_CTX);
    process.exit(1);
  }

  const seenKeys = new Set<string>();
  for (const row of rows) {
    if (seenKeys.has(row.key)) {
      logger.error(`Duplicate "key" across knowledge files: ${row.key}`, LOG_CTX);
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

  const repo = AppDataSource.getRepository(KnowledgeArticle);
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const patch = {
      title: row.title,
      category: row.category,
      sort_order: row.sort_order,
      is_visible: row.is_visible,
      content: row.content,
    };

    const existing = await repo.find({ where: { key: row.key } });

    if (existing.length === 0) {
      await repo.save(repo.create({ key: row.key, ...patch }));
      created++;
      logger.verbose(`Created ${row.key} — ${row.title}`, LOG_CTX);
    } else {
      for (const r of existing) {
        await repo.update(r.id, patch);
      }
      updated += existing.length;
      logger.verbose(`Updated ${existing.length} row(s) for ${row.key}`, LOG_CTX);
    }
  }

  console.log('');
  logger.log(`${colors.green}========== KNOWLEDGE SEED SUMMARY ==========${colors.reset}`, LOG_CTX);
  logger.log(`Files found: ${colors.blue}${files.length}${colors.reset}`, LOG_CTX);
  logger.log(`Valid articles applied: ${colors.blue}${rows.length}${colors.reset}`, LOG_CTX);
  logger.log(`Created: ${colors.green}${created}${colors.reset}`, LOG_CTX);
  logger.log(`Rows updated: ${colors.green}${updated}${colors.reset}`, LOG_CTX);
  logger.log(`${colors.green}=============================================${colors.reset}`, LOG_CTX);
  console.log('');

  await AppDataSource.destroy();
  logger.log('Database connection closed', LOG_CTX);
  process.exit(0);
}

seedKnowledge().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  logger.error(`Fatal: ${msg}`, LOG_CTX);
  console.error(e);
  process.exit(1);
});
