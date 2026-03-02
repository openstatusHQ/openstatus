import { Bell, Globe, Monitor } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Step {
  number: string;
  icon: LucideIcon;
  title: string;
  description: string;
  label: string;
}

const steps: Step[] = [
  {
    number: "01",
    icon: Monitor,
    title: "Add your monitors",
    description:
      "Connect your websites and APIs in seconds. Set your check frequency and regions.",
    label: "setup",
  },
  {
    number: "02",
    icon: Bell,
    title: "Get notified instantly",
    description:
      "Receive alerts via email, Slack, or SMS the moment downtime is detected.",
    label: "alerts",
  },
  {
    number: "03",
    icon: Globe,
    title: "Share your status",
    description:
      "Publish a beautiful public status page to keep your users informed.",
    label: "status",
  },
];

export function HowItWorks() {
  return (
    <section
      aria-labelledby="how-it-works-heading"
      className="not-prose my-8 border border-border font-mono"
    >
      {/* Section heading row */}
      <div className="grid grid-cols-1 gap-px border-t border-border bg-border sm:grid-cols-[1fr_auto]">
        {/* Heading cell */}
        <div className="bg-background px-6 py-8">
          <h2
            id="how-it-works-heading"
            className="text-xl font-medium tracking-tight text-foreground text-balance"
          >
            How it works
          </h2>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            Get up and running in minutes — no configuration overhead.
          </p>
        </div>

        {/* Decorative right cell — desktop only */}
        <div
          aria-hidden="true"
          className="hidden bg-background sm:flex items-center justify-center px-8 border-l border-border"
        >
          <span className="text-[10px] text-muted-foreground/50 select-none tracking-widest uppercase">
            $ openstatus start
          </span>
        </div>
      </div>

      {/* Steps grid */}
      <div className="grid grid-cols-1 gap-px border-t border-border bg-border sm:grid-cols-3">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isLast = index === steps.length - 1;
          return (
            <div key={step.number} className="relative flex flex-col bg-background">
              {/* Step number + label top bar */}
              <div className="flex items-center justify-between border-b border-border px-4 py-2">
                <span className="text-xs font-medium text-blue-700 dark:text-blue-400 tabular-nums select-none">
                  {step.number}
                </span>
                <span className="text-[10px] text-muted-foreground/60 tracking-widest uppercase select-none">
                  {step.label}
                </span>
              </div>

              {/* Card body */}
              <div className="flex flex-col gap-4 p-5 flex-1">
                {/* Icon */}
                <div className="flex items-center justify-between">
                  <div className="flex h-8 w-8 items-center justify-center border border-border bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </div>

                  {/* Connector arrow — only on non-last cards, desktop */}
                  {!isLast && (
                    <span
                      aria-hidden="true"
                      className="hidden sm:flex items-center text-muted-foreground/30 select-none"
                    >
                      <span className="inline-block w-6 border-t border-dashed border-muted-foreground/30" />
                      <svg
                        width="8"
                        height="8"
                        viewBox="0 0 8 8"
                        fill="currentColor"
                        className="shrink-0"
                      >
                        <path d="M0 0 L8 4 L0 8 Z" />
                      </svg>
                    </span>
                  )}
                </div>

                {/* Text */}
                <div>
                  <h3 className="text-sm font-medium text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </div>

              {/* Bottom status bar */}
              <div className="border-t border-border px-4 py-2 flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="inline-block h-1.5 w-1.5 bg-blue-700 dark:bg-blue-400"
                />
                <span className="text-[10px] text-muted-foreground/50 select-none">
                  step {step.number}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
