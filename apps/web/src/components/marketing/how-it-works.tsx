import { cn } from "@/lib/utils";
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
];

export function HowItWorks() {
  return (
    <section className="not-prose my-8 -mx-4 bg-muted/30 px-4 py-12 sm:py-16">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-10 text-center sm:mb-12">
          <h2 className="mb-3 font-medium text-2xl tracking-tight text-foreground sm:text-3xl">
            How it works
          </h2>
          <p className="mx-auto max-w-xl text-muted-foreground">
            Get started with uptime monitoring and status pages in three simple
            steps.
          </p>
        </div>

        {/* Steps */}
        <div className="relative grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-0">
          {/* Connecting lines (desktop only) */}
          <div
            className="pointer-events-none absolute top-16 right-[33.33%] left-[16.67%] hidden h-px border-t border-dashed border-border md:block"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute top-16 right-[16.67%] left-[33.33%] hidden h-px border-t border-dashed border-border md:block"
            aria-hidden="true"
          />

          {steps.map((step, index) => (
            <div
              key={step.number}
              className={cn(
                "relative flex flex-col items-center text-center",
                "border border-border bg-background p-6 sm:p-8",
                // Remove double borders on desktop
                index > 0 && "md:border-l-0"
              )}
            >
              {/* Numbered badge */}
              <div className="absolute -top-3 left-4 flex h-6 w-6 items-center justify-center bg-foreground text-background text-xs font-medium sm:left-6">
                {step.number}
              </div>

              {/* Icon */}
              <div className="mb-4 flex h-12 w-12 items-center justify-center border border-border bg-background sm:h-14 sm:w-14">
                <step.icon className="h-5 w-5 text-foreground sm:h-6 sm:w-6" />
              </div>

              {/* Content */}
              <h3 className="mb-2 font-medium text-foreground">{step.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {step.description}
              </p>

              {/* Arrow indicator (mobile only, except last) */}
              {index < steps.length - 1 && (
                <div
                  className="mt-4 text-muted-foreground md:hidden"
                  aria-hidden="true"
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="rotate-90"
                  >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
