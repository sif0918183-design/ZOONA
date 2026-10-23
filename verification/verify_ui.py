from playwright.sync_api import sync_playwright

def verify_frontend():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()

        page.goto('http://localhost:8080/p/admin-productsm.html')

        # Bypass login UI directly for testing modal render
        page.evaluate('''() => {
            document.getElementById("loginScreen").style.display = "none";
            document.getElementById("adminApp").style.display = "block";
            openAddModal();
        }''')

        page.wait_for_selector('#formModal.show', state='visible')

        # Scroll modal to show fIsHidden
        page.locator('#fIsHidden').scroll_into_view_if_needed()

        # Take screenshot
        page.screenshot(path='/home/jules/verification/admin_modal_is_hidden.png')

        browser.close()

if __name__ == '__main__':
    verify_frontend()
    print("Frontend verification screenshot generated at /home/jules/verification/admin_modal_is_hidden.png")
