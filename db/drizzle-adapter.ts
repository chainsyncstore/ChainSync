import { type NeonDatabase, type NeonQueryResultHKT } from 'drizzle-orm/neon-serverless'; // Changed to HKT
import { sql } from 'drizzle-orm';
import * as schema from '@shared/schema';

// Define the type for the Drizzle instance based on db/connection-manager.ts
// `drizzle()` from 'drizzle-orm/neon-serverless' returns NeonDatabase<TSchema>
type DrizzleDb = NeonDatabase<typeof schema>;

export class DrizzleAdapter {
  private dbInstance: DrizzleDb;

  // Using 'any' for the constructor argument and casting internally
  // to work around potential cross-module type inference issues with the specific schema.
  constructor(dbInstance: any) {
    this.dbInstance = dbInstance as DrizzleDb;
  }

  /**
   * Checks if a table exists in the specified schema (default 'public').
   * @param tableName The name of the table to check.
   * @param schemaName The name of the schema where the table is expected.
   * @returns True if the table exists, false otherwise.
   */
  async tableExists(tableName: string, schemaName: string = 'public'): Promise<boolean> {
    const query = sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = ${schemaName}
        AND table_name = ${tableName}
      );
    `;

    try {
      // Using NeonQueryResultHKT might require different handling or it might be an alias.
      // For now, let's see if simply changing the import name works,
      // or if we need to use it as a type constructor.
      // If this.dbInstance.execute returns Promise<NeonQueryResult<any>>,
      // then result should be NeonQueryResult<any>.
      // Let's assume NeonQueryResultHKT is a stand-in for now.
      const result: NeonQueryResultHKT["type"] = await this.dbInstance.execute(query); // Attempting to use HKT's 'type'

      if (result && result.rows && result.rows.length > 0) {
        const row = result.rows[0] as { exists?: boolean };
        if (typeof row.exists === 'boolean') {
          return row.exists;
        }
      }
      // If the structure is different or no rows are returned, log and assume false.
      console.warn(`Could not determine if table '${tableName}' in schema '${schemaName}' exists from query result:`, JSON.stringify(result));
      return false;
    } catch (error) {
      console.error(`Error checking if table '${tableName}' exists in schema '${schemaName}':`, error);
      return false; // Or rethrow, depending on desired error handling
    }
  }
}
