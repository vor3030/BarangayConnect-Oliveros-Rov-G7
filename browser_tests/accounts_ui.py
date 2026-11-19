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
            animated = page.evaluate("document.documentElement.dataset.motionReady === 'true' && !matchMedia('(prefers-reduced-motion: reduce)').matches")
            for element in page.locator("[data-reveal]").all():
                element.scroll_into_view_if_needed()
                if animated:
                    expect(element).to_have_attribute("data-revealed", "true")
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

    def test_showcase_previews_keyboard_device_and_pause_controls(self):
        page = self.open_page(viewport={"width": 1440, "height": 1000})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(self.live_server_url + "/")
        showcase = page.locator("[data-showcase]")
        expect(showcase).to_have_attribute("data-showcase-ready", "true")
        expect(page.get_by_role("heading", name="Resident accounts, clearly arranged.")).to_be_visible()
        expect(page.locator("#preview-profile")).to_be_visible()
        expect(page.locator(".preview-window")).to_be_in_viewport()
        pause = page.get_by_role("button", name="Reduce page motion")
        pause.click()
        expect(showcase).to_have_attribute("data-showcase-paused", "true")
        expect(page.locator("html")).to_have_attribute("data-page-motion", "reduced")
        expect(showcase).to_have_attribute("data-showcase-settled", "true")
        self.capture(page, "showcase-desktop")
        profile = page.get_by_role("tab", name="My profile", exact=True)
        profile.focus()
        page.keyboard.press("ArrowRight")
        resident = page.get_by_role("tab", name="Resident overview", exact=True)
        expect(resident).to_be_focused()
        expect(resident).to_have_attribute("aria-selected", "true")
        page.keyboard.press("End")
        expect(page.get_by_role("tab", name="Staff overview", exact=True)).to_have_attribute("aria-selected", "true")
        expect(page.locator("#preview-admin")).to_be_visible()
        expect(page.locator("#preview-profile")).not_to_be_visible()
        profile.click()
        page.get_by_role("button", name="Phone", exact=True).click()
        expect(page.locator("[data-preview-window]")).to_have_attribute("data-device", "phone")
        expect(page.locator("#preview-profile")).to_be_visible()
        for width, height in ((375, 812), (768, 1024), (1024, 768)):
            page.set_viewport_size({"width": width, "height": height})
            self.assertFalse(page.evaluate("document.documentElement.scrollWidth > window.innerWidth"))
            if width < 752:
                expect(page.get_by_role("group", name="Preview size")).not_to_be_visible()
                expect(page.locator("[data-preview-window]")).to_have_attribute("data-device", "responsive")
        self.capture(page, "showcase-profile-tablet")
        page.get_by_role("button", name="Email example", exact=True).click()
        expect(page.locator("[data-identifier-value]")).to_have_text("resident@example.com")
        page.get_by_role("button", name="Username example", exact=True).click()
        expect(page.locator("[data-identifier-value]")).to_have_text("resident")
        page.get_by_role("button", name="Enable page motion").click()
        expect(showcase).to_have_attribute("data-showcase-paused", "false")
        self.assertEqual(errors, [])

    def test_showcase_reduced_motion_and_no_javascript(self):
        for javascript, motion in ((True, "reduce"), (False, "no-preference")):
            with self.subTest(javascript=javascript, motion=motion):
                page = self.open_page(
                    viewport={"width": 375, "height": 812},
                    java_script_enabled=javascript, reduced_motion=motion,
                )
                page.goto(self.live_server_url + "/portfolio-showcase/")
                expect(page.get_by_role("heading", name="Resident accounts, clearly arranged.")).to_be_visible()
                if javascript:
                    expect(page.get_by_role("button", name="Reduced motion enabled")).to_be_disabled()
                    expect(page.locator("[data-showcase]")).to_have_attribute("data-showcase-paused", "true")
                    page.get_by_role("tab", name="Staff overview", exact=True).click()
                    expect(page.locator("#preview-admin")).to_be_visible()
                else:
                    expect(page.locator("[data-showcase-controls]")).not_to_be_visible()
                    for name in ("resident", "admin", "profile"):
                        expect(page.locator(f"#preview-{name}")).to_be_visible()
                self.assertFalse(page.evaluate("document.documentElement.scrollWidth > window.innerWidth"))
                self.capture(page, f"showcase-mobile-{javascript}")

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
        page.get_by_text("09123456789", exact=True).scroll_into_view_if_needed()
        expect(page.get_by_text("09123456789", exact=True)).to_be_visible()
        expect(page.get_by_role("button", name="Aerial", exact=True)).to_be_visible()
        self.capture(page, "resident-desktop")
        page.set_viewport_size({"width": 390, "height": 844})
        expect(page.get_by_role("button", name="Pause motion")).not_to_be_visible()
        self.assertFalse(page.evaluate("document.documentElement.scrollWidth > window.innerWidth"))
        self.capture(page, "resident-mobile")
        for width, height in ((375, 812), (768, 1024), (1024, 768), (844, 390)):
            page.set_viewport_size({"width": width, "height": height})
            self.assertFalse(page.evaluate("document.documentElement.scrollWidth > window.innerWidth"))
            expect(page.get_by_role("navigation", name="Main navigation")).to_be_visible()
        question = page.locator("summary").filter(has_text="Can I sign in with my username?")
        question.focus()
        page.keyboard.press("Enter")
        expect(page.get_by_text("Yes. Use your email address or username", exact=False)).to_be_visible()
        page.get_by_role("link", name="Update your details").click()
        expect(page.get_by_role("heading", name="Edit profile")).to_be_visible()
        page.get_by_role("link", name="Cancel", exact=True).click()
        expect(page.get_by_role("heading", name="Your profile")).to_be_visible()
        self.capture(page, "profile-mobile")
        page.get_by_role("link", name="Barangay Connect home").filter(visible=True).click()
        expect(page).to_have_url(self.live_server_url + "/")
        expect(page.locator("[data-showcase]")).to_be_visible()
        page.get_by_role("navigation", name="Main navigation").get_by_role("link", name="Open portal").click()
        expect(page).to_have_url(self.live_server_url + "/dashboard/resident/")
        self.assertEqual(errors, [])

    def test_password_visibility_and_failed_form_feedback(self):
        page = self.open_page(viewport={"width": 390, "height": 844})
        page.goto(self.live_server_url + "/login/")
        expect(page.locator("html")).to_have_attribute("data-interactions-ready", "true")
        password = page.get_by_label("Password")
        password.fill("Not-a-real-password")
        page.get_by_role("button", name="Show characters for this field").click()
        expect(password).to_have_attribute("type", "text")
        expect(password).to_have_value("Not-a-real-password")
        page.get_by_role("button", name="Hide characters for this field").click()
        expect(password).to_have_attribute("type", "password")
        page.get_by_label("Email or username").fill("missing-resident")
        page.get_by_role("button", name="Sign in", exact=True).click()
        summary = page.locator("[data-error-summary]")
        expect(summary).to_be_visible()
        expect(summary).to_be_focused()
        expect(summary).to_contain_text("Enter a valid email address or username and password.")
        self.capture(page, "login-error-mobile")

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
