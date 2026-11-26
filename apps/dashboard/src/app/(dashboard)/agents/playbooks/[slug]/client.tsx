"use client";

import {
  PLAYBOOK_DESCRIPTION_MAX_CHARS,
  PLAYBOOK_MAX_CHARS,
  PLAYBOOK_TITLE_MAX_CHARS,
  type PlaybookSlug,
  playbookDefaultDescription,
  playbookDefaultTitle,
} from "@openstatus/db/src/schema/playbooks/constants";
import {
  PLAYBOOK_VARIABLE_VALUE_MAX_CHARS,
  type PlaybookVariables,
  playbookVariableNames,
  renderPlaybook,
} from "@openstatus/db/src/schema/playbooks/variables";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@openstatus/ui/components/ui/alert-dialog";
import { Button } from "@openstatus/ui/components/ui/button";
import { cn } from "@openstatus/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { HoverCardTimestamp } from "@/components/common/hover-card-timestamp";
import { StatusDot } from "@/components/common/status-dot";
import {
  Composer,
  ComposerActions,
  ComposerFooter,
  ComposerPreview,
  ComposerPreviewToggle,
  ComposerTextarea,
} from "@/components/content/composer";
import {
  DetailActions,
  DetailAside,
  DetailContent,
  DetailDescription,
  DetailHeader,
  DetailInput,
  DetailMain,
  DetailSection,
  DetailSectionTitle,
  DetailTitle,
  DetailTitleRow,
} from "@/components/content/detail";
import {
  Property,
  PropertyInput,
  PropertyLabel,
  PropertyList,
  PropertyValue,
} from "@/components/content/property-list";
import { SectionGroup } from "@/components/content/section";
import { PlaybookRowActions } from "@/components/data-table/playbooks/data-table-row-actions";
import { playbookTemplate, playbookUsedFor } from "@/data/playbooks.client";
import { formatDistanceToNowShort } from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";
import { errorMessage } from "@/lib/trpc/error";

type Heading = { title?: string; description?: string };

