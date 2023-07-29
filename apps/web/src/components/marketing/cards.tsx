import { Shell } from "../dashboard/shell";
import { Icons } from "../icons";
import type { ValidIcon } from "../icons";

const cardConfig: {
  icon: ValidIcon;
  title: string;
  description: string;
}[] = [
  {
    icon: "activity",
    title: "Monitors",
    description: "Regularly monitor your website or API.",
  },
  {
    icon: "layout-dashboard",
    title: "Status Pages",
    description:
      "Create your own status page within seconds. Select your endpoints you wish to display.",
  },
  {
    icon: "siren",
    title: "Incidents",
    description: "Inform your users when something goes wrong.",
  },
  {
    icon: "toy-brick",
    title: "Integrations",
    description:
      "Create incident or received failure notification in the tools you already work with.",
  },
];

// TBD: if we need it at the beginning
export function Cards() {
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      {cardConfig.map(({ icon, title, description }, i) => {
        const Icon = Icons[icon];
        return (
          <Shell key={i}>
            <h3 className="font-cal mb-1 flex items-center text-xl">
              <Icon className="mr-2 h-4 w-4" /> {title}
            </h3>
            <p className="text-muted-foreground">{description}</p>
          </Shell>
        );
      })}
    </div>
  );
}
