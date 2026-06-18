"use client";

import { Badge } from "@openstatus/ui/components/ui/badge";
import { Button } from "@openstatus/ui/components/ui/button";
import { Checkbox } from "@openstatus/ui/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@openstatus/ui/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@openstatus/ui/components/ui/dialog";
import { ScrollArea } from "@openstatus/ui/components/ui/scroll-area";
import { cn } from "@openstatus/ui/lib/utils";
import { skipToken, useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { useState } from "react";

import { useTRPC } from "@/lib/trpc/client";

export type ThirdPartyEntry = {
  externalServiceId: number;
  externalServiceComponentId: number | null;
  name: string;
};

type SelectedService = { id: number; slug: string; name: string };

export function ThirdPartyPicker({
  open,
  onOpenChange,
  onAdd,
  existingKeys,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (entries: ThirdPartyEntry[]) => void;
  existingKeys: Set<string>;
}) {
  const trpc = useTRPC();
  const [service, setService] = useState<SelectedService | null>(null);
  const [checked, setChecked] = useState<Set<number | "all">>(new Set());

  const { data: services } = useQuery({
    ...trpc.externalService.grid.queryOptions(),
    enabled: open,
  });

  const { data: componentsResult, isLoading: componentsLoading } = useQuery(
    trpc.externalService.components.queryOptions(
      open && service ? { slug: service.slug } : skipToken,
    ),
  );

  function reset() {
    setService(null);
    setChecked(new Set());
  }

  function close() {
    reset();
    onOpenChange(false);
  }

  function toggle(key: number | "all") {
    setChecked((prev) => {
      if (prev.has(key)) {
        const next = new Set(prev);
        next.delete(key);
        return next;
      }
      // whole-service and specific components are mutually exclusive
      if (key === "all") return new Set<number | "all">(["all"]);
      const next = new Set(prev);
      next.delete("all");
      next.add(key);
      return next;
    });
  }

  function commit() {
    if (!service) return;
    const entries: ThirdPartyEntry[] = [];
    const components = componentsResult?.components ?? [];
    for (const key of checked) {
      if (key === "all") {
        entries.push({
          externalServiceId: service.id,
          externalServiceComponentId: null,
          name: service.name,
        });
      } else {
        const component = components.find((c) => c.id === key);
        if (component) {
          entries.push({
            externalServiceId: service.id,
            externalServiceComponentId: component.id,
            name: component.name,
          });
        }
      }
    }
    if (entries.length > 0) onAdd(entries);
    close();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {service ? service.name : "Add third-party service"}
          </DialogTitle>
          <DialogDescription>
            {service
              ? "Show the whole service or pick the components you depend on."
              : "Surface an upstream provider's status on your page."}
          </DialogDescription>
        </DialogHeader>

        {!service ? (
          <Command className="rounded-md border">
            <CommandInput placeholder="Search providers..." />
            <CommandList>
              <CommandEmpty>No providers found.</CommandEmpty>
              <ScrollArea className="h-72">
                {services?.map((s) => (
                  <CommandItem
                    key={s.slug}
                    value={s.name}
                    onSelect={() => {
                      setService({ id: s.id, slug: s.slug, name: s.name });
                      setChecked(new Set());
                    }}
                  >
                    {s.name}
                  </CommandItem>
                ))}
              </ScrollArea>
            </CommandList>
          </Command>
        ) : (
          <ScrollArea className="h-72">
            <div className="flex flex-col gap-2 pr-3">
              <ThirdPartyOption
                label="Whole service"
                description="Aggregated status across all components"
                checked={checked.has("all")}
                disabled={existingKeys.has(`${service.id}:all`)}
                onToggle={() => toggle("all")}
              />
              {componentsLoading ? (
                <p className="text-muted-foreground px-1 text-sm">Loading…</p>
              ) : null}
              {(componentsResult?.components ?? []).map((c) => (
                <ThirdPartyOption
                  key={c.id}
                  label={c.name}
                  description={c.groupName ?? undefined}
                  checked={checked.has(c.id)}
                  disabled={existingKeys.has(`${service.id}:${c.id}`)}
                  onToggle={() => toggle(c.id)}
                />
              ))}
              {!componentsLoading &&
              componentsResult &&
              !componentsResult.supported ? (
                <p className="text-muted-foreground px-1 text-sm">
                  This provider only exposes an overall status.
                </p>
              ) : null}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="sm:justify-between">
          {service ? (
            <Button type="button" variant="ghost" onClick={reset}>
              <ChevronLeft className="size-4" /> Back
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={commit}
              disabled={!service || checked.size === 0}
            >
              Add
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ThirdPartyOption({
  label,
  description,
  checked,
  disabled,
  onToggle,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && onToggle()}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-left",
        disabled ? "opacity-50" : "hover:bg-muted",
      )}
    >
      <Checkbox
        checked={disabled ? true : checked}
        disabled={disabled}
        tabIndex={-1}
        className="pointer-events-none"
      />
      <span className="flex flex-1 flex-col">
        <span className="text-sm">{label}</span>
        {description ? (
          <span className="text-muted-foreground text-xs">{description}</span>
        ) : null}
      </span>
      {disabled ? <Badge variant="secondary">Added</Badge> : null}
    </div>
  );
}
