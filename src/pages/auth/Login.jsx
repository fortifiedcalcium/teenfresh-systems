import React, { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuth } from "../../context/AuthContext.jsx";
import Field from "../../components/Field.jsx";
import PasswordInput from "../../components/PasswordInput.jsx";
import ErrorSummary, { useErrorFocus } from "../../components/ErrorSummary.jsx";
import Alert from "../../components/Alert.jsx";
import AuthShell, { GoogleButton } from "./AuthShell.jsx";
import { IconLogIn } from "../../components/NavIcons.jsx";

export const rememberDestination = (path) => { try { sessionStorage.setItem("post_auth_path", path); } catch { /* ignore */ } };
export const takeDestination = () => { try { const p = sessionStorage.getItem("post_auth_path"); sessionStorage.removeItem("post_auth_path"); return p; } catch { return null; } };

export default function Login() {
  const { user, loading, signIn, signInWithGoogle, sessionEnded } = useAuth();
  const nav = useNavigate();
  const from = useLocation().state?.from || "/";
  const { register, handleSubmit, formState: { errors, isSubmitting, submitCount } } = useForm({ shouldFocusError: false });
  const [focusSignal, bumpFocus] = useErrorFocus();
  const [error, setError] = useState("");

  useEffect(() => { rememberDestination(from); }, [from]);
  if (!loading && user) return <Navigate to={from} replace />;

  const onSubmit = async ({ email, password }) => {
    setError("");
    const { error: err } = await signIn(email.trim(), password);
    if (err) setError(/confirm/i.test(err.message) ? "Please confirm your email first. Open the verification link we sent to your inbox, then sign in." : "The email or password is incorrect. Check both and try again, or use “Forgot password?”.");
    else nav(from, { replace: true });
  };

  return (
    <AuthShell icon={IconLogIn} title="Sign in" subtitle="Sign in to register for events and see your tickets.">
      {sessionEnded && <Alert tone="warn" className="mb-4">Your session ended. Please sign in again to continue.</Alert>}
      <form onSubmit={handleSubmit(onSubmit, bumpFocus)} className="space-y-4" noValidate>
        <ErrorSummary errors={errors} submitCount={submitCount} focusSignal={focusSignal} extra={error} labels={{ email: "Email", password: "Password" }} />
        <Field id="email" label="Email" required error={errors.email?.message}>
          <input type="email" autoComplete="username" className="input" {...register("email", { required: "Enter your email address" })} />
        </Field>
        <Field id="password" label="Password" required error={errors.password?.message}>
          <PasswordInput autoComplete="current-password" {...register("password", { required: "Enter your password" })} />
        </Field>
        <button className="btn-primary w-full" disabled={isSubmitting}><IconLogIn />{isSubmitting ? "Signing in…" : "Sign in"}</button>
        <p className="text-center text-sm text-ink-muted">or</p>
        <GoogleButton onClick={() => signInWithGoogle()} />
        <p className="text-center text-sm">
          <Link to="/forgot-password">Forgot password?</Link> · <Link to="/register" state={{ from }}>Create an account</Link>
        </p>
      </form>
    </AuthShell>
  );
}
