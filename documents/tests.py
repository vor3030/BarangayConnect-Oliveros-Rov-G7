from django.test import TestCase, override_settings
from django.urls import reverse

from accounts.models import User

from .models import DocumentRequest, DocumentRequestLog


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class ResidentDocumentRequestTests(TestCase):
    password = "Test-password-barangay-1!"

    def make_user(self, username, staff=False):
        return User.objects.create_user(
            username=username,
            email=f"{username}@example.com",
            full_name=f"{username.title()} User",
            password=self.password,
            is_staff=staff,
        )

    def make_request(self, user, **overrides):
        defaults = {
            "document_type": DocumentRequest.DocumentType.BARANGAY_CLEARANCE,
            "purpose": "Local employment application",
            "copies": 1,
            "notes": "Purok 2 pickup",
            "status": DocumentRequest.Status.PENDING,
        }
        return DocumentRequest.objects.create(user=user, **(defaults | overrides))

    def test_anonymous_users_are_redirected_to_login(self):
        resident = self.make_user("maria")
        doc_request = self.make_request(resident)
        for url in (
            reverse("documents:list"),
            reverse("documents:create"),
            reverse("documents:detail", args=[doc_request.pk]),
            reverse("documents:update", args=[doc_request.pk]),
            reverse("documents:delete", args=[doc_request.pk]),
        ):
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertRedirects(response, f"{reverse('login')}?next={url}")

    def test_resident_can_create_document_request_defaulting_to_pending(self):
        resident = self.make_user("maria")
        self.client.force_login(resident)

        response = self.client.post(
            reverse("documents:create"),
            {
                "document_type": DocumentRequest.DocumentType.INDIGENCY,
                "purpose": "Hospital medical assistance",
                "copies": 2,
                "notes": "Will claim on weekday morning.",
                "status": DocumentRequest.Status.APPROVED,
            },
            follow=True,
        )
        created = DocumentRequest.objects.get(user=resident)
        self.assertRedirects(response, reverse("documents:detail", args=[created.pk]))
        self.assertEqual(created.status, DocumentRequest.Status.PENDING)
        self.assertEqual(created.copies, 2)
        self.assertContains(response, created.reference_code)
        self.assertContains(response, "Pending review")
        self.assertEqual(DocumentRequestLog.objects.filter(request=created).count(), 1)

    def test_create_validation_enforces_required_fields_and_business_rules(self):
        resident = self.make_user("maria")
        self.make_request(
            resident,
            document_type=DocumentRequest.DocumentType.BARANGAY_CLEARANCE,
            status=DocumentRequest.Status.PENDING,
        )
        self.client.force_login(resident)

        response = self.client.post(
            reverse("documents:create"),
            {
                "document_type": "",
                "purpose": "abc",
                "copies": 9,
                "notes": "",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("document_type", response.context["form"].errors)
        self.assertIn("purpose", response.context["form"].errors)
        self.assertIn("copies", response.context["form"].errors)

        duplicate = self.client.post(
            reverse("documents:create"),
            {
                "document_type": DocumentRequest.DocumentType.BARANGAY_CLEARANCE,
                "purpose": "Second job application",
                "copies": 1,
                "notes": "",
            },
        )
        self.assertEqual(duplicate.status_code, 200)
        self.assertFormError(
            duplicate.context["form"],
            "document_type",
            "You already have a pending request for Barangay Clearance. "
            "Edit your existing request or wait for barangay staff to process it.",
        )
        self.assertEqual(DocumentRequest.objects.filter(user=resident).count(), 1)

    def test_resident_can_resubmit_same_type_after_previous_is_completed(self):
        resident = self.make_user("maria")
        self.make_request(
            resident,
            document_type=DocumentRequest.DocumentType.RESIDENCY,
            status=DocumentRequest.Status.COMPLETED,
        )
        self.client.force_login(resident)

        response = self.client.post(
            reverse("documents:create"),
            {
                "document_type": DocumentRequest.DocumentType.RESIDENCY,
                "purpose": "School scholarship renewal",
                "copies": 1,
                "notes": "",
            },
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(
            DocumentRequest.objects.filter(
                user=resident,
                document_type=DocumentRequest.DocumentType.RESIDENCY,
            ).count(),
            2,
        )

    def test_resident_only_sees_and_modifies_own_requests(self):
        maria = self.make_user("maria")
        jose = self.make_user("jose")
        maria_req = self.make_request(maria, purpose="Maria job clearance")
        jose_req = self.make_request(jose, purpose="Jose bank application")

        self.client.force_login(maria)
        list_response = self.client.get(reverse("documents:list"))
        self.assertContains(list_response, "Maria job clearance")
        self.assertNotContains(list_response, "Jose bank application")

        self.assertEqual(
            self.client.get(reverse("documents:detail", args=[jose_req.pk])).status_code,
            403,
        )
        self.assertEqual(
            self.client.get(reverse("documents:update", args=[jose_req.pk])).status_code,
            403,
        )
        self.assertEqual(
            self.client.post(reverse("documents:delete", args=[jose_req.pk])).status_code,
            403,
        )
        self.assertTrue(DocumentRequest.objects.filter(pk=jose_req.pk).exists())
        self.assertEqual(
            self.client.get(reverse("documents:detail", args=[maria_req.pk])).status_code,
            200,
        )

    def test_resident_can_update_and_delete_pending_request_but_not_processed_one(self):
        resident = self.make_user("maria")
        pending_req = self.make_request(
            resident,
            document_type=DocumentRequest.DocumentType.BARANGAY_CLEARANCE,
            purpose="Initial purpose text",
        )
        approved_req = self.make_request(
            resident,
            document_type=DocumentRequest.DocumentType.RESIDENCY,
            purpose="Approved residency purpose",
            status=DocumentRequest.Status.APPROVED,
        )
        self.client.force_login(resident)

        update_response = self.client.post(
            reverse("documents:update", args=[pending_req.pk]),
            {
                "document_type": DocumentRequest.DocumentType.INDIGENCY,
                "purpose": "Updated scholarship requirement",
                "copies": 3,
                "notes": "Updated purok note",
            },
            follow=True,
        )
        self.assertRedirects(update_response, reverse("documents:detail", args=[pending_req.pk]))
        pending_req.refresh_from_db()
        self.assertEqual(pending_req.document_type, DocumentRequest.DocumentType.INDIGENCY)
        self.assertEqual(pending_req.purpose, "Updated scholarship requirement")
        self.assertEqual(pending_req.copies, 3)
        self.assertEqual(pending_req.status, DocumentRequest.Status.PENDING)
        self.assertEqual(pending_req.status_logs.count(), 1)

        blocked_edit = self.client.post(
            reverse("documents:update", args=[approved_req.pk]),
            {
                "document_type": DocumentRequest.DocumentType.RESIDENCY,
                "purpose": "Attempted edit after approval",
                "copies": 2,
                "notes": "",
            },
            follow=True,
        )
        self.assertRedirects(blocked_edit, reverse("documents:detail", args=[approved_req.pk]))
        self.assertContains(blocked_edit, "can no longer be edited")
        approved_req.refresh_from_db()
        self.assertEqual(approved_req.purpose, "Approved residency purpose")

        blocked_delete = self.client.post(
            reverse("documents:delete", args=[approved_req.pk]),
            follow=True,
        )
        self.assertRedirects(blocked_delete, reverse("documents:detail", args=[approved_req.pk]))
        self.assertContains(blocked_delete, "cannot be cancelled")
        self.assertTrue(DocumentRequest.objects.filter(pk=approved_req.pk).exists())

        delete_confirm = self.client.get(reverse("documents:delete", args=[pending_req.pk]))
        self.assertContains(delete_confirm, "Cancel this document request?")
        delete_response = self.client.post(
            reverse("documents:delete", args=[pending_req.pk]),
            follow=True,
        )
        self.assertRedirects(delete_response, reverse("documents:list"))
        self.assertContains(delete_response, "was cancelled and removed")
        self.assertFalse(DocumentRequest.objects.filter(pk=pending_req.pk).exists())

    def test_list_filtering_search_and_resident_dashboard_counts(self):
        resident = self.make_user("maria")
        self.make_request(
            resident,
            document_type=DocumentRequest.DocumentType.BARANGAY_CLEARANCE,
            purpose="Passport renewal ID",
            status=DocumentRequest.Status.PENDING,
        )
        self.make_request(
            resident,
            document_type=DocumentRequest.DocumentType.RESIDENCY,
            purpose="School enrollment proof",
            status=DocumentRequest.Status.COMPLETED,
        )
        self.client.force_login(resident)

        filtered = self.client.get(reverse("documents:list"), {"status": "Completed"})
        self.assertContains(filtered, "School enrollment proof")
        self.assertNotContains(filtered, "Passport renewal ID")

        searched = self.client.get(reverse("documents:list"), {"q": "Passport"})
        self.assertContains(searched, "Passport renewal ID")
        self.assertNotContains(searched, "School enrollment proof")

        dash = self.client.get(reverse("resident_dashboard"))
        self.assertEqual(dash.context["request_counts"]["total_requests"], 2)
        self.assertEqual(dash.context["request_counts"]["pending_requests"], 1)
        self.assertContains(dash, "Recent document requests")

    def test_staff_cannot_submit_edit_or_cancel_resident_requests_via_resident_views(self):
        resident = self.make_user("maria")
        staff = self.make_user("staff", staff=True)
        doc_request = self.make_request(resident)
        self.client.force_login(staff)

        self.assertEqual(self.client.get(reverse("documents:create")).status_code, 403)
        self.assertEqual(
            self.client.get(reverse("documents:update", args=[doc_request.pk])).status_code,
            403,
        )
        self.assertEqual(
            self.client.get(reverse("documents:delete", args=[doc_request.pk])).status_code,
            403,
        )
        self.assertEqual(
            self.client.get(reverse("documents:detail", args=[doc_request.pk])).status_code,
            200,
        )