export function Client({ slug }: { slug: PlaybookSlug }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: playbook } = useQuery(trpc.playbook.get.queryOptions({ slug }));
  // null = pristine: the editor follows the server copy, so a background
  // refetch never clobbers unsaved edits.
  const [draft, setDraft] = useState<string | null>(null);
  const template = playbookTemplate[slug];
  // An empty slot opens on the template, which can be saved as is.
  const server = playbook?.content ?? template;
  const content = draft ?? server;
  // same rule as the text: null follows the server copy
  const [values, setValues] = useState<PlaybookVariables | null>(null);
  const serverValues = playbook?.variables ?? {};
  const variables = values ?? serverValues;
  // Edits made before the playbook exists; they go with the first Save.
  const [heading, setHeading] = useState<Heading>({});
  const title = heading.title ?? playbook?.title ?? playbookDefaultTitle[slug];
  const description =
    heading.description ||
    playbook?.description ||
    playbookDefaultDescription[slug];
  const [descriptionResets, setDescriptionResets] = useState(0);

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: trpc.playbook.get.queryKey({ slug }),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.playbook.list.queryKey(),
      }),
    ]).then(() => {
      setDraft(null);
      setValues(null);
      setHeading({});
    });
  const onError = (error: unknown) => {
    toast.error(errorMessage(error));
  };

  const save = useMutation(
    trpc.playbook.save.mutationOptions({
      onSuccess: () => {
        toast.success("Playbook saved");
        return refresh();
      },
      onError,
    }),
  );
  // The heading and a value save on their own, like the properties of an incident; the text does not.
  const saveProperty = useMutation(
    trpc.playbook.save.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: trpc.playbook.pathKey() }),
      onError,
    }),
  );
  // Only for a variable the saved text already uses; one that exists only in
  // unsaved text goes with Save, since the server drops values the text does not use.
  const saveValue = (name: string) => {
    if (!playbook || !playbookVariableNames(playbook.content).includes(name)) {
      return;
    }
    const value = (variables[name] ?? "").trim();
    if (value === (serverValues[name] ?? "")) return;
    saveProperty.mutate({
      slug,
      content: playbook.content,
      variables: { ...serverValues, [name]: value },
    });
  };
  const saveHeading = (patch: Heading) => {
    // emptied, the description goes back to the default: remount to show it
    if (patch.description === "") setDescriptionResets((n) => n + 1);
    if (!playbook) return setHeading({ ...heading, ...patch });
    saveProperty.mutate({
      slug,
      content: playbook.content,
      variables: serverValues,
      ...patch,
    });
  };

  // The default tab depends on the server copy; mounting earlier would pin it.
  if (playbook === undefined) return null;

  const names = playbookVariableNames(content);
  const rendered = renderPlaybook(content, variables);
  // the cap counts what the agent reads: the text with its variables filled in
  const length = rendered.trim().length;
  const tooLong = length > PLAYBOOK_MAX_CHARS;
  const dirty =
    (draft !== null && draft.trim() !== server) ||
    names.some(
      (name) =>
        (variables[name] ?? "").trim() !== (serverValues[name] ?? "").trim(),
    );
  const busy = save.isPending;
  const canSave = !busy && (dirty || !playbook) && length > 0 && !tooLong;
  const submit = () => save.mutate({ slug, content, variables, ...heading });

  const status = dirty
    ? { label: "Unsaved changes", variant: "warning" as const }
    : playbook
      ? { label: "Written", variant: "success" as const }
      : { label: "Template, not saved", variant: "default" as const };

  return (
    <SectionGroup>
      <DetailHeader>
        <DetailTitleRow>
          <DetailTitle>
            <DetailInput
              aria-label="Title"
              required
              maxLength={PLAYBOOK_TITLE_MAX_CHARS}
              disabled={saveProperty.isPending}
              value={title}
              onCommit={(title) => saveHeading({ title })}
            />
          </DetailTitle>
          {playbook ? (
            <DetailActions>
              <PlaybookRowActions slug={slug} written edit={false} />
            </DetailActions>
          ) : null}
        </DetailTitleRow>
        <DetailDescription>
          <DetailInput
            key={descriptionResets}
            multiline
            aria-label="Description"
            maxLength={PLAYBOOK_DESCRIPTION_MAX_CHARS}
            disabled={saveProperty.isPending}
            value={description}
            onCommit={(description) => saveHeading({ description })}
          />
        </DetailDescription>
      </DetailHeader>
      <DetailContent>
        <DetailMain>
          <Composer size="lg" defaultValue={playbook ? "preview" : "write"}>
            <ComposerTextarea
              aria-label={`${title} playbook`}
              className="max-h-[60vh] overflow-y-auto"
              value={content}
              onChange={(e) => setDraft(e.target.value)}
              onSubmit={canSave ? submit : undefined}
            />
            <ComposerPreview
              // values as inline code, so the preview shows where a variable was filled in
              value={renderPlaybook(content, variables, (value) =>
                value.includes("`") ? value : `\`${value}\``,
              )}
              className="max-h-[60vh] overflow-y-auto"
            />
            <ComposerFooter>
              {/* px-2 like a ghost control so the text sits on the text column */}
              <span
                className={cn("px-2 font-mono", tooLong && "text-destructive")}
              >
                {length.toLocaleString("en-US")} /{" "}
                {PLAYBOOK_MAX_CHARS.toLocaleString("en-US")}
              </span>
              <ComposerActions>
                <ComposerPreviewToggle />
                <div className="flex items-center gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || content.trim() === template}
                      >
                        Reset template
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Reset to the template?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          The text in the editor is replaced by the default
                          template. Nothing is saved until you click Save.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => setDraft(template)}>
                          Reset
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button size="sm" disabled={!canSave} onClick={submit}>
                    Save
                  </Button>
                </div>
              </ComposerActions>
            </ComposerFooter>
          </Composer>
        </DetailMain>
        <DetailAside>
          <DetailSection id="properties">
            <DetailSectionTitle>Properties</DetailSectionTitle>
            <PropertyList>
              <Property>
                <PropertyLabel>Status</PropertyLabel>
                <PropertyValue>
                  <StatusDot variant={status.variant} />
                  <span className="truncate">{status.label}</span>
                </PropertyValue>
              </Property>
              <Property>
                <PropertyLabel>Used for</PropertyLabel>
                <PropertyValue>
                  <span className="truncate">{playbookUsedFor[slug]}</span>
                </PropertyValue>
              </Property>
              <Property>
                <PropertyLabel>Last edited</PropertyLabel>
                <PropertyValue>
                  {playbook ? (
                    <HoverCardTimestamp date={playbook.updatedAt} side="left">
                      <span>
                        {formatDistanceToNowShort(playbook.updatedAt)}
                      </span>
                    </HoverCardTimestamp>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </PropertyValue>
              </Property>
              <Property>
                <PropertyLabel>Edited by</PropertyLabel>
                <PropertyValue>
                  <span className="truncate">
                    {playbook?.updatedByUser?.name ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </span>
                </PropertyValue>
              </Property>
              <Property>
                <PropertyLabel>Created by</PropertyLabel>
                <PropertyValue>
                  <span className="truncate">
                    {playbook?.createdByUser?.name ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </span>
                </PropertyValue>
              </Property>
            </PropertyList>
          </DetailSection>
          <DetailSection id="variables">
            <DetailSectionTitle>Variables</DetailSectionTitle>
            {names.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Write <code className="font-mono">{"{{name}}"}</code> in the
                text to add a variable, then set its value here.
              </p>
            ) : (
              <PropertyList>
                {names.map((name) => (
                  <Property key={name}>
                    <PropertyLabel className="font-mono" title={name}>
                      {name}
                    </PropertyLabel>
                    <PropertyValue>
                      <PropertyInput
                        aria-label={name}
                        placeholder="Not set"
                        maxLength={PLAYBOOK_VARIABLE_VALUE_MAX_CHARS}
                        value={variables[name] ?? ""}
                        onChange={(e) =>
                          setValues({ ...variables, [name]: e.target.value })
                        }
                        onBlur={() => saveValue(name)}
                      />
                    </PropertyValue>
                  </Property>
                ))}
              </PropertyList>
            )}
          </DetailSection>
        </DetailAside>
      </DetailContent>
    </SectionGroup>
  );
}
