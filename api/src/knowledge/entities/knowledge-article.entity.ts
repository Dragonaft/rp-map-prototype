import { BaseEntity, Column, Entity, PrimaryColumn } from 'typeorm';
import { Expose } from 'class-transformer';

/**
 * A player-facing knowledge base article (the "Codex"). Content is authored as markdown files
 * under `api/data/knowledge/` and owned by `seed-knowledge.ts` — admin-panel edits are a
 * convenience overlay, not the source of truth; a reseed overwrites them (same convention as
 * PlayerClass/Good). `key` must equal the source filename's basename.
 */
@Entity({ name: 'knowledge_articles' })
export class KnowledgeArticle extends BaseEntity {
  @PrimaryColumn({ generated: 'uuid' })
  public readonly id: string;

  @Column({ unique: true })
  public key: string;

  @Column()
  public title: string;

  /** Sidebar grouping, free string (e.g. "Basics", "Economy", "Warfare"). */
  @Column()
  public category: string;

  /** Global ordering across all articles; categories sort by their lowest member's order. */
  @Column({ name: 'sort_order', default: 0 })
  @Expose({ name: 'sortOrder' })
  public sort_order: number;

  /** Markdown body. */
  @Column({ type: 'mediumtext' })
  public content: string;

  @Column({ name: 'is_visible', default: true })
  @Expose({ name: 'isVisible' })
  public is_visible: boolean;
}
