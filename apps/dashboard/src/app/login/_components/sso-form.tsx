"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import { Input } from "@openstatus/ui/components/ui/input";
import { useActionState, useState } from "react";

import { type SsoFormState, startSsoSignIn } from "./actions";
import { LoginButton } from "./login-button";

const initialState: SsoFormState = {};

export function SsoForm({ redirectTo }: { redirectTo?: string }) {
  const [expanded, setExpanded] = useState(false);
  const [state, formAction, isPending] = useActionState(
    startSsoSignIn,
    initialState,
  );

  if (!expanded) {
    return (
      <LoginButton
        type="button"
        provider="oidc"
        onClick={() => setExpanded(true)}
      >
        Sign in with SSO
      </LoginButton>
    );
  }

  return (
    <form action={formAction} className="grid w-full gap-2">
      <input type="hidden" name="redirectTo" value={redirectTo ?? ""} />
      <Input
        name="email"
        type="email"
        required
        autoFocus
        placeholder="you@company.com"
        aria-label="Work email"
        aria-invalid={state.error ? true : undefined}
      />
      {state.error ? (
        <p className="text-destructive text-xs">{state.error}</p>
      ) : null}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Redirecting…" : "Continue with SSO"}
      </Button>
    </form>
  );
}
