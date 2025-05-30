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

## Continuous Integration & Deployment

ChainSync uses GitHub Actions for continuous integration and deployment. The workflows automate testing, security scanning, and deployment processes.

### Workflows

- **tests.yml** - Runs unit and integration tests on push and pull requests
- **security-scan.yml** - Performs security scans including dependency analysis and code scanning
- **deploy.yml** - Handles the deployment to staging and production environments
- **validate-workflows.yml** - Validates GitHub Actions workflow files

### Pre-commit Hooks

The project uses pre-commit hooks to ensure code quality and prevent issues from being committed. To set up pre-commit hooks:

```bash
pip install pre-commit
pre-commit install
```

This installs the following hooks:
- actionlint - Validates GitHub Actions workflow files
- trailing-whitespace - Removes trailing whitespace
- end-of-file-fixer - Ensures files end with a newline
- check-yaml - Validates YAML files
- check-added-large-files - Prevents large files from being committed
- gitleaks - Scans for secrets and credentials

### Repository Secrets

The following secrets must be configured in GitHub repository settings for CI/CD to function correctly:

1. **SNYK_TOKEN** - For vulnerability scanning
2. **SEMGREP_APP_TOKEN** - For code scanning
3. **SLACK_WEBHOOK** - For Slack notifications

See `.github/SECURITY.md` for detailed setup instructions.

## License

MIT
