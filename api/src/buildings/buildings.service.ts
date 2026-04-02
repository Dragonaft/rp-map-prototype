import { Injectable } from '@nestjs/common';
import { InjectRepository } from "@nestjs/typeorm";
import { Not, Repository } from "typeorm";
import { Building } from "./entities/building.entity";
import { BuildingTypes } from "./types/building.types";

@Injectable()
export class BuildingsService {
  constructor(
    @InjectRepository(Building)
    private readonly buildingsRepository: Repository<Building>,
  ) {}

  async findAll() {
    return await this.buildingsRepository.find({ where: { type: Not(BuildingTypes.CAPITAL)} });
  }
}
