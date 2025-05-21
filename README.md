# ChainSync Manager

A modern inventory and store management system built with React, TypeScript, Node.js, and PostgreSQL.

## Prerequisites

- Node.js 18+ (LTS recommended)
- PostgreSQL 14+
- npm or yarn

## Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/chainsync-manager.git
   cd chainsync-manager
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Update the `.env` file with your configuration.

4. **Set up the database**
   ```bash
   npm run db:push
   npm run db:seed
   ```

5. **Start the development server**
   ```bash
   # Start the frontend
   npm run dev
   
   # In a separate terminal, start the backend
   npm run dev:server
   ```

6. **Build for production**
   ```bash
   npm run build
   npm start
   ```

## Available Scripts

- `npm run dev` - Start the Vite development server
- `npm run dev:server` - Start the backend server in development mode with hot-reload
- `npm run build` - Build both client and server for production
- `npm run build:client` - Build the client for production
- `npm run build:server` - Build the server for production
- `npm start` - Start the production server
- `npm run preview` - Preview the production build locally
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking
- `npm run db:push` - Push database schema
- `npm run db:seed` - Seed the database with initial data

## Project Structure

```
.
├── client/                 # Frontend React application
│   ├── public/            # Static files
│   └── src/               # React source code
├── server/                # Backend server code
│   ├── config/           # Configuration files
│   ├── controllers/      # Route controllers
│   ├── middleware/       # Express middleware
│   ├── models/           # Database models
│   ├── routes/           # API routes
│   ├── services/         # Business logic
│   └── utils/            # Utility functions
├── shared/               # Shared code between client and server
├── db/                   # Database migrations and seeds
├── .env.example          # Example environment variables
├── .eslintrc.json        # ESLint configuration
├── tsconfig.json         # TypeScript configuration
├── tsconfig.server.json  # Server-side TypeScript configuration
└── vite.config.ts        # Vite configuration
```

## Environment Variables

See `.env.example` for all available environment variables.

## License

MIT
