import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(login: string, password: string, country_name: string, color: string) {
    const existingUser = await this.usersRepository.findOne({ where: { login } });
    if (existingUser) {
      throw new ConflictException('User with this login already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await this.usersService.create({
      login,
      password: hashedPassword,
      country_name,
      color,
      troops: 0,
      money: 0,
    });

    return {
      id: user.id,
      login: user.login,
      countryName: user.country_name,
      color: user.color,
      troops: user.troops,
      money: user.money,
      isNew: user.is_new,
    };
  }

  async login(login: string, password: string) {
    const user = await this.usersRepository.findOne({ where: { login } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user);
    return {
      user: {
        id: user.id,
        login: user.login,
      },
      ...tokens,
    };
  }

  async refreshTokens(userId: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.generateTokens(user);
  }

  private async generateTokens(user: User) {
    const payload = { sub: user.id, login: user.login };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    return {
      accessToken,
      refreshToken,
    };
  }
}
