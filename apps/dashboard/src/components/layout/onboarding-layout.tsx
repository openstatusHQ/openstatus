"use client";

import {
  SHELL_CONTENT_COLUMN,
  SHELL_FORM_COLUMN,
} from "@/components/layout/shell-columns";
import { Wordmark } from "@/components/layout/wordmark";
import { NavFeedback } from "@/components/nav/nav-feedback";
import { NavLogout } from "@/components/nav/nav-logout";
import { cn } from "@/lib/utils";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupText,
} from "@openstatus/ui/components/ui/button-group";
import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";
import { ArrowUpRight, Check, Copy } from "lucide-react";

type StepStatus = "current" | "completed" | "upcoming";

export type OnboardingStep = {
  id: string;
  label: string;
  status: StepStatus;
  icon?: React.ReactNode;
};

export function OnboardingLayout({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col bg-background md:h-dvh md:min-h-0 md:overflow-hidden",
        className,
      )}
      {...props}
    >
      <header className="flex h-14 shrink-0 items-center justify-between border-border border-b px-4 md:px-6">
        <Wordmark size={24} showText />
        <div className="flex items-center gap-2">
          <NavFeedback />
          <NavLogout />
        </div>
      </header>
      <main className="flex flex-1 flex-col md:min-h-0">{children}</main>
    </div>
  );
}

export function OnboardingStepper({
  steps,
  className,
  ...props
}: React.ComponentProps<"nav"> & { steps: OnboardingStep[] }) {
  return (
    <nav
      aria-label="Onboarding progress"
      className={cn("w-full", className)}
      {...props}
    >
      <ol className="flex w-full items-stretch gap-3">
        {steps.map((step) => {
          const active =
            step.status === "current" || step.status === "completed";
          return (
            <li
              key={step.id}
              className="flex flex-1 flex-col gap-1.5"
              aria-current={step.status === "current" ? "step" : undefined}
            >
              <div
                className={cn(
                  "h-0.5 w-full rounded-full transition-colors",
                  active ? "bg-foreground" : "bg-muted",
                )}
                aria-hidden
              />
              <div
                className={cn(
                  "flex items-center gap-1.5 font-commit-mono text-xs tracking-tight transition-colors [&>svg]:size-3 [&>svg]:shrink-0",
                  active ? "text-foreground" : "text-muted-foreground/70",
                )}
              >
                {step.icon}
                <span>{step.label}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function OnboardingShell({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "grid w-full flex-1 grid-cols-1 md:min-h-0 md:grid-cols-2 xl:grid-cols-5",
        className,
      )}
      {...props}
    />
  );
}

export function OnboardingFormColumn({
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "col-span-1 flex w-full flex-col gap-6 px-4 py-8 md:min-h-0 md:overflow-y-auto md:px-8 md:py-32",
        SHELL_FORM_COLUMN,
        className,
      )}
      {...props}
    />
  );
}

export function OnboardingResultColumn({
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "col-span-1 flex w-full flex-col gap-3 border-border border-t bg-sidebar p-4 md:min-h-0 md:overflow-hidden md:border-t-0 md:border-l md:p-8",
        SHELL_CONTENT_COLUMN,
        className,
      )}
      {...props}
    />
  );
}

// =============================================================================
// Compound: form-column header
// Use as: <OnboardingStepHeader><OnboardingStepTitle/><OnboardingStepDescription/></OnboardingStepHeader>
// Mirrors auth/login: same `font-cal` heading + `font-commit-mono` muted lead.
// =============================================================================

export function OnboardingStepHeader({
  className,
  ...props
}: React.ComponentProps<"header">) {
  return <header className={cn("space-y-2", className)} {...props} />;
}

export function OnboardingStepTitle({
  className,
  ...props
}: React.ComponentProps<"h1">) {
  return (
    <h1
      className={cn(
        "font-cal text-2xl text-foreground tracking-tight",
        className,
      )}
      {...props}
    />
  );
}

export function OnboardingStepDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "text-pretty font-commit-mono text-muted-foreground text-sm",
        className,
      )}
      {...props}
    />
  );
}

export function OnboardingResultHeading({
  className,
  ...props
}: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn(
        "font-commit-mono font-medium text-foreground text-sm uppercase",
        className,
      )}
      {...props}
    />
  );
}

export function OnboardingActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex items-center gap-2", className)} {...props} />
  );
}

// =============================================================================
// Compound: preview placeholder
// Shared shell for the right-column previews (Step1 checks, Step2 iframe).
// Renders decorative content behind a backdrop-blurred hint card.
//
// Use as:
//   <OnboardingPreviewPlaceholder>
//     <OnboardingPreviewPlaceholderContent>{decorativeContent}</...>
//     <OnboardingPreviewPlaceholderOverlay>
//       <OnboardingPreviewPlaceholderText>{hint}</...>
//     </...>
//   </OnboardingPreviewPlaceholder>
// =============================================================================

export function OnboardingPreviewPlaceholder({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md border border-border bg-background md:min-h-0 md:flex-1",
        className,
      )}
      {...props}
    />
  );
}

export function OnboardingPreviewPlaceholderContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "pointer-events-none flex select-none md:min-h-0",
        className,
      )}
      {...props}
    />
  );
}

export function OnboardingPreviewPlaceholderOverlay({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-0% from-transparent to-90% to-background p-2",
        className,
      )}
      {...props}
    />
  );
}

export function OnboardingPreviewPlaceholderText({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "max-w-xs text-pretty rounded-md border border-border p-2 text-center text-foreground text-sm backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  );
}

// =============================================================================
// Locked-summary input
// Shown after the step's form has been submitted — read-only display of the
// committed value with copy + open affordances.
// =============================================================================

export function OnboardingLockedSummary({
  value,
  href,
  helper,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  value: string;
  /** Optional external link target. When provided, an "Open" button is added. */
  href?: string;
  helper?: React.ReactNode;
}) {
  const { copy, isCopied } = useCopyToClipboard();
  return (
    <div className={cn("space-y-3", className)} {...props}>
      <ButtonGroup className="w-full">
        <ButtonGroupText className="min-w-0 flex-1 justify-start">
          <code className="truncate font-mono text-foreground text-sm">
            {value}
          </code>
          <Check className="size-3 shrink-0 text-success" />
        </ButtonGroupText>
        <Button
          variant="outline"
          onClick={() => copy(value, { withToast: false })}
        >
          {isCopied ? (
            <Check className="size-3" />
          ) : (
            <Copy className="size-3" />
          )}
        </Button>
        {href ? (
          <Button variant="outline" asChild>
            <a href={href} target="_blank" rel="noopener noreferrer">
              Open <ArrowUpRight className="size-3" />
            </a>
          </Button>
        ) : null}
      </ButtonGroup>
      {helper ? (
        <p className="text-muted-foreground text-xs">{helper}</p>
      ) : null}
    </div>
  );
}
