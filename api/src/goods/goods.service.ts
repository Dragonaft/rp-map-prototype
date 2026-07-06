import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Good } from './entities/good.entity';

@Injectable()
export class GoodsService {
  constructor(
    @InjectRepository(Good)
    private readonly goodRepo: Repository<Good>,
  ) {}

  async getAll(): Promise<Good[]> {
    return this.goodRepo.find();
  }
}
