import { PayloadTooLargeException, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';

export function configureApp(app: NestExpressApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  app.useBodyParser('json', { limit: '100kb' });
  app.useBodyParser('urlencoded', { limit: '100kb', extended: true });

  // body-parser rejects an oversized body before any route runs. Its error is
  // not an HttpException, so the catch-all filter would report 500; normalize it
  // to the 413 the transport contract promises.
  app.use((error: unknown, _req: Request, _res: Response, next: NextFunction) => {
    if ((error as { type?: string } | null)?.type === 'entity.too.large') {
      next(new PayloadTooLargeException());
      return;
    }
    next(error);
  });

  const helmetMiddleware = helmet();
  app.use((req, res, next) => {
    // Swagger UI ships an inline bootstrap script and is served over HTTP in
    // development; helmet's default CSP blocks the first and upgrades the second.
    if (req.path.startsWith('/api/docs')) {
      next();
      return;
    }
    helmetMiddleware(req, res, next);
  });
}
