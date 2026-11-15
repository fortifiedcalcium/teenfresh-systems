import { supabase } from "~/lib/supabaseClient.js";

// One shared auth state for the whole app (the React AuthProvider). startAuth() runs once, from plugins/auth.client.js.
const session = ref(undefined);        // undefined = still resolving
const profile = ref(undefined);        // undefined = not loaded yet, null = none
const recovery = ref(false);           // opened from a password-reset link
const sessionEnded = ref(false);       // signed out without the user asking (2.2.1)
let manualSignOut = false;
let hadSession = false;
let started = false;

const uid = computed(() => session.value?.user?.id ?? null);
const loading = computed(() => session.value === undefined || (session.value !== null && profile.value === undefined));

async function loadProfile() {
  if (!uid.value) { profile.value = null; return; }
  const id = uid.value;
  const { data } = await supabase.from("profiles").select("id,email,full_name,role").eq("id", id).maybeSingle();
  if (uid.value === id) profile.value = data ?? null;
}

export function startAuth() {
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
export function whenAuthReady() {
  if (!loading.value) return Promise.resolve();
  return new Promise((resolve) => { const stop = watch(loading, (l) => { if (!l) { stop(); resolve(); } }, { immediate: true }); });
}

export function useAuth() {
  const origin = () => window.location.origin;
  return {
    session, profile, recovery, sessionEnded, loading,
    user: computed(() => session.value?.user ?? null),
    isAdmin: computed(() => profile.value?.role === "admin"),
    refreshProfile: loadProfile,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signUp: (email, password, fullName) => supabase.auth.signUp({ email, password, options: { data: { full_name: fullName }, emailRedirectTo: `${origin()}/auth/callback` } }),
    signInWithGoogle: () => supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${origin()}/auth/callback` } }),
    resetPassword: (email) => supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin()}/reset-password` }),
    updatePassword: (password) => supabase.auth.updateUser({ password }),
    signOut: () => { manualSignOut = true; return supabase.auth.signOut(); },
  };
}
