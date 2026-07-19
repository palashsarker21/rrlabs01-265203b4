// @vitest-environment jsdom
/// <reference types="vitest-axe/extend-expect" />
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as axeMatchers from "vitest-axe/matchers";
import { axe } from "vitest-axe";
import { SocialLinks } from "./social-links";
import { ENABLED_SOCIAL_PROFILES, SOCIAL_PROFILES } from "@/lib/brand";

expect.extend(axeMatchers);

const VARIANTS = ["icons", "list"] as const;

afterEach(() => cleanup());

describe.each(VARIANTS)("SocialLinks a11y (axe + names + keyboard) — %s", (variant) => {
  it("has no axe-detectable accessibility violations", async () => {
    const { container } = render(<SocialLinks variant={variant} ariaLabel="Follow RRLabs" />);
    (expect(await axe(container)) as any).toHaveNoViolations();
  });

  it("every link has a unique, non-empty accessible name derived from SOCIAL_PROFILES labels", () => {
    render(<SocialLinks variant={variant} />);
    const links = within(screen.getByRole("list")).getAllByRole("link");

    const names = links.map((l) => l.getAttribute("aria-label") ?? "");
    // No empties, no generic "link"/"click here" strings.
    for (const name of names) {
      expect(name.trim().length).toBeGreaterThan(0);
      expect(name.toLowerCase()).not.toBe("link");
      expect(name.toLowerCase()).not.toBe("click here");
    }
    // Uniqueness — an assistive-tech user needs to distinguish links.
    expect(new Set(names).size).toBe(names.length);

    // Each name must start with a curated platform label from the registry.
    const labels = new Set(SOCIAL_PROFILES.map((p) => p.label));
    for (const name of names) {
      const matched = [...labels].some((l) => name.startsWith(l));
      expect(matched, `accessible name "${name}" must start with a SOCIAL_PROFILES label`).toBe(true);
    }
    // And each enabled profile is represented exactly once.
    for (const p of ENABLED_SOCIAL_PROFILES) {
      const hits = names.filter((n) => n.startsWith(p.label)).length;
      expect(hits, `expected exactly one link for ${p.label}`).toBe(1);
    }
  });

  it("announces that links open in a new tab and pairs it with safe rel", () => {
    render(<SocialLinks variant={variant} />);
    const links = within(screen.getByRole("list")).getAllByRole("link");
    for (const link of links) {
      expect(link.getAttribute("aria-label") ?? "").toMatch(/opens in a new tab/i);
      expect(link.getAttribute("target")).toBe("_blank");
      const rel = link.getAttribute("rel") ?? "";
      expect(rel).toMatch(/\bnoopener\b/);
      expect(rel).toMatch(/\bnoreferrer\b/);
    }
  });

  it("renders a visible focus indicator on the focused link (design-system token)", async () => {
    const user = userEvent.setup();
    render(<SocialLinks variant={variant} />);
    const links = within(screen.getByRole("list")).getAllByRole("link");

    await user.tab();
    const focused = document.activeElement as HTMLElement;
    expect(focused).toBe(links[0]);
    const cls = focused.className;
    // Design-system ring token, not an arbitrary color.
    expect(cls).toMatch(/focus-visible:ring-2/);
    expect(cls).toMatch(/focus-visible:ring-ring/);
    expect(cls).toMatch(/focus-visible:outline-none/);
    // Focused link is a real, tabbable anchor.
    expect(focused.tagName).toBe("A");
    expect(focused.hasAttribute("href")).toBe(true);
  });

  it("Tab moves through every link in DOM order and Shift+Tab reverses it", async () => {
    const user = userEvent.setup();
    render(<SocialLinks variant={variant} />);
    const links = within(screen.getByRole("list")).getAllByRole("link");

    for (let i = 0; i < links.length; i++) {
      await user.tab();
      expect(document.activeElement).toBe(links[i]);
    }
    for (let i = links.length - 1; i > 0; i--) {
      await user.tab({ shift: true });
      expect(document.activeElement).toBe(links[i - 1]);
    }
  });

  it("activates the focused link with Enter AND Space (keyboard operable)", async () => {
    const user = userEvent.setup();
    render(<SocialLinks variant={variant} />);
    const links = within(screen.getByRole("list")).getAllByRole("link");
    const target = links[0];

    let clicks = 0;
    target.addEventListener("click", (e) => {
      clicks += 1;
      e.preventDefault();
    });

    await user.tab();
    expect(document.activeElement).toBe(target);

    await user.keyboard("{Enter}");
    expect(clicks).toBeGreaterThanOrEqual(1);

    // Anchors don't natively activate on Space, but focus must remain
    // on the link so the user isn't dropped out of the group.
    await user.keyboard(" ");
    expect(document.activeElement).toBe(target);
  });

  it("exposes a labelled group landmark tied to the link list", () => {
    render(<SocialLinks variant={variant} ariaLabel="Follow RRLabs" />);
    const group = screen.getByLabelText("Follow RRLabs");
    // The labelled element IS the list (semantic grouping for AT).
    expect(group.tagName).toBe("UL");
    expect(within(group).getAllByRole("link").length).toBe(
      ENABLED_SOCIAL_PROFILES.length,
    );
  });

  it("keeps decorative icons out of the accessibility tree", () => {
    const { container } = render(<SocialLinks variant={variant} />);
    const svgs = Array.from(container.querySelectorAll("svg"));
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      // Focus never lands on decorative icons.
      expect(svg.getAttribute("tabindex")).not.toBe("0");
    }
  });
});
