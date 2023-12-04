import { useTransition } from "react";
import { usePathname } from "next/navigation";

import type { Workspace } from "@openstatus/db/src/schema";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui";

// TODO: currently, we do prop drill from layout.tsx to here
// any better way?

export function SelectWorkspace({ workspaces }: { workspaces: Workspace[] }) {
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();

  function onChange(value: string) {
    startTransition(async () => {
      const id = workspaces.find((w) => w.slug === value)?.id;
      console.log({ id, value });
      if (!id) return;
      if (typeof window !== undefined) {
        // HARD RELOAD
        window.location.href = `/app/${value}/monitors`;
      }
      return;
    });
  }

  // get the second part of the pathname as `workspaceSlug`
  const value = pathname?.split("/")?.[2];

  console.log(value);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a workspace" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Workspace</SelectLabel>
          {workspaces.map(({ slug, id }) => (
            <SelectItem key={id} value={slug}>
              {slug}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
