const env =
  typeof import.meta !== 'undefined' &&
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ? (import.meta as unknown as { env: Record<string, string | undefined> }).env
    : {};

export const APP_VERSION = '2.4.0';

export const ADMIN_EMAIL = 'abdullahalhadi325@gmail.com';

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

export const ENV_TELEGRAM_BOT_TOKEN = env.VITE_TELEGRAM_BOT_TOKEN?.trim() || '';
export const ENV_TELEGRAM_CHAT_ID = env.VITE_TELEGRAM_CHAT_ID?.trim() || '';
export const ENV_ADMIN_PIN_HASH = env.VITE_ADMIN_PIN_HASH?.trim() || '';

export const DEVELOPER_LINKS = {
  portfolio: 'https://mr-onion-dev-portfolio-ud2z.vercel.app',
  telegramHandle: '@abdullahalhadis',
  telegramUrl: 'https://t.me/abdullahalhadis',
  whatsappNumber: '+8801723257754',
  whatsappUrl: 'https://wa.me/8801723257754',
} as const;
