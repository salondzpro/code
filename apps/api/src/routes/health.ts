import type { FastifyPluginAsync } from 'fastify';

const startedAt = new Date().toISOString();

const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', { config: { rateLimit: false } }, async (_req, reply) => {
    reply.header('Cache-Control', 'no-store');
    return { ok: true, service: 'salondz-api', startedAt, now: new Date().toISOString() };
  });
};

export default healthRoutes;
