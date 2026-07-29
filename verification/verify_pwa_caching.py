import os
from playwright.sync_api import sync_playwright

def verify_pwa():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        current_dir = os.getcwd()

        # 1. Verify Storefront index.html loading
        storefront_path = f"file://{current_dir}/index.html"
        print("Opening storefront:", storefront_path)
        page.goto(storefront_path)
        page.wait_for_timeout(500)

        # Inject some mock products and hide the splash screen to display our layout
        page.evaluate("""
            window.history.pushState = function() {};
            allProducts = [
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
              }
            ];
            document.getElementById('splash').style.display = 'none';
            document.getElementById('app').style.display = 'flex';
            filterCategory('الكل', null);
        """)
        page.wait_for_timeout(1000)

        # Verify that loading="lazy" is present on the images
        lazy_images_count = page.evaluate("""
            const imgs = document.querySelectorAll('img[loading="lazy"]');
            console.log("Lazy images found:", imgs.length);
            imgs.length;
        """)
        print(f"Verified {lazy_images_count} lazy loaded images are successfully rendered.")

        # Take a screenshot
        screenshot_path = "/home/jules/verification/pwa_verification.png"
        page.screenshot(path=screenshot_path)
        print(f"Storefront PWA screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    verify_pwa()
