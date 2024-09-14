"use client";

import { Check, ChevronsUpDown, Edit2 } from "lucide-react";
import * as React from "react";

import type { MonitorTag } from "@openstatus/db/src/schema";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openstatus/ui";

import { Icons } from "@/components/icons";
import { LoadingAnimation } from "@/components/loading-animation";
import { TagBadge } from "@/components/monitor/tag-badge";
import { toastAction } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/client";

const colors = [
  "#ff5c5c", // Red
  "#6fcf97", // Green
  "#70a1ff", // Blue
  "#ffb74d", // Orange
  "#b19cd9", // Violet
  "#7986cb", // Indigo
  "#64b5f6", // Turquoise
  "#ffee58", // Yellow
  "#f06292", // Pink
  "#ff77ff", // Fuchsia
  "#808080", // Gray
];

interface TagsMultiBoxProps {
  tags?: MonitorTag[];
  values: number[]; // values from the form
  onChange: (values: number[]) => void;
}

export function TagsMultiBox({
  tags: defaultTags = [],
  values,
  onChange,
}: TagsMultiBoxProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [tags, setTags] = React.useState<MonitorTag[]>(defaultTags);
  const [openCombobox, setOpenCombobox] = React.useState(false);
  const [openDialog, setOpenDialog] = React.useState(false);
  const [inputValue, setInputValue] = React.useState<string>("");

  const create = async (name: string) => {
    try {
      const randomIndex = Math.floor(Math.random() * colors.length);
      const newTag = await api.monitorTag.create.mutate({
        name: name.trim(),
        color: colors[randomIndex] || "#808080", // gray as default
      });
      toastAction("saved");
      setTags((prev) => [...prev, newTag]);
      // TODO: seems like the new value is not taken into account....
      // That's mainly because we only update the id, and not the name! Same is for the update() function
      onChange([...values, newTag.id]);
    } catch {
      toastAction("error");
    }
  };

  const toggle = (item: MonitorTag) => {
    onChange(
      values?.includes(item.id)
        ? values.filter((v) => v !== item.id)
        : [...values, item.id],
    );
    inputRef?.current?.focus();
  };

  const update = async (tag: MonitorTag) => {
    try {
      const updateTag = await api.monitorTag.update.mutate(tag);
      if (!updateTag) return;
      setTags((prev) => prev.map((f) => (f.id === tag.id ? updateTag : f)));
      toastAction("saved");
    } catch {
      toastAction("error");
    }
  };

  const _delete = async (item: MonitorTag) => {
    try {
      await api.monitorTag.delete.mutate({ id: item.id });
      setTags((prev) => prev.filter((f) => f.id !== item.id));
      onChange(values?.filter((v) => v !== item.id));
      toastAction("deleted");
    } catch {
      toastAction("error");
    }
  };

  const onComboboxOpenChange = (value: boolean) => {
    inputRef.current?.blur(); // HACK: otherwise, would scroll automatically to the bottom of page
    setOpenCombobox(value);
  };

  return (
    <div className="w-full">
      <Popover open={openCombobox} onOpenChange={onComboboxOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={openCombobox}
            className="h-auto w-full justify-between text-foreground"
          >
            <span className="flex flex-wrap gap-2 truncate">
              {values.length > 0
                ? values.map((id) => {
                    const tag = tags.find((tag) => tag.id === id);
                    return tag ? <TagBadge key={tag.id} {...tag} /> : null;
                  })
                : "Select tags"}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command className="w-[var(--radix-popover-trigger-width)]" loop>
            <CommandInput
              ref={inputRef}
              placeholder="Search tag..."
              value={inputValue}
              onValueChange={setInputValue}
            />
            <CommandList>
              <CommandGroup className="max-h-[145px] overflow-auto">
                {tags.map((item) => {
                  const isActive = values?.includes(item.id);
                  return (
                    <CommandItem
                      key={item.id}
                      value={item.name}
                      onSelect={() => toggle(item)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          isActive ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <div className="flex-1">{item.name}</div>
                      <div
                        className="h-4 w-4 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                    </CommandItem>
                  );
                })}
                <CommandItemCreate
                  onSelect={() => create(inputValue)}
                  {...{ inputValue, tags }}
                />
              </CommandGroup>
              <CommandSeparator alwaysRender />
              <CommandGroup>
                <CommandItem
                  value={`:${inputValue}:`} // HACK: that way, the edit button will always be shown
                  className="text-muted-foreground text-xs"
                  onSelect={() => setOpenDialog(true)}
                >
                  <div className={cn("mr-2 h-4 w-4")} />
                  <Edit2 className="mr-2 h-2.5 w-2.5" />
                  Edit tags
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Dialog
        open={openDialog}
        onOpenChange={(open) => {
          if (!open) setOpenCombobox(true);
          setOpenDialog(open);
        }}
      >
        <DialogContent className="flex max-h-[90vh] flex-col">
          <DialogHeader>
            <DialogTitle>Edit Tags</DialogTitle>
            <DialogDescription>
              Update or delete tags. Create a tag through the combobox.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-scroll">
            {tags.map((item) => {
              return (
                <DialogListItem
                  key={item.id}
                  onDelete={() => _delete(item)}
                  onSubmit={async (values) => {
                    await update({
                      ...item,
                      ...values,
                    });
                  }}
                  {...item}
                />
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const CommandItemCreate = ({
  inputValue,
  tags,
  onSelect,
}: {
  inputValue: string;
  tags: MonitorTag[];
  onSelect: () => Promise<void>;
}) => {
  const [isPending, startTransition] = React.useTransition();
  const hasNoTag = !tags
    .map(({ name }) => name.toLowerCase())
    .includes(`${inputValue.toLowerCase()}`);

  const render = inputValue !== "" && hasNoTag;

  if (!render) return null;

  // BUG: whenever a space is appended, the Create-Button will not be shown.
  return (
    <CommandItem
      key={`${inputValue}`}
      value={`${inputValue}`}
      className="text-muted-foreground text-xs"
      onSelect={() => {
        startTransition(async () => {
          await onSelect();
        });
      }}
      disabled={isPending}
    >
      <div className={cn("mr-2 h-4 w-4")} />
      {isPending ? "Creating" : "Create"} new label &quot;{inputValue}&quot;
    </CommandItem>
  );
};

const DialogListItem = ({
  id,
  name,
  color,
  onSubmit,
  onDelete,
}: MonitorTag & {
  onSubmit: (values: { name: string; color: string }) => Promise<void>;
  onDelete: () => Promise<void>;
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [accordionValue, setAccordionValue] = React.useState<string>("");
  const [inputValue, setInputValue] = React.useState<string>(name);
  const [colorValue, setColorValue] = React.useState<string>(color);
  const [isPending, startTransition] = React.useTransition();
  const disabled = name === inputValue && color === colorValue;

  React.useEffect(() => {
    if (accordionValue !== "") {
      inputRef.current?.focus();
    }
  }, [accordionValue]);

  // const handleSubmit = () => {}
  // const handleDelete = () => {}

  return (
    <Accordion
      key={id}
      type="single" // will never work as we have only one accordion for each tag
      collapsible
      value={accordionValue}
      onValueChange={setAccordionValue}
    >
      <AccordionItem value={`item-${id}`}>
        <AccordionTrigger className="w-full hover:no-underline">
          <TagBadge color={color} name={name} />
        </AccordionTrigger>
        <AccordionContent>
          {/* REMINDER: cannot nest form within form! HOTFIX: no form */}
          <div className="flex items-end gap-4 px-1">
            <div className="grid w-full gap-3">
              <Label htmlFor="name">Label name</Label>
              <Input
                ref={inputRef}
                id="name"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="h-8"
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="color">Color</Label>
              <Input
                id="color"
                type="color"
                value={colorValue}
                onChange={(e) => setColorValue(e.target.value)}
                className="h-8 px-2 py-1"
              />
            </div>
            {/* FIXME: shouldnt saves the monitor form */}
            <Button
              onClick={() => {
                startTransition(() => {
                  onSubmit({
                    name: inputValue.trim(),
                    color: colorValue,
                  });
                  setAccordionValue("");
                });
              }}
              disabled={disabled || isPending}
            >
              {isPending ? <LoadingAnimation /> : "Save"}
            </Button>
            <div className="flex items-center gap-4">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="icon"
                    variant="destructive"
                    disabled={isPending}
                  >
                    <Icons.trash className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure sure?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div>
                        You are about to delete the tag{" "}
                        <TagBadge color={color} name={name} /> .
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        startTransition(async () => {
                          await onDelete();
                        });
                      }}
                    >
                      {isPending ? <LoadingAnimation /> : "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};
