declare namespace NodeJS {
  interface ProcessEnv {
    [key: string]: string | undefined;
    NEXT_PUBLIC_SUPABASE_URL: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    NEXT_PUBLIC_APP_URL?: string;
    NEXT_PUBLIC_DEFAULT_TENANT_SLUG?: string;
    DEFAULT_TENANT_SLUG?: string;
    SAAS_ONBOARDING_ENABLED?: string;
  }
}

export {};
