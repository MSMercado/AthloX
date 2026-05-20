// Supabase Edge Function: delete-account
// Cascades a user's data deletion across every AthloX table + storage bucket,
// then deletes the auth.users row itself. Called from the in-app
// "Delete my account" flow in ProfileScreen.
//
// Required secrets (Edge Functions → Secrets):
//   SUPABASE_URL              — auto-set by Supabase
//   SUPABASE_SERVICE_ROLE_KEY — find in Settings → API → service_role (KEEP SECRET)
//
// SECURITY: This function uses the service role key, which bypasses RLS. We
// extract the user ID from the caller's JWT and ONLY delete data belonging to
// that user — we never trust a user_id from the request body.

// @ts-nocheck

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')   return json({ error: 'Method not allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: 'Server misconfigured: missing service role key' }, 500);
  }

  // 1. Verify the caller's JWT and extract their user ID.
  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'Missing Authorization header' }, 401);

  const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') || '', {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) {
    return json({ error: 'Could not verify user from JWT' }, 401);
  }
  const userId = user.id;
  console.log(`[delete-account] starting deletion for user ${userId}`);

  // 2. Use the service role to cascade-delete the user's data.
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const errors = [];

  // Storage: try to remove the user's photo folder. List then delete because
  // Supabase storage requires explicit paths (no wildcards on remove()).
  try {
    const { data: files } = await admin.storage.from('post-images').list(userId, { limit: 1000 });
    if (files?.length) {
      const paths = files.map(f => `${userId}/${f.name}`);
      await admin.storage.from('post-images').remove(paths);
    }
  } catch (e) {
    errors.push({ step: 'storage:post-images', message: e?.message });
  }

  // Tables — order matters for FK constraints. Children first, then parents.
  const tableSteps = [
    { table: 'likes',         column: 'user_id' },
    { table: 'comments',      column: 'user_id' },
    { table: 'post_reports',  column: 'reporter_id' },
    { table: 'blocked_users', column: 'blocker_id' },
    { table: 'blocked_users', column: 'blocked_id' },
    { table: 'follows',       column: 'follower_id' },
    { table: 'follows',       column: 'following_id' },
    { table: 'posts',         column: 'user_id' },
    { table: 'profiles',      column: 'id' },
  ];
  for (const { table, column } of tableSteps) {
    try {
      const { error } = await admin.from(table).delete().eq(column, userId);
      if (error) errors.push({ step: `${table}.${column}`, message: error.message });
    } catch (e) {
      errors.push({ step: `${table}.${column}`, message: e?.message });
    }
  }

  // 3. Finally, delete the auth user. This invalidates their session.
  try {
    const { error: authErr } = await admin.auth.admin.deleteUser(userId);
    if (authErr) {
      errors.push({ step: 'auth.deleteUser', message: authErr.message });
      // If we can't delete the auth user, the account technically still exists —
      // surface this as a hard failure so the client doesn't show "deleted!"
      // misleadingly. The other table deletions are already gone, but the user
      // can re-login and contact support.
      return json({ error: 'Failed to delete auth account', errors }, 500);
    }
  } catch (e) {
    errors.push({ step: 'auth.deleteUser', message: e?.message });
    return json({ error: 'Failed to delete auth account', errors }, 500);
  }

  console.log(`[delete-account] success for user ${userId}, soft-errors:`, errors);
  return json({ success: true, errors });
});
