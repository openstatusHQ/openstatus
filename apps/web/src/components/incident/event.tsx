import { format } from "date-fns";
import * as z from "zod";

import { insertIncidentUpdateSchema } from "@openstatus/db/src/schema";

import { ActionButton } from "@/app/app/(dashboard)/[workspaceSlug]/incidents/_components/action-button";
import { Icons } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { statusDict } from "@/data/incidents-dictionary";
import { Container } from "../dashboard/container";

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

const message =
  "Hello World this is the reason of the incident. Forests on wetlands and pine forests on sandy dry areas are characteristic of the Spree Forest region. Grasslands and fields can be found as well.";
const date = 1691268078000;
const title = "investigating"; // status

const monitors = [
  {
    title: "Google",
    description: "Is google down?",
  },
  {
    title: "Hello",
    description: "Is hello really down?",
  },
];

const MessageIcon = Icons["message-circle"];

// { title, date, message }: Props
export function IncidentEvent() {
  const { icon, label } = statusDict[title];
  const Icon = Icons[icon];
  return (
    <Container
      title={
        <span className="inline-flex items-center">
          {label}
          <span className="bg-muted border-border ring-background text-foreground ml-2 flex items-center justify-center rounded-full border p-1 ring-8">
            <Icon className="h-4 w-4" />
          </span>
        </span>
      }
      // could use a description in the dict
    >
      <ActionButton id={1} workspaceSlug="prickly-summer" /> {/* TODO: */}
      <div className="grid gap-3">
        <div className="flex space-x-3">
          <Icons.calendar className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
          <p className="text-sm font-light">
            {format(new Date(date), "LLL dd, y HH:mm")}
          </p>
        </div>
        <div className="flex space-x-3">
          <MessageIcon className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
          <p className="text-sm">{message}</p>
        </div>
        <div className="flex space-x-3">
          <Icons.activity className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
          <div className="grid gap-2">
            {monitors.map(({ title, description }, i) => (
              <div key={i} className="text-sm">
                <p>{title}</p>
                <p className="text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Container>
  );
}
