from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q
from django.urls import reverse
from django.utils import timezone


class DocumentRequest(models.Model):
    class DocumentType(models.TextChoices):
        BARANGAY_CLEARANCE = "Barangay Clearance", "Barangay Clearance"
        INDIGENCY = "Certificate of Indigency", "Certificate of Indigency"
        RESIDENCY = "Certificate of Residency", "Certificate of Residency"
        BUSINESS_CLEARANCE = "Barangay Business Clearance", "Barangay Business Clearance"
        FIRST_TIME_JOBSEEKER = (
            "First-Time Jobseeker Certificate",
            "First-Time Jobseeker Certificate",
        )

    class Status(models.TextChoices):
        PENDING = "Pending", "Pending"
        APPROVED = "Approved", "Approved"
        REJECTED = "Rejected", "Rejected"
        COMPLETED = "Completed", "Completed"

    ALLOWED_TRANSITIONS = {
        Status.PENDING: (Status.APPROVED, Status.REJECTED, Status.COMPLETED),
        Status.APPROVED: (Status.COMPLETED, Status.REJECTED),
        Status.REJECTED: (),
        Status.COMPLETED: (),
    }

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="document_requests",
    )
    document_type = models.CharField(max_length=50, choices=DocumentType.choices)
    purpose = models.CharField(max_length=255)
    copies = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    notes = models.TextField(blank=True, max_length=1000)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_document_requests",
    )
    staff_remarks = models.TextField(blank=True, max_length=1000)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["user", "status"], name="documents_user_status_idx"),
            models.Index(fields=["status", "created_at"], name="documents_status_created_idx"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(copies__gte=1, copies__lte=5),
                name="documents_copies_between_1_and_5",
            ),
            models.UniqueConstraint(
                fields=["user", "document_type"],
                condition=Q(status="Pending"),
                name="documents_unique_pending_per_user_type",
            ),
        ]

    def __str__(self):
        return f"{self.reference_code} - {self.document_type} ({self.status})"

    @property
    def reference_code(self):
        year = timezone.localtime(self.created_at).year if self.created_at else timezone.localdate().year
        if self.pk is None:
            return f"REQ-{year}-DRAFT"
        return f"REQ-{year}-{self.pk:04d}"

    @property
    def status_slug(self):
        return self.status.lower()

    @property
    def is_editable_by_resident(self):
        return self.status == self.Status.PENDING

    @property
    def is_deletable_by_resident(self):
        return self.status == self.Status.PENDING

    @property
    def is_deletable_by_staff(self):
        return self.status == self.Status.REJECTED

    @property
    def allowed_next_statuses(self):
        return self.ALLOWED_TRANSITIONS.get(self.status, ())

    def can_transition_to(self, new_status):
        return new_status in self.allowed_next_statuses

    def get_absolute_url(self):
        return reverse("documents:detail", args=[self.pk])


class DocumentRequestLog(models.Model):
    request = models.ForeignKey(
        DocumentRequest,
        on_delete=models.CASCADE,
        related_name="status_logs",
    )
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="document_status_logs",
    )
    previous_status = models.CharField(max_length=20, blank=True)
    new_status = models.CharField(
        max_length=20,
        choices=DocumentRequest.Status.choices,
    )
    note = models.TextField(blank=True, max_length=500)
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["changed_at", "id"]

    def __str__(self):
        return f"{self.request.reference_code}: {self.previous_status or 'New'} -> {self.new_status}"
