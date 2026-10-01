"use client";

import { Input } from "@openstatus/ui/components/ui/input";
import { useActionState } from "react";

import { type MagicLinkFormState, signInWithMagicLink } from "./actions";
import { LoginButton } from "./login-button";

const initialState: MagicLinkFormState = {};

export function MagicLinkForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction, isPending] = useActionState(
    signInWithMagicLink,
    initialState,
  );

  if (state.sent) {
    return (
      <div className="grid gap-1 text-center text-sm">
        <p className="font-medium">Check your inbox</p>
        <p className="text-muted-foreground text-pretty">
          We sent you a sign-in link. It is valid for 24 hours and works once.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid w-full gap-2">
      {redirectTo ? (
        <input type="hidden" name="redirectTo" value={redirectTo} />
      ) : null}
      <Input
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="gilfoyle@piedpiper.dev"
        aria-label="Email"
        aria-invalid={state.error ? true : undefined}
      />
      {state.error ? (
        <p className="text-destructive text-xs">{state.error}</p>
      ) : null}
      <LoginButton type="submit" provider="email" disabled={isPending}>
        {isPending ? "Sending…" : "Continue with email"}
      </LoginButton>
    </form>
  );
}
