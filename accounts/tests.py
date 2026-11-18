from io import BytesIO

from django.contrib.auth import SESSION_KEY
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
        self.assertContains(response, "Enter a valid email address and password.")
        self.assertNotIn(SESSION_KEY, self.client.session)
        self.client.force_login(user)
        self.assertEqual(self.client.get(reverse("logout")).status_code, 405)
        self.assertRedirects(self.client.post(reverse("logout")), reverse("login"))
        self.assertNotIn(SESSION_KEY, self.client.session)

    def test_protected_pages_redirect_to_login(self):
        for name in ("dashboard", "resident_dashboard", "admin_dashboard", "profile", "edit_profile"):
            path = reverse(name)
            self.assertRedirects(self.client.get(path), f"{reverse('login')}?next={path}")

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
