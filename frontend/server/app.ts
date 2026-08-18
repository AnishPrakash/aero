import express from 'express';
import { apiRouter } from './routes/api';

export function createExpressApp() {
  const app = express();
  app.use(express.json());

  // Mount backend API router
  app.use('/api', apiRouter);

  return app;
}
