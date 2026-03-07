import { Bell, Globe, Monitor } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstatus/ui/components/ui/card";
import { Badge } from "@openstatus/ui/components/ui/badge";

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
    <section className="bg-muted/50 py-16 -mx-4 px-4 md:py-20">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-12 text-center">
          <h2 className="text-2xl font-medium tracking-tight text-foreground md:text-3xl">
            How it works
          </h2>
          <p className="mt-3 text-muted-foreground">
            Get started in minutes with three simple steps
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connecting line - desktop only */}
          <div
            className="absolute top-1/2 left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] hidden -translate-y-1/2 md:block"
            aria-hidden="true"
          >
            <div className="h-px w-full border-t-2 border-dashed border-success/40" />
          </div>

          <div className="grid gap-6 md:grid-cols-3 md:gap-8">
            {steps.map((step, index) => (
              <div key={step.step} className="relative">
                {/* Arrow between cards - desktop only */}
                {index < steps.length - 1 && (
                  <div
                    className="absolute -right-4 top-1/2 z-10 hidden -translate-y-1/2 md:block"
                    aria-hidden="true"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      className="text-success/60"
                    >
                      <path
                        d="M6 3L11 8L6 13"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}

                <Card className="relative h-full border-border bg-background">
                  {/* Step badge */}
                  <Badge
                    variant="outline"
                    className="absolute -top-3 left-4 border-success/50 bg-success/10 font-mono text-xs text-success"
                  >
                    {step.step}
                  </Badge>

                  <CardHeader className="pt-6">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-success/30 bg-success/10">
                      <step.icon className="h-5 w-5 text-success" />
                    </div>
                    <CardTitle className="text-base font-medium">
                      {step.title}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <CardDescription className="text-sm leading-relaxed">
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
