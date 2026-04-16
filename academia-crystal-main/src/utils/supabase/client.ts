"use client";

import { createBrowserClient } from "@supabase/ssr";

// AQUI ESTAN TUS LLAVES PUESTAS DIRECTAMENTE PARA OBLIGARLO A FUNCIONAR
const SUPABASE_URL = "https://xqcsftjkvcrbcetrdulq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxY3NmdGprdmNyYmNldHJkdWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMTI1NjQsImV4cCI6MjA4MTU4ODU2NH0.sFp55IsqCP0AbypQbtnHKF1Z1OJDpNHxs7LKs7AlXg8";

export const supabaseBrowserClient = createBrowserClient(
  SUPABASE_URL,
  SUPABASE_KEY
);