import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { TechsService } from './techs.service';
import { SelectResearchDto } from './dto/select-research.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('techs')
@UseGuards(JwtAuthGuard)
export class TechsController {
  constructor(private readonly techsService: TechsService) {}

  @Get()
  async getAvailableForUser(@Request() req): Promise<Array<Record<string, unknown>>> {
    return this.techsService.getAvailableForUser(req.user ?? null);
  }

  /** Sets the caller's active research slot immediately — see TechsService.selectActiveResearch. */
  @Post('select')
  async selectActiveResearch(@Request() req, @Body() dto: SelectResearchDto): Promise<{ activeResearch: string }> {
    const activeResearch = await this.techsService.selectActiveResearch(req.user.id, dto.tech_key);
    return { activeResearch };
  }
}
