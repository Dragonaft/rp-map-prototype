import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UsersCreateBodyRequest } from "./requests/users-create-body.request";
import { UsersUpdateBodyRequest } from "./requests/users-update-body.request";
import { PartialUser } from "./types/users.types";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: UsersCreateBodyRequest): Promise<User> {
    const user = this.usersRepository.create({
      ...createUserDto,
      is_new: true,
    });

    return await this.usersRepository.save(user);
  }

  async findAll(): Promise<PartialUser[]> {
    const users = await this.usersRepository.find();
    return users.map(user => ({
      id: user.id,
      countryName: user.country_name,
      color: user.color,
    }));
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id }, relations: ['provinces'] });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async update(id: string, updateUserDto: UsersUpdateBodyRequest): Promise<User> {
    const user = await this.findOne(id);

    Object.assign(user, updateUserDto);

    return await this.usersRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    // const user = await this.findOne(id);
    // await this.usersRepository.remove(user);
  }
}
