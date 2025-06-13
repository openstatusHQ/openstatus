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
    <div className="flex min-h-screen flex-col font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-1 flex-col items-center justify-center gap-12">
        <div className="flex flex-col items-center gap-2 p-4">
          <Badge variant="secondary">Coming soon</Badge>
          <h1 className="max-w-xl text-center font-bold text-2xl sm:text-3xl">
            Welcome to the OpenStatus-Template
          </h1>
          <p className="max-w-[38rem] text-center text-foreground/70 text-sm sm:text-base">
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
            <span className="font-medium text-foreground">(BYO router)</span>.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="relative flex max-w-[320px] items-center gap-2 font-mono text-foreground/70 text-xs transition-all duration-300 ease-in-out sm:max-w-[620px]"
          onClick={() => {
            const url = `pnpm dlx shadcn@latest add ${BASE_URL}/r/${selected}`;
            copy(url, {
              successMessage: `Copied ${selected} url to clipboard.`,
            });
          }}
        >
          <div className="block truncate sm:hidden">
            pnpm dlx shadcn@latest add {BASE_URL}/r/{selected}
          </div>
          <div className="hidden items-center sm:flex">
            pnpm dlx shadcn@latest add {BASE_URL}/r/
            <WheelPicker
              items={REGISTRY_ITEMS}
              currentIndex={currentIndex}
              onIndexChange={setCurrentIndex}
              className="h-6 w-[120px]"
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
      <footer className="flex items-center justify-center gap-4 border-border border-t p-4">
        <p className="text-center text-foreground/70">
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
