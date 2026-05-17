import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from './common/services/config.service';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import './instrument';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { createWinstonConfig } from './logging/winston.config';

async function bootstrap() {
  // Create the App
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(createWinstonConfig()),
    rawBody: true,
  });

  // To access the ConfigService (Environment Variables)
  const configService = app.get(ConfigService);
  const clientUrls = configService.get<string>('CLIENT_URLS')?.split(',') || [];

  // 1. Enable CORS first — must be before any middleware, guards, or pipes
  app.enableCors({
    origin: clientUrls.length > 0 ? clientUrls : [
      'https://jobxhub.com',
      'https://www.jobxhub.com',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
  });

  // 2. Core middleware
  app.use(cookieParser());

  // 3. Global prefix
  app.setGlobalPrefix('api');

  // 4. Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory(errors) {
        const messages = errors.map(
          (err) => `${err.property} - ${Object.values(err.constraints || {}).join(', ')}`
        );
        return new BadRequestException(messages);
      },
    }),
  );

  // 5. API Documentation (Swagger) — last, it's just a UI
  const config = new DocumentBuilder()
    .setTitle("JobXHub's API")
    .setDescription('API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // 6. Start the server
  await app.listen(configService.port);
}

bootstrap().catch((err) => {
  console.error('Error during application bootstrap:', err);
  process.exit(1);
});