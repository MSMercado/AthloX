// Supabase Edge Function: groq-proxy (debug build)
// Forwards chat-completion requests to Groq with the API key kept server-side.
// Heavy console.log instrumentation so the Logs tab tells us exactly where things
// fail. Once stable, the verbose logs can be trimmed.

// @ts-nocheck

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
// llama-3.3-70b-versatile supports up to 32k output tokens. The client picks
// an appropriate budget per plan length (10k for short, 24k for 36+ weeks).
// The previous 8k ceiling silently truncated every plan-gen request,
// producing mid-JSON cutoffs.
const MAX_TOKENS_CEILING = 32000;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  console.log(`[groq-proxy] ${req.method} ${req.url}`);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ error: { message: 'Method not allowed' } }, 405);
  }

  let body;
  try {
    body = await req.json();
    console.log(
      `[groq-proxy] received body: model=${body?.model} ` +
      `messages_len=${body?.messages?.length} ` +
      `max_tokens=${body?.max_tokens} ` +
      `temperature=${body?.temperature} ` +
      `response_format=${JSON.stringify(body?.response_format)}`,
    );
  } catch (err) {
    console.log(`[groq-proxy] body parse failed: ${err?.message}`);
    return json({ error: { message: 'Invalid JSON body' } }, 400);
  }

  const groqBody = {
    model: body.model || 'llama-3.3-70b-versatile',
    messages: body.messages,
  };
  if (typeof body.max_tokens === 'number') {
    groqBody.max_tokens = Math.min(body.max_tokens, MAX_TOKENS_CEILING);
  }
  if (typeof body.temperature === 'number') {
    groqBody.temperature = body.temperature;
  }
  if (body.response_format && typeof body.response_format === 'object') {
    groqBody.response_format = body.response_format;
  }

  if (!Array.isArray(groqBody.messages) || groqBody.messages.length === 0) {
    console.log('[groq-proxy] missing messages');
    return json({ error: { message: 'messages array is required' } }, 400);
  }

  const groqKey = Deno.env.get('GROQ_KEY');
  if (!groqKey) {
    console.log('[groq-proxy] GROQ_KEY not set');
    return json(
      { error: { message: 'Server misconfigured: GROQ_KEY not set' } },
      500,
    );
  }

  let groqRes;
  try {
    console.log('[groq-proxy] calling Groq...');
    groqRes = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(groqBody),
    });
    console.log(`[groq-proxy] Groq responded with status ${groqRes.status}`);
  } catch (err) {
    console.log(`[groq-proxy] fetch threw: ${err?.message || err}`);
    return json(
      { error: { message: `Groq fetch failed: ${err?.message || err}` } },
      502,
    );
  }

  let text;
  try {
    text = await groqRes.text();
    // Log first 500 chars of body so we can see Groq's error message in logs
    console.log(`[groq-proxy] Groq body (first 500 chars): ${text.slice(0, 500)}`);
  } catch (err) {
    console.log(`[groq-proxy] groqRes.text() failed: ${err?.message}`);
    return json(
      { error: { message: `Failed to read Groq response: ${err?.message}` } },
      502,
    );
  }

  return new Response(text, {
    status: groqRes.status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
