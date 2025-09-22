import { cardConfig } from "@/config/features";
import { Button } from "@openstatus/ui";
import Link from "next/link";
import {
  CardContainer,
  CardContent,
  CardFeature,
  CardFeatureContainer,
  CardHeader,
  CardIcon,
  CardTitle,
} from "../card";
import { Code } from "./code";

export function CLICard() {
  const { icon, title, features } = cardConfig.cli;
  return (
    <CardContainer>
      <CardHeader>
        <CardIcon icon={icon} />
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Code />
        <CardFeatureContainer>
          {features?.map((feature, i) => (
            <CardFeature key={i} {...feature} />
          ))}
          <div className="text-center">
            <Button className="rounded-full" asChild>
              <Link
                href="https://docs.openstatus.dev/tutorial/get-started-with-openstatus-cli/"
                target="_blank"
                rel="noreferrer"
              >
                Learn more
              </Link>
            </Button>
          </div>
        </CardFeatureContainer>
      </CardContent>
    </CardContainer>
  );
}
