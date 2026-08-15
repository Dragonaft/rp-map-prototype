import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KnowledgeArticle } from './entities/knowledge-article.entity';

@Injectable()
export class KnowledgeService {
  constructor(
    @InjectRepository(KnowledgeArticle) private readonly knowledgeRepo: Repository<KnowledgeArticle>,
  ) {}

  /** Visible articles for the player-facing Codex, ordered for direct rendering. */
  findAllVisible() {
    return this.knowledgeRepo.find({
      where: { is_visible: true },
      order: { sort_order: 'ASC' },
    });
  }
}
