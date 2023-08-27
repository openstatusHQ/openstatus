"use client";

import { useState } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { Shell } from "../dashboard/shell";
import { Icons } from "../icons";
import type { ValidIcon } from "../icons";

type FeatureProps = {
  icon: ValidIcon;
  title: string;
  description: string;
  video: string;
};

const featuresConfig = {
  monitors: {
    icon: "activity",
    title: "Monitors",
    description:
      "Regularly monitor your website or API. Advanced settings allow you to set custom headers and a body payload if needed.",
    video: "Monitors",
  },
  "status-pages": {
    icon: "panel-top",
    title: "Status Pages",
    description:
      "Create your own status page within seconds. Claim your slug or connect to your custom domain and select the information you want to display.",
    video: "Status Pages",
  },
  incidents: {
    icon: "siren",
    title: "Incidents",
    description:
      "Inform your users when something goes wrong. Use markdown for your messages.",
    video: "Incidents",
  },
  integrations: {
    icon: "toy-brick",
    title: "Integrations",
    description:
      "Create incident or received failure notification in the tools you already work with.",
    video: "Integrations",
  },
} as const satisfies Record<string, FeatureProps>;

type Features = keyof typeof featuresConfig;

export function Features() {
  const [selected, setSelected] = useState<Features>("monitors");
  return (
    <Shell className="overflow-hidden">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-5">
        <div className="md:col-span-2">
          <Accordion
            value={selected}
            onValueChange={(value) => setSelected(value as Features)}
            type="single"
            collapsible
            className="w-full"
          >
            {Object.entries(featuresConfig).map(([key, feature]) => {
              const Icon = Icons[feature.icon];
              return (
                <AccordionItem
                  key={key}
                  value={key}
                  disabled={selected === key}
                >
                  <AccordionTrigger className="font-cal">
                    <span className="inline-flex items-center">
                      <Icon className="mr-2 h-4 w-4" />
                      {feature.title}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {feature.description}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
        <div className="relative h-64 w-full md:col-span-3 md:h-full">
          {/* Shell className px-3 py-4 md:p-6 */}
          <div
            key={selected}
            className={cn(
              "bg-muted border-border absolute -bottom-6 -right-6 left-0 top-0 rounded-tl-lg border",
              "slide-in-from-bottom-0 animate-in fade-in",
            )}
          >
            {/* video */}
            {featuresConfig[selected]?.video}
          </div>
        </div>
      </div>
    </Shell>
  );
}
