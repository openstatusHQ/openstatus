import { Bell, Globe, Monitor } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Step {
  number: number;
  title: string;
  description: string;
  icon: LucideIcon;
}

const steps: Step[] = [
  {
    number: 1,
    title: "Add your monitors",
    description:
      "Connect your websites and APIs in seconds. Set your check frequency and regions.",
    icon: Monitor,
  },
  {
    number: 2,
    title: "Get notified instantly",
    description:
      "Receive alerts via email, Slack, or SMS the moment downtime is detected.",
    icon: Bell,
  },
  {
    number: 3,
    title: "Share your status",
    description:
      "Publish a beautiful public status page to keep your users informed.",
    icon: Globe,
  },
];

export function HowItWorks() {
  return (
    <section
      aria-labelledby="how-it-works-heading"
      className="bg-green-50 dark:bg-green-950/20 border-y border-green-200 dark:border-green-900/30 -mx-4 px-4 py-12 sm:py-16"
    >
      <div className="mx-auto max-w-4xl">
        {/* Heading */}
        <div className="mb-10 text-center sm:mb-12">
          <h2
            id="how-it-works-heading"
            className="font-cal text-2xl font-semibold tracking-tight text-foreground text-balance"
          >
            How it works
          </h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed text-balance">
            Get up and running in minutes. No complex setup required.
          </p>
        </div>

        {/* Steps */}
        <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
          {/* Dotted connector line — desktop only */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-[2.75rem] hidden sm:block"
          >
            <div
              className="mx-auto h-px border-t border-dashed border-green-300 dark:border-green-800"
              style={{ width: "calc(66.666% - 2rem)", marginLeft: "16.666%" }}
            />
          </div>

          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="relative flex flex-col gap-3 border border-green-200 dark:border-green-900/30 bg-white dark:bg-green-950/10 p-5"
              >
                {/* Top row: badge + icon */}
                <div className="flex items-center justify-between">
                  {/* Numbered badge */}
                  <span className="inline-flex h-6 w-6 items-center justify-center border border-green-300 dark:border-green-700 bg-green-100 dark:bg-green-900/40 text-[11px] font-medium text-green-700 dark:text-green-300 font-mono">
                    {step.number}
                  </span>

                  {/* Icon */}
                  <span className="text-green-600 dark:text-green-400">
                    <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
                  </span>
                </div>

                {/* Text */}
                <div>
                  <h3 className="text-sm font-medium text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
