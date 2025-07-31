# ChainSync Manager API Documentation

## Overview

The ChainSync Manager API provides a comprehensive REST API for managing retail operations, including inventory, payments, analytics, and customer management.

## Base URL

```
Production: https://api.chainsync.com
Development: http://localhost:3000
```

## Authentication

All API endpoints require authentication using JWT tokens, except for public endpoints like registration and login.

### Getting a Token

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

### Using a Token

Include the token in the Authorization header:

```http
Authorization: Bearer <your-jwt-token>
```

## Error Handling

All API responses follow a consistent error format:

```json
{
  "success": false,
  "error": "Error message",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format",
      "value": "invalid-email"
    }
  ]
}
```

## Rate Limiting

- **Standard users**: 100 requests per minute
- **Premium users**: 500 requests per minute
- **Admin users**: 1000 requests per minute

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit per window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Time when the rate limit resets

## Endpoints

### Authentication

#### Register User
```http
POST /api/auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe",
  "phone": "+1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "John Doe",
    "phone": "+1234567890",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "token": "jwt-token-here"
}
```

#### Login User
```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "customer"
  },
  "token": "jwt-token-here"
}
```

#### Get User Profile
```http
GET /api/auth/profile
Authorization: Bearer <token>
```

### Products

#### Get Products
```http
GET /api/products
```

**Query Parameters:**
- `limit` (number): Number of products to return (default: 20, max: 100)
- `offset` (number): Number of products to skip (default: 0)
- `category` (string): Filter by category
- `search` (string): Search in product name and description
- `minPrice` (number): Minimum price filter
- `maxPrice` (number): Maximum price filter
- `inStock` (boolean): Filter by stock availability

**Response:**
```json
{
  "success": true,
  "products": [
    {
      "id": "product-123",
      "name": "Sample Product",
      "description": "Product description",
      "sku": "SKU-001",
      "price": 29.99,
      "category": "electronics",
      "inStock": true,
      "quantity": 50,
      "images": ["image1.jpg", "image2.jpg"],
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 100,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

#### Get Product by ID
```http
GET /api/products/{productId}
```

#### Create Product (Admin)
```http
POST /api/products
Authorization: Bearer <admin-token>
```

**Request Body:**
```json
{
  "name": "New Product",
  "description": "Product description",
  "sku": "SKU-002",
  "price": 39.99,
  "category": "electronics",
  "quantity": 100,
  "images": ["image1.jpg"]
}
```

### Inventory

#### Get Inventory Items
```http
GET /api/inventory/items
Authorization: Bearer <token>
```

#### Update Inventory Item
```http
PUT /api/inventory/items/{itemId}
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "quantity": 95,
  "price": 34.99,
  "status": "active"
}
```

#### Import Inventory
```http
POST /api/inventory/import
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: CSV file with inventory data

### Payments

#### Create Payment Intent
```http
POST /api/payments/create-intent
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "amount": 100.00,
  "currency": "USD",
  "paymentMethod": "credit_card"
}
```

