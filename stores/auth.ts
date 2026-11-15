import { defineStore } from "pinia";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "~/lib/supabaseClient";

export interface Profile { id: string; email: string; full_name: string | null; role: string }

// Who is signed in: the session, the profile row (and its role), and the account actions. One shared state for the whole app.
// `session` is undefined while it is still being read, null when nobody is signed in.
export const useAuthStore = defineStore("auth", () => {
  const session = ref<Session | null | undefined>(undefined);
  const profile = ref<Profile | null | undefined>(undefined);   // undefined = not loaded yet, null = none
  const recovery = ref(false);                                   // opened from a password-reset link
  const sessionEnded = ref(false);                               // signed out without the user asking (2.2.1)
  let manualSignOut = false;
  let hadSession = false;
  let started = false;

  const uid = computed(() => session.value?.user?.id ?? null);
  const user = computed<User | null>(() => session.value?.user ?? null);
  const isAdmin = computed(() => profile.value?.role === "admin");
  const loading = computed(() => session.value === undefined || (session.value !== null && profile.value === undefined));

  async function loadProfile() {
    if (!uid.value) { profile.value = null; return; }
    const id = uid.value;
    const { data } = await supabase.from("profiles").select("id,email,full_name,role").eq("id", id).maybeSingle();
    if (uid.value === id) profile.value = (data as Profile | null) ?? null;
  }

  /** Starts listening to the session. Runs once, from plugins/auth.client.ts. */
  function init() {
    if (started) return;
    started = true;
    supabase.auth.getSession().then(({ data }) => { session.value = data.session ?? null; });
    supabase.auth.onAuthStateChange((event, s) => {
      // keep this callback synchronous: awaiting supabase calls in here can deadlock the client
      session.value = s ?? null;
      if (event === "PASSWORD_RECOVERY") recovery.value = true;
      if (event === "SIGNED_IN") { hadSession = true; sessionEnded.value = false; }
      if (event === "SIGNED_OUT") {
        // an expired or revoked session: tell the user instead of silently dropping them
        if (hadSession && !manualSignOut) sessionEnded.value = true;
        hadSession = false; manualSignOut = false;
      }
    });
    watch(uid, () => { if (session.value === undefined) return; profile.value = undefined; loadProfile(); }, { immediate: true });
    watch(() => session.value === undefined, (resolving) => { if (!resolving) { profile.value = undefined; loadProfile(); } });
  }

  /** Resolves once the session (and the profile, when signed in) is known. Route guards wait on this. */
  function whenReady(): Promise<void> {
    if (!loading.value) return Promise.resolve();
    return new Promise<void>((resolve) => { const stop = watch(loading, (l) => { if (!l) { stop(); resolve(); } }, { immediate: true }); });
  }

  const origin = () => window.location.origin;
  return {
    session, profile, recovery, sessionEnded, uid, user, isAdmin, loading, init, whenReady, refreshProfile: loadProfile,
    signIn: (email: string, password: string) => supabase.auth.signInWithPassword({ email, password }),
    signUp: (email: string, password: string, fullName: string) => supabase.auth.signUp({ email, password, options: { data: { full_name: fullName }, emailRedirectTo: `${origin()}/auth/callback` } }),
    signInWithGoogle: () => supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${origin()}/auth/callback` } }),
    resetPassword: (email: string) => supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin()}/reset-password` }),
    updatePassword: (password: string) => supabase.auth.updateUser({ password }),
    signOut: () => { manualSignOut = true; return supabase.auth.signOut(); },
  };
});
