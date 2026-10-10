/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Absolute URL of the deployed website; required in the mobile app for /api calls. */
  readonly VITE_API_BASE_URL?: string;
  /** Public site address used for canonical URLs and sitemaps, e.g. https://www.example.com */
  readonly VITE_SITE_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
