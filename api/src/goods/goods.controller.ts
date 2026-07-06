import { ClassSerializerInterceptor, Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { GoodsService } from './goods.service';
import { Good } from './entities/good.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('goods')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class GoodsController {
  constructor(private readonly goodsService: GoodsService) {}

  @Get()
  async getAll(): Promise<Good[]> {
    return this.goodsService.getAll();
  }
}
