import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Province } from './entities/province.entity';

@Injectable()
export class ProvincesService {
  constructor(
    @InjectRepository(Province)
    private readonly provinceRepository: Repository<Province>,
  ) {}

  create(body: any) {
    return 'This action adds a new province';
  }

  async getAll() {
    return await this.provinceRepository.find();
  }

  findOne(id: number) {
    return `This action returns a #${id} province`;
  }

  update(id: number, body: any) {
    return `This action updates a #${id} province`;
  }
}
