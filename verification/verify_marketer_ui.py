
from playwright.sync_api import sync_playwright
import os
import time

def verify_marketer_dashboard():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Get absolute path to the file
        current_dir = os.getcwd()
        dashboard_path = f"file://{current_dir}/p/blog-page_57.html"

        print(f"Navigating to {dashboard_path}")
        page.goto(dashboard_path)

        # Wait for the page to load
        page.wait_for_timeout(1000)

        # Take a screenshot of the login page
        page.screenshot(path="/home/jules/verification/marketer_login.png")

        # Mocking the session in localStorage to bypass login
        page.evaluate("""
            localStorage.setItem('affiliate_session', JSON.stringify({
                id: 'jules1234',
                name: 'Jules Test',
                email: 'jules@example.com',
                loginTime: new Date().toISOString()
            }));
        """)

        # Reload to trigger the dashboard view
        page.reload()
        page.wait_for_timeout(2000)

        # Take a screenshot of the dashboard
        page.screenshot(path="/home/jules/verification/marketer_dashboard.png")

        print("Screenshots taken successfully.")
        browser.close()

if __name__ == "__main__":
    verify_marketer_dashboard()
