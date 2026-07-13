import os
from playwright.sync_api import sync_playwright

def verify_frontend():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        current_dir = os.getcwd()

        # 1. Verify Storefront index.html
        storefront_path = f"file://{current_dir}/index.html"
        print("Opening storefront:", storefront_path)
        page.goto(storefront_path)
        page.wait_for_timeout(500)

        # Stub window.history.pushState, inject mock products, and hide splash screen
        page.evaluate("""
            window.history.pushState = function() {};
            window.allProducts = [
              {
                id: 1,
                name: "مضرب تنس احترافي",
                category: "اللياقة والرياضة",
                price: 45000,
                old_price: 60000,
                discount: 25,
                is_out_of_stock: false,
                image: "https://images.pexels.com/photos/3642537/pexels-photo-3642537.jpeg?auto=compress&cs=tinysrgb&w=600"
              },
              {
                id: 2,
                name: "سيروم العناية بالبشرة الطبيعي",
                category: "تجميل",
                price: 12000,
                is_out_of_stock: false,
                image: "https://images.pexels.com/photos/3373739/pexels-photo-3373739.jpeg?auto=compress&cs=tinysrgb&w=600"
              },
              {
                id: 3,
                name: "خلاط كهربائي ذكي",
                category: "تجميل/أجهزة كهربائية",
                price: 85000,
                is_out_of_stock: false,
                image: "https://images.pexels.com/photos/5824485/pexels-photo-5824485.jpeg?auto=compress&cs=tinysrgb&w=600"
              }
            ];
            document.getElementById('splash').style.display = 'none';
            filterCategory('الكل', null);
        """)
        page.wait_for_timeout(1000)

        # Take a screenshot of the category filter buttons and products
        page.screenshot(path="/home/jules/verification/storefront_categories.png")
        print("Storefront screenshot saved to /home/jules/verification/storefront_categories.png")

        # Click on "أقسام المتجر" tab to verify the categories list page
        try:
            page.click("text=الأقسام")
            page.wait_for_timeout(1000)
            page.screenshot(path="/home/jules/verification/storefront_categories_page.png")
            print("Storefront categories page screenshot saved to /home/jules/verification/storefront_categories_page.png")
        except Exception as e:
            print("Could not click categories tab:", e)

        # 2. Verify Admin Panel p/admin-productsm.html
        admin_path = f"file://{current_dir}/p/admin-productsm.html"
        print("Opening admin products:", admin_path)
        page.goto(admin_path)

        # Bypass login via localStorage
        page.evaluate("""
            localStorage.setItem('admin_auth', JSON.stringify({
                auth: '1',
                password: 'test_password',
                expiry: Date.now() + 8640000000
            }));
        """)
        page.reload()
        page.wait_for_timeout(1000)

        # Open Add Product modal to display the primary and secondary category dropdowns
        try:
            page.wait_for_selector(".add-btn", timeout=5000)
            page.click(".add-btn")
            page.wait_for_timeout(1000)
            page.screenshot(path="/home/jules/verification/admin_add_modal.png")
            print("Admin modal screenshot saved to /home/jules/verification/admin_add_modal.png")
        except Exception as e:
            print("Could not click add-btn or capture modal:", e)

        browser.close()

if __name__ == "__main__":
    verify_frontend()
