import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express, Request, Response, NextFunction } from 'express';

const isProduction = process.env.NODE_ENV === 'production';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Nexorux HR API',
      version: '1.0.0',
      description: 'Enterprise Multi-tenant HCM SaaS API'
    },
    servers: [
      { url: process.env.SWAGGER_SERVER_URL || 'http://localhost:5000/api/v1', description: 'Development server' }
    ]
  },
  apis: [
    'server/src/routes/api.ts',
    'server/src/routes/system.ts',
    'server/src/validation/schemas.ts'
  ]
};

export const swaggerSpec = swaggerJsdoc(options);

function swaggerAuth(req: Request, res: Response, next: NextFunction) {
  if (!isProduction) return next();
  const auth = req.headers.authorization;
  const expected = process.env.SWAGGER_AUTH_TOKEN;
  if (!expected || auth !== `Bearer ${expected}`) {
    res.set('WWW-Authenticate', 'Bearer');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

export function setupSwagger(app: Express) {
  app.use('/api-docs', swaggerAuth, swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/api-docs.json', swaggerAuth, (_req, res) => {
    res.json(swaggerSpec);
  });
}
