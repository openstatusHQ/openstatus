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
      className="not-prose my-16 rounded-2xl border bg-muted/40 px-6 py-14 sm:px-10"
    >
      <div className="mx-auto max-w-2xl text-center">
        <h2
          id="how-it-works-heading"
          className="text-balance font-cal text-3xl tracking-tight sm:text-4xl"
        >
          How it works
        </h2>
        <p className="mt-3 text-pretty text-muted-foreground leading-relaxed">
          Go from zero to a fully monitored, public status page in three simple
          steps.
        </p>
      </div>

      <ol className="relative mt-12 grid gap-6 md:grid-cols-3 md:gap-8">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isLast = index === steps.length - 1;

          return (
            <li key={step.title} className="relative flex">
              <Card className="relative w-full transition-shadow hover:shadow-md">
                {/* Numbered badge */}
                <span
                  aria-hidden="true"
                  className="absolute -top-3 -left-3 flex h-8 w-8 items-center justify-center rounded-full border bg-background text-sm font-semibold text-foreground shadow-sm"
                >
                  {index + 1}
                </span>

                <CardHeader>
                  <span className="flex h-12 w-12 items-center justify-center rounded-lg border bg-background text-foreground">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <CardTitle className="mt-4 text-lg">
                    <span className="sr-only">{`Step ${index + 1}: `}</span>
                    {step.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="leading-relaxed">
                    {step.description}
                  </CardDescription>
                </CardContent>
              </Card>

              {/* Connecting dotted line + arrow (desktop only) */}
              {!isLast ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute top-1/2 right-0 hidden translate-x-1/2 -translate-y-1/2 items-center md:flex",
                  )}
                >
                  <span className="h-px w-8 border-t border-dashed border-muted-foreground/40" />
                  <svg
                    className="h-4 w-4 text-muted-foreground/60"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
