import { ArrowRight, Bell, Globe, Monitor } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "../../lib/utils";

const steps: {
  title: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    title: "Add your monitors",
    description:
      "Connect your websites and APIs in seconds. Set your check frequency and regions.",
    icon: Monitor,
  },
  {
    title: "Get notified instantly",
    description:
      "Receive alerts via email, Slack, or SMS the moment downtime is detected.",
    icon: Bell,
  },
  {
    title: "Share your status",
    description:
      "Publish a beautiful public status page to keep your users informed.",
    icon: Globe,
  },
];

export function HowItWorks({ className }: { className?: string }) {
  return (
    <section
      aria-labelledby="how-it-works-heading"
      className={cn(
        "not-prose bg-muted/40 border-border my-8 border p-6 md:p-10",
        // NOTE: globals.css styles `.prose h2 / h3 / p` with raw selectors that
        // outrank utility classes and `not-prose`, so reset them locally.
        "[&_h2]:mt-0! [&_h2]:mb-0! [&_h2]:border-t-0! [&_h2]:pt-0!",
        "[&_h3]:my-0! [&_p]:my-0!",
        className,
      )}
    >
      <div className="flex flex-col gap-3 text-center">
        <h2
          id="how-it-works-heading"
          className="text-foreground text-2xl font-semibold tracking-tight"
        >
          How it works
        </h2>
        <p className="text-muted-foreground mx-auto max-w-xl text-sm leading-relaxed text-pretty">
          From first check to public status page in three steps — no agents to
          install, no infrastructure to babysit.
        </p>
      </div>

      <ol className="mt-8 flex list-none flex-col items-stretch gap-4 p-0 md:flex-row md:gap-0">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isLast = index === steps.length - 1;

          return (
            <li key={step.title} className="flex flex-1 items-stretch">
              <div className="border-border bg-background flex w-full flex-col gap-3 border p-5">
                <div className="flex items-center justify-between gap-3">
                  <span
                    aria-hidden="true"
                    className="border-border text-foreground flex size-9 shrink-0 items-center justify-center border"
                  >
                    <Icon className="size-5" />
                  </span>
                  <span
                    aria-hidden="true"
                    className="border-border text-muted-foreground flex size-6 shrink-0 items-center justify-center border text-xs tabular-nums"
                  >
                    {index + 1}
                  </span>
                </div>
                <h3 className="text-foreground text-base font-medium">
                  <span className="sr-only">{`Step ${index + 1}: `}</span>
                  {step.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
                  {step.description}
                </p>
              </div>

              {!isLast ? (
                <div
                  aria-hidden="true"
                  className="text-muted-foreground/60 hidden shrink-0 self-center items-center md:flex"
                >
                  <span className="border-border w-6 border-t border-dashed" />
                  <ArrowRight className="size-4" />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
