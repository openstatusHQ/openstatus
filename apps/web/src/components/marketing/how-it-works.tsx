import { cn } from "@/lib/utils";
import { Bell, Globe, Monitor } from "lucide-react";

const steps = [
  {
    step: 1,
    title: "Add your monitors",
    description:
      "Connect your websites and APIs in seconds. Set your check frequency and regions.",
    icon: Monitor,
  },
  {
    step: 2,
    title: "Get notified instantly",
    description:
      "Receive alerts via email, Slack, or SMS the moment downtime is detected.",
    icon: Bell,
  },
  {
    step: 3,
    title: "Share your status",
    description:
      "Publish a beautiful public status page to keep your users informed.",
    icon: Globe,
  },
];

export function HowItWorks({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        "not-prose -mx-4 my-8 bg-muted/50 px-4 py-12 md:py-16",
        className
      )}
    >
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-10 text-center md:mb-12">
          <h2 className="mb-2 font-mono text-2xl font-medium tracking-tight text-foreground md:text-3xl">
            How it works
          </h2>
          <p className="font-mono text-muted-foreground">
            Get started in minutes with three simple steps
          </p>
        </div>

        {/* Steps */}
        <div className="relative grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-0">
          {/* Connecting lines - desktop only */}
          <div
            className="absolute top-12 hidden h-px w-full md:block"
            aria-hidden="true"
          >
            <div className="mx-auto flex w-2/3 justify-between">
              <div className="h-px w-full border-t-2 border-dashed border-border" />
            </div>
          </div>

          {steps.map((step, index) => (
            <div key={step.step} className="relative flex flex-col items-center">
              {/* Card */}
              <div className="flex w-full flex-col items-center border border-border bg-background p-6 text-center md:mx-4">
                {/* Step number badge */}
                <div className="mb-4 flex h-8 w-8 items-center justify-center border border-border bg-muted font-mono text-sm text-muted-foreground">
                  {step.step}
                </div>

                {/* Icon */}
                <div className="mb-4 flex h-12 w-12 items-center justify-center">
                  <step.icon className="h-8 w-8 text-foreground" />
                </div>

                {/* Content */}
                <h3 className="mb-2 font-mono text-lg font-medium text-foreground">
                  {step.title}
                </h3>
                <p className="font-mono text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>

              {/* Arrow connector - mobile only */}
              {index < steps.length - 1 && (
                <div
                  className="my-2 flex h-6 items-center justify-center text-muted-foreground md:hidden"
                  aria-hidden="true"
                >
                  <svg
                    width="12"
                    height="24"
                    viewBox="0 0 12 24"
                    fill="none"
                    className="text-border"
                  >
                    <path
                      d="M6 0V20M6 20L1 15M6 20L11 15"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeDasharray="4 2"
                    />
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
