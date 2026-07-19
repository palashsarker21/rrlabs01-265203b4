// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { SocialLinks } from "./social-links";

describe("SocialLinks snapshots", () => {
  afterEach(() => cleanup());

  it("matches the icons variant snapshot", () => {
    const { container } = render(<SocialLinks />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("matches the list variant snapshot", () => {
    const { container } = render(<SocialLinks variant="list" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("matches the icons variant with a custom className", () => {
    const { container } = render(<SocialLinks className="justify-center gap-6" />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
