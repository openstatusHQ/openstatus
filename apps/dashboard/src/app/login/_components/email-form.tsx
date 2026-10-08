"use client";

import { Email } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { Input } from "@openstatus/ui/components/ui/input";
import { Separator } from "@openstatus/ui/components/ui/separator";
import { useActionState, useEffect, useState } from "react";

import {
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateTitle,
} from "@/components/content/empty-state";

import { type EmailFormState, continueWithEmail } from "./actions";
import { LoginButton, STORAGE_KEY } from "./login-button";

const initialState: EmailFormState = {};

type Mode = "closed" | "sso" | "email";

/**
 * One form, two doors: "Continue with SSO" sits with the OAuth buttons, the
 * magic link hides behind a text link so OAuth stays the obvious path. Both
 * submit the same action, which routes verified SSO domains server-side.
 * Reopens by itself for returning email/SSO users. The OAuth forms come in as
 * children so the "check your inbox" state can replace the whole list.
 */
export function EmailForm({
  redirectTo,
  sso,
  children,
}: {
  redirectTo?: string;
  sso: boolean;
  children?: React.ReactNode;
}) {
  const [state, formAction, isPending] = useActionState(
    continueWithEmail,
    initialState,
  );
  const [mode, setMode] = useState<Mode>("closed");
  // The action state outlives a mode switch; an error from the email form
  // must not show up, or mark the input invalid, on the SSO form.
  const [staleState, setStaleState] = useState<EmailFormState | null>(null);
  const error = state === staleState ? undefined : state.error;
  const switchMode = (next: Mode) => {
    setStaleState(state);
    setMode(next);
  };

  useEffect(() => {
    const last = localStorage.getItem(STORAGE_KEY);
    if (last === "email") setMode("email");
    if (last === "sso" && sso) setMode("sso");
  }, [sso]);

  if (state.sent) {
    return (
      <EmptyStateContainer className="py-8">
        <Email className="text-muted-foreground size-5" />
        <EmptyStateTitle>Check your inbox</EmptyStateTitle>
        <EmptyStateDescription className="text-pretty">
          We sent you a sign-in link. It is valid for 24 hours and works once.
        </EmptyStateDescription>
      </EmptyStateContainer>
    );
  }

  const form = (
    <form action={formAction} className="grid w-full gap-2">
      {redirectTo ? (
        <input type="hidden" name="redirectTo" value={redirectTo} />
      ) : null}
      <Input
        name="email"
        type="email"
        required
        autoFocus
        autoComplete="email"
        placeholder={
          mode === "sso" ? "you@company.com" : "gilfoyle@piedpiper.dev"
        }
        aria-label={mode === "sso" ? "Work email" : "Email"}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "email-error" : undefined}
      />
      {error ? (
        <p id="email-error" role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
      <LoginButton
        type="submit"
        provider={mode === "sso" ? "sso" : "email"}
        disabled={isPending}
      >
        {mode === "sso"
          ? isPending
            ? "Redirecting…"
            : "Continue with SSO"
          : isPending
            ? "Continuing…"
            : "Continue with email"}
      </LoginButton>
    </form>
  );

  return (
    <>
      {children}
      {sso ? (
        mode === "sso" ? (
          form
        ) : (
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => switchMode("sso")}
          >
            Continue with SSO
          </Button>
        )
      ) : null}
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-muted-foreground text-xs">or</span>
        <Separator className="flex-1" />
      </div>
      {mode === "email" ? (
        form
      ) : (
        <Button
          type="button"
          variant="ghost"
          className="text-muted-foreground w-full"
          onClick={() => switchMode("email")}
        >
          Continue with email
        </Button>
      )}
    </>
  );
}
