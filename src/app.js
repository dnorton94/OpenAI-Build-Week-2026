import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiRouter } from './routes/api.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '150kb' }));
  app.use(express.static(path.join(rootDir, 'public'), { extensions: ['html'] }));
  app.use(apiRouter);
  app.use((req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` }));
  app.use((error, _req, res, _next) => {
    const status = Number.isInteger(error.statusCode) ? error.statusCode : 500;
    if (status >= 500) console.error(error);
    res.status(status).json({ error: error.message || 'Unexpected server error.' });
  });
  return app;
}
