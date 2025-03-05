export async function sendChatRequest(
  requestBody: any,
  apiKey: string,
  signal?: AbortSignal
): Promise<any> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody),
    signal
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || 'Error from OpenAI API');
  }

  return data;
}
