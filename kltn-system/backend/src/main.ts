import 'reflect-metadata';
import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser = require('cookie-parser');
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

import * as path from 'path';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
  app.use('/api/uploads', express.static(path.join(process.cwd(), 'uploads')));
  app.setGlobalPrefix('api');
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cookieParser());
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim().replace(/\/$/, ''))
    : ['http://localhost:5173', 'http://127.0.0.1:5173'];
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.replace(/\/$/, '');
      const isAllowed =
        allowedOrigins.includes('*') ||
        allowedOrigins.includes(cleanOrigin) ||
        /\.vercel\.app$/.test(cleanOrigin) ||
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanOrigin);
      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'Range'],
    exposedHeaders: ['Content-Range', 'X-Total-Count'],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  const config = new DocumentBuilder().setTitle('KLTN Management API').setDescription('Graduation thesis management API').setVersion('1.0').addBearerAuth().build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
}
bootstrap();
