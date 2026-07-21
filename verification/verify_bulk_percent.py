# verification/verify_bulk_percent.py
from playwright.sync_api import sync_playwright
import os
import json

def verify_bulk_percent():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Intercept and mock API requests
        mock_products = [
            {
                "id": 101,
                "name": "HONOR Pad X7(128-4) WiFi",
                "price": 100000,
                "old_price": None,
                "discount": None,
                "warehouse": "الخرطوم",
                "delivery_cities": [{"name": "الخرطوم", "price": 2000, "type": "cod"}]
            },
            {
                "id": 102,
                "name": "HONOR Pad X7(128-4) Sim",
                "price": 200000,
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
        # We will run this on port 5000
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

        # Enter 5% modifier in the percentage input
        page.fill("#bulkPercentInput", "5")
        page.wait_for_timeout(500)

        # Click "تطبيق النسبة مؤقتاً"
        page.click("text=تطبيق النسبة مؤقتاً")
        page.wait_for_timeout(1000)

        # Check that the temp prices are updated: 100000 * 1.05 = 105000, 200000 * 1.05 = 210000
        mini_list_html = page.inner_html("#bulkProductsMiniList")
        print("Mini-list HTML content after 5% increase:")
        print(mini_list_html)

        # Assertions to ensure math works
        assert "105,000" in mini_list_html or "105000" in mini_list_html, "Failed to find updated price for Product 101 (105,000)"
        assert "210,000" in mini_list_html or "210000" in mini_list_html, "Failed to find updated price for Product 102 (210,000)"
        print("Math assertion passed: 100000 -> 105000, 200000 -> 210000")

        # Clear prices
        page.click("text=مسح")
        page.wait_for_timeout(500)

        # Try negative percent modifier: -10%
        page.fill("#bulkPercentInput", "-10")
        page.click("text=تطبيق النسبة مؤقتاً")
        page.wait_for_timeout(1000)

        mini_list_html_neg = page.inner_html("#bulkProductsMiniList")
        assert "90,000" in mini_list_html_neg or "90000" in mini_list_html_neg, "Failed to find updated price for Product 101 (90,000)"
        assert "180,000" in mini_list_html_neg or "180000" in mini_list_html_neg, "Failed to find updated price for Product 102 (180,000)"
        print("Math assertion passed for discount: 100000 -> 90000, 200000 -> 180000")

        # Take a screenshot
        screenshot_path = "verification/bulk_percent_screenshot.png"
        page.screenshot(path=screenshot_path, full_page=True)
        print(f"Screenshot taken at: {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    verify_bulk_percent()
