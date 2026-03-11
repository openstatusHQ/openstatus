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
    <section className="bg-muted/50 py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4">
        {/* Header */}
        <div className="mb-12 text-center md:mb-16">
          <h2 className="text-2xl font-medium tracking-tight text-foreground md:text-3xl">
            How it works
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Get up and running with OpenStatus in three simple steps
          </p>
        </div>

        {/* Steps */}
        <div className="relative grid gap-8 md:grid-cols-3 md:gap-6">
          {/* Connecting line for desktop */}
          <div
            aria-hidden="true"
            className="absolute left-0 right-0 top-12 hidden h-px border-t border-dashed border-border md:block"
            style={{
              left: "calc(16.67% + 24px)",
              right: "calc(16.67% + 24px)",
            }}
          />

          {steps.map((step, index) => (
            <div key={step.step} className="relative flex flex-col items-center">
              {/* Numbered badge */}
              <div className="relative z-10 mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background text-sm font-medium text-foreground shadow-sm">
                {step.step}
              </div>

              {/* Arrow between steps on desktop */}
              {index < steps.length - 1 && (
                <div
                  aria-hidden="true"
                  className="absolute right-0 top-12 hidden -translate-y-1/2 translate-x-1/2 text-muted-foreground md:block"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="text-border"
                  >
                    <path
                      d="M6 4L10 8L6 12"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}

              {/* Card content */}
              <div className="flex flex-1 flex-col items-center rounded-lg border border-border bg-card p-6 text-center shadow-sm">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                  <step.icon className="h-5 w-5 text-foreground" />
                </div>
                <h3 className="mb-2 font-medium text-foreground">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
