import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { DbService } from '../db/db.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DbService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.db.query('SELECT id FROM users WHERE email = $1', [dto.email]);
    if (existing.rowCount && existing.rowCount > 0) {
      throw new ConflictException('Diese E-Mail-Adresse ist bereits registriert.');
    }
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const userId = uuid();
    await this.db.query(
      'INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)',
      [userId, dto.email, passwordHash],
    );
    await this.db.query(
      'INSERT INTO claude_connections (id, user_id, type, concurrency_limit) VALUES ($1, $2, $3, $4)',
      [uuid(), userId, 'API_KEY', 2],
    );
    return this.buildAuthResult(userId, dto.email);
  }

  async login(dto: LoginDto) {
    const result = await this.db.query(
      'SELECT id, password_hash FROM users WHERE email = $1',
      [dto.email],
    );
    const user = result.rows[0];
    if (!user) throw new UnauthorizedException('E-Mail oder Passwort ist falsch.');
    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) throw new UnauthorizedException('E-Mail oder Passwort ist falsch.');
    return this.buildAuthResult(user.id, dto.email);
  }

  private async buildAuthResult(userId: string, email: string) {
    const token = await this.jwtService.signAsync(
      { sub: userId, email },
      { secret: process.env.JWT_SECRET, expiresIn: '7d' },
    );
    return { token, user: { id: userId, email } };
  }
}
