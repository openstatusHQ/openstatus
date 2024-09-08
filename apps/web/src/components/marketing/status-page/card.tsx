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
          {features?.map((feature) => (
            <CardFeature key={`status-page-card-${nanoid(6)}`} {...feature} />
          ))}
        </CardFeatureContainer>
      </CardContent>
    </CardContainer>
  );
}
