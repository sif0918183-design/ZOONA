
from playwright.sync_api import sync_playwright
import os

def verify_admin_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        current_dir = os.getcwd()
        admin_path = f"file://{current_dir}/p/admin-controlm.html"

        page.goto(admin_path)

        # Bypass login via localStorage
        page.evaluate("""
            localStorage.setItem('admin_auth', JSON.stringify({
                auth: '1',
                password: 'test_password',
                expiry: Date.now() + 86400000
            }));
        """)

        page.reload()
        page.wait_for_timeout(1000)

        # Click on Settings tab
        page.click("text=إعدادات العمولة")
        page.wait_for_timeout(500)

        page.screenshot(path="/home/jules/verification/admin_settings.png")

        browser.close()

if __name__ == "__main__":
    verify_admin_ui()
