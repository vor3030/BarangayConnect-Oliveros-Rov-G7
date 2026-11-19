import os
from pathlib import Path

from django.contrib.auth import get_user_model
from django.contrib.staticfiles.testing import StaticLiveServerTestCase
from playwright.sync_api import expect, sync_playwright


class AccountsBrowserTests(StaticLiveServerTestCase):
    browser = None
    playwright = None

    def capture(self, page, name):
        directory = os.getenv("UI_SCREENSHOT_DIR")
        if directory:
            Path(directory).mkdir(parents=True, exist_ok=True)
            for element in page.locator("[data-reveal]").all():
                element.scroll_into_view_if_needed()
                expect(element).to_have_css("opacity", "1")
            page.evaluate("window.scrollTo(0, 0)")
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
        # Close Playwright's sync event loop before Django flushes the test database.
        if self.playwright is not None:
            try:
                self.browser.close()
            finally:
                self.playwright.stop()
        super().tearDown()

    def test_desktop_scene_and_animated_icon(self):
        page = self.open_page(viewport={"width": 1440, "height": 900})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(self.live_server_url + "/login/")
        scene = page.locator(".auth-intro")
        pause = page.get_by_role("button", name="Pause motion")
        expect(pause).to_be_visible()
        expect(scene).to_have_attribute("data-scene-motion", "running")
        expect(scene.locator("canvas")).to_be_visible()
        expect(page.locator("html")).to_have_attribute("data-motion-ready", "true")
        page.get_by_role("button", name="Aerial", exact=True).click()
        expect(scene).to_have_attribute("data-scene-view", "aerial")
        expect(page.get_by_role("button", name="Aerial", exact=True)).to_have_attribute("aria-pressed", "true")
        page.get_by_role("button", name="Explore", exact=True).click()
        expect(scene).to_have_attribute("data-scene-view", "neighborhood")
        icon = page.get_by_role("link", name="Register").locator("[data-icon-ready] svg")
        expect(icon).to_be_visible()
        scene.hover(position={"x": 90, "y": 150})
        pause.focus()
        page.keyboard.press("Enter")
        expect(scene).to_have_attribute("data-scene-motion", "paused")
        traveler = scene.locator(".connection-traveler")
        paused_position = traveler.get_attribute("transform")
        page.wait_for_timeout(150)
        self.assertEqual(traveler.get_attribute("transform"), paused_position)
        page.get_by_role("button", name="Resume motion").click()
        expect(scene).to_have_attribute("data-scene-motion", "running")
        expect(page.get_by_role("button", name="Sign in")).to_be_enabled()
        self.capture(page, "login-desktop")
        self.assertEqual(errors, [])

    def test_narrow_layout_and_reduced_motion_fallback(self):
        for width, motion, javascript in (
            (390, "no-preference", True),
            (768, "reduce", True),
            (1024, "no-preference", False),
        ):
            with self.subTest(width=width, motion=motion, javascript=javascript):
                page = self.open_page(
                    viewport={"width": width, "height": 850},
                    reduced_motion=motion,
                    java_script_enabled=javascript,
                )
                page.goto(self.live_server_url + "/register/")
                expect(page.get_by_role("heading", name="Your neighborhood. Closer together.")).to_be_visible()
                expect(page.get_by_role("button", name="Pause motion")).not_to_be_visible()
                expect(page.locator(".neighborhood-canvas")).not_to_be_visible()
                expect(page.get_by_role("button", name="Create account")).to_be_enabled()
                self.assertFalse(
                    page.evaluate("document.documentElement.scrollWidth > window.innerWidth")
                )
                self.capture(page, f"register-{width}-{motion}-{javascript}")

    def test_webgl_unavailable_keeps_login_usable(self):
        page = self.open_page(viewport={"width": 1280, "height": 900})
        page.add_init_script("""
            const original = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function(type, ...args) {
                return type.startsWith('webgl') ? null : original.call(this, type, ...args);
            };
        """)
        page.goto(self.live_server_url + "/login/")
        expect(page.locator("html")).to_have_attribute("data-motion-ready", "true")
        expect(page.locator(".neighborhood-canvas")).not_to_be_visible()
        expect(page.get_by_role("button", name="Pause motion")).not_to_be_visible()
        expect(page.get_by_role("button", name="Sign in", exact=True)).to_be_enabled()

    def test_resident_dashboard_and_profile_navigation(self):
        get_user_model().objects.create_user(
            username="maria", email="maria@example.com", full_name="Maria Santos",
            contact_number="09123456789", password="Browser-test-password!",
        )
        page = self.open_page(viewport={"width": 1440, "height": 1000})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(self.live_server_url + "/login/")
        page.get_by_label("Email or username").fill("maria")
        page.get_by_label("Password").fill("Browser-test-password!")
        page.get_by_role("button", name="Sign in", exact=True).click()
        expect(page).to_have_url(self.live_server_url + "/dashboard/resident/")
        expect(page.get_by_role("heading", name="Good to see you, Maria Santos.")).to_be_visible()
        expect(page.get_by_text("09123456789", exact=True)).to_be_visible()
        expect(page.get_by_role("button", name="Aerial", exact=True)).to_be_visible()
        self.capture(page, "resident-desktop")
        page.set_viewport_size({"width": 390, "height": 844})
        expect(page.get_by_role("button", name="Pause motion")).not_to_be_visible()
        self.assertFalse(page.evaluate("document.documentElement.scrollWidth > window.innerWidth"))
        self.capture(page, "resident-mobile")
        page.get_by_role("link", name="Update your details").click()
        expect(page.get_by_role("heading", name="Edit profile")).to_be_visible()
        page.get_by_role("link", name="Cancel", exact=True).click()
        expect(page.get_by_role("heading", name="Your profile")).to_be_visible()
        self.assertEqual(errors, [])

    def test_dashboard_chart_matches_database_counts(self):
        model = get_user_model()
        model.objects.create_user(
            username="staff", email="staff@example.com", full_name="Barangay Staff",
            password="Browser-test-password!", is_staff=True,
        )
        for index, is_active in enumerate((True, True, False)):
            model.objects.create_user(
                username=f"resident{index}",
                email=f"resident{index}@example.com",
                full_name=f"Resident {index}",
                is_active=is_active,
            )

        page = self.open_page(reduced_motion="reduce")
        page.goto(self.live_server_url + "/login/")
        page.get_by_label("Email or username").fill("staff@example.com")
        page.get_by_label("Password").fill("Browser-test-password!")
        page.get_by_role("button", name="Sign in").click()
        expect(page).to_have_url(self.live_server_url + "/dashboard/admin/")
        chart = page.locator("[data-account-chart]")
        expect(chart).to_be_visible()
        expect(chart).to_have_attribute("data-chart-ready", "true")
        expect(chart).to_have_attribute("data-active", "2")
        expect(chart).to_have_attribute("data-inactive", "1")
        expect(page.locator(".account-counts dd")).to_have_text(["2", "1"])
        self.capture(page, "admin-desktop")

        page.goto(self.live_server_url + "/dashboard/resident/")
        expect(page.get_by_role("heading", name="Access denied")).to_be_visible()
