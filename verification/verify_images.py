import os
import sys
from playwright.sync_api import sync_playwright, expect

def test_homepage_images(page):
    # Capture console logs
    page.on("console", lambda msg: print(f"BROWSER CONSOLE: [{msg.type}] {msg.text}"))
    page.on("pageerror", lambda err: print(f"BROWSER ERROR: {err.message}"))

    # 1. Navigate to the local server
    print("Navigating to http://localhost:5000/")
    page.goto("http://localhost:5000/")

    # 2. Wait for splash animation to finish and products to load
    print("Waiting for splash screen to disappear...")
    page.wait_for_timeout(4000)

    # 3. Assert main app view is visible
    expect(page.locator("#app")).to_be_visible(timeout=10000)

    # 4. Check for product cards and their images
    product_images = page.locator("#productsGrid .product-card img")
    count = product_images.count()
    print(f"Found {count} product images on the homepage.")

    assert count > 0, "No product images found on homepage!"

    # 5. Check if the image sources are optimized
    for i in range(min(count, 5)):
        img_src = product_images.nth(i).get_attribute("src")
        loading_attr = product_images.nth(i).get_attribute("loading")
        decoding_attr = product_images.nth(i).get_attribute("decoding")
        print(f"Image {i+1} src: {img_src}")
        print(f"Image {i+1} loading: {loading_attr}, decoding: {decoding_attr}")

        # Verify it has transform params (width=350 or pexels w=350)
        assert "width=350" in img_src or "w=350" in img_src or "w=400" in img_src, f"Image {i+1} is not optimized: {img_src}"
        assert loading_attr == "lazy", f"Image {i+1} does not have loading='lazy'!"
        assert decoding_attr == "async", f"Image {i+1} does not have decoding='async'!"

    print("All checks passed successfully!")

    # 6. Capture a screenshot of the main page
    os.makedirs("verification", exist_ok=True)
    screenshot_path = "verification/homepage_optimized.png"
    page.screenshot(path=screenshot_path, full_page=True)
    print(f"Screenshot captured at: {screenshot_path}")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_homepage_images(page)
        finally:
            browser.close()
