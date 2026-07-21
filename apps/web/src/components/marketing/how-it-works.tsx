import { Bell, Globe, Monitor } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstatus/ui/components/ui/card";

import { cn } from "@/lib/utils";

type Step = {
  icon: LucideIcon;
  title: string;
  description: string;
};

const steps: Step[] = [
  {
    icon: Monitor,
    title: "Add your monitors",
    description:
      "Connect your websites and APIs in seconds. Set your check frequency and regions.",
  },
  {
    icon: Bell,
    title: "Get notified instantly",
    description:
      "Receive alerts via email, Slack, or SMS the moment downtime is detected.",
  },
  {
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
      className="not-prose my-16 rounded-2xl border bg-muted/40 px-4 py-14 sm:px-8"
    >
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <h2
          id="how-it-works-heading"
          className="text-balance font-cal text-3xl sm:text-4xl"
        >
          How it works
        </h2>
        <p className="mt-3 text-pretty text-muted-foreground leading-relaxed">
          Go from zero to full observability in three simple steps.
        </p>
      </div>

      <div className="relative mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
        {/* Connecting dotted line across steps on desktop */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-9 hidden items-center justify-between px-[16.6%] md:flex"
        >
          <div className="h-px w-full border-t border-border border-dashed" />
        </div>

        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={step.title} className="relative flex flex-col">
              <Card className="relative h-full bg-background transition-colors hover:border-foreground/20">
                {/* Numbered badge */}
                <span
                  aria-hidden="true"
                  className="-top-3 -right-3 absolute flex h-8 w-8 items-center justify-center rounded-full border bg-background font-medium text-muted-foreground text-sm shadow-sm"
                >
                  {index + 1}
                </span>
                <CardHeader>
                  <span
                    className={cn(
                      "mb-2 flex h-11 w-11 items-center justify-center rounded-lg",
                      "bg-muted text-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <CardTitle className="text-lg">{step.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-pretty leading-relaxed">
                    {step.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </section>
  );
}
