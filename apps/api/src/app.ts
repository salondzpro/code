import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import etag from '@fastify/etag';
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import * as Sentry from '@sentry/node';
import { config } from './config';
import authPlugin from './plugins/auth';
import { AppError, fromPostgrest } from './lib/errors';
import healthRoutes from './routes/health';
import publicRoutes from './routes/public';
import meRoutes from './routes/me';
import bookingRoutes from './routes/bookings';
import proSalonRoutes from './routes/pro/salon';
import proServiceRoutes from './routes/pro/services';
import proStaffRoutes from './routes/pro/staff';
import proBlockRoutes from './routes/pro/blocks';
import proBookingRoutes from './routes/pro/bookings';
import internalRoutes from './routes/internal';

export type App = FastifyInstance;

export async function buildApp(): Promise<App> {
  if (config.SENTRY_DSN) {
    Sentry.init({ dsn: config.SENTRY_DSN, environment: config.NODE_ENV, tracesSampleRate: 0.05 });
  }

  const app = Fastify({
    logger: config.isProd
      ? { level: config.LOG_LEVEL }
      : {
          level: config.LOG_LEVEL,
          transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
        },
    trustProxy: true,
    bodyLimit: 512 * 1024,
    ajv: undefined,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(helmet, { global: true, contentSecurityPolicy: false });
  await app.register(cors, {
    origin: config.corsOrigins.length ? config.corsOrigins : !config.isProd,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.user?.id ?? req.ip,
  });
  await app.register(etag);
  await app.register(authPlugin);

  app.setErrorHandler((err, req, reply) => {
    if (hasZodFastifySchemaValidationErrors(err)) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Données invalides',
          details: err.validation.map((v) => ({ path: v.instancePath, message: v.message })),
        },
      });
    }
    if (isResponseSerializationError(err)) {
      req.log.error({ err }, 'response serialization error');
      return reply.status(500).send({ error: { code: 'SERIALIZATION_ERROR', message: 'Erreur interne' } });
    }
    if (err instanceof AppError) {
      return reply.status(err.statusCode).send({
        error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
      });
    }
    // Erreur PostgREST non interceptée (shape { code, message, details, hint })
    const maybePg = err as unknown as { code?: string; message?: string; details?: string; hint?: string };
    if (maybePg && typeof maybePg.code === 'string' && typeof maybePg.message === 'string' && 'hint' in maybePg) {
      const mapped = fromPostgrest({
        code: maybePg.code,
        message: maybePg.message,
        details: maybePg.details ?? '',
        hint: maybePg.hint ?? '',
      });
      if (mapped.statusCode >= 500) req.log.error({ err }, 'db error');
      return reply.status(mapped.statusCode).send({
        error: { code: mapped.code, message: mapped.message, ...(mapped.details ? { details: mapped.details } : {}) },
      });
    }
    const e = err as { statusCode?: number; message?: string };
    const status = e.statusCode ?? 500;
    if (status >= 500) {
      req.log.error({ err }, 'unhandled error');
      if (config.SENTRY_DSN) Sentry.captureException(err);
    }
    return reply.status(status).send({
      error: {
        code: status === 429 ? 'RATE_LIMITED' : status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
        message: status >= 500 ? 'Erreur interne' : (e.message ?? 'Erreur'),
      },
    });
  });

  app.setNotFoundHandler((_req, reply) => {
    reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Route introuvable' } });
  });

  await app.register(healthRoutes);
  await app.register(publicRoutes, { prefix: '/v1' });
  await app.register(meRoutes, { prefix: '/v1' });
  await app.register(bookingRoutes, { prefix: '/v1' });
  await app.register(proSalonRoutes, { prefix: '/v1/pro' });
  await app.register(proServiceRoutes, { prefix: '/v1/pro' });
  await app.register(proStaffRoutes, { prefix: '/v1/pro' });
  await app.register(proBlockRoutes, { prefix: '/v1/pro' });
  await app.register(proBookingRoutes, { prefix: '/v1/pro' });
  await app.register(internalRoutes, { prefix: '/internal' });

  return app;
}
