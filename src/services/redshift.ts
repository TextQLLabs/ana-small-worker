import {
  RedshiftDataClient,
  ExecuteStatementCommand,
  GetStatementResultCommand,
  DescribeStatementCommand
} from '@aws-sdk/client-redshift-data';
import { RedshiftCredentials, SqlQueryResult } from '../types';

export async function executeSqlQuery(
  credentials: RedshiftCredentials,
  query: string,
  awsAccessKeyId: string,
  awsSecretAccessKey: string
): Promise<SqlQueryResult> {
  try {
    if (!credentials.host || !credentials.database || !credentials.user) {
      return {
        columns: [],
        rows: [],
        error: 'Missing required credentials (host, database, or user)',
        query
      };
    }

    const hostParts = credentials.host.split('.');
    if (hostParts.length < 2) {
      return {
        columns: [],
        rows: [],
        error: 'Invalid host format. Expected format: workgroup-name.account-id.region.redshift-serverless.amazonaws.com',
        query
      };
    }

    const clusterIdentifier = hostParts[0];
    const regionMatch = credentials.host.match(/\.([a-z0-9-]+)\.redshift/);
    const region = regionMatch ? regionMatch[1] : 'us-east-1';

    const client = new RedshiftDataClient({
      region,
      credentials: {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey
      }
    });

    const execCommand = new ExecuteStatementCommand({
      WorkgroupName: clusterIdentifier,
      Database: credentials.database,
      Sql: query,
      Schema: credentials.schema
    });

    const execResponse = await client.send(execCommand);
    const statementId = execResponse.Id;

    if (!statementId) {
      throw new Error('Failed to get statement ID from Redshift');
    }

    let queryStatus = 'STARTED';
    let maxAttempts = 30;
    let attempts = 0;

    while ((queryStatus === 'STARTED' || queryStatus === 'SUBMITTED' || queryStatus === 'PICKED') && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 500));

      const describeCommand = new DescribeStatementCommand({
        Id: statementId
      });

      const describeResponse = await client.send(describeCommand);
      queryStatus = describeResponse.Status || '';

      if (queryStatus === 'FAILED') {
        return {
          columns: [],
          rows: [],
          error: describeResponse.Error || 'Query execution failed',
          query
        };
      }

      attempts++;
    }

    if (attempts >= maxAttempts) {
      return {
        columns: [],
        rows: [],
        error: 'Query timed out after multiple attempts',
        query
      };
    }

    const resultCommand = new GetStatementResultCommand({
      Id: statementId
    });

    const resultResponse = await client.send(resultCommand);

    const columns = resultResponse.ColumnMetadata?.map(col => col.name || '') || [];
    const rows = [];

    if (resultResponse.Records) {
      for (const record of resultResponse.Records) {
        const row: Record<string, any> = {};
        record.forEach((field, index) => {
          const columnName = columns[index];
          let value = null;
          if (field.stringValue !== undefined) value = field.stringValue;
          else if (field.longValue !== undefined) value = field.longValue;
          else if (field.doubleValue !== undefined) value = field.doubleValue;
          else if (field.booleanValue !== undefined) value = field.booleanValue;
          else if (field.isNull) value = null;

          row[columnName] = value;
        });
        rows.push(row);
      }
    }

    return { columns, rows, query };
  } catch (error) {
    console.error('SQL Query Error:', error);

    return {
      columns: [],
      rows: [],
      error: error instanceof Error
        ? error.message
        : 'Failed to execute SQL query.',
      query
    };
  }
}
