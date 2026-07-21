# verification/verify_bulk_update.py
from playwright.sync_api import sync_playwright
import os

def verify_bulk_update():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Go to http://localhost:5000/p/admin-productsm.html
        page.goto("http://localhost:5000/p/admin-productsm.html")

        # Bypass login via localStorage
        page.evaluate("""
            localStorage.setItem('admin_auth', JSON.stringify({
                auth: '1',
                password: 'test_password',
                expiry: Date.now() + 86400000 * 30
            }));
        """)

        # Reload page to apply session
        page.reload()
        page.wait_for_timeout(2000)

        # Click on the collapsible header to expand the Bulk Update section
        # The text is "التحديث الجماعي لأسعار ومدن المستودعات"
        page.click("text=التحديث الجماعي لأسعار ومدن المستودعات")
        page.wait_for_timeout(1000)

        # Take a screenshot
        os.makedirs("/home/jules/verification", exist_ok=True)
        screenshot_path = "/home/jules/verification/bulk_update.png"
        page.screenshot(path=screenshot_path, full_page=True)
        print(f"Screenshot taken at: {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    verify_bulk_update()
