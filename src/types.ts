export interface RedshiftCredentials {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  schema: string;
}

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
