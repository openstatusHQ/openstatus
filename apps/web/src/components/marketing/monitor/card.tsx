import Link from "next/link";

import { Button } from "@openstatus/ui";

import { cardConfig } from "@/config/features";
import {
  CardContainer,
  CardContent,
  CardFeature,
  CardFeatureContainer,
  CardHeader,
  CardIcon,
  CardTitle,
} from "../card";
import { Globe } from "./globe";

export function MonitoringCard() {
  const { icon, title, features } = cardConfig.monitors;
  return (
    <CardContainer>
      <CardHeader>
        <CardIcon icon={icon} />
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Globe />
        <CardFeatureContainer>
          {features?.map((feature, i) => <CardFeature key={i} {...feature} />)}
          <div className="order-first flex items-center justify-center gap-3 md:order-none">
            <Button asChild variant="default" className="rounded-full">
              <Link href="/play/checker">Speed Checker</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/public/1">Public Dashboard</Link>
            </Button>
          </div>
        </CardFeatureContainer>
      </CardContent>
    </CardContainer>
  );
}
