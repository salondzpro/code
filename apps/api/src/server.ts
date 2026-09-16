import { buildApp } from './app';
import { config } from './config';

const app = await buildApp();

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'arrêt en cours…');
  // Garde-fou : si une requête traîne, on n'attend pas que l'hébergeur tue le processus.
  setTimeout(() => process.exit(1), 10_000).unref();
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
