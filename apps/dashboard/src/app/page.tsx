"use client";

import { Link } from "@/components/common/link";
import {
  WheelPicker,
  WheelPickerSelect,
  WheelPickerOptions,
} from "@/components/common/wheel-picker";
import { GitHubIcon } from "@/components/icons/github";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { CheckIcon, CopyIcon } from "lucide-react";
import NextLink from "next/link";
import { useState } from "react";

const BASE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://template.openstatus.dev";

const REGISTRY_ITEMS = [
  "metric-card.json",
  "action-card.json",
  "form-card.json",
  "section.json",
  "empty-state.json",
];

const DEFAULT_INDEX = 2;

export default function Home() {
  const { copy, isCopied } = useCopyToClipboard();
  const [currentIndex, setCurrentIndex] = useState(DEFAULT_INDEX);
  const selected = REGISTRY_ITEMS[currentIndex];
  return (
    <div className="font-[family-name:var(--font-geist-sans)] min-h-screen flex flex-col">
      <main className="flex-1 flex flex-col gap-12 justify-center items-center">
        <div className="flex flex-col items-center gap-2 p-4">
          <Badge variant="secondary">Coming soon</Badge>
          <h1 className="text-center text-2xl sm:text-3xl font-bold max-w-xl">
            Welcome to the OpenStatus-Template
          </h1>
          <p className="text-foreground/70 text-sm sm:text-base text-center max-w-[38rem]">
            We&apos;ve created this template to help you get started with your{" "}
            <Link
              href="https://ui.shadcn.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              @shadcn/ui
            </Link>{" "}
            project. It uses{" "}
            <Link
              href="https://nextjs.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              @nextjs
            </Link>{" "}
            in an SPA mode and can be exported statically{" "}
            <span className="text-foreground font-medium">(BYO router)</span>.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="relative text-xs text-foreground/70 font-mono flex items-center gap-2 max-w-[320px] sm:max-w-[620px] transition-all duration-300 ease-in-out"
          onClick={() => {
            const url = `pnpm dlx shadcn@latest add ${BASE_URL}/r/${selected}`;
            copy(url, {
              successMessage: `Copied ${selected} url to clipboard.`,
            });
          }}
        >
          <div className="block sm:hidden truncate">
            pnpm dlx shadcn@latest add {BASE_URL}/r/{selected}
          </div>
          <div className="hidden sm:flex items-center">
            pnpm dlx shadcn@latest add {BASE_URL}/r/
            <WheelPicker
              items={REGISTRY_ITEMS}
              currentIndex={currentIndex}
              onIndexChange={setCurrentIndex}
              className="w-[120px] h-6"
            >
              <WheelPickerSelect>
                <WheelPickerOptions />
              </WheelPickerSelect>
            </WheelPicker>
          </div>
          {isCopied ? (
            <CheckIcon className="shrink-0" />
          ) : (
            <CopyIcon className="shrink-0" />
          )}
        </Button>
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" asChild>
            <NextLink
              href="https://github.com/openstatusHQ/openstatus-template"
              target="_blank"
              rel="noopener noreferrer"
            >
              <GitHubIcon />
              GitHub
            </NextLink>
          </Button>
          <Button size="sm" asChild>
            <NextLink href="/dashboard/onboarding">Dashboard</NextLink>
          </Button>
        </div>
      </main>
      <footer className="flex items-center justify-center gap-4 border-t border-border p-4">
        <p className="text-foreground/70 text-center">
          Powered by{" "}
          <Link
            href="https://openstatus.dev"
            target="_blank"
            rel="noopener noreferrer"
          >
            OpenStatus
          </Link>
        </p>
        <ThemeToggle />
      </footer>
    </div>
  );
}