**Response:**
```json
{
  "success": true,
  "id": "pi_1234567890",
  "clientSecret": "pi_1234567890_secret_abc123",
  "amount": 100.00,
  "currency": "USD",
  "status": "requires_payment_method",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

#### Process Payment
```http
POST /api/payments/process
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "paymentIntentId": "pi_1234567890",
  "paymentMethod": {
    "type": "credit_card",
    "number": "4242424242424242",
    "expiryMonth": "12",
    "expiryYear": "2025",
    "cvv": "123"
  }
}
```

**Response:**
```json
{
  "success": true,
  "paymentId": "pay_1234567890",
  "transactionId": "txn_1234567890",
  "amount": 100.00,
  "currency": "USD",
  "status": "completed",
  "processingFees": 2.90,
  "netAmount": 97.10,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

#### Get Payment History
```http
GET /api/payments/history
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (number): Number of payments to return (default: 20)
- `offset` (number): Number of payments to skip (default: 0)
- `startDate` (string): Filter payments from this date (ISO 8601)
- `endDate` (string): Filter payments until this date (ISO 8601)

#### Refund Payment
```http
POST /api/payments/{paymentId}/refund
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "amount": 50.00,
  "reason": "Customer request"
}
```

### Analytics

#### Get Sales Analytics
```http
GET /api/analytics/sales
Authorization: Bearer <admin-token>
```

**Query Parameters:**
- `startDate` (string): Start date for analytics (ISO 8601)
- `endDate` (string): End date for analytics (ISO 8601)
- `groupBy` (string): Group by day, week, month (default: day)

**Response:**
```json
{
  "success": true,
  "data": {
    "totalSales": 15000.00,
    "totalOrders": 150,
    "averageOrderValue": 100.00,
    "salesByDay": [
      {
        "date": "2024-01-01",
        "sales": 500.00,
        "orders": 5
      }
    ],
    "topProducts": [
      {
        "productId": "product-123",
        "name": "Sample Product",
        "quantity": 25,
        "revenue": 750.00
      }
    ],
    "salesByCategory": [
      {
        "category": "electronics",
        "sales": 8000.00,
        "orders": 80
      }
    ]
  },
  "period": {
    "startDate": "2024-01-01T00:00:00.000Z",
    "endDate": "2024-01-31T23:59:59.999Z"
  }
}
```

#### Get Inventory Analytics
```http
GET /api/analytics/inventory
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalItems": 1000,
    "lowStockItems": 15,
    "outOfStockItems": 3,
    "totalValue": 50000.00,
    "turnoverRate": 0.85,
    "itemsByCategory": [
      {
        "category": "electronics",
        "count": 300,
        "value": 20000.00
      }
    ]
  }
}
```

### Orders

#### Get Orders
```http
GET /api/orders
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (number): Number of orders to return (default: 20)
- `offset` (number): Number of orders to skip (default: 0)
- `status` (string): Filter by order status
- `startDate` (string): Filter orders from this date (ISO 8601)
- `endDate` (string): Filter orders until this date (ISO 8601)

#### Create Order
```http
POST /api/orders
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "items": [
    {
      "productId": "product-123",
      "quantity": 2,
      "price": 29.99
    }
  ],
  "shippingAddress": {
    "name": "John Doe",
    "address": "123 Main St",
    "city": "Anytown",
    "state": "CA",
    "postalCode": "12345",
    "country": "USA"
  },
  "paymentMethod": "credit_card"
}
```

### Webhooks

#### Register Webhook
```http
POST /api/webhooks
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "url": "https://your-app.com/webhook",
  "events": ["payment.completed", "order.created"],
  "secret": "webhook-secret"
}
```

#### List Webhooks
```http
GET /api/webhooks
Authorization: Bearer <token>
```

### Health Check

#### Get API Health
```http
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "payment": "healthy"
  }
}
```

## WebSocket Events

### Connection
```javascript
const socket = io('https://api.chainsync.com', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### Events

#### Order Updates
```javascript
socket.on('order.updated', (data) => {
  console.log('Order updated:', data);
});
```

#### Payment Notifications
```javascript
socket.on('payment.completed', (data) => {
  console.log('Payment completed:', data);
});
```

#### Inventory Alerts
```javascript
socket.on('inventory.low_stock', (data) => {
  console.log('Low stock alert:', data);
});
```

## SDKs and Libraries

### JavaScript/TypeScript
```bash
npm install @chainsync/sdk
```

```javascript
import { ChainSyncClient } from '@chainsync/sdk';

const client = new ChainSyncClient({
  apiKey: 'your-api-key',
  environment: 'production'
});

// Get products
const products = await client.products.list({
  limit: 20,
  category: 'electronics'
});

// Process payment
const payment = await client.payments.process({
  amount: 100.00,
  paymentMethod: 'credit_card'
});
```

### Python
```bash
pip install chainsync-sdk
```

```python
from chainsync import ChainSyncClient

client = ChainSyncClient(
    api_key='your-api-key',
    environment='production'
)

# Get products
products = client.products.list(
    limit=20,
    category='electronics'
)

# Process payment
payment = client.payments.process(
    amount=100.00,
    payment_method='credit_card'
)
```

## Support

For API support and questions:
- Email: api-support@chainsync.com
- Documentation: https://docs.chainsync.com
- Status page: https://status.chainsync.com 