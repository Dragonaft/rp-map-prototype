import { ClassSerializerInterceptor, Controller, Get, NotFoundException, Param, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IconsService } from './icons.service';

@Controller('icons')
@UseGuards(JwtAuthGuard)
export class IconsController {
  constructor(private readonly iconsService: IconsService) {}

  @Get()
  @UseInterceptors(ClassSerializerInterceptor)
  getAll() {
    return this.iconsService.findAllMeta();
  }

  // Binary response, served outside the normal JSON pipeline — @Res() without `passthrough`
  // takes over the response entirely, same convention as GET /users/:id/flag. Immutable caching
  // means each browser fetches a given hash's icon at most once.
  @Get(':kind/:key')
  async getIcon(@Param('kind') kind: string, @Param('key') key: string, @Res() res: Response) {
    const icon = await this.iconsService.getIconBinary(kind, key);
    if (!icon) {
      throw new NotFoundException(`No icon for ${kind}/${key}`);
    }
    res.set({
      'Content-Type': icon.mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
      ETag: icon.hash,
    });
    res.send(icon.data);
  }
}
