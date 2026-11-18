from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models
from django.db.models.functions import Lower


class AccountManager(UserManager):
    def get_by_natural_key(self, username):
        return self.get(email__iexact=username)

    async def aget_by_natural_key(self, username):
        return await self.aget(email__iexact=username)

    @classmethod
    def normalize_email(cls, email):
        return BaseUserManager.normalize_email(email).lower()


class User(AbstractUser):
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=100)
    contact_number = models.CharField(max_length=32, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username", "full_name"]
    objects = AccountManager()

    class Meta:
        constraints = [
            models.UniqueConstraint(Lower("email"), name="accounts_email_ci_unique"),
            models.UniqueConstraint(Lower("username"), name="accounts_username_ci_unique"),
        ]

    def get_full_name(self):
        return self.full_name

    @property
    def role_label(self):
        return "Admin" if self.is_staff else "Resident"


class ProfilePhoto(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    image = models.BinaryField(editable=False)
