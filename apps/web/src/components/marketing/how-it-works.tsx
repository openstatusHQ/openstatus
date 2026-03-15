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
    <section className="not-prose my-8 bg-muted/50 py-12">
      <div className="mx-auto max-w-5xl px-4">
        {/* Header */}
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-medium tracking-tight text-foreground">
            How it works
          </h2>
          <p className="mt-2 text-muted-foreground">
            Get started in minutes with three simple steps
          </p>
        </div>

        {/* Steps */}
        <div className="relative grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Connecting dotted line for desktop */}
          <div
            className="absolute left-0 right-0 top-12 hidden h-px border-t border-dashed border-border md:block"
            style={{ marginLeft: "16.67%", marginRight: "16.67%" }}
            aria-hidden="true"
          />

          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              {/* Arrow between cards on desktop */}
              {index < steps.length - 1 && (
                <div
                  className="absolute right-0 top-12 hidden -translate-y-1/2 translate-x-1/2 text-muted-foreground md:block"
                  aria-hidden="true"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              )}

              {/* Card */}
              <div
                className={cn(
                  "relative border border-border bg-background p-6",
                  "transition-colors hover:bg-muted/50"
                )}
              >
                {/* Number badge */}
                <div className="absolute -top-3 left-4 flex h-6 w-6 items-center justify-center border border-border bg-background text-xs font-medium text-foreground">
                  {step.number}
                </div>

                {/* Icon */}
                <div className="mb-4 flex h-10 w-10 items-center justify-center border border-border bg-muted">
                  <step.icon className="h-5 w-5 text-foreground" />
                </div>

                {/* Content */}
                <h3 className="mb-2 font-medium text-foreground">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
