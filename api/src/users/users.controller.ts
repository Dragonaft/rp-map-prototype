import {
  Controller, Get, Post, Body, Patch, Param, Delete, HttpCode, HttpStatus, UseInterceptors, ClassSerializerInterceptor,
  UseGuards, Request, Res, UploadedFile, NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { UsersService, FLAG_MAX_BYTES } from './users.service';
import { UsersCreateBodyRequest } from "./requests/users-create-body.request";
import { UsersUpdateBodyRequest } from "./requests/users-update-body.request";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@Controller('users')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() body: UsersCreateBodyRequest) {
    return this.usersService.create(body);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.usersService.findOne(id, req.user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UsersUpdateBodyRequest, @Request() req) {
    return this.usersService.update(id, body, req.user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  // The multer size limit is a memory-safety backstop (rejects before the whole buffer is
  // read into RAM on this box's 2GB); UsersService.setFlag re-checks size and validates the
  // actual image format via magic bytes regardless of what multer/the client claim.
  @Post(':id/flag')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: FLAG_MAX_BYTES } }))
  uploadFlag(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @Request() req) {
    return this.usersService.setFlag(id, req.user.id, file?.buffer);
  }

  @Delete(':id/flag')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteFlag(@Param('id') id: string, @Request() req) {
    return this.usersService.deleteFlag(id, req.user.id);
  }

  // Binary response, served outside the normal JSON pipeline — @Res() without `passthrough`
  // takes over the response entirely, so ClassSerializerInterceptor never touches this buffer.
  // Immutable caching means each browser fetches a given hash's image at most once.
  @Get(':id/flag')
  async getFlag(@Param('id') id: string, @Res() res: Response) {
    const flag = await this.usersService.getFlag(id);
    if (!flag) {
      throw new NotFoundException('This user has no flag');
    }
    res.set({
      'Content-Type': flag.mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
      ...(flag.hash ? { ETag: flag.hash } : {}),
    });
    res.send(flag.data);
  }

  // No ownership check — any authenticated player may view any other's lore, same as
  // GET /diplomacy/treaties/public/:userId. Read through ClassSerializerInterceptor normally
  // (plain JSON, unlike the binary flag route above).
  @Get(':id/lore')
  getLore(@Param('id') id: string) {
    return this.usersService.getLore(id);
  }
}
