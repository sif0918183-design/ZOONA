# verification/verify_bulk_update_expanded.py
from playwright.sync_api import sync_playwright
import os
import json

def verify_bulk_update_expanded():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Intercept and mock API requests
        mock_products = [
            {
                "id": 101,
                "name": "HONOR Pad X7(128-4) WiFi",
                "price": 720000,
                "old_price": 750000,
                "discount": 4,
                "warehouse": "الخرطوم",
                "delivery_cities": [{"name": "الخرطوم", "price": 2000, "type": "cod"}]
            },
            {
                "id": 102,
                "name": "HONOR Pad X7(128-4) Sim",
                "price": 740000,
                "old_price": None,
                "discount": None,
                "warehouse": "الخرطوم",
                "delivery_cities": [{"name": "الخرطوم", "price": 2000, "type": "cod"}]
            }
        ]

        def handle_api(route):
            url = route.request.url
            if "admin-products" in url:
                route.fulfill(
                    status=200,
                    content_type="application/json",
                    body=json.dumps(mock_products)
                )
            else:
                route.continue_()

        page.route("**/api/admin-products**", handle_api)

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

        # Expand the section
        page.click("text=التحديث الجماعي لأسعار ومدن المستودعات")
        page.wait_for_timeout(500)

        # Select "الخرطوم" from the warehouse dropdown
        page.select_option("#bulkWarehouseSelect", "الخرطوم")
        page.wait_for_timeout(500)

        # Fill in the text area with new prices
        paste_text = "HONOR Pad X7(128-4)👉760000 WiFi 🇸🇦🔥\nHONOR Pad X7(128-4)👉780000 Sim🇸🇦🔥"
        page.fill("#bulkPasteArea", paste_text)
        page.wait_for_timeout(500)

        # Click "تفعيل الأسعار المقترحة مؤقتاً"
        page.click("text=تفعيل الأسعار المقترحة مؤقتاً")
        page.wait_for_timeout(1000)

        # Take a screenshot
        screenshot_path = "/home/jules/verification/bulk_update_expanded.png"
        page.screenshot(path=screenshot_path, full_page=True)
        print(f"Screenshot taken at: {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    verify_bulk_update_expanded()
