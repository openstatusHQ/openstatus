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
      className="not-prose my-8 border border-border font-mono"
    >
      {/* Section header */}
      <div className="border-b border-border bg-muted/40 px-6 py-8 text-center">
        <h2
          id="how-it-works-heading"
          className="text-2xl font-medium tracking-tight text-foreground text-balance"
        >
          How it works
        </h2>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">
          Get up and running in minutes — no configuration overhead.
        </p>
      </div>

      {/* Steps grid */}
      <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-3">
        {steps.map((step, index) => (
          <div key={step.number} className="relative bg-background p-6">
            {/* Dotted arrow connector — visible between cards on desktop only */}
            {index < steps.length - 1 && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 -right-3 z-10 hidden items-center sm:flex"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-border"
                >
                  <path
                    d="M4 12 Q8 12 12 12 Q16 12 20 12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M17 8.5 L21 12 L17 15.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            )}

            {/* Numbered badge + icon row */}
            <div className="mb-5 flex items-center justify-between">
              <span className="inline-flex h-6 w-6 items-center justify-center border border-border bg-muted text-xs font-medium text-muted-foreground select-none tabular-nums">
                {step.number}
              </span>
              <step.icon
                className="h-5 w-5 text-muted-foreground"
                aria-hidden="true"
              />
            </div>

            {/* Text content */}
            <h3 className="text-sm font-medium text-foreground mb-1.5">
              {step.title}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
