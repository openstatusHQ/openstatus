import type { ColorFormat } from "@/components/theme-editor/types";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePreferencesStore } from "@/store/preferences-store";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { ScrollArea, ScrollBar } from "../ui/scroll-area";
import { CodeBlock } from "./code-block";
import type { ThemeEditorState } from "./types/editor";
import {
  generateTailwindConfigCode,
  generateThemeCode,
} from "./utils/theme-style-generator";

interface CodePanelProps {
  themeEditorState: ThemeEditorState;
}

const CodePanel: React.FC<CodePanelProps> = ({ themeEditorState }) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("index.css");

  const colorFormat = usePreferencesStore((state) => state.colorFormat);
  const tailwindVersion = usePreferencesStore((state) => state.tailwindVersion);
  const setColorFormat = usePreferencesStore((state) => state.setColorFormat);
  const setTailwindVersion = usePreferencesStore(
    (state) => state.setTailwindVersion,
  );
  const getAvailableColorFormats = usePreferencesStore(
    (state) => state.getAvailableColorFormats,
  );

  const code = generateThemeCode(
    themeEditorState,
    colorFormat,
    tailwindVersion,
  );
  const configCode = generateTailwindConfigCode(themeEditorState, colorFormat);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex-none">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Theme Code</h2>
        </div>
      </div>
      <div className="mb-4 flex items-center gap-2">
        <Select
          value={tailwindVersion}
          onValueChange={(value: "3" | "4") => {
            setTailwindVersion(value);
            if (value === "4" && colorFormat === "hsl") {
              setColorFormat("oklch");
              setActiveTab("index.css");
            }
          }}
        >
          <SelectTrigger className="bg-muted/50 w-fit gap-1 border-none outline-hidden focus:border-none focus:ring-transparent">
            <SelectValue className="focus:ring-transparent" />
          </SelectTrigger>
          <SelectContent className="z-99999">
            <SelectItem value="3">Tailwind v3</SelectItem>
            <SelectItem value="4">Tailwind v4</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={colorFormat}
          onValueChange={(value: ColorFormat) => setColorFormat(value)}
        >
          <SelectTrigger className="bg-muted/50 w-fit gap-1 border-none outline-hidden focus:border-none focus:ring-transparent">
            <SelectValue className="focus:ring-transparent" />
          </SelectTrigger>
          <SelectContent className="z-99999">
            {getAvailableColorFormats().map((colorFormat) => (
              <SelectItem key={colorFormat} value={colorFormat}>
                {colorFormat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        defaultValue="index.css"
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border"
      >
        <div className="bg-muted/50 flex flex-none items-center justify-between border-b px-4 py-2">
          <TabsList className="h-8 bg-transparent p-0">
            <TabsTrigger
              value="index.css"
              className="h-7 px-3 text-sm font-medium"
            >
              index.css
            </TabsTrigger>
            {tailwindVersion === "3" && (
              <TabsTrigger
                value="tailwind.config.ts"
                className="h-7 px-3 text-sm font-medium"
              >
                tailwind.config.ts
              </TabsTrigger>
            )}
          </TabsList>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                copyToClipboard(activeTab === "index.css" ? code : configCode)
              }
              className="h-8"
              aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
            >
              {copied ? (
                <>
                  <Check className="size-4" />
                  <span className="sr-only md:not-sr-only">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="size-4" />
                  <span className="sr-only md:not-sr-only">Copy</span>
                </>
              )}
            </Button>
          </div>
        </div>

        <TabsContent value="index.css" className="overflow-hidden">
          <ScrollArea className="relative h-full">
            <CodeBlock
              code={code}
              language="css"
              className="h-full rounded-none border-0"
            />
            <ScrollBar orientation="horizontal" />
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        </TabsContent>

        {tailwindVersion === "3" && (
          <TabsContent value="tailwind.config.ts" className="overflow-hidden">
            <ScrollArea className="relative h-full">
              <CodeBlock
                code={configCode}
                language="typescript"
                className="h-full rounded-none border-0"
              />
              <ScrollBar orientation="horizontal" />
              <ScrollBar orientation="vertical" />
            </ScrollArea>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default CodePanel;
