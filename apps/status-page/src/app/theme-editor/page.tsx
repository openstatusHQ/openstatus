"use client";

import Editor from "@/components/theme-editor/editor";

export default function ThemeEditorPage() {
  // No theme loading - user starts fresh or uses presets
  const themePromise = Promise.resolve(null);

  return (
    <div className="h-screen">
      <Editor themePromise={themePromise} />
    </div>
  );
}


