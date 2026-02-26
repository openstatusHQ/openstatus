import type React from "react";
import { highlight } from "sugar-high";

export function Code({
  children,
  className,
  ...props
}: React.ComponentProps<"code">) {
  // Only apply syntax highlighting if a language is specified (className contains "language-")
  const hasLanguage = className?.includes("language-");

  if (hasLanguage) {
    const codeHTML = highlight(children?.toString() ?? "");
    return (
      <code
        // biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
        dangerouslySetInnerHTML={{ __html: codeHTML }}
        className={className}
        {...props}
      />
    );
  }

  // Plain code block without language - render as-is
  return (
    <code className={className} {...props}>
      {children}
    </code>
  );
}
