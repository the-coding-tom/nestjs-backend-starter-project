import { NestFactory } from '@nestjs/core';
import * as morgan from 'morgan';

import { AppModule } from './app.module';
import { config } from './config/config';
import { LoggerService } from './common/services/logger/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Enable raw body for Stripe webhook signature verification
  });

  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Add morgan logging middleware
  app.use(
    morgan(':method :url :status :res[content-length] - :response-time ms', {
      stream: {
        write: message => LoggerService.info(message.replace('\n', '')),
      },
    }),
  );

  await app.listen(config.port);
  LoggerService.info(`Application is running on: http://localhost:${config.port}`);
}

bootstrap();

