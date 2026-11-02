"use client";

import { useActionState, useEffect } from "react";
import { loginAction, mfaAction, changePasswordAction, holdSetupSecret, type FormState } from "@/app/staff/actions/auth";

function ErrorBox({ state }: { state: FormState }) {
  return state.error ? <div className="err" role="alert">{state.error}</div> : null;
}

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, {});
  return (
    <form action={action} style={{ display: "contents" }}>
      <ErrorBox state={state} />
      <div className="fld"><label htmlFor="lg-e">Email</label><input id="lg-e" name="email" className="inp" type="email" autoComplete="username" defaultValue={state.email} key={state.email} required /></div>
      <div className="fld"><label htmlFor="lg-p">Password</label><input id="lg-p" name="password" className="inp" type="password" autoComplete="current-password" required /><small>Forgot it? Ask the Admin to reset your account.</small></div>
      <button className="btn p" type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}

export function MfaForm() {
  const [state, action, pending] = useActionState(mfaAction, {});
  return (
    <form action={action} style={{ display: "contents" }}>
      <ErrorBox state={state} />
      <div className="fld"><label htmlFor="mfa-c">6-digit code</label><input id="mfa-c" name="code" className="inp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus /></div>
      <button className="btn p" type="submit" disabled={pending}>{pending ? "Checking…" : "Continue"}</button>
    </form>
  );
}

export function SetupSecret({ secret }: { secret: string }) {
  useEffect(() => { void holdSetupSecret(secret); }, [secret]);
  return (
    <div className="fld">
      <span className="lab">Key for typing in by hand</span>
      <div className="secret" aria-label="Authenticator key">{secret.match(/.{1,4}/g)?.join(" ")}</div>
    </div>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, {});
  return (
    <form action={action} style={{ display: "contents" }}>
      <ErrorBox state={state} />
      <div className="fld"><label htmlFor="cp-c">Current password</label><input id="cp-c" name="current" className="inp" type="password" autoComplete="current-password" required /></div>
      <div className="fld"><label htmlFor="cp-n">New password</label><input id="cp-n" name="next" className="inp" type="password" autoComplete="new-password" minLength={10} required /><small>At least 10 characters.</small></div>
      <div className="fld"><label htmlFor="cp-r">Repeat new password</label><input id="cp-r" name="confirm" className="inp" type="password" autoComplete="new-password" minLength={10} required /></div>
      <button className="btn p" type="submit" disabled={pending}>{pending ? "Saving…" : "Save password"}</button>
    </form>
  );
}
