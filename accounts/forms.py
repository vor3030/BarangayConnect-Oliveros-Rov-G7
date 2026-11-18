from django.contrib.auth.forms import AuthenticationForm, BaseUserCreationForm, UserChangeForm
from django.forms import ModelForm

from .models import User


class UniqueEmailMixin:
    def clean_email(self):
        email = User.objects.normalize_email(self.cleaned_data["email"])
        if User.objects.filter(email__iexact=email).exclude(pk=self.instance.pk).exists():
            self.add_error("email", "An account already uses this email address.")
        return email


class RegistrationForm(UniqueEmailMixin, BaseUserCreationForm):
    class Meta:
        model = User
        fields = ("full_name", "username", "email", "contact_number")

    def clean_username(self):
        username = self.cleaned_data["username"]
        if User.objects.filter(username__iexact=username).exists():
            self.add_error("username", "This username is already taken.")
        return username


class LoginForm(AuthenticationForm):
    error_messages = {
        "invalid_login": "Enter a valid email address and password.",
        "inactive": "This account is inactive.",
    }


class ProfileForm(UniqueEmailMixin, ModelForm):
    class Meta:
        model = User
        fields = ("full_name", "email", "contact_number")


class AdminUserChangeForm(UniqueEmailMixin, UserChangeForm):
    class Meta(UserChangeForm.Meta):
        model = User
