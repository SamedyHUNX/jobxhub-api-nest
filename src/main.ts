import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from './common/services/config.service';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import './instrument';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import bodyParser from 'body-parser';

async function bootstrap() {
  // Create the App
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });
  // To access the ConfigService (Environment Variables)
  const configService = app.get(ConfigService);
  const clientUrls = configService.get<string>('CLIENT_URLS')?.split(',') || [];

  // API Documentation
  const config = new DocumentBuilder()
    .setTitle('JobXHub API')
    .setDescription('API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  // Create Swagger Document
  const document = SwaggerModule.createDocument(app, config);
  // Setup Swagger UI
  SwaggerModule.setup('api', app, document);

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory(errors) {
        const messages = errors.map(
          (err) => `${err.property} - ${Object.values(err.constraints || {}).join(', ')}`
        )
        return new BadRequestException(messages)
      },
    }),
  );

  // Set Global Prefix
  app.setGlobalPrefix('api');
  // Use Cookie Parser
  app.use(cookieParser());
  // Enable CORS
  app.enableCors({
    origin: clientUrls,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  // Start the server
  await app.listen(configService.port);
}
bootstrap().catch((err) => {
  console.error('Error during application bootstrap:', err);
  process.exit(1);
});
