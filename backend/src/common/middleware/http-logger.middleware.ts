import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

const SENSITIVE_QUERY_KEYS =
  /([?&](?:token|access_token|accessToken|refresh_token|refreshToken|password|secret|nationalId|iqamaNumber)=)[^&#]*/gi;

export function redactSensitiveUrl(url: string): string {
  return url
    .replace(/[\r\n]/g, '')
    .replace(SENSITIVE_QUERY_KEYS, '$1[REDACTED]');
}

@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl, ip } = req;
    const incomingReqId = req.headers['x-request-id'];
    const rawReqId =
      typeof incomingReqId === 'string' && incomingReqId.trim().length > 0
        ? incomingReqId.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 64)
        : randomUUID();
    const requestId = rawReqId || randomUUID();

    (req as any).requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    const start = Date.now();

    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - start;
      const forwarded = req.headers['x-forwarded-for'];
      const rawIp =
        (typeof forwarded === 'string'
          ? forwarded.split(',')[0]
          : forwarded?.[0]) ||
        req.socket.remoteAddress ||
        ip ||
        'unknown';
      const clientIp = rawIp.replace(/[\r\n]/g, '').trim();
      const safeUrl = redactSensitiveUrl(originalUrl);

      const icon = statusCode >= 400 ? '⚠️' : '📡';
      this.logger.log(
        `${icon} [reqId=${requestId}] [${method}] ${safeUrl} -> ${statusCode} (${duration}ms) [from ${clientIp}]`,
      );
    });

    next();
  }
}
