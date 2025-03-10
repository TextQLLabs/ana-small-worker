export interface DatabaseCredentials {
  databaseType: 'redshift' | 'postgres';
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  schema?: string;
  connectionString?: string; // For PostgreSQL connections
}

// For backward compatibility
export type RedshiftCredentials = DatabaseCredentials;

export interface SqlQueryResult {
  columns: string[];
  rows: Record<string, any>[];
  error?: string;
  query?: string;
}

export interface Message {
  role: string;
  content: string;
  tool_calls?: any[];
}
