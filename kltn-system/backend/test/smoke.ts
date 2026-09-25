import assert from 'node:assert/strict';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  const swaggerConfig = new DocumentBuilder().setTitle('KLTN smoke').setVersion('1').build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));
  await app.init();
  const server = await app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const unauthenticated = await fetch(`http://127.0.0.1:${port}/api/topics`);
  assert.equal(unauthenticated.status, 401, 'protected topics endpoint must reject anonymous requests');
  const docs = await fetch(`http://127.0.0.1:${port}/docs`);
  assert.equal(docs.status, 200, 'Swagger endpoint must be available');
  await app.close();
  console.log('Smoke checks passed');
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
