import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { NewsAgency } from './entities/news-agency.entity';
import { NewsArticle } from './entities/news-article.entity';

export const MAX_ARTICLES_PER_DAY = 4;

function utcDayStart(): Date {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

export interface MyAgencyResponse {
  agency: NewsAgency | null;
  articlesToday: number;
  remainingToday: number;
}

@Injectable()
export class NewsService {
  constructor(
    @InjectRepository(NewsAgency) private readonly agencyRepo: Repository<NewsAgency>,
    @InjectRepository(NewsArticle) private readonly articleRepo: Repository<NewsArticle>,
  ) {}

  listAgencies(): Promise<NewsAgency[]> {
    return this.agencyRepo.find({ order: { createdAt: 'ASC' } });
  }

  async getAgency(id: string): Promise<NewsAgency> {
    const agency = await this.agencyRepo.findOne({ where: { id } });
    if (!agency) throw new NotFoundException(`News agency ${id} not found`);
    return agency;
  }

  listArticles(agencyId: string): Promise<NewsArticle[]> {
    return this.articleRepo.find({ where: { agency_id: agencyId }, order: { createdAt: 'DESC' } });
  }

  private countToday(agencyId: string): Promise<number> {
    return this.articleRepo.count({ where: { agency_id: agencyId, createdAt: MoreThanOrEqual(utcDayStart()) } });
  }

  async getMine(userId: string): Promise<MyAgencyResponse> {
    const agency = await this.agencyRepo.findOne({ where: { user_id: userId } });
    const articlesToday = agency ? await this.countToday(agency.id) : 0;
    return { agency, articlesToday, remainingToday: MAX_ARTICLES_PER_DAY - articlesToday };
  }

  async createAgency(userId: string, name: string): Promise<NewsAgency> {
    const trimmed = name.trim();
    if (await this.agencyRepo.findOne({ where: { user_id: userId } })) {
      throw new ConflictException('You already run a news agency');
    }
    if (await this.agencyRepo.findOne({ where: { name: trimmed } })) {
      throw new ConflictException('That agency name is already taken');
    }
    return this.agencyRepo.save(this.agencyRepo.create({ user_id: userId, name: trimmed }));
  }

  async renameAgency(userId: string, name: string): Promise<NewsAgency> {
    const trimmed = name.trim();
    const agency = await this.agencyRepo.findOne({ where: { user_id: userId } });
    if (!agency) throw new NotFoundException('You do not run a news agency yet');
    const taken = await this.agencyRepo.findOne({ where: { name: trimmed } });
    if (taken && taken.id !== agency.id) throw new ConflictException('That agency name is already taken');
    agency.name = trimmed;
    return this.agencyRepo.save(agency);
  }

  async createArticle(userId: string, title: string, content: string): Promise<NewsArticle> {
    const agency = await this.agencyRepo.findOne({ where: { user_id: userId } });
    if (!agency) throw new NotFoundException('You must create a news agency before publishing');
    if ((await this.countToday(agency.id)) >= MAX_ARTICLES_PER_DAY) {
      throw new BadRequestException(`You've already published ${MAX_ARTICLES_PER_DAY} articles today`);
    }
    return this.articleRepo.save(this.articleRepo.create({ agency_id: agency.id, title: title.trim(), content }));
  }
}
