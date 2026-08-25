import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface AuthUser {
  userId: string;
  email: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Kein gültiges Token vorhanden.');
    }
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });
      request.user = { userId: payload.sub, email: payload.email } as AuthUser;
      return true;
    } catch {
      throw new UnauthorizedException('Token ungültig oder abgelaufen.');
    }
  }

  private extractToken(request: any): string | undefined {
    const cookieToken = request.cookies?.['access_token'];
    if (cookieToken) return cookieToken;
    const authHeader = request.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice('Bearer '.length);
    }
    return undefined;
  }
}
