import { createServer } from './server';
import { env } from './config/env';

const app = createServer();

const server = app.listen(env.PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 Versora API running in [${env.NODE_ENV}] mode`);
  console.log(`📡 URL: http://localhost:${env.PORT}`);
  console.log(`🩺 Health: http://localhost:${env.PORT}/api/health`);
  console.log(`===============================================`);
});

// Graceful Shutdown
function handleShutdown(signal: string) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('Versora API server closed cleanly.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
