from django.contrib import admin

from .models import DocumentRequest, DocumentRequestLog


class DocumentRequestLogInline(admin.TabularInline):
    model = DocumentRequestLog
    extra = 0
    readonly_fields = ("previous_status", "new_status", "changed_by", "note", "changed_at")
    can_delete = False


@admin.register(DocumentRequest)
class DocumentRequestAdmin(admin.ModelAdmin):
    list_display = (
        "reference_code",
        "document_type",
        "user",
        "copies",
        "status",
        "reviewed_by",
        "created_at",
    )
    list_filter = ("status", "document_type", "created_at")
    search_fields = ("purpose", "user__full_name", "user__email", "user__username")
    readonly_fields = ("created_at", "updated_at", "processed_at")
    inlines = [DocumentRequestLogInline]
