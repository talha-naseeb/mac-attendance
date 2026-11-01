import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap/configure-app';
import { resolveCorsOrigins } from './config/cors';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  configureApp(app);

  app.useBodyParser('json', { limit: '100kb' });
  app.useBodyParser('urlencoded', { limit: '100kb', extended: true });

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

  // Enable CORS only for the configured admin and mobile web origins.
  const environment = configService.get<string>('environment') || 'development';
  const configuredOrigins = resolveCorsOrigins(
    process.env.CORS_ORIGINS,
    environment,
  );
  app.enableCors({
    origin: configuredOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: false,
  });

  // Setup Swagger OpenAPI interactive documentation
  const config = new DocumentBuilder()
    .setTitle('Mac-HR Enterprise API')
    .setDescription(
      'Mac-HR Backend REST Services: 4-Tier RBAC, 6-Layer Anti-Spoofing Attendance, Saudi Labor Law Leaves, and GOSI Payroll.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT bearer token',
        in: 'header',
      },
      'bearer',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Mac-HR API Documentation',
  });

  const port = configService.get<number>('port') || 4000;
  await app.listen(port);
  logger.log(`🚀 Mac-HR Backend running at http://localhost:${port}/api`);
  logger.log(`📖 Swagger OpenAPI docs available at http://localhost:${port}/api/docs`);
}

bootstrap();
