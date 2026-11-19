from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower


class AccountManager(UserManager):
    def get_by_natural_key(self, username):
        try:
            return self.get(Q(email__iexact=username) | Q(username__iexact=username))
        except self.model.MultipleObjectsReturned:
            # An email can also be another account's username. Reject ambiguous
            # identifiers rather than selecting an account or raising a server error.
            raise self.model.DoesNotExist from None

    async def aget_by_natural_key(self, username):
        try:
            return await self.aget(Q(email__iexact=username) | Q(username__iexact=username))
        except self.model.MultipleObjectsReturned:
            raise self.model.DoesNotExist from None

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
