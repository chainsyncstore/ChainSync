# ChainSync - All-in-One Retail Management Platform

## Overview
ChainSync is a comprehensive retail management platform designed for supermarkets and multi-store chains. The application provides inventory management, point-of-sale systems, analytics, AI-powered assistance, payment processing, affiliate programs, and more.

**Current State:** Migrating from Replit Agent to standard Replit environment with fullstack_js template structure.

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
**2025-01-22:** Migration from Replit Agent to standard Replit environment in progress
- ✅ Installed required dependencies and set up fullstack_js structure
- ✅ Fixed dual-server configuration (API on port 5000, Frontend on port 3000)
- ✅ Resolved TypeScript errors in core components and API call signatures
- ✅ Both frontend and backend servers are running successfully
- 🔄 Continuing TypeScript error resolution across remaining components

## User Preferences
- Focus on comprehensive functionality over simplification
- Maintain existing complex features during migration
- Prioritize data integrity and security practices

## Migration Status
Currently working through migration checklist in `.local/state/replit/agent/progress_tracker.md`