import { Injectable, UnauthorizedException, ConflictException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { UserRoles } from '../users/types/users.types';
import { GameSettingsService } from '../settings/game-settings.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private gameSettingsService: GameSettingsService,
  ) {}

  /**
   * Rejects a non-ADMIN/MODERATOR login/refresh while the game is paused. Sibling to the
   * `is_npc` check in login() — placed after credential/identity checks so a paused game
   * never leaks which logins exist. Belt-and-braces alongside GamePauseInterceptor: without
   * this, a tab left open would keep silently renewing its access token via /auth/refresh.
   */
  private async assertLoginAllowed(user: User): Promise<void> {
    if (user.role === UserRoles.ADMIN || user.role === UserRoles.MODERATOR) return;

    const settings = await this.gameSettingsService.get();
    if (settings.is_paused) {
      throw new ForbiddenException({
        error: 'Forbidden',
        message: settings.pause_message || 'The game is currently paused.',
        code: 'GAME_PAUSED',
      });
    }
  }

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

    if (user.is_npc) {
      throw new UnauthorizedException('This is an NPC country and cannot be logged into');
    }

    await this.assertLoginAllowed(user);

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

    await this.assertLoginAllowed(user);

    return this.generateTokens(user);
  }

  private async generateTokens(user: User) {
    const payload = { sub: user.id, login: user.login, role: user.role };

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
