import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createPublicKey, verify as verifySignature } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { LoginDto, SsoLoginDto } from './dto/login.dto';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private entraJwksCache?: { keys: Array<Record<string, unknown>>; expiresAt: number };

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        branch: true,
        manager: { select: { firstName: true, lastName: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('This account has been deactivated. Please contact HR.');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const payload: JwtPayload = {
      sub: user.id,
      employeeId: user.employeeId,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
      name: `${user.firstName} ${user.lastName}`,
      canAccessWebAdmin: user.canAccessWebAdmin,
    };

    const token = this.jwtService.sign(payload);

    return {
      accessToken: token,
      user: {
        id: user.id,
        employeeId: user.employeeId,
        firstName: user.firstName,
        lastName: user.lastName,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        phone: user.phone,
        role: user.role,
        department: user.department,
        jobTitle: user.jobTitle,
        fullNameAr: user.fullNameAr,
        titleAr: user.titleAr,
        departmentAr: user.departmentAr,
        nationalId: user.nationalId,
        iqamaNumber: user.iqamaNumber,
        avatarInitials: user.avatarInitials,
        avatarPresetId: user.avatarPresetId,
        avatarColor: user.avatarColor,
        createdAt: user.createdAt,
        isRemoteAllowed: user.isRemoteAllowed,
        manager: user.manager,
        avatarUrl: user.avatarUrl,
        canAccessWebAdmin: user.canAccessWebAdmin,
        branch: user.branch
          ? {
              id: user.branch.id,
              name: user.branch.name,
              nameAr: user.branch.nameAr,
              code: user.branch.code,
              latitude: user.branch.latitude,
              longitude: user.branch.longitude,
              geofenceRadiusMeters: user.branch.geofenceRadiusMeters,
            }
          : null,
      },
    };
  }

  /**
   * The web console has a distinct sign-in endpoint so employee credentials
   * cannot be used to establish an administration-console session.
   */
  async adminLogin(loginDto: LoginDto) {
    const result = await this.login(loginDto);
    if (
      !result.user.canAccessWebAdmin ||
      (result.user.role !== 'HR_ADMIN' && result.user.role !== 'SUPER_ADMIN')
    ) {
      throw new ForbiddenException(
        'This account is not authorized to access the MacqHR administration console.',
      );
    }
    return result;
  }

  async ssoLogin(ssoDto: SsoLoginDto) {
    const claims = await this.verifyEntraIdToken(ssoDto.ssoToken);
    const emailClaim = claims.preferred_username ?? claims.email ?? claims.upn;
    if (typeof emailClaim !== 'string' || !emailClaim.includes('@')) {
      throw new UnauthorizedException('Verified Entra token has no usable email claim.');
    }
    const email = emailClaim.toLowerCase();

    if (email !== ssoDto.email.trim().toLowerCase()) {
      throw new UnauthorizedException('SSO email does not match the verified Entra ID principal.');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        branch: true,
        manager: { select: { firstName: true, lastName: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        `User ${email} does not exist in corporate directory. SSO sync required.`,
      );
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account has been disabled.');
    }

    const payload: JwtPayload = {
      sub: user.id,
      employeeId: user.employeeId,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
      name: `${user.firstName} ${user.lastName}`,
      canAccessWebAdmin: user.canAccessWebAdmin,
    };

    const token = this.jwtService.sign(payload);

    return {
      accessToken: token,
      user: {
        id: user.id,
        employeeId: user.employeeId,
        firstName: user.firstName,
        lastName: user.lastName,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.role,
        department: user.department,
        jobTitle: user.jobTitle,
        fullNameAr: user.fullNameAr,
        titleAr: user.titleAr,
        departmentAr: user.departmentAr,
        nationalId: user.nationalId,
        iqamaNumber: user.iqamaNumber,
        avatarInitials: user.avatarInitials,
        avatarPresetId: user.avatarPresetId,
        avatarColor: user.avatarColor,
        createdAt: user.createdAt,
        isRemoteAllowed: user.isRemoteAllowed,
        manager: user.manager,
        avatarUrl: user.avatarUrl,
        canAccessWebAdmin: user.canAccessWebAdmin,
        branch: user.branch,
      },
    };
  }

  private async verifyEntraIdToken(token: string): Promise<Record<string, unknown>> {
    const tenantId = this.configService.get<string>('azure.tenantId');
    const clientId = this.configService.get<string>('azure.clientId');
    if (!tenantId || !clientId) {
      this.logger.error('Entra SSO is unavailable because AZURE_TENANT_ID/AZURE_CLIENT_ID are not configured.');
      throw new UnauthorizedException('Microsoft Entra SSO is not configured.');
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Invalid Microsoft Entra ID token.');
    }

    let header: Record<string, unknown>;
    let claims: Record<string, unknown>;
    try {
      header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    } catch {
      throw new UnauthorizedException('Invalid Microsoft Entra ID token.');
    }
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') {
      throw new UnauthorizedException('Unsupported Microsoft Entra ID token signing method.');
    }

    let keys = await this.getEntraSigningKeys(tenantId);
    let jwk = keys.find((key) => key.kid === header.kid && key.kty === 'RSA');
    if (!jwk) {
      keys = await this.getEntraSigningKeys(tenantId, true);
      jwk = keys.find((key) => key.kid === header.kid && key.kty === 'RSA');
    }
    if (!jwk) {
      throw new UnauthorizedException('Unrecognized Microsoft Entra signing key.');
    }

    const signingInput = Buffer.from(`${parts[0]}.${parts[1]}`);
    const signature = Buffer.from(parts[2], 'base64url');
    let signatureValid = false;
    try {
      signatureValid = verifySignature(
        'RSA-SHA256',
        signingInput,
        createPublicKey({
          // The JWKS response is runtime-validated above; cast through unknown
          // because DOM and Node declare distinct JsonWebKey interfaces.
          key: jwk as unknown as import('crypto').JsonWebKey,
          format: 'jwk',
        }),
        signature,
      );
    } catch {
      signatureValid = false;
    }
    if (!signatureValid) {
      throw new UnauthorizedException('Microsoft Entra ID token signature is invalid.');
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (
      claims.aud !== clientId ||
      claims.iss !== `https://login.microsoftonline.com/${tenantId}/v2.0` ||
      claims.tid !== tenantId ||
      typeof claims.exp !== 'number' || claims.exp <= nowSeconds ||
      (typeof claims.nbf === 'number' && claims.nbf > nowSeconds)
    ) {
      throw new UnauthorizedException('Microsoft Entra ID token claims are invalid or expired.');
    }
    return claims;
  }

  private async getEntraSigningKeys(
    tenantId: string,
    forceRefresh = false,
  ): Promise<Array<Record<string, unknown>>> {
    if (!forceRefresh && this.entraJwksCache && this.entraJwksCache.expiresAt > Date.now()) {
      return this.entraJwksCache.keys;
    }
    try {
      const response = await fetch(
        `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/discovery/v2.0/keys`,
      );
      if (!response.ok) throw new Error(`JWKS request failed: ${response.status}`);
      const body = (await response.json()) as { keys?: Array<Record<string, unknown>> };
      if (!Array.isArray(body.keys)) throw new Error('JWKS response did not contain keys.');
      this.entraJwksCache = { keys: body.keys, expiresAt: Date.now() + 60 * 60 * 1000 };
      return body.keys;
    } catch (error) {
      this.logger.error('Could not retrieve Microsoft Entra signing keys.', error);
      throw new UnauthorizedException('Microsoft Entra SSO verification is temporarily unavailable.');
    }
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        branch: true,
        manager: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            jobTitle: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User profile not found.');
    }

    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }
}
