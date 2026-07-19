// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, within } from "@testing-library/react";
import { SocialLinks } from "./social-links";
import { SOCIAL_PROFILES } from "@/lib/brand";

const ENABLED = SOCIAL_PROFILES.filter((p) => p.enabled && p.href);

describe("SocialLinks", () => {
  it("renders one link per enabled official profile (icons variant)", () => {
    const { container } = render(<SocialLinks />);
    const links = container.querySelectorAll("a");
    expect(links.length).toBe(ENABLED.length);
  });

  it("does not render any reserved (disabled) platforms", () => {
    const { container } = render(<SocialLinks />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    for (const p of SOCIAL_PROFILES.filter((x) => !x.enabled)) {
      expect(hrefs).not.toContain(p.href);
    }
  });

  it("opens every link in a new tab with rel='noopener noreferrer'", () => {
    const { container } = render(<SocialLinks />);
    const links = container.querySelectorAll("a");
    expect(links.length).toBeGreaterThan(0);
    links.forEach((a) => {
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")).toBe("noopener noreferrer");
    });
  });

  it("uses the exact official URLs from the brand registry", () => {
    const { container } = render(<SocialLinks />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    for (const p of ENABLED) {
      expect(hrefs).toContain(p.href);
    }
  });

  it("gives every link an accessible label mentioning 'new tab'", () => {
    const { container } = render(<SocialLinks />);
    container.querySelectorAll("a").forEach((a) => {
      const label = a.getAttribute("aria-label") ?? "";
      expect(label).toMatch(/opens in a new tab/i);
      expect(label.length).toBeGreaterThan("(opens in a new tab)".length);
    });
  });

  it("labels the group with the default aria-label", () => {
    const { container } = render(<SocialLinks />);
    expect(container.querySelector("ul")?.getAttribute("aria-label")).toBe(
      "Official social profiles",
    );
  });

  it("honors a custom ariaLabel", () => {
    const { container } = render(<SocialLinks ariaLabel="Follow us" />);
    expect(container.querySelector("ul")?.getAttribute("aria-label")).toBe("Follow us");
  });

  it("respects the platforms filter and renders in the given order", () => {
    const { container } = render(<SocialLinks platforms={["linkedin", "github", "x"]} />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    const linkedin = ENABLED.find((p) => p.platform === "linkedin")!.href;
    const github = ENABLED.find((p) => p.platform === "github")!.href;
    const x = ENABLED.find((p) => p.platform === "x")!.href;
    expect(hrefs).toEqual([linkedin, github, x]);
  });

  it("silently drops reserved platforms passed via filter", () => {
    const { container } = render(
      <SocialLinks platforms={["github", "producthunt", "medium"]} />,
    );
    const links = container.querySelectorAll("a");
    expect(links.length).toBe(1);
    expect(links[0].getAttribute("href")).toBe(
      ENABLED.find((p) => p.platform === "github")!.href,
    );
  });

  it("returns null when no profiles resolve", () => {
    const { container } = render(<SocialLinks platforms={["producthunt", "medium"]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders sr-only platform text in the icons variant", () => {
    const { container } = render(<SocialLinks />);
    const srTexts = Array.from(container.querySelectorAll("a .sr-only")).map((el) =>
      el.textContent?.trim(),
    );
    for (const p of ENABLED) {
      expect(srTexts).toContain(p.label);
    }
  });

  it("list variant shows the platform label and hostname visibly", () => {
    const { container } = render(<SocialLinks variant="list" />);
    const links = container.querySelectorAll("a");
    expect(links.length).toBe(ENABLED.length);
    for (const p of ENABLED) {
      const anchor = Array.from(links).find((a) => a.getAttribute("href") === p.href)!;
      expect(anchor).toBeTruthy();
      const { getByText } = within(anchor as HTMLElement);
      expect(getByText(p.label)).toBeTruthy();
      expect(getByText(p.href.replace(/^https?:\/\//, ""))).toBeTruthy();
      expect(anchor.getAttribute("target")).toBe("_blank");
      expect(anchor.getAttribute("rel")).toBe("noopener noreferrer");
    }
  });

  it("marks decorative icons with aria-hidden so screen readers skip them", () => {
    const { container } = render(<SocialLinks />);
    container.querySelectorAll("a > svg").forEach((svg) => {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
    });
  });
});
