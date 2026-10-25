import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ButtonCopyMarkdown } from "./button-copy-markdown";

describe("ButtonCopyMarkdown", () => {
  it("renders with accessible visible copy markdown text without duplicate sr-only label", () => {
    const html = renderToStaticMarkup(
      <ButtonCopyMarkdown markdown="# Test markdown" />,
    );
    expect(html).toContain("Copy markdown");
    expect(html).not.toContain("sr-only");
  });

  it("renders with initial copy icon and correct button role", () => {
    const html = renderToStaticMarkup(
      <ButtonCopyMarkdown markdown="Sample markdown" />,
    );
    expect(html).toMatch(/<button [^>]*type="button"/);
  });

  it("copies markdown to clipboard and shows success state on click", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText,
      },
    });

    render(<ButtonCopyMarkdown markdown="# Test markdown content" />);

    const button = screen.getByRole("button", { name: /copy markdown/i });
    fireEvent.click(button);

    expect(writeText).toHaveBeenCalledWith("# Test markdown content");
    
    // Check for success state (e.g. text changing to "Copied" or similar based on component implementation)
    expect(await screen.findByText(/copied/i)).toBeInTheDocument();
  });
});
