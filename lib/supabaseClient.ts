import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && key);

// Only the anon key is ever used in the browser. What a user may do is decided by Row Level Security.
export const supabase = createClient(url || "http://localhost:54321", key || "missing-anon-key", {
  // On the server (server-rendered public pages) nothing is stored or refreshed: it only reads what anyone may read.
  auth: { persistSession: import.meta.client, autoRefreshToken: import.meta.client, detectSessionInUrl: import.meta.client, flowType: "pkce" },
});
