// @ts-check
// lint-staged configuration
module.exports = {
  // TypeScript files - run ESLint, Prettier and type checking
  '**/*.{ts,tsx}': [
    'eslint --fix',
    'prettier --write',
    // Run Jest tests related to changed files
    files => {
      const tests = files
        .map(file => file.replace(/\.(ts|tsx)$/, '.test.$1'))
        .filter(testFile => {
          try {
            return require('fs').existsSync(testFile);
          } catch (e) {
            return false;
          }
        });

      if (tests.length > 0) {
        return `jest ${tests.join(' ')} --passWithNoTests`;
      }
      return 'echo "No related tests found for changed files"';
    },
    // Type check (avoid path issues with spaces by not passing filenames directly)
    () => 'tsc --noEmit --skipLibCheck',
  ],

  // JavaScript files
  '**/*.{js,jsx}': ['eslint --fix', 'prettier --write'],

  // Style files
  '**/*.{css,scss,less}': ['prettier --write'],

  // JSON, YAML, Markdown
  '**/*.{json,md,yml,yaml}': ['prettier --write'],

  // SQL files - check for sensitive information and SQL injection vectors
  '**/*.sql': [files => `node scripts/validate-sql.js ${files.map(f => `"${f}"`).join(' ')}`],

  // Special checks for Drizzle ORM files
  '**/db/**/*.ts': [
    files => `node scripts/check-db-patterns.js ${files.map(f => `"${f}"`).join(' ')}`,
  ],

  // Database service files
  'server/services/**/*.ts': [
    // Additional security checks for services
    files => `node scripts/check-db-patterns.js ${files.map(f => `"${f}"`).join(' ')}`,
  ],
};
