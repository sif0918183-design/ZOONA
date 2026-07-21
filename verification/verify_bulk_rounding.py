# verification/verify_bulk_rounding.py
from playwright.sync_api import sync_playwright
import os
import json

def verify_bulk_rounding():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Intercept and mock API requests
        mock_products = [
            {
                "id": 201,
                "name": "Test Product A",
                "price": 11391,
                "old_price": None,
                "discount": None,
                "warehouse": "الخرطوم",
                "delivery_cities": [{"name": "الخرطوم", "price": 2000, "type": "cod"}]
            },
            {
                "id": 202,
                "name": "Test Product B",
                "price": 27191,
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

        # First test: +5% on Test Product A (11,391 * 1.05 = 11,960.55 -> should round to 12,000)
        page.fill("#bulkPercentInput", "5")
        page.click("text=تطبيق النسبة مؤقتاً")
        page.wait_for_timeout(1000)

        mini_list_html = page.inner_html("#bulkProductsMiniList")
        print("Mini-list HTML content after +5% increase:")
        print(mini_list_html)

        # Assertions to ensure thousands rounding works
        assert "12,000" in mini_list_html or "12000" in mini_list_html, "Failed: 11,391 + 5% should round to 12,000"
        print("Test A Passed: 11,391 + 5% rounded to 12,000 correctly!")

        # Clear prices
        page.click("text=مسح")
        page.wait_for_timeout(500)

        # Second test: -10% on Test Product B (27,191 * 0.9 = 24,471.9 -> should round to 24,000)
        page.fill("#bulkPercentInput", "-10")
        page.click("text=تطبيق النسبة مؤقتاً")
        page.wait_for_timeout(1000)

        mini_list_html_neg = page.inner_html("#bulkProductsMiniList")
        print("Mini-list HTML content after -10% discount:")
        print(mini_list_html_neg)

        assert "24,000" in mini_list_html_neg or "24000" in mini_list_html_neg, "Failed: 27,191 - 10% should round to 24,000"
        print("Test B Passed: 27,191 - 10% rounded to 24,000 correctly!")

        # Take a screenshot
        screenshot_path = "/home/jules/verification/rounding_verification.png"
        page.screenshot(path=screenshot_path, full_page=True)
        print(f"Rounding screenshot taken at: {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    verify_bulk_rounding()
