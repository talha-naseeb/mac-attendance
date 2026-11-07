import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl, ip } = req;
    const start = Date.now();

    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - start;
      const forwarded = req.headers['x-forwarded-for'];
      const rawIp =
        (typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded?.[0]) ||
        req.socket.remoteAddress ||
        ip ||
        'unknown';
      const clientIp = rawIp.replace(/[\r\n]/g, '').trim();
      const safeUrl = originalUrl.replace(/[\r\n]/g, '');

      const icon = statusCode >= 400 ? '⚠️' : '📡';
      this.logger.log(
        `${icon} [${method}] ${safeUrl} -> ${statusCode} (${duration}ms) [from ${clientIp}]`,
      );
    });

    next();
  }
}
