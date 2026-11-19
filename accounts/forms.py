from io import BytesIO

from django import forms
from django.contrib.auth.forms import AuthenticationForm, BaseUserCreationForm, UserChangeForm, UsernameField
from django.forms import ModelForm
from PIL import Image, ImageOps

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
    username = UsernameField(
        label="Email or username",
        widget=forms.TextInput(attrs={
            "autofocus": True, "autocomplete": "username", "autocapitalize": "none",
        }),
    )

    error_messages = {
        "invalid_login": "Enter a valid email address or username and password.",
        "inactive": "This account is inactive.",
    }


class ProfileForm(UniqueEmailMixin, ModelForm):
    photo = forms.FileField(
        label="Profile photo",
        required=False,
        widget=forms.ClearableFileInput(
            attrs={"accept": "image/jpeg,image/png,image/webp"}
        ),
        help_text="Choose a JPG, PNG, or WebP image up to 5 MB.",
    )

    def clean_photo(self):
        upload = self.cleaned_data["photo"]
        if upload is None:
            return None
        if upload.size > 5 * 1024 * 1024:
            raise forms.ValidationError("Choose an image no larger than 5 MB.")

        try:
            with Image.open(upload, formats=["JPEG", "PNG", "WEBP"]) as image:
                if image.width * image.height > 20_000_000:
                    raise forms.ValidationError("Choose an image under 20 megapixels.")
                photo = ImageOps.fit(
                    ImageOps.exif_transpose(image).convert("RGB"),
                    (256, 256),
                    Image.Resampling.LANCZOS,
                )
                output = BytesIO()
                photo.save(output, format="JPEG", quality=85)
        except (OSError, ValueError, SyntaxError, Image.DecompressionBombError) as error:
            raise forms.ValidationError("Upload a valid JPG, PNG, or WebP image.") from error
        return output.getvalue()

    class Meta:
        model = User
        fields = ("full_name", "email", "contact_number")


class AdminUserChangeForm(UniqueEmailMixin, UserChangeForm):
    class Meta(UserChangeForm.Meta):
        model = User
