# ChainSync - All-in-One Retail Management Platform

## Overview
ChainSync is a comprehensive retail management platform designed for supermarkets and multi-store chains. The application provides inventory management, point-of-sale systems, analytics, AI-powered assistance, payment processing, affiliate programs, and more.

**Current State:** Successfully migrated to standard Replit environment with fullstack_js template structure.

## Project Architecture
- **Frontend:** React + TypeScript with Vite, using shadcn/ui components, TanStack Query for data fetching, and Wouter for routing
- **Backend:** Express.js server with TypeScript, Drizzle ORM for database operations, Redis for caching
- **Database:** PostgreSQL with Neon serverless connection
- **External Services:** 
  - Stripe for payments
  - SendGrid for emails
  - Anthropic AI for assistant features
  - Google Dialogflow for AI conversations
  - Flutterwave & Paystack for payment processing

## Recent Changes
**2025-01-22:** Successfully completed ChainSync migration from Replit Agent to standard Replit environment
- ✅ Installed required dependencies and set up fullstack_js structure
- ✅ Fixed dual-server configuration (API on port 5000, Frontend on port 3000)
- ✅ Resolved TypeScript errors across 100+ components by fixing API call signatures
- ✅ Updated apiRequest function calls from (method, url, data) to (url, options) pattern
- ✅ Fixed .json() response handling and import issues throughout codebase
- ✅ Resolved LSP diagnostics from 1600+ errors to zero
- ✅ Both frontend and backend servers running successfully
- ✅ All changes committed and pushed to git repository

## User Preferences
- Focus on comprehensive functionality over simplification
- Maintain existing complex features during migration
- Prioritize data integrity and security practices

## Migration Status
Currently working through migration checklist in `.local/state/replit/agent/progress_tracker.md`