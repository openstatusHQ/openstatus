import { Bell, Globe, Monitor } from "lucide-react";

const steps = [
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
] as const;

export function HowItWorks() {
  return (
    <section className="not-prose py-12">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-10 text-center">
          <h2 className="font-cal text-3xl tracking-tight text-foreground">
            How it works
          </h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">
            Get up and running in minutes with three simple steps.
          </p>
        </div>

        {/* Steps grid */}
        <div className="relative grid grid-cols-1 gap-px border border-border bg-border md:grid-cols-3">
          {/* Connecting dotted lines (desktop only) */}
          <div
            className="pointer-events-none absolute inset-0 z-10 hidden md:block"
            aria-hidden="true"
          >
            {/* Line between step 1 and step 2 */}
            <div className="absolute top-1/2 left-[33.333%] h-px w-[calc(0%+1px)] -translate-x-1/2 -translate-y-1/2">
              <svg
                className="absolute -left-6 top-1/2 -translate-y-1/2 text-muted-foreground/60"
                width="48"
                height="12"
                viewBox="0 0 48 12"
                fill="none"
              >
                <line
                  x1="0"
                  y1="6"
                  x2="36"
                  y2="6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
                <path
                  d="M36 2L42 6L36 10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                />
              </svg>
            </div>
            {/* Line between step 2 and step 3 */}
            <div className="absolute top-1/2 left-[66.666%] h-px w-[calc(0%+1px)] -translate-x-1/2 -translate-y-1/2">
              <svg
                className="absolute -left-6 top-1/2 -translate-y-1/2 text-muted-foreground/60"
                width="48"
                height="12"
                viewBox="0 0 48 12"
                fill="none"
              >
                <line
                  x1="0"
                  y1="6"
                  x2="36"
                  y2="6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
                <path
                  d="M36 2L42 6L36 10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                />
              </svg>
            </div>
          </div>

          {steps.map((step) => (
            <div
              key={step.number}
              className="relative bg-background p-6 transition-colors hover:bg-muted"
            >
              {/* Numbered badge */}
              <span className="mb-4 inline-flex h-6 w-6 items-center justify-center border border-border bg-muted text-xs font-medium text-muted-foreground">
                {step.number}
              </span>

              {/* Icon */}
              <div className="mb-3 mt-4">
                <step.icon
                  className="h-5 w-5 text-foreground"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </div>

              {/* Content */}
              <h3 className="font-cal text-lg tracking-tight text-foreground">
                {step.title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
