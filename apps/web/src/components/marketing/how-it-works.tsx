import { Bell, Globe, Monitor } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstatus/ui/components/ui/card";
import { cn } from "@openstatus/ui/lib/utils";

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
    <section className="bg-muted/50 py-16 md:py-24 -mx-8 px-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl font-medium tracking-tight text-foreground md:text-4xl">
            How it works
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Get started with OpenStatus in three simple steps
          </p>
        </div>

        {/* Steps Grid */}
        <div className="relative">
          {/* Desktop connecting line */}
          <div
            className="absolute top-1/2 left-0 right-0 hidden md:block -translate-y-1/2 z-0"
            aria-hidden="true"
          >
            <div className="mx-auto max-w-3xl px-16">
              <div className="border-t-2 border-dashed border-border" />
            </div>
          </div>

          {/* Cards */}
          <div className="relative z-10 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-6">
            {steps.map((step, index) => (
              <div key={step.step} className="relative">
                {/* Desktop arrow between cards */}
                {index < steps.length - 1 && (
                  <div
                    className="absolute -right-3 top-1/2 hidden md:block -translate-y-1/2 z-20"
                    aria-hidden="true"
                  >
                    <svg
                      className="h-6 w-6 text-muted-foreground/50"
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

                <Card
                  className={cn(
                    "relative h-full border-border bg-background transition-shadow hover:shadow-md",
                    "rounded-none"
                  )}
                >
                  {/* Step badge */}
                  <div className="absolute -top-3 left-6">
                    <span className="inline-flex h-7 w-7 items-center justify-center bg-foreground text-background text-sm font-medium">
                      {step.step}
                    </span>
                  </div>

                  <CardHeader className="pt-8">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center bg-muted">
                      <step.icon className="h-6 w-6 text-foreground" />
                    </div>
                    <CardTitle className="text-lg">{step.title}</CardTitle>
                  </CardHeader>

                  <CardContent>
                    <CardDescription className="text-base leading-relaxed">
                      {step.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
