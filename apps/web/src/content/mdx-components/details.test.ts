import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";
import { renderToStaticMarkup } from "react-dom/server";

import { Details } from "./details";

const render = (props: Parameters<typeof Details>[0]) =>
  renderToStaticMarkup(Details(props));

describe("Details", () => {
  test("renders a plain summary by default", () => {
    expect(render({ summary: "What is openstatus?", children: "A" })).toBe(
      '<details id="what-is-openstatus"><summary>What is openstatus?</summary>A</details>',
    );
  });

  test("renders the summary as a heading when asked", () => {
    const html = render({
      summary: "What is openstatus?",
      children: "A",
      headingLevel: 3,
    });
    expect(html).toContain("<summary><h3>What is openstatus?</h3></summary>");
  });

  test("keeps the anchor id stable across both forms", () => {
    const plain = render({
      summary: "Do you offer annual billing?",
      children: "A",
    });
    const heading = render({
      summary: "Do you offer annual billing?",
      children: "A",
      headingLevel: 3,
    });
    const id = 'id="do-you-offer-annual-billing"';
    expect(plain).toContain(id);
    expect(heading).toContain(id);
  });
});
