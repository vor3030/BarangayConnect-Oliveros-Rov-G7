from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .forms import AdminUserChangeForm, RegistrationForm
from .models import User


@admin.register(User)
class AccountAdmin(UserAdmin):
    form = AdminUserChangeForm
    add_form = RegistrationForm
    list_display = ("email", "username", "full_name", "is_staff", "is_active")
    ordering = ("email",)

    def has_module_permission(self, request):
        return request.user.is_superuser

    def has_view_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_add_permission(self, request):
        return request.user.is_superuser

    def has_change_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser

    search_fields = ("email", "username", "full_name")
    fieldsets = (
        (None, {"fields": ("email", "username", "password")}),
        ("Profile", {"fields": ("full_name", "contact_number")}),
        *UserAdmin.fieldsets[2:],
    )
    add_fieldsets = (
        (None, {"fields": (*RegistrationForm.Meta.fields, "password1", "password2")}),
    )


admin.site.site_header = "Barangay Connect administration"
admin.site.index_title = "Barangay administration"
