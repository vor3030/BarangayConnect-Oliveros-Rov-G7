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


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class AdminDocumentRequestTests(TestCase):
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
            "purpose": "Local employment requirement",
            "copies": 1,
            "notes": "Purok 3",
            "status": DocumentRequest.Status.PENDING,
        }
        return DocumentRequest.objects.create(user=user, **(defaults | overrides))

    def test_residents_are_blocked_from_admin_management_routes(self):
        resident = self.make_user("maria")
        doc_request = self.make_request(resident, status=DocumentRequest.Status.REJECTED)
        self.client.force_login(resident)

        self.assertEqual(self.client.get(reverse("documents:manage_list")).status_code, 403)
        self.assertEqual(
            self.client.get(reverse("documents:review", args=[doc_request.pk])).status_code,
            403,
        )
        self.assertEqual(
            self.client.post(
                reverse("documents:review", args=[doc_request.pk]),
                {"status": DocumentRequest.Status.APPROVED, "staff_remarks": "Trying to self-approve"},
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.get(reverse("documents:admin_delete", args=[doc_request.pk])).status_code,
            403,
        )

    def test_staff_queue_lists_all_residents_and_supports_filters(self):
        maria = self.make_user("maria")
        jose = self.make_user("jose")
        staff = self.make_user("staff", staff=True)

        req1 = self.make_request(
            maria,
            document_type=DocumentRequest.DocumentType.BARANGAY_CLEARANCE,
            purpose="Maria employment clearance",
            status=DocumentRequest.Status.PENDING,
        )
        req2 = self.make_request(
            jose,
            document_type=DocumentRequest.DocumentType.INDIGENCY,
            purpose="Jose medical assistance",
            status=DocumentRequest.Status.APPROVED,
        )

        self.client.force_login(staff)
        self.assertRedirects(
            self.client.get(reverse("documents:list")),
            reverse("documents:manage_list"),
        )

        all_res = self.client.get(reverse("documents:manage_list"))
        self.assertContains(all_res, req1.reference_code)
        self.assertContains(all_res, req2.reference_code)

        by_status = self.client.get(reverse("documents:manage_list"), {"status": "Pending"})
        self.assertContains(by_status, "Maria employment clearance")
        self.assertNotContains(by_status, "Jose medical assistance")

        by_type = self.client.get(
            reverse("documents:manage_list"),
            {"document_type": DocumentRequest.DocumentType.INDIGENCY},
        )
        self.assertContains(by_type, "Jose medical assistance")
        self.assertNotContains(by_type, "Maria employment clearance")

        by_search = self.client.get(reverse("documents:manage_list"), {"q": "jose@example.com"})
        self.assertContains(by_search, "Jose medical assistance")
        self.assertNotContains(by_search, "Maria employment clearance")

    def test_staff_status_transitions_and_audit_logging(self):
        resident = self.make_user("maria")
        staff = self.make_user("staff", staff=True)
        doc_request = self.make_request(resident)
        self.client.force_login(staff)

        approve_res = self.client.post(
            reverse("documents:review", args=[doc_request.pk]),
            {
                "status": DocumentRequest.Status.APPROVED,
                "staff_remarks": "Ready for pickup at Window 2.",
            },
            follow=True,
        )
        self.assertRedirects(approve_res, reverse("documents:review", args=[doc_request.pk]))
        self.assertContains(approve_res, "status updated to Approved")
        doc_request.refresh_from_db()
        self.assertEqual(doc_request.status, DocumentRequest.Status.APPROVED)
        self.assertEqual(doc_request.reviewed_by, staff)
        self.assertIsNotNone(doc_request.processed_at)
        self.assertEqual(doc_request.staff_remarks, "Ready for pickup at Window 2.")

        complete_res = self.client.post(
            reverse("documents:review", args=[doc_request.pk]),
            {
                "status": DocumentRequest.Status.COMPLETED,
                "staff_remarks": "Claimed with valid government ID.",
            },
            follow=True,
        )
        self.assertRedirects(complete_res, reverse("documents:review", args=[doc_request.pk]))
        doc_request.refresh_from_db()
        self.assertEqual(doc_request.status, DocumentRequest.Status.COMPLETED)
        self.assertEqual(doc_request.status_logs.count(), 2)

        revert_res = self.client.post(
            reverse("documents:review", args=[doc_request.pk]),
            {
                "status": DocumentRequest.Status.PENDING,
                "staff_remarks": "Try reverting",
            },
            follow=True,
        )
        self.assertContains(revert_res, "cannot be transitioned further")
        doc_request.refresh_from_db()
        self.assertEqual(doc_request.status, DocumentRequest.Status.COMPLETED)

    def test_rejection_requires_staff_remarks_and_allows_admin_removal(self):
        resident = self.make_user("maria")
        staff = self.make_user("staff", staff=True)
        doc_request = self.make_request(resident)
        self.client.force_login(staff)

        missing_remarks = self.client.post(
            reverse("documents:review", args=[doc_request.pk]),
            {"status": DocumentRequest.Status.REJECTED, "staff_remarks": "no"},
        )
        self.assertEqual(missing_remarks.status_code, 200)
        self.assertFormError(
            missing_remarks.context["form"],
            "staff_remarks",
            "Provide a clear reason (at least 5 characters) when rejecting a document request.",
        )

        # Cannot remove while still Pending
        blocked_remove = self.client.post(
            reverse("documents:admin_delete", args=[doc_request.pk]),
            follow=True,
        )
        self.assertContains(blocked_remove, "Only Rejected requests can be removed")
        self.assertTrue(DocumentRequest.objects.filter(pk=doc_request.pk).exists())

        # Reject with valid reason
        self.client.post(
            reverse("documents:review", args=[doc_request.pk]),
            {
                "status": DocumentRequest.Status.REJECTED,
                "staff_remarks": "Address outside pilot barangay coverage.",
            },
        )
        doc_request.refresh_from_db()
        self.assertEqual(doc_request.status, DocumentRequest.Status.REJECTED)

        # Staff can now delete Rejected record
        confirm_page = self.client.get(reverse("documents:admin_delete", args=[doc_request.pk]))
        self.assertContains(confirm_page, "Remove rejected request?")
        deleted = self.client.post(
            reverse("documents:admin_delete", args=[doc_request.pk]),
            follow=True,
        )
        self.assertRedirects(deleted, reverse("documents:manage_list"))
        self.assertContains(deleted, "was permanently removed")
        self.assertFalse(DocumentRequest.objects.filter(pk=doc_request.pk).exists())

    def test_admin_dashboard_shows_pending_queue_and_counts(self):
        resident = self.make_user("maria")
        staff = self.make_user("staff", staff=True)
        pending = self.make_request(resident, purpose="Pending clearance review")
        self.make_request(
            resident,
            document_type=DocumentRequest.DocumentType.RESIDENCY,
            status=DocumentRequest.Status.COMPLETED,
        )

        self.client.force_login(staff)
        response = self.client.get(reverse("admin_dashboard"))
        self.assertEqual(response.context["request_counts"]["pending_requests"], 1)
        self.assertEqual(response.context["request_counts"]["total_requests"], 2)
        self.assertContains(response, pending.reference_code)
        self.assertContains(response, "Pending clearance review")
