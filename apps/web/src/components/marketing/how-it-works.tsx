import { Bell, Globe, Monitor, MoveRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Fragment } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstatus/ui/components/ui/card";

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
      className="not-prose rounded-2xl border border-border bg-muted/50 px-4 py-14 sm:px-8 sm:py-16"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="how-it-works-heading"
            className="text-balance font-cal text-3xl text-foreground sm:text-4xl"
          >
            How it works
          </h2>
          <p className="mt-3 text-pretty text-base text-muted-foreground leading-relaxed">
            Go from zero to fully monitored in three simple steps — no complex
            setup required.
          </p>
        </div>

        <ol className="mt-12 flex flex-col gap-6 pl-0! [&>li]:m-0 [&>li]:list-none! [&>li]:pl-0 lg:flex-row lg:items-stretch lg:gap-0">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isLast = index === steps.length - 1;

            return (
              <Fragment key={step.title}>
                <li className="flex-1 lg:px-3">
                  <Card className="relative h-full overflow-hidden bg-card transition-colors hover:border-foreground/20">
                    <span
                      aria-hidden="true"
                      className="absolute top-4 right-4 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 font-medium text-primary text-sm tabular-nums"
                    >
                      {index + 1}
                    </span>
                    <CardHeader>
                      <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-background text-foreground">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <CardTitle className="mt-4 text-lg">
                        {step.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-pretty leading-relaxed">
                        {step.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                </li>

                {!isLast ? (
                  <li
                    aria-hidden="true"
                    className="hidden shrink-0 items-center justify-center lg:flex"
                  >
                    <MoveRight
                      className="h-6 w-6 text-muted-foreground/50"
                      strokeDasharray="4 3"
                    />
                  </li>
                ) : null}
              </Fragment>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
