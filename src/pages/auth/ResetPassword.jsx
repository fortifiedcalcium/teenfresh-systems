import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuth } from "../../context/AuthContext.jsx";
import Field from "../../components/Field.jsx";
import PasswordInput from "../../components/PasswordInput.jsx";
import ErrorSummary, { useErrorFocus } from "../../components/ErrorSummary.jsx";
import { Loading } from "../../components/Spinner.jsx";
import AuthShell from "./AuthShell.jsx";
import { IconKey } from "../../components/NavIcons.jsx";

export default function ResetPassword() {
  const { session, loading, updatePassword } = useAuth();
  const nav = useNavigate();
  const { register, handleSubmit, getValues, formState: { errors, isSubmitting, submitCount } } = useForm({ shouldFocusError: false });
  const [focusSignal, bumpFocus] = useErrorFocus();
  const [error, setError] = useState("");

  const onSubmit = async ({ password }) => {
    setError("");
    const { error: err } = await updatePassword(password);
    if (err) setError(err.message);
    else nav("/", { replace: true });
  };

  // The reset link signs the user in (recovery session); without one there is nothing to reset.
  if (loading) return <AuthShell title="Reset password"><Loading /></AuthShell>;
  if (!session) return <AuthShell title="Link expired"><p className="text-center">This reset link is invalid or has expired. <Link to="/forgot-password">Request a new one</Link>.</p></AuthShell>;

  return (
    <AuthShell title="Choose a new password">
      <form onSubmit={handleSubmit(onSubmit, bumpFocus)} className="space-y-4" noValidate>
        <ErrorSummary errors={errors} submitCount={submitCount} focusSignal={focusSignal} extra={error} labels={{ password: "New password", confirm: "Confirm new password" }} />
        <div>
          <p id="pw-rules" className="mb-1 text-sm font-semibold">Password rules</p>
          <ul className="mb-2 list-disc pl-5 text-sm text-ink-muted"><li>At least 8 characters</li></ul>
          <Field id="password" label="New password" required error={errors.password?.message}>
            <PasswordInput autoComplete="new-password" aria-describedby="pw-rules" {...register("password", { required: "Choose a password", minLength: { value: 8, message: "Use at least 8 characters" } })} />
          </Field>
        </div>
        <Field id="confirm" label="Confirm new password" required error={errors.confirm?.message}>
          <PasswordInput autoComplete="new-password" {...register("confirm", { validate: (v) => v === getValues("password") || "The passwords do not match. Type the same password again" })} />
        </Field>
        <button className="btn-primary w-full" disabled={isSubmitting}><IconKey />{isSubmitting ? "Saving…" : "Update password"}</button>
      </form>
    </AuthShell>
  );
}
