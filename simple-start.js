#!/usr/bin/env node

// Simple startup script that bypasses complex logging setup
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ _extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    _status: 'healthy',
    _timestamp: new Date().toISOString(),
    _uptime: process.uptime(),
    _environment: process.env.NODE_ENV || 'development'
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist/client')));

  // Handle SPA routing
  app.get('*', (req, res, next) => {
    if (!req.path.startsWith('/api/')) {
      res.sendFile(path.join(__dirname, 'dist/client/index.html'));
    } else {
      next();
    }
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    _error: 'Route not found',
    _code: 'NOT_FOUND'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    _error: 'Internal Server Error',
    _code: 'INTERNAL_ERROR'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on _http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
