import {
  type ArgumentMetadata,
  BadRequestException,
  type INestApplication,
  UnsupportedMediaTypeException,
  ValidationPipe,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { AppConfig } from './config';

/**
 * Rejects bodies that are not a JSON object (e.g. an array) before class-validator sees them.
 * A request with no body at all is treated as `{}`.
 */
class StrictValidationPipe extends ValidationPipe {
  override async transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
    if (metadata.type === 'body' && value === undefined) value = {};
    if (metadata.type === 'body' && (typeof value !== 'object' || value === null || Array.isArray(value))) {
      throw new BadRequestException(['request body must be a JSON object']);
    }
    return super.transform(value, metadata);
  }
}

/**
 * A POST/PUT/PATCH with a body must declare `Content-Type: application/json`.
 * Plain Express middleware runs outside Nest's exception filter, so it writes the JSON error itself.
 */
function requireJsonBody(req: Request, res: Response, next: NextFunction): void {
  const hasBody = Number(req.headers['content-length'] ?? 0) > 0 || req.headers['transfer-encoding'] !== undefined;
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && hasBody && !req.is('application/json')) {
    const error = new UnsupportedMediaTypeException('Content-Type must be application/json');
    res.status(error.getStatus()).json(error.getResponse());
    return;
  }
  next();
}

/** Everything `main.ts` and the e2e tests share, so tests exercise the real HTTP behaviour. */
export function configureApp(app: INestApplication, config: AppConfig): void {
  app.setGlobalPrefix('api');
  app.use(requireJsonBody);
  app.useGlobalPipes(
    new StrictValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      stopAtFirstError: true,
      transform: true,
      // Never coerce: "12" must not become 12 and "false" must not become true.
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.enableCors({
    origin: config.corsOrigins,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  });
  app.enableShutdownHooks();
}
