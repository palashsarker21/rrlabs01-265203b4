"""End-to-end test: phone-number copy button — clipboard + a11y announcement.

Loads /contact, clicks the "Copy <number>" button for each contact phone,
and verifies:

  1. Clipboard receives the exact E.164 number.
  2. A sonner toast appears with text "Phone number copied.".
  3. The toast is announced to assistive tech:
       - It lives inside a Sonner region element carrying `aria-live`
         (`polite` or `assertive`).
       - The toast itself exposes `role="status"` (or `role="alert"`) so
         screen readers pick it up as a live announcement.
       - The toast is not `aria-hidden`.

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


async def click_copy_and_verify(page, number: str, shot_prefix: str):
    # Reset clipboard so the assertion is unambiguous.
    await page.evaluate("navigator.clipboard.writeText('')")

    button = page.get_by_role("button", name=f"Copy {number}").first
    await expect(button).to_be_visible()
    await button.scroll_into_view_if_needed()
    await button.click()

    # --- 1. Clipboard has the number ---------------------------------------
    # Poll briefly — the click handler is async.
    clipboard = ""
    for _ in range(20):
        clipboard = await page.evaluate("navigator.clipboard.readText()")
        if clipboard == number:
            break
        await page.wait_for_timeout(50)
    assert clipboard == number, (
        f"clipboard mismatch for {number}: expected {number!r}, got {clipboard!r}"
    )

    # --- 2. Toast is rendered with the exact copy --------------------------
    toast = page.locator("[data-sonner-toast]").filter(has_text=TOAST_TEXT).first
    await expect(toast).to_be_visible()

    # --- 3. Announced to screen readers ------------------------------------
    # (a) The Sonner region wrapping toasts must carry aria-live.
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
        f"expected Sonner region to have aria-live=polite|assertive, got {region_live!r}"
    )

    # (b) The toast itself is exposed as a live status/alert.
    role = await toast.get_attribute("role")
    assert role in ("status", "alert"), (
        f"expected toast role=status|alert, got {role!r}"
    )

    # (c) The toast is not hidden from AT.
    aria_hidden = await toast.get_attribute("aria-hidden")
    assert aria_hidden in (None, "false"), (
        f"toast must not be aria-hidden, got aria-hidden={aria_hidden!r}"
    )

    # (d) The announced text contains the user-facing message.
    text = (await toast.inner_text()).strip()
    assert TOAST_TEXT in text, f"toast text missing announcement: {text!r}"

    await page.screenshot(path=str(SCREENSHOTS / f"{shot_prefix}_copy_{number}.png"))

    # Dismiss so the next assertion starts clean.
    await page.evaluate(
        """
        () => document.querySelectorAll('[data-sonner-toast]').forEach(t => t.remove())
        """
    )


async def main() -> int:
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 1800},
        )
        await context.grant_permissions(
            ["clipboard-read", "clipboard-write"], origin=BASE
        )
        page = await context.new_page()

        await page.goto(f"{BASE}/contact", wait_until="domcontentloaded")
        await expect(page.get_by_role("button", name=f"Copy {PRIMARY}").first).to_be_visible()

        for n in NUMBERS:
            await click_copy_and_verify(page, n, "contact")

        # Also verify the same behavior on the footer PhoneList on the home page.
        await page.goto(BASE, wait_until="domcontentloaded")
        footer_button = page.get_by_role("button", name=f"Copy {PRIMARY}").first
        await footer_button.scroll_into_view_if_needed()
        await click_copy_and_verify(page, PRIMARY, "footer")

        await browser.close()
        return 0


if __name__ == "__main__":
    try:
        sys.exit(asyncio.run(main()))
    except AssertionError as e:
        print(f"FAIL: {e}", file=sys.stderr)
        sys.exit(1)
