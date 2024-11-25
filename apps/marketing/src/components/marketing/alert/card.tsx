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
          {features?.map((feature, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
            <CardFeature key={i} {...feature} />
          ))}
        </CardFeatureContainer>
      </CardContent>
    </CardContainer>
  );
}
