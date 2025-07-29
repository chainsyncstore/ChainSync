// server/swagger.ts
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import { getLogger } from '../src/logging/index.js';

const logger = getLogger().child({ component: 'swagger' });

/**
 * Swagger definition
 */
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ChainSync API Documentation',
      version: '1.0.0',
      description: 'API documentation for the ChainSync platform',
      license: {
        name: 'Private',
        url: 'https://chainsync.com/license',
      },
      contact: {
        name: 'ChainSync Support',
        url: 'https://chainsync.com/support',
        email: 'support@chainsync.com',
      },
    },
    servers: [
      {
        url: '/api/v1',
        description: 'ChainSync API v1',
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'connect.sid'
        },
        csrfToken: {
          type: 'apiKey',
          in: 'header',
          name: 'X-CSRF-Token'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message'
            },
            code: {
              type: 'string',
              description: 'Error code'
            },
            stack: {
              type: 'string',
              description: 'Error stack trace (only in development)'
            }
          },
          required: ['error', 'code']
        },
        Customer: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Customer unique identifier'
            },
            name: {
              type: 'string',
              description: 'Customer name'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Customer email address'
            },
            phone: {
              type: 'string',
              description: 'Customer phone number'
            },
            loyaltyPoints: {
              type: 'integer',
              description: 'Current loyalty points balance'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Customer creation timestamp'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Customer last update timestamp'
            }
          },
          required: ['id', 'name', 'email', 'loyaltyPoints', 'createdAt', 'updatedAt']
        },
        Transaction: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Transaction unique identifier'
            },
            customerId: {
              type: 'string',
              format: 'uuid',
              description: 'Customer unique identifier'
            },
            storeId: {
              type: 'string',
              format: 'uuid',
              description: 'Store unique identifier'
            },
            amount: {
              type: 'number',
              format: 'float',
              description: 'Transaction amount'
            },
            type: {
              type: 'string',
              enum: ['purchase', 'refund', 'adjustment'],
              description: 'Transaction type'
            },
            status: {
              type: 'string',
              enum: ['pending', 'completed', 'failed', 'canceled'],
              description: 'Transaction status'
            },
            loyaltyPointsEarned: {
              type: 'integer',
              description: 'Loyalty points earned in this transaction'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Transaction creation timestamp'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Transaction last update timestamp'
            }
          },
          required: ['id', 'customerId', 'storeId', 'amount', 'type', 'status', 'createdAt', 'updatedAt']
        },
        Store: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Store unique identifier'
            },
            name: {
              type: 'string',
              description: 'Store name'
            },
            address: {
              type: 'string',
              description: 'Store address'
            },
            manager: {
              type: 'string',
              description: 'Store manager name'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Store creation timestamp'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Store last update timestamp'
            }
          },
          required: ['id', 'name', 'address', 'createdAt', 'updatedAt']
        },
        Subscription: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Subscription unique identifier'
            },
            userId: {
              type: 'string',
              format: 'uuid',
              description: 'User unique identifier'
            },
            planId: {
              type: 'string',
              description: 'Subscription plan identifier'
            },
            status: {
              type: 'string',
              enum: ['active', 'canceled', 'expired', 'pending', 'failed'],
              description: 'Current subscription status'
            },
            startDate: {
              type: 'string',
              format: 'date-time',
              description: 'Subscription start date'
            },
            endDate: {
              type: 'string',
              format: 'date-time',
              description: 'Subscription end date'
            },
            renewalDate: {
              type: 'string',
              format: 'date-time',
              description: 'Next renewal date'
            },
            paymentMethod: {
              type: 'string',
              enum: ['card', 'bank', 'paystack', 'flutterwave'],
              description: 'Payment method used for the subscription'
            },
            amount: {
              type: 'number',
              format: 'float',
              description: 'Subscription amount'
            },
            currency: {
              type: 'string',
              description: 'Currency code (e.g., USD, NGN)'
            },
            paymentReference: {
              type: 'string',
              description: 'Reference from payment provider'
            },
            metadata: {
              type: 'object',
              description: 'Additional subscription metadata'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Subscription creation timestamp'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Subscription last update timestamp'
            }
          },
          required: ['id', 'userId', 'planId', 'status', 'startDate', 'endDate', 'amount', 'currency', 'createdAt', 'updatedAt']
        },
        LoyaltyUpdate: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Loyalty update unique identifier'
            },
            customerId: {
              type: 'string',
              format: 'uuid',
              description: 'Customer unique identifier'
            },
            transactionId: {
              type: 'string',
              format: 'uuid',
              description: 'Associated transaction ID (if applicable)'
            },
            points: {
              type: 'integer',
              description: 'Points added or subtracted'
            },
            type: {
              type: 'string',
              enum: ['earn', 'redeem', 'adjust', 'expire'],
              description: 'Type of loyalty update'
            },
            reason: {
              type: 'string',
              description: 'Reason for update'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Update timestamp'
            }
          },
          required: ['id', 'customerId', 'points', 'type', 'createdAt']
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'User unique identifier'
            },
            username: {
              type: 'string',
              description: 'Username'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            role: {
              type: 'string',
              enum: ['admin', 'manager', 'cashier', 'customer'],
              description: 'User role'
            },
            storeId: {
              type: 'string',
              format: 'uuid',
              description: 'Associated store ID (for store staff)'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'User creation timestamp'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'User last update timestamp'
            }
          },
          required: ['id', 'username', 'email', 'role', 'createdAt', 'updatedAt']
        }
      }
    }
  },
  apis: [
    './server/routes/*.ts',
    './server/routes/**/*.ts',
    './server/app.ts'
  ],
};

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJsdoc(swaggerOptions);

/**
 * Setup Swagger UI
 */
export function setupSwagger(app: Express): void {
  if (process.env.ENABLE_SWAGGER !== 'true' && process.env.NODE_ENV === 'production') {
    logger.info('Swagger UI is disabled in production. Set ENABLE_SWAGGER=true to enable it.');
    return;
  }

  // Serve swagger docs
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'ChainSync API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
    },
  }));

  // Serve swagger spec as JSON
  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  logger.info('Swagger UI initialized at /api/docs');
}

export default setupSwagger;
