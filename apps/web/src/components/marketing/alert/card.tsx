import { cardConfig } from "@/config/features";
import { nanoid } from "nanoid";
import {
  CardContainer,
  CardContent,
  CardFeature,
  CardFeatureContainer,
  CardHeader,
  CardIcon,
  CardTitle,
} from "../card";
import { Timeline } from "./timeline";

export function AlertCard() {
  const { icon, title, features } = cardConfig.alerts;
  return (
    <CardContainer>
      <CardHeader>
        <CardIcon icon={icon} />
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Timeline />
        <CardFeatureContainer>
          {features?.map((feature) => (
            <CardFeature key={`alert-card-${nanoid(6)}`} {...feature} />
          ))}
        </CardFeatureContainer>
      </CardContent>
    </CardContainer>
  );
}
