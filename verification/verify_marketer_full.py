
from playwright.sync_api import sync_playwright
import os

def verify_marketer_full():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        current_dir = os.getcwd()
        dashboard_path = f"file://{current_dir}/p/blog-page_57.html"

        # Navigate first so origin is established
        page.goto(dashboard_path)

        # Now set localStorage
        page.evaluate("""
            localStorage.setItem('affiliate_session', JSON.stringify({
                id: 'jules1234',
                name: 'Jules Test',
                email: 'jules@example.com',
                loginTime: new Date().toISOString()
            }));
        """)

        # Reload to apply session
        page.reload()
        page.wait_for_timeout(2000)

        # Scroll down to see the links
        page.evaluate("window.scrollTo(0, 700)")
        page.screenshot(path="/home/jules/verification/marketer_links.png")

        browser.close()

if __name__ == "__main__":
    verify_marketer_full()
