import { Bell, Globe, Monitor } from "lucide-react";
import type React from "react";

import { cn } from "../../lib/utils";

type Step = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  iconClassName: string;
};

const steps: Step[] = [
  {
    icon: Monitor,
    title: "Add your monitors",
    description:
      "Connect your websites and APIs in seconds. Set your check frequency and regions.",
    iconClassName:
      "border-green-600/40 bg-green-100 text-green-700 dark:border-green-400/30 dark:bg-green-950 dark:text-green-400",
  },
  {
    icon: Bell,
    title: "Get notified instantly",
    description:
      "Receive alerts via email, Slack, or SMS the moment downtime is detected.",
    iconClassName:
      "border-yellow-600/40 bg-yellow-100 text-yellow-700 dark:border-yellow-400/30 dark:bg-yellow-950 dark:text-yellow-400",
  },
  {
    icon: Globe,
    title: "Share your status",
    description:
      "Publish a beautiful public status page to keep your users informed.",
    iconClassName:
      "border-green-600/40 bg-green-100 text-green-700 dark:border-green-400/30 dark:bg-green-950 dark:text-green-400",
  },
];

export function HowItWorks({ className }: { className?: string }) {
  return (
    <section
      aria-labelledby="how-it-works-heading"
      className={cn("not-prose border-border border bg-muted/40 p-6 md:p-10", className)}
    >
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <h2
          id="how-it-works-heading"
          className="text-foreground text-balance text-2xl font-semibold tracking-tight md:text-3xl"
        >
          How it works
        </h2>
        <p className="text-muted-foreground mt-2 text-balance text-sm md:text-base">
          Go from zero to a fully monitored, transparent status page in three
          simple steps.
        </p>
      </div>

      <ol className="mt-8 grid grid-cols-1 gap-4 md:mt-10 md:grid-cols-3 md:gap-0">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isLast = index === steps.length - 1;

          return (
            <li key={step.title} className="relative flex md:px-3">
              <div className="border-border bg-background relative flex w-full flex-col border p-6">
                <span
                  aria-hidden="true"
                  className="border-border bg-muted text-muted-foreground absolute right-4 top-4 flex h-6 w-6 items-center justify-center border text-xs font-medium tabular-nums"
                >
                  {index + 1}
                </span>

                <span
                  className={cn(
                    "flex h-11 w-11 items-center justify-center border",
                    step.iconClassName,
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>

                <h3 className="text-foreground mt-4 text-base font-semibold">
                  {step.title}
                </h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>

              {!isLast ? (
                <span
                  aria-hidden="true"
                  className="text-muted-foreground/60 absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 md:block"
                >
                  <ArrowConnector />
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ArrowConnector() {
  return (
    <svg
      width="28"
      height="12"
      viewBox="0 0 28 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="presentation"
    >
      <line
        x1="0"
        y1="6"
        x2="22"
        y2="6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="3 3"
      />
      <path
        d="M20 1.5L26 6L20 10.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
