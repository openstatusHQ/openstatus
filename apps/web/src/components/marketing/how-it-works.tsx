import { Bell, Globe, Monitor } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstatus/ui/components/ui/card";

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
    <section className="bg-muted/40 py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4">
        {/* Header */}
        <div className="mb-12 text-center md:mb-16">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            How it works
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Get started with OpenStatus in three simple steps
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connecting line - visible on desktop */}
          <div
            className="absolute left-0 right-0 top-1/2 hidden -translate-y-1/2 md:block"
            aria-hidden="true"
          >
            <div className="mx-auto flex max-w-3xl items-center justify-between px-24">
              <div className="h-px flex-1 border-t-2 border-dashed border-border" />
              <div className="mx-4 text-muted-foreground/50">
                <ArrowIcon />
              </div>
              <div className="h-px flex-1 border-t-2 border-dashed border-border" />
              <div className="mx-4 text-muted-foreground/50">
                <ArrowIcon />
              </div>
              <div className="h-px flex-1 border-t-2 border-dashed border-border" />
            </div>
          </div>

          {/* Cards */}
          <div className="relative grid gap-6 md:grid-cols-3 md:gap-8">
            {steps.map(({ step, title, description, icon: Icon }) => (
              <Card
                key={step}
                className="relative border-border bg-card transition-shadow hover:shadow-md"
              >
                {/* Step badge */}
                <div className="absolute -top-3 left-4">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                    {step}
                  </span>
                </div>

                <CardHeader className="pb-2 pt-6">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-5 w-5 text-foreground" />
                  </div>
                  <CardTitle className="text-lg">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    {description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-muted-foreground/60"
    >
      <path
        d="M6 12L10 8L6 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
