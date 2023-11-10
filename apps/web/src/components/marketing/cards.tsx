import { Badge } from "@openstatus/ui";

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
        <h3 className="font-cal text-center text-3xl">{props.title}</h3>
      </div>
      <ul className="grid gap-4 md:grid-cols-3 md:gap-6">
        {props.features?.map((feature, i) => {
          const FeatureIcon = Icons[feature.icon];
          return (
            <li key={i}>
              <p className="flex flex-col">
                <p>
                  <FeatureIcon className="text-foreground/80 mb-1 mr-1.5 inline-flex h-4 w-4" />
                  <span className="text-foreground font-medium">
                    {feature.catchline.replace(".", "")}
                  </span>{" "}
                </p>
                <span className="text-muted-foreground">
                  {feature.description}
                </span>
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
    <Shell className="relative flex items-center justify-between">
      <div>
        <div className="flex items-center gap-3">
          <h3 className="font-cal text-3xl">{props.title}</h3>
          <div className="border-border rounded-full border p-2">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className="text-muted-foreground mt-2">{props.description}</p>
      </div>
      <div />
    </Shell>
  );
}
