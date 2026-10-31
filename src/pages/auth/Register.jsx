import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuth } from "../../context/AuthContext.jsx";
import Field from "../../components/Field.jsx";
import PasswordInput from "../../components/PasswordInput.jsx";
import ErrorSummary from "../../components/ErrorSummary.jsx";
import AuthShell, { GoogleButton } from "./AuthShell.jsx";
import { rememberDestination } from "./Login.jsx";

export default function Register() {
  const { signUp, signInWithGoogle } = useAuth();
  const from = useLocation().state?.from || "/";
  const { register, handleSubmit, getValues, formState: { errors, isSubmitting, submitCount } } = useForm({ shouldFocusError: false });
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const onSubmit = async ({ fullName, email, password }) => {
    setError("");
    rememberDestination(from);
    const { data, error: err } = await signUp(email.trim(), password, fullName.trim());
    if (err) { setError(err.message); return; }
    // Supabase answers an already-registered address with a user that has no identities
    if (data.user && data.user.identities?.length === 0) { setError("An account with this email already exists. Try signing in instead."); return; }
    setDone(true);
  };

  if (done) {
    return (
      <AuthShell title="Check your email">
        <p role="status" className="text-center">We sent a verification link to <strong>{getValues("email")}</strong>. Open it to activate your account, then <Link to="/login" state={{ from }}>sign in</Link>.</p>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Create an account" subtitle="One account lets you register and keep your tickets.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <ErrorSummary errors={errors} submitCount={submitCount} extra={error} labels={{ fullName: "Full name", email: "Email", password: "Password", confirm: "Confirm password" }} />
        <Field id="fullName" label="Full name" required error={errors.fullName?.message}>
          <input autoComplete="name" className="input" {...register("fullName", { required: "Enter your full name" })} />
        </Field>
        <Field id="email" label="Email" required error={errors.email?.message}>
          <input type="email" autoComplete="email" className="input" {...register("email", { required: "Enter your email address", pattern: { value: /^\S+@\S+\.\S+$/, message: "Enter a valid email address, like name@example.com" } })} />
        </Field>
        <div>
          <p id="pw-rules" className="mb-1 text-sm font-semibold">Password rules</p>
          <ul className="mb-2 list-disc pl-5 text-sm text-ink-muted"><li>At least 8 characters</li><li>You can paste from a password manager</li></ul>
          <Field id="password" label="Password" required error={errors.password?.message}>
            <PasswordInput autoComplete="new-password" aria-describedby="pw-rules" {...register("password", { required: "Choose a password", minLength: { value: 8, message: "Use at least 8 characters" } })} />
          </Field>
        </div>
        <Field id="confirm" label="Confirm password" required error={errors.confirm?.message}>
          <PasswordInput autoComplete="new-password" {...register("confirm", { validate: (v) => v === getValues("password") || "The passwords do not match. Type the same password again" })} />
        </Field>
        <button className="btn-primary w-full" disabled={isSubmitting}>{isSubmitting ? "Creating account…" : "Sign up"}</button>
        <p className="text-center text-sm text-ink-muted">or</p>
        <GoogleButton onClick={() => { rememberDestination(from); signInWithGoogle(); }} />
        <p className="text-center text-sm">Already have an account? <Link to="/login" state={{ from }}>Sign in</Link></p>
      </form>
    </AuthShell>
  );
}
