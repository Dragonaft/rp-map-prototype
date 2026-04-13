import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // In production the frontend is served by nginx on the same origin,
  // so CORS is not needed. In development allow the Vite dev server.
  app.enableCors({
    origin: process.env.NODE_ENV === 'production'
      ? false
      : ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  });

  await app.listen(3000);
  console.log(`API server is running on http://localhost:3000`);
}
bootstrap();
