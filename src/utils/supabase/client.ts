"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_KEY, SUPABASE_URL } from "./constants";

export const supabaseBrowserClient = createBrowserClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

console.log(
  "Supabase anon key prefix",
  SUPABASE_KEY
    ? SUPABASE_KEY.slice(0, 16)
    : "<missing>"
);