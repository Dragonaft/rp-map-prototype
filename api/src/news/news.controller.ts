import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NewsService } from './news.service';
import { NewsAgencyNameDto } from './dto/news-agency-name.dto';
import { CreateNewsArticleDto } from './dto/create-news-article.dto';

@Controller('news')
@UseGuards(JwtAuthGuard)
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get('agencies')
  getAgencies() {
    return this.newsService.listAgencies();
  }

  @Get('agencies/mine')
  getMine(@Request() req) {
    return this.newsService.getMine(req.user.id);
  }

  @Get('agencies/:id')
  getAgency(@Param('id') id: string) {
    return this.newsService.getAgency(id);
  }

  @Get('agencies/:id/articles')
  getArticles(@Param('id') id: string) {
    return this.newsService.listArticles(id);
  }

  @Post('agencies')
  createAgency(@Request() req, @Body() dto: NewsAgencyNameDto) {
    return this.newsService.createAgency(req.user.id, dto.name);
  }

  @Patch('agencies/mine')
  renameAgency(@Request() req, @Body() dto: NewsAgencyNameDto) {
    return this.newsService.renameAgency(req.user.id, dto.name);
  }

  @Post('articles')
  createArticle(@Request() req, @Body() dto: CreateNewsArticleDto) {
    return this.newsService.createArticle(req.user.id, dto.title, dto.content);
  }
}
