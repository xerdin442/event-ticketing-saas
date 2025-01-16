import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import logger from './common/logger';
import { Secrets } from './common/env';
import { WsAdapter } from '@nestjs/platform-ws';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Secrets.PORT ?? 3000
  
  app.enableCors();
  app.use(helmet());
  app.setGlobalPrefix('/api');
  app.useWebSocketAdapter(new WsAdapter(app));
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true
  }));
  
  await app.listen(port, '0.0.0.0');
  logger.info(`Application is running on port ${port}\n`)
}
bootstrap();
