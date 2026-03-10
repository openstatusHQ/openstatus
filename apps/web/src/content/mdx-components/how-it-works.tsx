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

export function HowItWorks() {
  return (
    <section className="not-prose my-8 -mx-4 bg-muted/50 px-4 py-12 md:py-16">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-10 text-center md:mb-12">
          <h2 className="text-2xl font-medium tracking-tight text-foreground md:text-3xl">
            How it works
          </h2>
          <p className="mt-3 text-muted-foreground">
            Get started with OpenStatus in three simple steps
          </p>
        </div>

        {/* Steps */}
        <div className="relative grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-0">
          {/* Connecting lines (desktop only) */}
          <div
            className="absolute top-12 left-[calc(16.67%+2rem)] right-[calc(16.67%+2rem)] hidden h-px border-t border-dashed border-border md:block"
            aria-hidden="true"
          />

          {steps.map((step, index) => (
            <div
              key={step.step}
              className={cn(
                "relative flex flex-col items-center text-center",
                index !== steps.length - 1 && "md:border-r md:border-border"
              )}
            >
              {/* Step card */}
              <div className="relative w-full border border-border bg-background p-6 md:border-0 md:bg-transparent md:p-8">
                {/* Number badge */}
                <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center border border-border bg-background font-mono text-sm text-muted-foreground">
                  {step.step}
                </div>

                {/* Icon */}
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center">
                  <step.icon className="h-6 w-6 text-foreground" />
                </div>

                {/* Title */}
                <h3 className="mb-2 font-medium text-foreground">
                  {step.title}
                </h3>

                {/* Description */}
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>

              {/* Arrow indicator (mobile only) */}
              {index !== steps.length - 1 && (
                <div
                  className="my-2 text-muted-foreground md:hidden"
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
                  >
                    <path d="M12 5v14M19 12l-7 7-7-7" />
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
