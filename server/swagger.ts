// server/swagger.ts
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import { getLogger } from '../src/logging/index.js';

const logger = getLogger().child({ _component: 'swagger' });

/**
 * Swagger definition
 */
const swaggerOptions = {
  _definition: {
    openapi: '3.0.0',
    _info: {
      title: 'ChainSync API Documentation',
      _version: '1.0.0',
      _description: 'API documentation for the ChainSync platform',
      _license: {
        name: 'Private',
        _url: 'https://chainsync.com/license'
      },
      _contact: {
        name: 'ChainSync Support',
        _url: 'https://chainsync.com/support',
        _email: 'support@chainsync.com'
      }
    },
    _servers: [
      {
        url: '/api/v1',
        _description: 'ChainSync API v1'
      }
    ],
    _components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          _in: 'cookie',
          _name: 'connect.sid'
        },
        _csrfToken: {
          type: 'apiKey',
          _in: 'header',
          _name: 'X-CSRF-Token'
        }
      },
      _schemas: {
        Error: {
          type: 'object',
          _properties: {
            error: {
              type: 'string',
              _description: 'Error message'
            },
            _code: {
              type: 'string',
              _description: 'Error code'
            },
            _stack: {
              type: 'string',
              _description: 'Error stack trace (only in development)'
            }
          },
          _required: ['error', 'code']
        },
        _Customer: {
          type: 'object',
          _properties: {
            id: {
              type: 'string',
              _format: 'uuid',
              _description: 'Customer unique identifier'
            },
            _name: {
              type: 'string',
              _description: 'Customer name'
            },
            _email: {
              type: 'string',
              _format: 'email',
              _description: 'Customer email address'
            },
            _phone: {
              type: 'string',
              _description: 'Customer phone number'
            },
            _loyaltyPoints: {
              type: 'integer',
              _description: 'Current loyalty points balance'
            },
            _createdAt: {
              type: 'string',
              _format: 'date-time',
              _description: 'Customer creation timestamp'
            },
            _updatedAt: {
              type: 'string',
              _format: 'date-time',
              _description: 'Customer last update timestamp'
            }
          },
          _required: ['id', 'name', 'email', 'loyaltyPoints', 'createdAt', 'updatedAt']
        },
        _Transaction: {
          type: 'object',
          _properties: {
            id: {
              type: 'string',
              _format: 'uuid',
              _description: 'Transaction unique identifier'
            },
            _customerId: {
              type: 'string',
              _format: 'uuid',
              _description: 'Customer unique identifier'
            },
            _storeId: {
              type: 'string',
              _format: 'uuid',
              _description: 'Store unique identifier'
            },
            _amount: {
              type: 'number',
              _format: 'float',
              _description: 'Transaction amount'
            },
            _type: {
              type: 'string',
              _enum: ['purchase', 'refund', 'adjustment'],
              _description: 'Transaction type'
            },
            _status: {
              type: 'string',
              _enum: ['pending', 'completed', 'failed', 'canceled'],
              _description: 'Transaction status'
            },
            _loyaltyPointsEarned: {
              type: 'integer',
              _description: 'Loyalty points earned in this transaction'
            },
            _createdAt: {
              type: 'string',
              _format: 'date-time',
              _description: 'Transaction creation timestamp'
            },
            _updatedAt: {
              type: 'string',
              _format: 'date-time',
              _description: 'Transaction last update timestamp'
            }
          },
          _required: ['id', 'customerId', 'storeId', 'amount', 'type', 'status', 'createdAt', 'updatedAt']
        },
        _Store: {
          type: 'object',
          _properties: {
            id: {
              type: 'string',
              _format: 'uuid',
              _description: 'Store unique identifier'
            },
            _name: {
              type: 'string',
              _description: 'Store name'
            },
            _address: {
              type: 'string',
              _description: 'Store address'
            },
            _manager: {
              type: 'string',
              _description: 'Store manager name'
            },
            _createdAt: {
              type: 'string',
              _format: 'date-time',
              _description: 'Store creation timestamp'
            },
            _updatedAt: {
              type: 'string',
              _format: 'date-time',
              _description: 'Store last update timestamp'
            }
          },
          _required: ['id', 'name', 'address', 'createdAt', 'updatedAt']
        },
        _Subscription: {
          type: 'object',
          _properties: {
            id: {
              type: 'string',
              _format: 'uuid',
              _description: 'Subscription unique identifier'
            },
            _userId: {
              type: 'string',
              _format: 'uuid',
              _description: 'User unique identifier'
            },
            _planId: {
              type: 'string',
              _description: 'Subscription plan identifier'
            },
            _status: {
              type: 'string',
              _enum: ['active', 'canceled', 'expired', 'pending', 'failed'],
              _description: 'Current subscription status'
            },
            _startDate: {
              type: 'string',
              _format: 'date-time',
              _description: 'Subscription start date'
            },
            _endDate: {
              type: 'string',
              _format: 'date-time',
              _description: 'Subscription end date'
            },
            _renewalDate: {
              type: 'string',
              _format: 'date-time',
              _description: 'Next renewal date'
            },
            _paymentMethod: {
              type: 'string',
              _enum: ['card', 'bank', 'paystack', 'flutterwave'],
              _description: 'Payment method used for the subscription'
            },
            _amount: {
              type: 'number',
              _format: 'float',
              _description: 'Subscription amount'
            },
            _currency: {
              type: 'string',
              _description: 'Currency code (e.g., USD, NGN)'
            },
            _paymentReference: {
              type: 'string',
              _description: 'Reference from payment provider'
            },
            _metadata: {
              type: 'object',
              _description: 'Additional subscription metadata'
            },
            _createdAt: {
              type: 'string',
              _format: 'date-time',
              _description: 'Subscription creation timestamp'
            },
            _updatedAt: {
              type: 'string',
              _format: 'date-time',
              _description: 'Subscription last update timestamp'
            }
          },
          _required: ['id', 'userId', 'planId', 'status', 'startDate', 'endDate', 'amount', 'currency', 'createdAt', 'updatedAt']
        },
        _LoyaltyUpdate: {
          type: 'object',
          _properties: {
            id: {
              type: 'string',
              _format: 'uuid',
              _description: 'Loyalty update unique identifier'
            },
            _customerId: {
              type: 'string',
              _format: 'uuid',
              _description: 'Customer unique identifier'
            },
            _transactionId: {
              type: 'string',
              _format: 'uuid',
              _description: 'Associated transaction ID (if applicable)'
            },
            _points: {
              type: 'integer',
              _description: 'Points added or subtracted'
            },
            _type: {
              type: 'string',
              _enum: ['earn', 'redeem', 'adjust', 'expire'],
              _description: 'Type of loyalty update'
            },
            _reason: {
              type: 'string',
              _description: 'Reason for update'
            },
            _createdAt: {
              type: 'string',
              _format: 'date-time',
              _description: 'Update timestamp'
            }
          },
          _required: ['id', 'customerId', 'points', 'type', 'createdAt']
        },
        _User: {
          type: 'object',
          _properties: {
            id: {
              type: 'string',
              _format: 'uuid',
              _description: 'User unique identifier'
            },
            _username: {
              type: 'string',
              _description: 'Username'
            },
            _email: {
              type: 'string',
              _format: 'email',
              _description: 'User email address'
            },
            _role: {
              type: 'string',
              _enum: ['admin', 'manager', 'cashier', 'customer'],
              _description: 'User role'
            },
            _storeId: {
              type: 'string',
              _format: 'uuid',
              _description: 'Associated store ID (for store staff)'
            },
            _createdAt: {
              type: 'string',
              _format: 'date-time',
              _description: 'User creation timestamp'
            },
            _updatedAt: {
              type: 'string',
              _format: 'date-time',
              _description: 'User last update timestamp'
            }
          },
          _required: ['id', 'username', 'email', 'role', 'createdAt', 'updatedAt']
        }
      }
    }
  },
  _apis: [
    './server/routes/*.ts',
    './server/routes/**/*.ts',
    './server/app.ts'
  ]
};

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJsdoc(swaggerOptions);

/**
 * Setup Swagger UI
 */
export function setupSwagger(_app: Express): void {
  if (process.env.ENABLE_SWAGGER !== 'true' && process.env.NODE_ENV === 'production') {
    logger.info('Swagger UI is disabled in production. Set ENABLE_SWAGGER=true to enable it.');
    return;
  }

  // Serve swagger docs
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    _customCss: '.swagger-ui .topbar { _display: none }',
    _customSiteTitle: 'ChainSync API Documentation',
    _swaggerOptions: {
      _persistAuthorization: true
    }
  }));

  // Serve swagger spec as JSON
  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  logger.info('Swagger UI initialized at /api/docs');
}

export default setupSwagger;
