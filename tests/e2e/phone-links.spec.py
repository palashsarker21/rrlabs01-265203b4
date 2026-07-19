"""End-to-end tests for phone-number interactions.

Loads /contact and the footer on / and verifies:
  * The primary and WhatsApp Business numbers render as `tel:` links.
  * Clicking each number triggers a dialer navigation (tel: href).
  * Clicking the "Copy <number>" button shows the sonner success toast
    with the exact text "Phone number copied.".

Run: `python3 tests/e2e/phone-links.spec.py` while the dev server is
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

# Capture tel: link activations without letting the browser attempt the
# external protocol navigation (which is blocked in headless Chromium).
TEL_INTERCEPT = """
window.__telClicks = [];
document.addEventListener('click', (e) => {
  const a = e.target && e.target.closest && e.target.closest('a[href^="tel:"]');
  if (a) {
    e.preventDefault();
    window.__telClicks.push(a.getAttribute('href'));
  }
}, true);
"""


async def verify_tel_click(page, number: str, shot_name: str):
    await page.evaluate("window.__telClicks = []")
    # Multiple copies may exist (e.g., footer + section); pick the first
    # anchor whose text contains the number.
    link = page.locator(f'a[href="tel:{number}"]').first
    await expect(link).to_be_visible()
    await link.scroll_into_view_if_needed()
    await link.click()
    clicks = await page.evaluate("window.__telClicks")
    assert clicks == [f"tel:{number}"], f"expected [tel:{number}], got {clicks}"
    await page.screenshot(path=str(SCREENSHOTS / shot_name))


async def verify_copy_toast(page, number: str, shot_name: str):
    prior = await page.locator("[data-sonner-toast]").count()
    button = page.get_by_role("button", name=f"Copy {number}").first
    await expect(button).to_be_visible()
    await button.scroll_into_view_if_needed()
    await button.click()
    # Wait for a NEW toast to be added, then assert its text matches.
    await page.wait_for_function(
        "prior => document.querySelectorAll('[data-sonner-toast]').length > prior",
        arg=prior,
        timeout=5000,
    )
    toast = page.locator("[data-sonner-toast]").last
    await expect(toast).to_have_text(TOAST_TEXT, timeout=3000)
    await page.screenshot(path=str(SCREENSHOTS / shot_name))
    copied = await page.evaluate("navigator.clipboard.readText()")
    assert copied == number, f"clipboard mismatch: expected {number}, got {copied!r}"


async def run_page(context, path: str, slug: str):
    page = await context.new_page()
    await page.add_init_script(TEL_INTERCEPT)
    await page.goto(f"{BASE}{path}", wait_until="domcontentloaded")
    await page.wait_for_load_state("networkidle")

    # If we're testing the footer on `/`, scroll it into view first so
    # the phone anchors are mounted and interactable.
    if path == "/":
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await page.wait_for_timeout(300)

    for number in NUMBERS:
        await verify_tel_click(page, number, f"{slug}-tel-{number}.png")
        await verify_copy_toast(page, number, f"{slug}-copy-{number}.png")

    await page.close()
    print(f"OK  {path}: verified tel: + copy toast for both numbers")


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 1800},
            permissions=["clipboard-read", "clipboard-write"],
        )
        # Contact page uses PhoneList; home footer uses PhoneList inside
        # marketing-chrome. Both must satisfy the same assertions.
        await run_page(context, "/contact", "contact")
        await run_page(context, "/", "footer")
        await browser.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except AssertionError as e:
        print(f"FAIL {e}", file=sys.stderr)
        sys.exit(1)
