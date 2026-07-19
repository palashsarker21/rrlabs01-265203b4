// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import axe from "axe-core";
import { SocialLinks } from "./social-links";

async function runAxe(node: HTMLElement) {
  return axe.run(node, {
    resultTypes: ["violations"],
    rules: {
      // region rule requires a landmark on the whole page; not relevant for an isolated component test
      region: { enabled: false },
    },
  });
}

describe("SocialLinks accessibility (axe-core)", () => {
  it("has no axe violations in the default (icons) variant", async () => {
    const { container } = render(
      <main>
        <SocialLinks />
      </main>,
    );
    const results = await runAxe(container);
    expect(
      results.violations,
      results.violations.map((v) => `${v.id}: ${v.help}`).join("\n"),
    ).toEqual([]);
  });

  it("has no axe violations in the list variant", async () => {
    const { container } = render(
      <main>
        <SocialLinks variant="list" />
      </main>,
    );
    const results = await runAxe(container);
    expect(
      results.violations,
      results.violations.map((v) => `${v.id}: ${v.help}`).join("\n"),
    ).toEqual([]);
  });

  it("every link exposes an accessible name and is keyboard-focusable", () => {
    const { container } = render(<SocialLinks />);
    const links = Array.from(container.querySelectorAll("a"));
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) {
      const name =
        a.getAttribute("aria-label") ??
        a.getAttribute("aria-labelledby") ??
        a.textContent?.trim() ??
        "";
      expect(name.length, `link ${a.getAttribute("href")} has no accessible name`).toBeGreaterThan(0);
      const tabindex = a.getAttribute("tabindex");
      expect(tabindex === null || Number(tabindex) >= 0).toBe(true);
    }
  });
});
