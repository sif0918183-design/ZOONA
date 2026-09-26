from playwright.sync_api import sync_playwright
import json

def verify_bulk_note():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        mock_products = [
            {
                "id": 101,
                "name": "المنتج الأول",
                "price": 100000,
                "old_price": None,
                "discount": None,
                "warehouse": "الخرطوم",
                "warehouse_note": "",
                "delivery_cities": []
            },
            {
                "id": 102,
                "name": "المنتج الثاني",
                "price": 200000,
                "old_price": None,
                "discount": None,
                "warehouse": "الخرطوم",
                "warehouse_note": "",
                "delivery_cities": []
            }
        ]

        patched_requests = []

        def handle_api(route):
            req = route.request
            url = req.url
            if "admin-products" in url:
                if req.method == "PATCH":
                    patched_requests.append({
                        "url": url,
                        "data": req.post_data_json
                    })
                    route.fulfill(status=204)
                else:
                    route.fulfill(
                        status=200,
                        content_type="application/json",
                        body=json.dumps(mock_products)
                    )
            else:
                route.continue_()

        page.route("**/api/admin-products**", handle_api)

        page.goto("http://localhost:5000/p/admin-productsm.html")

        # Bypass login
        page.evaluate("""
            localStorage.setItem('admin_auth', JSON.stringify({
                auth: '1',
                password: 'test_password',
                expiry: Date.now() + 86400000 * 30
            }));
        """)

        page.reload()
        page.wait_for_timeout(1000)

        # Expand bulk section
        page.click("text=التحديث الجماعي لأسعار ومدن وملحوظات المستودعات")
        page.wait_for_timeout(500)

        # Select warehouse "الخرطوم"
        page.select_option("#bulkWarehouseSelect", "الخرطوم")
        page.wait_for_timeout(500)

        # Fill warehouse note
        page.fill("#bulkWarehouseNoteInput", "متوفر بيع جملة فقط")
        page.wait_for_timeout(500)

        # Click "تفعيل الملحوظة مؤقتاً"
        page.click("text=تفعيل الملحوظة مؤقتاً")
        page.wait_for_timeout(500)

        # Handle alert confirm automatically
        page.on("dialog", lambda dialog: dialog.accept())

        # Click confirm save button
        page.click("#bulkConfirmBtn")
        page.wait_for_timeout(1000)

        print(f"Patched requests count: {len(patched_requests)}")
        for r in patched_requests:
            print("PATCH payload:", r["data"])

        assert len(patched_requests) == 2, f"Expected 2 PATCH requests, got {len(patched_requests)}"
        for r in patched_requests:
            assert r["data"]["warehouse_note"] == "متوفر بيع جملة فقط", f"Expected warehouse_note to be 'متوفر بيع جملة فقط', got {r['data'].get('warehouse_note')}"

        print("SUCCESS: Collective warehouse note update verified successfully with new staging mechanism!")
        browser.close()

if __name__ == "__main__":
    verify_bulk_note()
