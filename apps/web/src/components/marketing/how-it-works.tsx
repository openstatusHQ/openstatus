import { Bell, Globe, Monitor } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Step {
  number: number;
  icon: LucideIcon;
  title: string;
  description: string;
}

const steps: Step[] = [
  {
    number: 1,
    icon: Monitor,
    title: "Add your monitors",
    description:
      "Connect your websites and APIs in seconds. Set your check frequency and regions.",
  },
  {
    number: 2,
    icon: Bell,
    title: "Get notified instantly",
    description:
      "Receive alerts via email, Slack, or SMS the moment downtime is detected.",
  },
  {
    number: 3,
    icon: Globe,
    title: "Share your status",
    description:
      "Publish a beautiful public status page to keep your users informed.",
  },
];

export function HowItWorks() {
  return (
    <section
      aria-labelledby="how-it-works-heading"
      className="not-prose -mx-4 my-0 bg-muted/40 px-4 py-6 sm:py-8"
    >
      {/* Section header */}
      <div className="mb-6 text-center sm:mb-8">
        <h2
          id="how-it-works-heading"
          className="font-mono text-balance text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
        >
          How it works
        </h2>
        <p className="mt-1.5 font-sans text-balance text-sm text-muted-foreground">
          Get up and running in minutes — no configuration overhead.
        </p>
      </div>

      {/* Steps grid */}
      <div className="relative mx-auto max-w-3xl">
        {/* Desktop connector line */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-7 hidden items-center px-[calc(16.67%+1rem)] md:flex"
        >
          <div className="h-px flex-1 border-t border-dashed border-border" />
          <svg
            className="mx-1 h-3 w-3 shrink-0 text-muted-foreground"
            viewBox="0 0 12 12"
            fill="currentColor"
          >
            <path d="M6.5 1.5 11 6l-4.5 4.5M1 6h10" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="h-px flex-1 border-t border-dashed border-border" />
          <svg
            className="mx-1 h-3 w-3 shrink-0 text-muted-foreground"
            viewBox="0 0 12 12"
            fill="currentColor"
          >
            <path d="M6.5 1.5 11 6l-4.5 4.5M1 6h10" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <ol className="relative grid gap-3 md:grid-cols-3 md:gap-4">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <li
                key={step.number}
                className="relative flex flex-col items-stretch text-center"
              >
                {/* Mobile step connector */}
                {step.number < steps.length && (
                  <div
                    aria-hidden="true"
                    className="absolute left-1/2 top-full mt-0 flex -translate-x-1/2 flex-col items-center py-1 md:hidden"
                  >
                    <div className="h-3 w-px border-l border-dashed border-border" />
                    <svg
                      className="h-2 w-2 text-muted-foreground"
                      viewBox="0 0 12 12"
                      fill="none"
                    >
                      <path d="M6 1v10M1 6.5l5 4.5 5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}

                {/* Card */}
                <div className="relative flex h-full w-full flex-col items-center gap-1 rounded-lg border border-border bg-background p-4 shadow-xs transition-shadow hover:shadow-sm">
                  {/* Numbered badge */}
                  <span
                    aria-hidden="true"
                    className="absolute right-2.5 top-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-muted font-mono text-[9px] font-semibold tabular-nums text-muted-foreground"
                  >
                    {step.number}
                  </span>

                  {/* Icon */}
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-muted">
                    <Icon className="h-4 w-4 text-foreground" aria-hidden="true" />
                  </div>

                  {/* Text */}
                  <h3 className="font-mono text-sm font-semibold text-foreground">
                    {step.title}
                  </h3>
                  <p className="font-sans text-xs leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
