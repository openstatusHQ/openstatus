import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CopyMarkdown } from "./copy-markdown";
import { describe, it, expect, vi } from "vitest";

// @vitest-environment jsdom

describe("CopyMarkdown", () => {
  it("copies markdown to clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText,
      },
    });

    render(<CopyMarkdown markdown="# Test Markdown" />);

    const button = screen.getByRole("button", { name: /copy markdown/i });
    fireEvent.click(button);

    expect(writeText).toHaveBeenCalledWith("# Test Markdown");
    
    await waitFor(() => {
      expect(screen.getByText("Copied")).toBeInTheDocument();
    });
  });
});
