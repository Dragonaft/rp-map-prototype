import { BaseEntity, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, Unique } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { NewsArticle } from './news-article.entity';

/** One press outlet per player — publishes NewsArticle rows to the public News Wall. */
@Entity({ name: 'news_agencies' })
@Unique(['user_id'])
@Unique(['name'])
export class NewsAgency extends BaseEntity {
  @PrimaryColumn({ generated: 'uuid' })
  public readonly id: string;

  @Column()
  public user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  public user: User;

  @Column()
  public name: string;

  @OneToMany(() => NewsArticle, (article) => article.agency)
  public readonly articles?: NewsArticle[];

  @CreateDateColumn()
  public readonly createdAt: Date;
}
