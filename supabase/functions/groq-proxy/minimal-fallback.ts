// Backup: bare-minimum groq-proxy.
// If the debug version still crashes, paste THIS into the function code field
// instead. This version does almost nothing — just forwards the request to Groq
// and returns the response — so any failure must be in the request shape itself.

// @ts-nocheck

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  const body = await req.json();
  const key = Deno.env.get('GROQ_KEY');

  const groqRes = await fetch(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );

  const text = await groqRes.text();
  return new Response(text, {
    status: groqRes.status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
