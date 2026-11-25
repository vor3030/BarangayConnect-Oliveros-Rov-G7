from io import BytesIO

from asgiref.sync import async_to_sync
from django.contrib.auth import SESSION_KEY, aauthenticate
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse

from PIL import Image

from .models import User


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class AccountTests(TestCase):
    password = "Random-school-password-39!"

    def make_user(self, username, staff=False):
        return User.objects.create_user(
            username=username,
            email=f"{username}@example.com",
            full_name=username.title(),
            password=self.password,
            is_staff=staff,
        )

    def register_data(self, **changes):
        data = {
            "username": "maria",
            "email": "Maria@example.com",
            "full_name": "Maria Santos",
            "password1": self.password,
            "password2": self.password,
        }
        return data | changes

    def test_registration_hashes_password_and_assigns_resident(self):
        response = self.client.post(
            reverse("register"), self.register_data(is_staff="on"), follow=True
        )
        self.assertRedirects(response, reverse("login"))
        self.assertContains(response, "Your account was created.")
        user = User.objects.get(email="maria@example.com")
        self.assertFalse(user.is_staff)
        self.assertNotEqual(user.password, self.password)
        self.assertTrue(user.check_password(self.password))

    def test_registration_rejects_invalid_and_duplicate_fields(self):
        self.make_user("maria")
        response = self.client.post(
            reverse("register"), self.register_data(username="MARIA")
        )
        self.assertFormError(response.context["form"], "email", "An account already uses this email address.")
        self.assertFormError(response.context["form"], "username", "This username is already taken.")
        response = self.client.post(
            reverse("register"),
            self.register_data(username="new-user", email="invalid-email", password2="mismatch", full_name=""),
        )
        self.assertEqual(set(response.context["form"].errors), {"email", "password2", "full_name"})
        self.assertEqual(User.objects.count(), 1)

    def test_login_routes_each_role_and_blocks_the_other_dashboard(self):
        for user, dashboard, other in [
            (self.make_user("maria"), "resident_dashboard", "admin_dashboard"),
            (self.make_user("staff", staff=True), "admin_dashboard", "resident_dashboard"),
        ]:
            with self.subTest(role=user.role_label):
                self.client.logout()
                response = self.client.post(
                    reverse("login"),
                    {
                        "username": user.email.upper(),
                        "password": self.password,
                        "next": reverse(other),
                    },
                    follow=True,
                )
                self.assertEqual(response.request["PATH_INFO"], reverse(dashboard))
                self.assertContains(response, f"{user.role_label} dashboard")
                self.assertEqual(self.client.get(reverse(other)).status_code, 403)

    def test_bad_credentials_and_logout(self):
        user = self.make_user("maria")
        response = self.client.post(
            reverse("login"), {"username": user.email, "password": "incorrect"}
        )
        self.assertContains(response, "Enter a valid email address or username and password.")
        self.assertNotIn(SESSION_KEY, self.client.session)
        self.client.force_login(user)
        self.assertEqual(self.client.get(reverse("logout")).status_code, 405)
        self.assertRedirects(self.client.post(reverse("logout")), reverse("login"))
        self.assertNotIn(SESSION_KEY, self.client.session)

    def test_protected_pages_redirect_to_login(self):
        for name in ("dashboard", "resident_dashboard", "admin_dashboard", "profile", "edit_profile"):
            path = reverse(name)
            self.assertRedirects(self.client.get(path), f"{reverse('login')}?next={path}")

    def test_dashboard_profile_completion_uses_actual_details(self):
        user = self.make_user("maria")
        self.client.force_login(user)
        response = self.client.get(reverse("resident_dashboard"))
        self.assertEqual(response.context["profile_completed_fields"], 3)
        self.assertEqual(response.context["profile_completion"], 75)
        user.contact_number = "09123456789"
        user.save(update_fields=["contact_number"])
        response = self.client.get(reverse("resident_dashboard"))
        self.assertEqual(response.context["profile_completed_fields"], 4)
        self.assertEqual(response.context["profile_completion"], 100)

    def test_showcase_is_public_and_does_not_expose_account_details(self):
        self.assertEqual(reverse("home"), "/")
        self.assertEqual(reverse("dashboard"), "/dashboard/")
        home = self.client.get(reverse("home"))
        self.assertContains(home, "Your barangay,")
        self.assertContains(home, 'class="brand" href="/"')
        self.assertNotContains(home, "Interface showcase")
        self.assertNotContains(home, "Illustrative UI only")
        url = reverse("portfolio_showcase")
        response = self.client.get(url)
        self.assertContains(response, "Your barangay,")
        self.assertEqual(self.client.head(url).status_code, 200)
        self.assertEqual(self.client.post(url).status_code, 405)
        user = self.make_user("private-resident")
        self.client.force_login(user)
        self.assertContains(self.client.get(reverse("home")), "data-showcase")
        response = self.client.get(url)
        self.assertContains(response, "data-showcase")
        self.assertNotContains(response, user.email)
        self.assertNotContains(response, user.full_name)
        self.assertNotContains(response, 'class="portal-sidebar"')

    def test_username_login_is_case_insensitive_for_both_roles(self):
        for username, staff, dashboard in (
            ("maria", False, "resident_dashboard"),
            ("operator", True, "admin_dashboard"),
        ):
            user = self.make_user(username, staff=staff)
            with self.subTest(role=user.role_label):
                self.client.logout()
                response = self.client.post(reverse("login"), {
                    "username": f"  {username.upper()}  ", "password": self.password,
                }, follow=True)
                self.assertEqual(response.request["PATH_INFO"], reverse(dashboard))
                self.assertEqual(self.client.session[SESSION_KEY], str(user.pk))

    def test_async_authentication_accepts_email_and_username(self):
        user = self.make_user("maria")
        for identifier in (user.email.upper(), user.username.upper()):
            with self.subTest(identifier=identifier):
                result = async_to_sync(aauthenticate)(username=identifier, password=self.password)
                self.assertEqual(result.pk, user.pk)

    def test_login_rejects_inactive_users_and_invalid_identifiers(self):
        user = self.make_user("maria")
        for identifier in (user.email, user.username, "missing", "missing@example.com"):
            with self.subTest(identifier=identifier, reason="wrong password"):
                response = self.client.post(reverse("login"), {
                    "username": identifier, "password": "incorrect",
                })
                self.assertContains(response, "Enter a valid email address or username and password.")
                self.assertNotIn(SESSION_KEY, self.client.session)
        user.is_active = False
        user.save(update_fields=["is_active"])
        for identifier in (user.email, user.username):
            with self.subTest(identifier=identifier, reason="inactive"):
                response = self.client.post(reverse("login"), {
                    "username": identifier, "password": self.password,
                })
                self.assertEqual(response.status_code, 200)
                self.assertNotIn(SESSION_KEY, self.client.session)

    def test_ambiguous_email_and_username_fail_without_server_error(self):
        user = self.make_user("maria")
        User.objects.create_user(
            username=user.email, email="other@example.com", full_name="Other Resident",
            password=self.password,
        )
        response = self.client.post(reverse("login"), {
            "username": user.email, "password": self.password,
        })
        self.assertContains(response, "Enter a valid email address or username and password.")
        self.assertNotIn(SESSION_KEY, self.client.session)
        self.assertIsNone(async_to_sync(aauthenticate)(username=user.email, password=self.password))
        self.assertTrue(self.client.login(username=user.username, password=self.password))

    def test_admin_login_accepts_username(self):
        user = User.objects.create_superuser(
            username="operator", email="operator@example.com", full_name="Operator",
            password=self.password,
        )
        response = self.client.get(reverse("admin:login"))
        self.assertContains(response, "Email or username")
        response = self.client.post(reverse("admin:login"), {
            "username": user.username, "password": self.password, "next": reverse("admin:index"),
        })
        self.assertRedirects(response, reverse("admin:index"))
        self.assertEqual(self.client.session[SESSION_KEY], str(user.pk))

    def test_profile_is_private_and_updates_only_allowed_fields(self):
        resident = self.make_user("maria")
        other = self.make_user("jose")
        self.client.force_login(resident)
        response = self.client.get(reverse("profile"), {"user": other.pk})
        self.assertContains(response, resident.email)
        self.assertNotContains(response, other.email)
        url = reverse("edit_profile")
        response = self.client.post(
            url, {"full_name": "Maria Santos", "email": other.email.upper()}
        )
        self.assertFormError(response.context["form"], "email", "An account already uses this email address.")
        response = self.client.post(
            url,
            {
                "full_name": "Maria Santos",
                "email": "Updated@example.com",
                "contact_number": "09171234567",
                "user": other.pk,
                "is_staff": "on",
            },
            follow=True,
        )
        self.assertRedirects(response, reverse("profile"))
        self.assertContains(response, "Your profile was updated.")
        resident.refresh_from_db()
        other.refresh_from_db()
        self.assertEqual(resident.full_name, "Maria Santos")
        self.assertEqual(resident.email, "updated@example.com")
        self.assertEqual(resident.contact_number, "09171234567")
        self.assertFalse(resident.is_staff)
        self.assertEqual(other.full_name, "Jose")

    def test_only_superusers_can_access_account_management(self):
        staff = self.make_user("staff", staff=True)
        superuser = User.objects.create_superuser(
            username="operator",
            email="operator@example.com",
            full_name="Barangay Operator",
            password=self.password,
        )
        url = reverse("admin:accounts_user_change", args=[staff.pk])
        self.client.force_login(staff)
        self.assertEqual(self.client.get(url).status_code, 403)
        self.client.force_login(superuser)
        self.assertContains(self.client.get(url), "Staff status")


    def test_profile_photo_upload_replacement_and_access(self):
        resident = self.make_user("maria")
        other = self.make_user("jose")
        profile_url = reverse("profile")
        edit_url = reverse("edit_profile")
        photo_url = reverse("profile_photo")
        self.assertRedirects(self.client.get(photo_url), f"{reverse('login')}?next={photo_url}")
        self.client.force_login(resident)
        self.assertContains(self.client.get(profile_url), "Default avatar")
        self.assertContains(self.client.get(edit_url), 'enctype="multipart/form-data"')
        details = {"full_name": resident.full_name, "email": resident.email}
        previous = None

        for color in ("red", "blue"):
            with self.subTest(color=color):
                upload = BytesIO()
                Image.new("RGB", (300, 200), color).save(upload, format="PNG")
                photo = SimpleUploadedFile("photo.png", upload.getvalue(), "image/png")
                self.assertRedirects(
                    self.client.post(edit_url, details | {"photo": photo}),
                    profile_url,
                )
                self.assertContains(self.client.get(profile_url), f'src="{photo_url}"')
                response = self.client.get(photo_url)
                self.assertEqual(response.headers["Content-Type"], "image/jpeg")
                self.assertIn("private", response.headers["Cache-Control"])
                self.assertNotEqual(response.content, previous)
                with Image.open(BytesIO(response.content)) as image:
                    self.assertEqual(image.size, (256, 256))
                previous = response.content

        invalid = SimpleUploadedFile("fake.png", b"invalid", "image/png")
        response = self.client.post(edit_url, details | {"photo": invalid})
        self.assertFormError(
            response.context["form"], "photo", "Upload a valid JPG, PNG, or WebP image."
        )
        self.assertEqual(self.client.get(photo_url).content, previous)
        self.assertRedirects(self.client.post(edit_url, details), profile_url)
        self.assertEqual(self.client.get(photo_url).content, previous)

        self.client.force_login(other)
        self.assertEqual(self.client.get(photo_url, {"user": resident.pk}).status_code, 404)
        self.assertContains(self.client.get(profile_url), "Default avatar")
