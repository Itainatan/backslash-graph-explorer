import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { loadConfig } from './config';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const app = await NestFactory.create(AppModule.register({ config }));
  configureApp(app, config);
  await app.listen(config.port, '0.0.0.0');
  Logger.log(
    `API listening on port ${config.port}; CORS origins: ${config.corsOrigins.join(', ') || '(none)'}`,
    'Bootstrap',
  );
}

bootstrap().catch((error: unknown) => {
  Logger.error(error instanceof Error ? error.message : error, undefined, 'Bootstrap');
  process.exit(1);
});
