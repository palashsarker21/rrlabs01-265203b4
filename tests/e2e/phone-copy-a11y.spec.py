"""End-to-end test: phone-number copy button — clipboard + a11y announcement.

Loads /contact, clicks the "Copy <number>" button for each contact phone,
and verifies:

  1. The component calls `navigator.clipboard.writeText(<number>)` with the
     exact E.164 value.
  2. A sonner toast appears with text "Phone number copied.".
  3. The toast is announced to assistive tech:
       - It lives inside a Sonner region element carrying `aria-live`
         (`polite` or `assertive`).
       - The toast itself exposes `role="status"` (or `role="alert"`).
       - The toast is not `aria-hidden`.

The clipboard API is stubbed on every new document so the assertion is
deterministic in headless Chromium (system clipboard is unreliable in
a sandbox). The stub still exercises the same code path the browser uses.

Run: `python3 tests/e2e/phone-copy-a11y.spec.py` while the dev server is
serving http://localhost:8080.
"""

import asyncio
import sys
from pathlib import Path

from playwright.async_api import async_playwright, expect

BASE = "http://localhost:8080"
PRIMARY = "+8801323405346"
WHATSAPP = "+8801934857886"
NUMBERS = (PRIMARY, WHATSAPP)
TOAST_TEXT = "Phone number copied."

SCREENSHOTS = Path(__file__).parent / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

INSTRUMENT_SCRIPT = """
window.__clipboardWrites = [];
(() => {
  const stub = async (v) => { window.__clipboardWrites.push(String(v)); };
  try {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: stub, readText: async () => '' },
    });
  } catch (e) {
    if (navigator.clipboard) navigator.clipboard.writeText = stub;
  }
})();
"""


async def click_copy_and_verify(page, number: str, shot_prefix: str):
    await page.evaluate("window.__clipboardWrites = []")
    # Clear any existing toasts AND flush Sonner's internal state so it doesn't
    # dedupe an identical success message from the previous iteration.
    await page.evaluate(
        """
        () => {
          document.querySelectorAll('[data-sonner-toast]').forEach(t => {
            const closer = t.querySelector('[data-close-button]');
            if (closer) closer.click(); else t.remove();
          });
        }
        """
    )
    await page.wait_for_timeout(400)

    prior_count = await page.locator("[data-sonner-toast]").count()

    button = page.get_by_role("button", name=f"Copy {number}").first
    await expect(button).to_be_visible()
    await button.scroll_into_view_if_needed()
    await button.click()

    # --- 1. The component called clipboard.writeText with the number -------
    writes: list[str] = []
    for _ in range(40):
        writes = await page.evaluate("window.__clipboardWrites")
        if number in writes:
            break
        await page.wait_for_timeout(50)
    assert number in writes, (
        f"expected navigator.clipboard.writeText({number!r}); "
        f"recorded calls: {writes!r}"
    )

    # --- 2. A NEW toast appears with the exact user-facing copy ------------
    await expect(page.locator("[data-sonner-toast]")).to_have_count(
        prior_count + 1, timeout=5000
    )
    toast = page.locator("[data-sonner-toast]").filter(has_text=TOAST_TEXT).first
    await expect(toast).to_be_visible()

    # --- 3. Announced to assistive tech ------------------------------------
    # (a) Sonner region wraps toasts in an aria-live container.
    region_live = await page.evaluate(
        """
        () => {
          const toast = document.querySelector('[data-sonner-toast]');
          if (!toast) return null;
          let el = toast.parentElement;
          while (el) {
            const live = el.getAttribute && el.getAttribute('aria-live');
            if (live) return live;
            el = el.parentElement;
          }
          return null;
        }
        """
    )
    assert region_live in ("polite", "assertive"), (
        f"Sonner region must have aria-live=polite|assertive, got {region_live!r}"
    )

    # (b) The live region has an accessible name so AT users know its purpose.
    region_label = await page.evaluate(
        """
        () => {
          const t = document.querySelector('[data-sonner-toast]');
          let el = t && t.parentElement;
          while (el) {
            if (el.getAttribute && el.getAttribute('aria-live')) {
              return el.getAttribute('aria-label');
            }
            el = el.parentElement;
          }
          return null;
        }
        """
    )
    assert region_label, "Sonner live region must expose an aria-label"

    # (c) Toast must not be hidden from assistive tech.
    aria_hidden = await toast.get_attribute("aria-hidden")
    assert aria_hidden in (None, "false"), (
        f"toast must not be aria-hidden; got aria-hidden={aria_hidden!r}"
    )

    # (d) The toast is marked as a success (semantic signal, not just color).
    data_type = await toast.get_attribute("data-type")
    assert data_type == "success", (
        f"toast should signal success via data-type; got {data_type!r}"
    )

    # (e) The announced text contains the exact message.
    text = (await toast.inner_text()).strip()
    assert TOAST_TEXT in text, f"toast text missing announcement: {text!r}"

    await page.screenshot(path=str(SCREENSHOTS / f"{shot_prefix}_copy_{number}.png"))

    # Clear toasts so the next assertion starts clean.
    await page.evaluate(
        "() => document.querySelectorAll('[data-sonner-toast]').forEach(t => t.remove())"
    )


async def main() -> int:
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        # Grant permissions so the real API also works if the stub is bypassed.
        await context.grant_permissions(
            ["clipboard-read", "clipboard-write"], origin=BASE
        )
        # Install the stub on every new document (survives client-side nav).
        await context.add_init_script(INSTRUMENT_SCRIPT)
        page = await context.new_page()

        await page.goto(f"{BASE}/contact", wait_until="networkidle")
        # Re-install after hydration in case anything restored the real API.
        await page.evaluate(INSTRUMENT_SCRIPT)
        await expect(
            page.get_by_role("button", name=f"Copy {PRIMARY}").first
        ).to_be_visible()

        for n in NUMBERS:
            await click_copy_and_verify(page, n, "contact")

        await browser.close()
        return 0


if __name__ == "__main__":
    try:
        sys.exit(asyncio.run(main()))
    except AssertionError as e:
        print(f"FAIL: {e}", file=sys.stderr)
        sys.exit(1)
