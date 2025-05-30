// @ts-check
module.exports = {
  // TypeScript files - run ESLint and type checking
  '**/*.{ts,tsx}': [
    {
      title: 'Lint TypeScript files',
      task: 'eslint --fix',
    },
    {
      title: 'Type-check TypeScript files',
      task: (filenames) =>
        `tsc --noEmit --skipLibCheck --project tsconfig.json ${
          filenames.length > 10 ? '' : filenames.map((f) => `"${f}"`).join(' ')
        }`,
    },
  ],

  // JavaScript files - run ESLint only
  '**/*.{js,jsx}': [
    {
      title: 'Lint JavaScript files',
      task: 'eslint --fix',
    },
  ],

  // Style files - run Prettier
  '**/*.{css,scss,less}': [
    {
      title: 'Format stylesheets',
      task: 'prettier --write',
    },
  ],

  // JSON, YAML, Markdown - run Prettier
  '**/*.{json,md,yml,yaml}': [
    {
      title: 'Format JSON/YAML/Markdown',
      task: 'prettier --write',
    },
  ],

  // SQL files - check for sensitive information and SQL injection vectors
  '**/*.sql': [
    {
      title: 'Check SQL files for security',
      task: (filenames) =>
        `node scripts/sql-security-check.js ${filenames.map((f) => `"${f}"`).join(' ')}`,
    },
  ],

  // Special checks for Drizzle ORM files
  '**/db/**/*.ts': [
    {
      title: 'Check Drizzle ORM patterns',
      task: (filenames) =>
        `node scripts/check-drizzle-patterns.js ${filenames.map((f) => `"${f}"`).join(' ')}`,
    },
  ],
};
