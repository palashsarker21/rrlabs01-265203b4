// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock is hoisted; put mock state inside vi.hoisted so factories can access it.
const h = vi.hoisted(() => {
  type ResendArgs = { type: string; email: string; options?: { emailRedirectTo?: string } };
  type UserResp = { data: { user: { email?: string; email_confirmed_at?: string } | null } };
  return {
    navigate: vi.fn(),
    resend: vi.fn<(args: ResendArgs) => Promise<{ error: Error | null }>>(),
    getUser: vi.fn<() => Promise<UserResp>>(),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
  };
});

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useNavigate: () => h.navigate,
    Link: ({ children, ...rest }: React.PropsWithChildren<Record<string, unknown>>) => (
      <a {...(rest as Record<string, unknown>)}>{children as React.ReactNode}</a>
    ),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      resend: h.resend,
      getUser: h.getUser,
      onAuthStateChange: h.onAuthStateChange,
    },
  },
}));

vi.mock("sonner", () => ({
  toast: { success: h.toastSuccess, error: h.toastError },
}));

vi.mock("@/components/brand-mark", () => ({ BrandMark: () => <div data-testid="brandmark" /> }));
vi.mock("@/components/auth/auth-footer", () => ({ AuthFooter: () => <div data-testid="footer" /> }));

const { navigate, resend, getUser, onAuthStateChange, toastSuccess, toastError } = h;

// Import AFTER mocks so the module picks them up.
import { VerifyEmailPage } from "./verify-email";

beforeEach(() => {
  resend.mockReset();
  getUser.mockReset();
  getUser.mockResolvedValue({ data: { user: { email: "jane@example.com" } } });
  onAuthStateChange.mockClear();
  navigate.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  // JSDOM: ensure a clean hash between tests
  window.location.hash = "";
});

afterEach(() => {
  cleanup();
});

async function renderPage() {
  render(<VerifyEmailPage />);
  // Wait for the async getUser() to resolve and populate the email field.
  await waitFor(() =>
    expect((screen.getByLabelText(/didn't get the email/i) as HTMLInputElement).value).toBe(
      "jane@example.com",
    ),
  );
}

describe("VerifyEmailPage — resend action", () => {
  it("shows a loading state while the request is in-flight and disables the input+button", async () => {
    // Hold the promise open so we can observe the loading state.
    let resolve!: (v: { error: null }) => void;
    resend.mockReturnValue(new Promise((r) => (resolve = r)));

    await renderPage();
    const user = userEvent.setup();
    const btn = screen.getByRole("button", { name: /resend email/i });
    const input = screen.getByLabelText(/didn't get the email/i) as HTMLInputElement;

    await user.click(btn);

    // Loading UI
    const sendingBtn = await screen.findByRole("button", { name: /sending/i });
    expect(sendingBtn).toBeDisabled();
    expect(input).toBeDisabled();

    await act(async () => {
      resolve({ error: null });
    });

    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        "Verification email sent. Check your inbox.",
      ),
    );
  });

  it("starts a 60-second cooldown after a successful send and prevents re-submit", async () => {
    vi.useFakeTimers();
    try {
      resend.mockResolvedValue({ error: null });

      render(<VerifyEmailPage />);
      // Advance microtasks for getUser().then(...)
      await act(async () => {
        await Promise.resolve();
      });

      const input = screen.getByLabelText(/didn't get the email/i) as HTMLInputElement;
      await waitFor(() => expect(input.value).toBe("jane@example.com"));

      const btn = screen.getByRole("button", { name: /resend email/i });

      await act(async () => {
        btn.click();
      });
      // Let the resolved promise flush.
      await act(async () => {
        await Promise.resolve();
      });

      // Cooldown label appears immediately.
      const cooldownBtn = await screen.findByRole("button", { name: /resend in 60s/i });
      expect(cooldownBtn).toBeDisabled();

      // Attempting to click during cooldown must NOT trigger another network call.
      resend.mockClear();
      await act(async () => {
        cooldownBtn.click();
      });
      expect(resend).not.toHaveBeenCalled();

      // Tick 1 second → label decrements.
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(
        screen.getByRole("button", { name: /resend in 59s/i }),
      ).toBeInTheDocument();

      // Fast-forward the remainder of the cooldown.
      await act(async () => {
        vi.advanceTimersByTime(60_000);
      });
      expect(
        screen.getByRole("button", { name: /resend email/i }),
      ).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("maps rate-limit errors to a plain retry message (status-safe)", async () => {
    resend.mockResolvedValue({ error: new Error("Email rate limit exceeded (429)") });

    await renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /resend email/i }));

    const msg = await screen.findByText(
      /too many requests\. please wait a moment and try again\./i,
    );
    expect(msg).toBeInTheDocument();
    expect(toastError).toHaveBeenCalledWith(
      "Too many requests. Please wait a moment and try again.",
    );
    // The real error string must not be exposed.
    expect(screen.queryByText(/429/)).toBeNull();
    expect(screen.queryByText(/rate limit exceeded/i)).toBeNull();
  });

  it("does not disclose account state on generic failures (status-safe fallback)", async () => {
    resend.mockResolvedValue({ error: new Error("User already confirmed") });

    await renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /resend email/i }));

    const safe = await screen.findByText(
      /if your account needs verification, a new link has been sent\./i,
    );
    expect(safe).toBeInTheDocument();
    // Provider's raw message must never reach the DOM or toast.
    expect(screen.queryByText(/already confirmed/i)).toBeNull();
    expect(toastError).toHaveBeenCalledWith(
      "If your account needs verification, a new link has been sent.",
    );
  });

  it("performs local email validation without a network call", async () => {
    await renderPage();
    const user = userEvent.setup();

    const input = screen.getByLabelText(/didn't get the email/i);
    await user.clear(input);
    await user.type(input, "not-an-email");
    await user.click(screen.getByRole("button", { name: /resend email/i }));

    expect(resend).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/enter a valid email address\./i),
    ).toBeInTheDocument();
  });

  it("posts to Supabase with signup type and same-origin redirect", async () => {
    resend.mockResolvedValue({ error: null });

    await renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /resend email/i }));

    await waitFor(() => expect(resend).toHaveBeenCalledTimes(1));
    const args = resend.mock.calls[0][0];
    expect(args.type).toBe("signup");
    expect(args.email).toBe("jane@example.com");
    expect(args.options?.emailRedirectTo).toBe(
      `${window.location.origin}/verify-email`,
    );
  });
});
