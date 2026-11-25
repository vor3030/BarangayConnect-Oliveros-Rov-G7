import os
import re
from pathlib import Path

from django.contrib.auth import get_user_model
from django.contrib.staticfiles.testing import StaticLiveServerTestCase
from playwright.sync_api import expect, sync_playwright


class DocumentRequestsBrowserTests(StaticLiveServerTestCase):
    browser = None
    playwright = None

    def capture(self, page, name):
        directory = os.getenv("UI_SCREENSHOT_DIR")
        if directory:
            Path(directory).mkdir(parents=True, exist_ok=True)
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(350)
            for element in page.locator("[data-reveal]").all():
                element.scroll_into_view_if_needed()
                expect(element).to_have_css("opacity", "1")
            page.evaluate("window.scrollTo(0, 0)")
            page.evaluate("() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")
            page.screenshot(path=str(Path(directory) / f"{name}.png"), full_page=True)

    def open_page(self, **options):
        if self.browser is None:
            self.playwright = sync_playwright().start()
            try:
                self.browser = self.playwright.chromium.launch(
                    channel=os.getenv("PLAYWRIGHT_CHANNEL") or None,
                    args=["--enable-unsafe-swiftshader"],
                )
            except Exception:
                self.playwright.stop()
                self.playwright = None
                raise
        return self.browser.new_page(**options)

    def tearDown(self):
        if self.playwright is not None:
            try:
                self.browser.close()
            finally:
                self.playwright.stop()
        super().tearDown()

    def test_full_document_request_vertical_slice_resident_and_admin(self):
        User = get_user_model()
        User.objects.create_user(
            username="resident_e2e",
            email="resident.e2e@example.com",
            full_name="Maria Santos",
            contact_number="09171234567",
            password="Browser-test-password!",
        )
        User.objects.create_user(
            username="staff_e2e",
            email="staff.e2e@example.com",
            full_name="Barangay Secretary",
            contact_number="09189876543",
            password="Browser-test-password!",
            is_staff=True,
        )

        page = self.open_page(viewport={"width": 1366, "height": 900}, reduced_motion="reduce")
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))

        # 1. Resident logs in and sees dashboard
        page.goto(self.live_server_url + "/login/")
        page.get_by_label("Email or username").fill("resident.e2e@example.com")
        page.get_by_label("Password").fill("Browser-test-password!")
        page.get_by_role("button", name="Sign in", exact=True).click()
        expect(page).to_have_url(self.live_server_url + "/dashboard/resident/")
        self.capture(page, "01-resident-dashboard")

        # 2. Resident opens New Document Request and triggers validation errors
        page.get_by_role("link", name="Request a document").first.click()
        expect(page).to_have_url(self.live_server_url + "/requests/new/")
        page.get_by_label("Purpose of request").fill("job")
        page.get_by_label("Number of copies").fill("9")
        page.get_by_role("button", name="Submit request").click()
        summary = page.locator("[data-error-summary]")
        expect(summary).to_be_visible()
        expect(summary).to_contain_text("Document type")
        expect(summary).to_contain_text("Purpose of request")
        self.capture(page, "02-request-validation-error")

        # 3. Resident submits valid Barangay Clearance request
        page.get_by_label("Document type").select_option("Barangay Clearance")
        page.get_by_label("Purpose of request").fill("Local employment requirement")
        page.get_by_label("Number of copies").fill("2")
        page.get_by_label("Additional details (optional)").fill("Purok 2, morning pickup preferred.")
        page.get_by_role("button", name="Submit request").click()
        expect(page).to_have_url(re.compile(r"/requests/\d+/$"))
        first_detail_url = page.url
        first_ref = page.locator(".doc-ref").first.inner_text()
        expect(page.get_by_text("Pending review", exact=True)).to_be_visible()
        self.capture(page, "03-request-created-tracker")

        # 4. Resident edits pending request
        page.get_by_role("link", name="Edit request").click()
        expect(page).to_have_url(re.compile(r"/requests/\d+/edit/$"))
        page.get_by_label("Purpose of request").fill("Local employment and NBI clearance")
        page.get_by_role("button", name="Save changes").click()
        expect(page).to_have_url(first_detail_url)
        expect(page.get_by_text("Local employment and NBI clearance")).to_be_visible()
        self.capture(page, "04-request-updated")

        # 5. Resident submits a second request (Certificate of Residency) to test cancellation
        page.goto(self.live_server_url + "/requests/new/")
        page.get_by_label("Document type").select_option("Certificate of Residency")
        page.get_by_label("Purpose of request").fill("Bank account opening requirement")
        page.get_by_label("Number of copies").fill("1")
        page.get_by_role("button", name="Submit request").click()
        expect(page).to_have_url(re.compile(r"/requests/\d+/$"))
        second_ref = page.locator(".doc-ref").first.inner_text()

        page.goto(self.live_server_url + "/requests/")
        expect(page.get_by_text(first_ref)).to_be_visible()
        expect(page.get_by_text(second_ref)).to_be_visible()
        self.capture(page, "05-resident-request-list")

        # Resident cancels the second pending request (first row in descending order)
        page.locator("tbody tr", has_text=second_ref).get_by_role("link", name="Cancel").click()
        expect(page.get_by_role("heading", name="Cancel this document request?")).to_be_visible()
        self.capture(page, "06-request-cancel-confirm")
        page.get_by_role("button", name="Yes, cancel request").click()
        expect(page).to_have_url(self.live_server_url + "/requests/")
        expect(page.get_by_text("was cancelled and removed")).to_be_visible()

        # Verify mobile viewport layout has no horizontal overflow
        page.set_viewport_size({"width": 390, "height": 844})
        overflow = page.evaluate("""() => {
            const diff = document.documentElement.scrollWidth - window.innerWidth;
            if (diff <= 0) return null;
            const offenders = [...document.querySelectorAll('*')]
              .filter(el => el.getBoundingClientRect().right > window.innerWidth + 1)
              .slice(0, 5)
              .map(el => `${el.tagName}.${el.className}@${Math.round(el.getBoundingClientRect().right)}`);
            return { diff, offenders };
        }""")
        self.assertIsNone(overflow, f"Mobile horizontal overflow: {overflow}")
        page.set_viewport_size({"width": 1366, "height": 900})

        # Sign out resident
        page.locator(".sidebar-logout button").click()
        expect(page).to_have_url(self.live_server_url + "/login/")

        # 6. Admin/Staff logs in and reviews the pending request
        page.get_by_label("Email or username").fill("staff.e2e@example.com")
        page.get_by_label("Password").fill("Browser-test-password!")
        page.get_by_role("button", name="Sign in", exact=True).click()
        expect(page).to_have_url(self.live_server_url + "/dashboard/admin/")
        expect(page.get_by_text(first_ref)).to_be_visible()
        self.capture(page, "07-admin-dashboard-queue")

        page.get_by_role("link", name="Open full request queue").first.click()
        expect(page).to_have_url(self.live_server_url + "/requests/manage/")
        self.capture(page, "08-admin-request-queue")

        page.locator("tbody tr", has_text=first_ref).get_by_role("link", name="Review").click()
        expect(page).to_have_url(re.compile(r"/requests/\d+/review/$"))
        page.get_by_label("New status").select_option("Approved")
        page.get_by_label("Staff remarks").fill(
            "Verified residency record. Ready for pickup at Window 2, Mon-Fri 8 AM to 5 PM."
        )
        page.get_by_role("button", name="Update status").click()
        expect(page.get_by_text("status updated to Approved")).to_be_visible()
        self.capture(page, "09-admin-review-approved")

        # Sign out staff and verify resident sees real-time Approved status + remarks
        page.locator(".sidebar-logout button").click()
        page.get_by_label("Email or username").fill("resident.e2e@example.com")
        page.get_by_label("Password").fill("Browser-test-password!")
        page.get_by_role("button", name="Sign in", exact=True).click()
        page.goto(first_detail_url)
        expect(page.get_by_text("Ready for pickup at Window 2", exact=False).first).to_be_visible()
        expect(page.get_by_role("link", name="Edit request")).not_to_be_visible()
        self.capture(page, "10-resident-approved-tracker")

        self.assertEqual(errors, [])
