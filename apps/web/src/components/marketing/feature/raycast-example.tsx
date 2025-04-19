import {
  Calculator,
  Calendar,
  CreditCard,
  Settings,
  Smile,
  User,
} from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@openstatus/ui";
import Image from "next/image";

const commands = [
  "Show Monitors",
  "Create Status Report",
  "Show Status Page",
  "Create Status Report Update",
  "Show Incidents",
];

export function RaycastExample() {
  return (
    <Command className="rounded-lg border shadow-md md:min-w-[450px]">
      <CommandInput placeholder="Search for apps and commands..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Commands">
          {commands.map((command) => (
            <CommandItem key={command}>
              <span className="relative mr-2">
                <Image
                  src="/icon.png"
                  alt="OpenStatus"
                  width={16}
                  height={16}
                />
              </span>
              <span>{command}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
