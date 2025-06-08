// Schema test file to verify imports
import { schema } from './shared/schema';

// Log the schema keys to see if it's properly loaded
console.log('Schema keys:', Object.keys(schema));

// Try to access some specific tables
console.log('Has cashierSessions:', Boolean(schema.cashierSessions));
console.log('Has users:', Boolean(schema.users));
console.log('Has transactions:', Boolean(schema.transactions));

// Attempt to use a table in a type context
type UserSelect = typeof schema.users.$inferSelect;
