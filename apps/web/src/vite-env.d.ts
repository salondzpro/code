/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_API_URL: string;
  readonly VITE_SENTRY_DSN?: string;
  /** Version du bundle (commit), posée par `scripts/build-site.mjs` et Codemagic : `lib/liveUpdate.ts`. */
  readonly VITE_BUNDLE_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
