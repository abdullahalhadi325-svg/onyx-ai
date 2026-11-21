const env =
  typeof import.meta !== 'undefined' &&
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ? (import.meta as unknown as { env: Record<string, string | undefined> }).env
    : {};

export const SUPABASE_URL =
  env.VITE_SUPABASE_URL?.trim() || 'https://gtzqnemrppyvnbdeoeke.supabase.co';

export const SUPABASE_ANON_KEY =
  env.VITE_SUPABASE_ANON_KEY?.trim() ||
  'sb_publishable_lFEIoMtJxKHKyUgp4YtQGw_pUsAK8jb';

export const BACKEND_API_URL = (
  env.VITE_BACKEND_API_URL ||
  'https://hadi-mp-ai-backend.abdullahalhadi325.workers.dev'
)
  .trim()
  .replace(/\/+$/, '');
