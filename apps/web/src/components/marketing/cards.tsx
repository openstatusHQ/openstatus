import Link from "next/link";

import { Badge, Button } from "@openstatus/ui";

import type { Feature, SpecialFeature } from "@/config/features";
import { Shell } from "../dashboard/shell";
import { Icons } from "../icons";

export function Cards(props: Feature) {
  const Icon = Icons[props.icon];
  return (
    <Shell className="grid gap-6">
      <div className="flex flex-col items-center justify-center gap-3">
        <div className="border-border rounded-full border p-2">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="font-cal text-center text-2xl">{props.title}</h3>
      </div>
      <ul className="grid gap-4 md:grid-cols-3">
        {props.features?.map((feature, i) => {
          return (
            <li key={i}>
              <p className="text-muted-foreground text-sm">
                <span className="text-foreground font-medium">
                  {feature.catchline}
                </span>{" "}
                {feature.description}
              </p>
              {feature.badge ? (
                <Badge variant="secondary" className="-ml-2 mt-1">
                  {feature.badge}
                </Badge>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Shell>
  );
}

export function SpecialCard(props: SpecialFeature) {
  const Icon = Icons[props.icon];
  return (
    <Shell className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-3">
          <h3 className="font-cal text-2xl">{props.title}</h3>
          <div className="border-border rounded-full border p-2">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className="text-muted-foreground mt-2 text-sm">
          {props.description}
        </p>
      </div>
      <Button asChild>
        <Link href="mailto:thibault@openstatus.dev">Contact Us</Link>
      </Button>
    </Shell>
  );
}
