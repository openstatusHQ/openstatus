"use client";

import { Bell, Globe, Monitor } from "lucide-react";
import type React from "react";
import { cn } from "@/lib/utils";

interface Step {
  number: number;
  title: string;
  icon: React.ReactNode;
  description: string;
}

const steps: Step[] = [
  {
    number: 1,
    title: "Add your monitors",
    icon: <Monitor className="h-8 w-8" />,
    description:
      "Connect your websites and APIs in seconds. Set your check frequency and regions.",
  },
  {
    number: 2,
    title: "Get notified instantly",
    icon: <Bell className="h-8 w-8" />,
    description:
      "Receive alerts via email, Slack, or SMS the moment downtime is detected.",
  },
  {
    number: 3,
    title: "Share your status",
    icon: <Globe className="h-8 w-8" />,
    description:
      "Publish a beautiful public status page to keep your users informed.",
  },
];

export function HowItWorks() {
  return (
    <section className="py-12 md:py-16 lg:py-20 my-8 bg-muted/40">
      <div className="container mx-auto px-4 md:px-6">
        {/* Centered Heading */}
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            How it works
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Get started with OpenStatus in three simple steps
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 relative">
          {/* Desktop Connecting Lines */}
          <div className="hidden md:block absolute top-1/4 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-border to-transparent -z-10" />

          {steps.map((step, index) => (
            <div
              key={step.number}
              className="relative flex flex-col items-center text-center"
            >
              {/* Numbered Badge */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 inline-flex items-center justify-center w-10 h-10 rounded-full bg-background border-2 border-border font-semibold text-sm font-mono z-10">
                {step.number}
              </div>

              {/* Card */}
              <div className={cn(
                "w-full pt-8 pb-6 px-6 md:px-8 rounded-lg border border-border",
                "bg-card hover:shadow-md transition-shadow duration-200",
                "flex flex-col items-center",
              )}>
                {/* Icon */}
                <div className="text-foreground/60 mb-4 mt-2">
                  {step.icon}
                </div>

                {/* Title */}
                <h3 className="text-xl font-semibold mb-3 text-foreground">
                  {step.title}
                </h3>

                {/* Description */}
                <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>

              {/* Mobile Connecting Arrow (visible only between steps) */}
              {index < steps.length - 1 && (
                <div className="md:hidden flex justify-center my-4">
                  <svg
                    className="w-6 h-6 text-muted-foreground/30"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
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
