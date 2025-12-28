"use client";

import Editor from "@/components/theme-editor/editor";
import { Suspense } from "react";

export default function ThemeEditorPage() {
  return (
    <main className="mx-auto">
      <div className="mx-auto w-full space-y-8 ">
        <Suspense>
          <Editor />
        </Suspense>
      </div>
    </main>
  );
}
