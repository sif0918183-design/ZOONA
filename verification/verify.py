from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 390, "height": 844})

        # Go to home page
        page.goto("http://localhost:8080/index.html")
        page.wait_for_timeout(2500) # Wait for splash to hide and app to render

        # Screenshot home page with top ad unit above banner
        page.screenshot(path="/home/jules/verification/home_ad.png")

        # Open a product modal
        # Click on product card
        card = page.locator(".product-card").first
        if card.is_visible():
            card.click()
            page.wait_for_timeout(1000)

            # Scroll modal to bottom
            modal = page.locator("#modalContent")
            modal.evaluate("el => el.scrollTop = el.scrollHeight")
            page.wait_for_timeout(500)

            page.screenshot(path="/home/jules/verification/modal_ad.png")

        browser.close()

if __name__ == "__main__":
    run()
