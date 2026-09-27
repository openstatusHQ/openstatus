"use client";

import { Check, Code } from "@openstatus/icons";
import {
  type ParsedThemeInput,
  type Theme,
  type ThemeMode,
  parseThemeInput,
} from "@openstatus/theme-store";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@openstatus/ui/components/ui/dialog";
import { Textarea } from "@openstatus/ui/components/ui/textarea";
import { useTheme } from "next-themes";
import { useState } from "react";
import { toast } from "sonner";

import { useThemeBuilder } from "./theme-builder-provider";

function applyParsedTheme(theme: Theme, parsed: ParsedThemeInput): Theme {
  if (parsed.partial) {
    return {
      ...theme,
      ...parsed.info,
      light: { ...theme.light, ...parsed.definition.light },
      dark: { ...theme.dark, ...parsed.definition.dark },
    };
  }
  return { ...theme, ...parsed.info, ...parsed.definition };
}

/** Applies a pasted theme (JSON, `.ts` file, CSS or bare declarations) to the builder. */
export function ThemePasteDialog(props: React.ComponentProps<typeof Button>) {
  const { setTheme } = useThemeBuilder();
  const { resolvedTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const mode: ThemeMode = resolvedTheme === "dark" ? "dark" : "light";

  function apply() {
    const result = parseThemeInput(text, mode);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setTheme((prev) => applyParsedTheme(prev, result));
    if (result.warnings.length > 0) {
      toast.warning(
        `Applied with ${result.warnings.length} skipped ${
          result.warnings.length === 1 ? "entry" : "entries"
        }`,
        { description: result.warnings[0] },
      );
    } else {
      toast.success("Theme applied");
    }
    setOpen(false);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setText("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button {...props}>
          <Code className="size-4" />
          Paste
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Paste a theme</DialogTitle>
          <DialogDescription>
            JSON or the TypeScript theme file, as your agent or the copy button
            produced it. <code>:root</code> / <code>.dark</code> CSS blocks work
            too, and bare <code>--name: value;</code> lines apply to the {mode}{" "}
            mode.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`{\n  "id": "my-theme",\n  "name": "My Theme",\n  "light": { "--primary": "oklch(0.6 0.1 250)" },\n  "dark": { "--primary": "oklch(0.8 0.1 250)" }\n}`}
          // no ligatures — Geist Mono merges "--" into a single long-dash glyph
          className="field-sizing-fixed h-64 font-mono text-xs [font-variant-ligatures:none]"
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={text.trim().length === 0}>
            <Check className="size-4" />
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
