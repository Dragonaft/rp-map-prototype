import { ClassSerializerInterceptor, Controller, Get, Request, UseGuards, UseInterceptors } from '@nestjs/common';
import { GoodsService } from './goods.service';
import { UserGoodsService } from './user-goods.service';
import { Good } from './entities/good.entity';
import { UserGood } from './entities/user-good.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('goods')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class GoodsController {
  constructor(
    private readonly goodsService: GoodsService,
    private readonly userGoodsService: UserGoodsService,
  ) {}

  @Get()
  async getAll(): Promise<Good[]> {
    return this.goodsService.getAll();
  }

  @Get('mine')
  async getMine(@Request() req): Promise<UserGood[]> {
    return this.userGoodsService.getForUser(req.user.id);
  }
}
