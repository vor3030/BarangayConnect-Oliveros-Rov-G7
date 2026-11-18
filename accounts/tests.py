from django.contrib.auth import SESSION_KEY
from django.test import TestCase, override_settings
from django.urls import reverse

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
