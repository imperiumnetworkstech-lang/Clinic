import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Router } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { corsOrigins, env, isProduction } from './config/env.js';
import { sequelize } from './db/sequelize.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import './models/index.js';
import { adminRouter } from './routes/admin.js';
import { buildOpenApiDocument } from './routes/openapi.js';
import { patientRouter } from './routes/patient.js';
import { patientAuthRouter } from './routes/patientAuth.js';
import { publicRouter } from './routes/public.js';
import { staffAuthRouter } from './routes/staffAuth.js';

export function createApp(): express.Express {
  const app = express();

  app.set('trust proxy', env.TRUST_PROXY ? 1 : false);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => callback(null, !origin || corsOrigins.includes(origin)),
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
      maxAge: 600,
    }),
  );
  app.use(
    pinoHttp({
      logger,
      quietReqLogger: true,
      autoLogging: { ignore: (req) => req.url === '/health' },
      serializers: {
        req: (req: { method: string; url: string }) => ({ method: req.method, url: req.url }),
      },
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.get('/ready', async (_req, res) => {
    await sequelize.query('SELECT 1');
    res.json({ status: 'ready' });
  });

  const api = Router();
  api.use('/auth/staff', staffAuthRouter);
  api.use('/auth/patient', patientAuthRouter);
  api.use('/public', publicRouter);
  api.use('/admin', adminRouter);
  api.use('/me', patientRouter);
  app.use('/api/v1', api);

  if (!isProduction) {
    const document = buildOpenApiDocument();
    app.get('/api/docs.json', (_req, res) => {
      res.json(document);
    });
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(document));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
