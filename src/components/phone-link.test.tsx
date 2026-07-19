// @vitest-environment jsdom
/// <reference types="vitest-axe/extend-expect" />
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as axeMatchers from "vitest-axe/matchers";
import { axe } from "vitest-axe";

expect.extend(axeMatchers);

import { PhoneLink, PhoneList } from "@/components/phone-link";
import { CONTACT_PHONES, type PhoneEntry } from "@/lib/brand";

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const primary: PhoneEntry = {
  number: "+8801323405346",
  label: "Primary",
  kind: "primary",
  ariaLabel: "Call +8801323405346",
};

const whatsapp: PhoneEntry = {
  number: "+8801934857886",
  label: "WhatsApp Business",
  kind: "whatsapp",
  ariaLabel: "Call WhatsApp Business +8801934857886",
};

afterEach(() => {
  cleanup();
  toastSuccess.mockReset();
  toastError.mockReset();
  vi.restoreAllMocks();
});

describe("PhoneLink", () => {
  it("renders a tel: link with the exact aria-label from the entry", () => {
    render(<PhoneLink entry={primary} />);
    const link = screen.getByRole("link", { name: primary.ariaLabel });
    expect(link).toHaveAttribute("href", `tel:${primary.number}`);
    expect(link).toHaveTextContent(primary.number);
  });

  it("uses tel: even for the WhatsApp entry (dialer + long-press handoff)", () => {
    render(<PhoneLink entry={whatsapp} />);
    const link = screen.getByRole("link", { name: whatsapp.ariaLabel });
    expect(link).toHaveAttribute("href", `tel:${whatsapp.number}`);
  });

  it("renders the WhatsApp Business badge only for whatsapp entries", () => {
    const { rerender } = render(<PhoneLink entry={primary} />);
    expect(screen.queryByLabelText("WhatsApp Business")).toBeNull();

    rerender(<PhoneLink entry={whatsapp} />);
    const badge = screen.getByLabelText("WhatsApp Business");
    expect(badge).toHaveTextContent(/WhatsApp Business/i);
  });

  it("exposes an accessible copy button labelled with the number", () => {
    render(<PhoneLink entry={primary} />);
    const btn = screen.getByRole("button", { name: `Copy ${primary.number}` });
    expect(btn).toHaveAttribute("type", "button");
  });

  it("copies the number via navigator.clipboard and toasts success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<PhoneLink entry={primary} />);
    await userEvent.click(
      screen.getByRole("button", { name: `Copy ${primary.number}` }),
    );

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(primary.number));
    expect(toastSuccess).toHaveBeenCalledWith("Phone number copied.");
    expect(toastError).not.toHaveBeenCalled();
  });

  it("falls back to document.execCommand when clipboard API is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });

    render(<PhoneLink entry={whatsapp} />);
    await userEvent.click(
      screen.getByRole("button", { name: `Copy ${whatsapp.number}` }),
    );

    await waitFor(() => expect(execCommand).toHaveBeenCalledWith("copy"));
    expect(toastSuccess).toHaveBeenCalledWith("Phone number copied.");
  });

  it("surfaces an error toast when clipboard write throws", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new Error("denied")),
      },
    });

    render(<PhoneLink entry={primary} />);
    await userEvent.click(
      screen.getByRole("button", { name: `Copy ${primary.number}` }),
    );

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Could not copy phone number."),
    );
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("has no detectable axe violations for either entry kind", async () => {
    const { container: c1 } = render(<PhoneLink entry={primary} />);
    expect(await axe(c1)).toHaveNoViolations();
    cleanup();

    const { container: c2 } = render(<PhoneLink entry={whatsapp} />);
    expect(await axe(c2)).toHaveNoViolations();
  });
});

describe("PhoneList", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("renders one <li> per CONTACT_PHONES entry inside a <ul>", () => {
    render(<PhoneList />);
    const list = screen.getByRole("list");
    const items = screen.getAllByRole("listitem");
    expect(list.tagName).toBe("UL");
    expect(items).toHaveLength(CONTACT_PHONES.length);
  });

  it("renders a tel: link and copy button for every registered phone", () => {
    render(<PhoneList />);
    for (const p of CONTACT_PHONES) {
      const link = screen.getByRole("link", { name: p.ariaLabel });
      expect(link).toHaveAttribute("href", `tel:${p.number}`);
      expect(
        screen.getByRole("button", { name: `Copy ${p.number}` }),
      ).toBeInTheDocument();
    }
  });

  it("renders the WhatsApp Business badge exactly once when a whatsapp entry exists", () => {
    render(<PhoneList />);
    const badges = screen.queryAllByLabelText("WhatsApp Business");
    const expected = CONTACT_PHONES.filter((p) => p.kind === "whatsapp").length;
    expect(badges).toHaveLength(expected);
  });

  it("has no detectable axe violations", async () => {
    const { container } = render(<PhoneList />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
