// The pages use useAuth(); the state itself lives in the Pinia store (stores/auth.ts).
export function useAuth() {
  const s = useAuthStore();
  const { session, profile, recovery, sessionEnded, loading, user, isAdmin } = storeToRefs(s);
  return {
    session, profile, recovery, sessionEnded, loading, user, isAdmin,
    refreshProfile: s.refreshProfile, signIn: s.signIn, signUp: s.signUp, signInWithGoogle: s.signInWithGoogle,
    resetPassword: s.resetPassword, updatePassword: s.updatePassword, signOut: s.signOut,
  };
}

/** Resolves once the session (and the profile, when signed in) is known. Route guards wait on this. */
export const whenAuthReady = (): Promise<void> => useAuthStore().whenReady();
