import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { Loading } from "../../components/Spinner.jsx";
import { takeDestination } from "./Login.jsx";
import { IconLogIn } from "../../components/NavIcons.jsx";

/** Landing page for the email-verification link and the Google OAuth redirect.
 *  The Supabase client exchanges the ?code= for a session by itself; we just wait for it. */
export default function Callback() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [timedOut, setTimedOut] = useState(false);
  const params = new URLSearchParams(window.location.search + window.location.hash.replace("#", "&"));
  const urlError = params.get("error_description");

  useEffect(() => { if (!loading && user) nav(takeDestination() || "/", { replace: true }); }, [loading, user, nav]);
  useEffect(() => { const t = setTimeout(() => setTimedOut(true), 12000); return () => clearTimeout(t); }, []);

  return (
    <main id="main-content" className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      {urlError || timedOut ? (
        <>
          <h1 className="text-xl">Sign in did not complete</h1>
          <p role="alert" className="max-w-md text-danger">{urlError || "The sign-in took too long. Please try again."}</p>
          <Link className="btn-primary" to="/login"><IconLogIn />Back to sign in</Link>
        </>
      ) : (
        <Loading label="Signing you in…" />
      )}
    </main>
  );
}
