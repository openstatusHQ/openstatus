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
import { TrackerExample } from "./tracker-example";

export function StatusPageCard() {
  const { icon, title, features } = cardConfig.pages;
  return (
    <CardContainer>
      <CardHeader>
        <CardIcon icon={icon} />
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent dir="rows">
        <TrackerExample />
        <CardFeatureContainer dir="cols">
          {features?.map((feature, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
            <CardFeature key={i} {...feature} />
          ))}
        </CardFeatureContainer>
      </CardContent>
    </CardContainer>
  );
}
