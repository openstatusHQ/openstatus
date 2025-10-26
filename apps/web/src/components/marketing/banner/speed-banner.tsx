import { Button } from "@openstatus/ui";
import { SpeedCheckerButton } from "../speed-checker-button";
import { GenericBanner } from "./generic-banner";

const config = {
  exploratory: {
    title: "Type. Submit. Discover.",
    description: "See how fast your API really is - in real time.",
  },
  dev: {
    title: "Call. Measuer. Improve.",
    description: "Benchmark your API speed with OpenStatus.",
  },
};

export function SpeedBanner() {
  const { title, description } = config.exploratory;
  return (
    <GenericBanner
      title={title}
      description={description}
      actions={
        <div className="flex gap-2">
          <Button className="rounded-full" variant="outline" asChild>
            <a href="https://app.openstatus.dev" className="text-nowrap">
              Start for free
            </a>
          </Button>
          <SpeedCheckerButton />
        </div>
      }
    />
  );
}
