import { buildApp } from './app';
import { config } from './config';

const app = await buildApp();

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'arrêt en cours…');
  await app.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ port: config.PORT, host: config.HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
