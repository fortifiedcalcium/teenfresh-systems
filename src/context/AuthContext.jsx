import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = still resolving
  const [profile, setProfile] = useState(undefined); // undefined = not loaded yet, null = none
  const [recovery, setRecovery] = useState(false);   // opened from a password-reset link
  const [sessionEnded, setSessionEnded] = useState(false); // signed out without the user asking (2.2.1)
  const manualSignOut = useRef(false);
  const hadSession = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      // keep this callback synchronous: awaiting supabase calls in here can deadlock the client
      setSession(s ?? null);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_IN") { hadSession.current = true; setSessionEnded(false); }
      if (event === "SIGNED_OUT") {
        // an expired or revoked session: tell the user instead of silently dropping them
        if (hadSession.current && !manualSignOut.current) setSessionEnded(true);
        hadSession.current = false; manualSignOut.current = false;
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const uid = session?.user?.id ?? null;
  const loadProfile = useCallback(async () => {
    if (!uid) { setProfile(null); return; }
    const { data } = await supabase.from("profiles").select("id,email,full_name,role").eq("id", uid).maybeSingle();
    setProfile(data ?? null);
  }, [uid]);

  useEffect(() => {
    if (session === undefined) return;
    setProfile(undefined);
    loadProfile();
  }, [uid, session === undefined, loadProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    profile,
    isAdmin: profile?.role === "admin",
    loading: session === undefined || (session !== null && profile === undefined),
    recovery,
    sessionEnded,
    refreshProfile: loadProfile,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signUp: (email, password, fullName) =>
      supabase.auth.signUp({ email, password, options: { data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}/auth/callback` } }),
    signInWithGoogle: () =>
      supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } }),
    resetPassword: (email) => supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` }),
    updatePassword: (password) => supabase.auth.updateUser({ password }),
    signOut: () => { manualSignOut.current = true; return supabase.auth.signOut(); },
  }), [session, profile, recovery, sessionEnded, loadProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
