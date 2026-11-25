from django import forms

from .models import DocumentRequest


class DocumentRequestForm(forms.ModelForm):
    class Meta:
        model = DocumentRequest
        fields = ("document_type", "purpose", "copies", "notes")
        labels = {
            "document_type": "Document type",
            "purpose": "Purpose of request",
            "copies": "Number of copies",
            "notes": "Additional details (optional)",
        }
        help_texts = {
            "document_type": "Choose the barangay certificate or clearance you need.",
            "purpose": "State why you need this document (for example, local employment, scholarship, or medical assistance).",
            "copies": "You may request 1 to 5 copies per submission.",
            "notes": "Include your purok or street details, or any pickup preference for barangay staff.",
        }
        widgets = {
            "document_type": forms.Select(),
            "purpose": forms.TextInput(
                attrs={
                    "placeholder": "e.g., Local employment application",
                    "maxlength": "255",
                }
            ),
            "copies": forms.NumberInput(
                attrs={
                    "min": "1",
                    "max": "5",
                    "inputmode": "numeric",
                }
            ),
            "notes": forms.Textarea(
                attrs={
                    "rows": 4,
                    "placeholder": "Optional address or pickup notes for barangay staff",
                    "maxlength": "1000",
                }
            ),
        }

    def __init__(self, *args, user=None, **kwargs):
        self.user = user
        super().__init__(*args, **kwargs)
        self.fields["document_type"].choices = [
            ("", "Select a barangay document"),
            *DocumentRequest.DocumentType.choices,
        ]

    def clean_purpose(self):
        purpose = " ".join(self.cleaned_data["purpose"].split())
        if len(purpose) < 5:
            raise forms.ValidationError(
                "Describe the purpose in at least 5 characters so barangay staff can verify your request."
            )
        return purpose

    def clean_copies(self):
        copies = self.cleaned_data["copies"]
        if copies < 1 or copies > 5:
            raise forms.ValidationError("Request between 1 and 5 copies per submission.")
        return copies

    def clean_notes(self):
        return self.cleaned_data["notes"].strip()

    def clean(self):
        cleaned_data = super().clean()
        if self.instance.pk and self.instance.status != DocumentRequest.Status.PENDING:
            raise forms.ValidationError(
                f"Requests marked {self.instance.status} can no longer be edited."
            )

        document_type = cleaned_data.get("document_type")
        owner = self.user or (self.instance.user if self.instance.user_id else None)
        if document_type and owner is not None:
            duplicate_qs = DocumentRequest.objects.filter(
                user=owner,
                document_type=document_type,
                status=DocumentRequest.Status.PENDING,
            )
            if self.instance.pk:
                duplicate_qs = duplicate_qs.exclude(pk=self.instance.pk)
            if duplicate_qs.exists():
                self.add_error(
                    "document_type",
                    f"You already have a pending request for {document_type}. "
                    "Edit your existing request or wait for barangay staff to process it.",
                )
        return cleaned_data
