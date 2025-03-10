import { executeSqlQuery } from './services/redshift';
import { sendChatRequest } from './services/openai';
import { RedshiftCredentials } from './types';

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Helper function to add CORS headers to responses
function corsify(response: Response): Response {
  const newHeaders = new Headers(response.headers);

  for (const [key, value] of Object.entries(corsHeaders)) {
    newHeaders.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

// Get sample credentials from environment based on provided ID
function getSampleCredentials(env: Env, id: string = 'SAMPLE-1'): RedshiftCredentials | null {
  const envKey = `${id}_REDSHIFT_CREDENTIALS`;

  if (!env[envKey]) {
    return null;
  }


  try {
    const parsed = JSON.parse(env[envKey]);
    console.log('PARSED CREDENTIALS:', parsed);
  } catch (e) {
    console.log('FAILED TO PARSE CREDENTIALS:', e);
  }

  try {
    return JSON.parse(env[envKey]);
  } catch (e) {
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Route handling
    if (request.method === 'POST') {
      // Handle SQL query endpoint
      if (path === '/api/query') {
        try {
          const body = await request.json();
          const { code, redshiftCredentials } = body;

          // Determine which credentials to use
          let credentials: RedshiftCredentials;

          if (!redshiftCredentials) {
            // Default to SAMPLE-1 if null or undefined is provided
            const sampleCredentials = getSampleCredentials(env);

            if (!sampleCredentials) {
              return corsify(new Response(JSON.stringify({
                columns: [],
                rows: [],
                error: 'Failed to get default sample credentials'
              }), {
                status: 500,
                headers: {
                  'Content-Type': 'application/json'
                }
              }));
            }

            credentials = sampleCredentials;
          } else if ('id' in redshiftCredentials && typeof redshiftCredentials.id === 'string' && redshiftCredentials.id.includes('SAMPLE')) {
            // Use specific sample if id contains "SAMPLE"
            const sampleCredentials = getSampleCredentials(env, redshiftCredentials.id);

            if (!sampleCredentials) {
              return corsify(new Response(JSON.stringify({
                columns: [],
                rows: [],
                error: `Failed to get sample credentials for id: ${redshiftCredentials.id}`
              }), {
                status: 500,
                headers: {
                  'Content-Type': 'application/json'
                }
              }));
            }

            credentials = sampleCredentials;
          } else {
            // Use provided credentials if they appear to be full credentials
            credentials = redshiftCredentials as RedshiftCredentials;
          }

          const result = await executeSqlQuery(
            credentials,
            code,
            env.AWS_ACCESS_KEY_ID,
            env.AWS_SECRET_ACCESS_KEY
          );

          return corsify(new Response(JSON.stringify(result), {
            headers: {
              'Content-Type': 'application/json'
            }
          }));
        } catch (error) {
          return corsify(new Response(JSON.stringify({
            columns: [],
            rows: [],
            error: error instanceof Error ? error.message : 'Server error processing query'
          }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json'
            }
          }));
        }
      }

      // Handle OpenAI proxy endpoint
      if (path === '/api/chat') {
        try {
          const body = await request.json();

          // Use OpenAI API key from request or fall back to environment variable
          const apiKey = body.openaiApiKey || env.OPENAI_API_KEY;

          if (!apiKey) {
            return corsify(new Response(JSON.stringify({
              error: 'OpenAI API key is required either in the request or as an environment variable'
            }), {
              status: 400,
              headers: {
                'Content-Type': 'application/json'
              }
            }));
          }

          // Remove the API key from the request body if it exists
          const { openaiApiKey, ...requestBody } = body;

          const result = await sendChatRequest(
            requestBody,
            apiKey
          );

          return corsify(new Response(JSON.stringify(result), {
            headers: {
              'Content-Type': 'application/json'
            }
          }));
        } catch (error) {
          return corsify(new Response(JSON.stringify({
            error: error instanceof Error ? error.message : 'Server error processing chat request'
          }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json'
            }
          }));
        }
      }
    }

    return corsify(new Response('Not Found', { status: 404 }));
  },
} satisfies ExportedHandler<Env>;
