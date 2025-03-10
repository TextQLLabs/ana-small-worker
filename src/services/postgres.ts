import { Client } from 'pg';
import { DatabaseCredentials, SqlQueryResult } from '../types';

export async function executePostgresSqlQuery(
  credentials: DatabaseCredentials,
  query: string
): Promise<SqlQueryResult> {
  let client;

  try {
    // Check for required credentials
    if (!credentials.connectionString && 
        (!credentials.host || !credentials.database || !credentials.user)) {
      return {
        columns: [],
        rows: [],
        error: 'Missing required credentials (connectionString or host/database/user)',
        query
      };
    }

    // Create client with connection string if provided, otherwise use individual parameters
    if (credentials.connectionString) {
      client = new Client({
        connectionString: credentials.connectionString
      });
    } else {
      client = new Client({
        host: credentials.host,
        port: credentials.port,
        database: credentials.database,
        user: credentials.user,
        password: credentials.password
      });
    }

    await client.connect();
    
    const result = await client.query(query);
    
    // Format results to match the SqlQueryResult interface
    const columns = result.fields.map(field => field.name);
    const rows = result.rows;

    return { columns, rows, query };
  } catch (error) {
    console.error('PostgreSQL Query Error:', error);

    return {
      columns: [],
      rows: [],
      error: error instanceof Error
        ? error.message
        : 'Failed to execute PostgreSQL query.',
      query
    };
  } finally {
    if (client) {
      await client.end();
    }
  }
}