import { formatDistance } from "date-fns";
import * as z from "zod";

import { insertIncidentUpdateSchema } from "@openstatus/db/src/schema";

import { Icons } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { statusDict } from "@/data/incidents-dictionary";

const temporarySchema = insertIncidentUpdateSchema
  .pick({
    title: true,
    message: true,
    date: true,
  })
  .extend({
    monitors: z.number().array().min(1),
  });

type Props = z.infer<typeof temporarySchema>;

const message = "Hello World this is the reason of the incident...";
const date = 1691268078000;
const title = "investigating"; // status

const monitors = [
  {
    title: "Google",
    descriptions: "Is google down?",
  },
];

export function IncidentEvent() {
  const { icon, label } = statusDict[title];
  const Icon = Icons[icon];
  return (
    <div className="relative flex items-start">
      <div className="relative mr-3 px-1">
        <div className="bg-background border-border ring-background text-muted-foreground flex h-8 w-8 items-center justify-center rounded-full border ring-8">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>
      <div className="border-input relative -my-2 -ml-2 min-w-0 flex-1 rounded-md border p-2 pr-8">
        <Button size="icon" variant="ghost" className="absolute right-1 top-1">
          <Icons.pencil className="h-4 w-4" />
        </Button>
        <div className="flex">
          <div className="mr-1 flex h-8 items-center">
            <div className="bg-muted-foreground h-6 w-6 rounded-full" />
          </div>
          <div className="text-muted-foreground text-sm leading-7">
            <span className="mr-0.5">
              <span className="text-foreground font-semibold">mxkaske</span>{" "}
              created
            </span>{" "}
            <span className="mr-0.5">
              <Badge variant="outline">{label}</Badge>
            </span>{" "}
            <span className="whitespace-nowrap">
              {formatDistance(new Date(date), new Date())}
            </span>
          </div>
        </div>
        <p className="mt-0.5 text-sm">{message}</p>
      </div>
    </div>
  );
}
