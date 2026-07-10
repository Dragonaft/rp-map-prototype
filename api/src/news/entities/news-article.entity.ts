import { BaseEntity, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { NewsAgency } from './news-agency.entity';

/** A published article, immutable once posted — max 4 per agency per calendar (UTC) day, see NewsService. */
@Entity({ name: 'news_articles' })
@Index(['agency_id', 'createdAt'])
export class NewsArticle extends BaseEntity {
  @PrimaryColumn({ generated: 'uuid' })
  public readonly id: string;

  @Column()
  public agency_id: string;

  @ManyToOne(() => NewsAgency, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agency_id' })
  public agency: NewsAgency;

  @Column()
  public title: string;

  /** Markdown body. */
  @Column({ type: 'text' })
  public content: string;

  @CreateDateColumn()
  public readonly createdAt: Date;
}
