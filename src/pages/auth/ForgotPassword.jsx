import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuth } from "../../context/AuthContext.jsx";
import Field from "../../components/Field.jsx";
import ErrorSummary, { useErrorFocus } from "../../components/ErrorSummary.jsx";
import AuthShell from "./AuthShell.jsx";

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const { register, handleSubmit, formState: { errors, isSubmitting, submitCount } } = useForm({ shouldFocusError: false });
  const [focusSignal, bumpFocus] = useErrorFocus();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async ({ email }) => {
    setError("");
    const { error: err } = await resetPassword(email.trim());
    if (err) setError(err.message);
    else setSent(true); // same message whether or not the account exists
  };

  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your email and we will send you a reset link.">
      {sent ? (
        <p role="status" className="text-center">If an account exists for that address, a reset link is on its way. <Link to="/login">Back to sign in</Link></p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit, bumpFocus)} className="space-y-4" noValidate>
          <ErrorSummary errors={errors} submitCount={submitCount} focusSignal={focusSignal} extra={error} labels={{ email: "Email" }} />
          <Field id="email" label="Email" required error={errors.email?.message}>
            <input type="email" autoComplete="email" className="input" {...register("email", { required: "Enter your email address" })} />
          </Field>
          <button className="btn-primary w-full" disabled={isSubmitting}>{isSubmitting ? "Sending…" : "Send reset link"}</button>
          <p className="text-center text-sm"><Link to="/login">Back to sign in</Link></p>
        </form>
      )}
    </AuthShell>
  );
}
