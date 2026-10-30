import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';

export interface JwtPayload {
  sub: string;
  employeeId: string;
  email: string;
  role: string;
  branchId?: string | null;
  name: string;
  canAccessWebAdmin?: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.secret'),
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException('Invalid JWT payload claims.');
    }

    // Re-hydrate security-sensitive claims so role removal and deactivation
    // take effect immediately instead of waiting for a previously issued JWT.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        employeeId: true,
        email: true,
        role: true,
        branchId: true,
        firstName: true,
        lastName: true,
        canAccessWebAdmin: true,
        isActive: true,
      },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Your account is inactive or no longer exists.');
    }

    return {
      id: user.id,
      employeeId: user.employeeId,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
      name: `${user.firstName} ${user.lastName}`,
      canAccessWebAdmin: user.canAccessWebAdmin,
    };
  }
}
