// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SocialLinks } from "./social-links";
import { ENABLED_SOCIAL_PROFILES } from "@/lib/brand";

const VARIANTS = ["icons", "list"] as const;

afterEach(() => cleanup());

describe.each(VARIANTS)("SocialLinks a11y — %s variant", (variant) => {
  it("exposes a labelled group landmark", () => {
    render(<SocialLinks variant={variant} ariaLabel="Follow RRLabs" />);
    // The <ul> carries the group's accessible name.
    expect(screen.getByLabelText("Follow RRLabs")).toBeTruthy();
  });

  it("renders one link per enabled profile with an accessible name that includes the label and new-tab hint", () => {
    render(<SocialLinks variant={variant} />);
    const list = screen.getByRole("list");
    const links = within(list).getAllByRole("link");
    expect(links.length).toBe(ENABLED_SOCIAL_PROFILES.length);

    for (const link of links) {
      const name = link.getAttribute("aria-label") ?? "";
      // Names must be non-empty, mention "opens in a new tab", and match
      // one of the curated platform labels — no generic "link" names.
      expect(name.length).toBeGreaterThan(0);
      expect(name).toMatch(/opens in a new tab/i);
      const matchesProfile = ENABLED_SOCIAL_PROFILES.some((p) => name.startsWith(p.label));
      expect(matchesProfile, `unexpected accessible name: ${name}`).toBe(true);

      // New-tab links must be safe.
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel") ?? "").toMatch(/noopener/);
      expect(link.getAttribute("rel") ?? "").toMatch(/noreferrer/);
    }
  });

  it("keeps every link in the natural tab order (no negative/positive tabindex)", () => {
    render(<SocialLinks variant={variant} />);
    const links = within(screen.getByRole("list")).getAllByRole("link");
    for (const link of links) {
      const ti = link.getAttribute("tabindex");
      // Absent = natural order (0). Explicit positive values break tab
      // sequencing; explicit negative values remove the link from the
      // tab order entirely.
      expect(ti === null || ti === "0").toBe(true);
    }
  });

  it("applies a visible focus ring via the design-system token", () => {
    render(<SocialLinks variant={variant} />);
    const links = within(screen.getByRole("list")).getAllByRole("link");
    for (const link of links) {
      const cls = link.className;
      expect(cls).toMatch(/focus-visible:ring-2/);
      expect(cls).toMatch(/focus-visible:ring-ring/);
      expect(cls).toMatch(/focus-visible:outline-none/);
    }
  });

  it("moves focus across every link with Tab and back with Shift+Tab", async () => {
    const user = userEvent.setup();
    render(<SocialLinks variant={variant} />);
    const links = within(screen.getByRole("list")).getAllByRole("link");

    // Baseline: nothing in the group has focus yet.
    expect(links.some((l) => l === document.activeElement)).toBe(false);

    for (let i = 0; i < links.length; i++) {
      await user.tab();
      expect(document.activeElement, `Tab #${i + 1} should focus link ${i}`).toBe(links[i]);
    }

    // Walk focus back to the first link with Shift+Tab.
    for (let i = links.length - 1; i > 0; i--) {
      await user.tab({ shift: true });
      expect(document.activeElement).toBe(links[i - 1]);
    }
  });

  it("activates the focused link via keyboard (Enter fires the link)", async () => {
    const user = userEvent.setup();
    render(<SocialLinks variant={variant} />);
    const [first] = within(screen.getByRole("list")).getAllByRole("link");

    // Intercept navigation so jsdom doesn't complain about opening a new tab.
    let opened: string | null = null;
    const originalOpen = window.open;
    window.open = ((url?: string | URL) => {
      opened = String(url ?? "");
      return null;
    }) as typeof window.open;

    let defaultPrevented = false;
    first.addEventListener("click", (e) => {
      // jsdom does not follow anchors, but we still capture the click to
      // verify keyboard activation reached the link.
      defaultPrevented = true;
      e.preventDefault();
    });

    await user.tab();
    expect(document.activeElement).toBe(first);
    await user.keyboard("{Enter}");

    window.open = originalOpen;
    expect(defaultPrevented || opened !== null).toBe(true);
  });

  it("hides decorative icons from assistive tech", () => {
    const { container } = render(<SocialLinks variant={variant} />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    svgs.forEach((svg) => {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
    });
  });
});
