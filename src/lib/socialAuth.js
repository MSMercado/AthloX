import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { supabase } from './supabase';

// Required for iOS to properly close the browser after auth
WebBrowser.maybeCompleteAuthSession();

const REDIRECT = 'athlox://auth-callback';

// Expo Go doesn't support custom URL schemes — social login needs a real dev/prod build
const isExpoGo = Constants.appOwnership === 'expo';

// Parse both ?query= and #fragment= params from a callback URL
function parseCallbackUrl(url) {
  const result = {};
  const parts = url.split(/[?#]/);
  for (let i = 1; i < parts.length; i++) {
    parts[i].split('&').forEach(pair => {
      const [k, v] = pair.split('=');
      if (k) result[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
  }
  return result;
}

export async function signInWithProvider(provider) {
  if (isExpoGo) {
    throw new Error('EXPO_GO');
  }

  // 1. Get the OAuth URL from Supabase
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: REDIRECT,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data?.url) throw new Error('Could not start sign in. Please try again.');

  // 2. Open provider login page in an in-app browser
  const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT);

  // User closed the browser — silent exit, no error
  if (result.type === 'cancel' || result.type === 'dismiss') return;

  if (result.type !== 'success' || !result.url) {
    throw new Error('Sign in failed. Please try again.');
  }

  // 3. Handle the callback URL — Supabase uses PKCE (code) or implicit (tokens)
  const params = parseCallbackUrl(result.url);

  // PKCE flow: exchange the code for a real session
  if (params.code) {
    const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(result.url);
    if (exchangeErr) throw exchangeErr;
    return;
  }

  // Implicit flow: tokens come back directly in the URL fragment
  if (params.access_token && params.refresh_token) {
    const { error: sessionErr } = await supabase.auth.setSession({
      access_token:  params.access_token,
      refresh_token: params.refresh_token,
    });
    if (sessionErr) throw sessionErr;
    return;
  }

  // Fallback: check if Supabase already picked up the session automatically
  const { data: existing } = await supabase.auth.getSession();
  if (!existing?.session) {
    throw new Error('Sign in did not complete. Please try again.');
  }
}
