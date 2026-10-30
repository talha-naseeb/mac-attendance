import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { resolveCorsOrigins } from './config/cors';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Set global API route prefix: /api/...
  app.setGlobalPrefix('api');

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

  // Global validation pipe with automatic payload stripping & transformation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global exception filter for unified REST responses
  app.useGlobalFilters(new HttpExceptionFilter());

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
