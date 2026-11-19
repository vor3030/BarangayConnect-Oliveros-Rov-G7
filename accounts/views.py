from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.views import LoginView
from django.core.exceptions import PermissionDenied
from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from django.http import Http404, HttpResponse
from django.shortcuts import redirect, render
from django.urls import reverse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_http_methods, require_safe

from .forms import LoginForm, ProfileForm, RegistrationForm
from .models import ProfilePhoto, User


class AccountLoginView(LoginView):
    template_name = "accounts/login.html"
    authentication_form = LoginForm
    redirect_authenticated_user = True

    def get_success_url(self):
        return reverse("dashboard")


@require_safe
def portfolio_showcase(request):
    return render(request, "accounts/portfolio_showcase.html", {"is_showcase": True})


def save_account_form(form):
    try:
        with transaction.atomic():
            account = form.save(commit=False)
            if account._state.adding:
                account.save()
            else:
                account.save(
                    update_fields=[name for name in form.changed_data if name in form.Meta.fields]
                )
    except IntegrityError as error:
        constraint = getattr(getattr(error.__cause__, "diag", None), "constraint_name", None)
        if constraint in {"accounts_email_ci_unique", "accounts_user_email_key"}:
            form.add_error("email", "An account already uses this email address.")
        elif constraint in {"accounts_username_ci_unique", "accounts_user_username_key"}:
            form.add_error("username", "This username is already taken.")
        else:
            raise
        return False
    return True


@require_http_methods(["GET", "HEAD", "POST"])
def register(request):
    if request.user.is_authenticated:
        return redirect("dashboard")
    form = RegistrationForm(request.POST if request.method == "POST" else None)
    if form.is_valid() and save_account_form(form):
        messages.success(request, "Your account was created. Sign in with your email or username.")
        return redirect("login")
    return render(request, "accounts/register.html", {"form": form})


@login_required
@require_safe
def dashboard(request):
    return redirect("admin_dashboard" if request.user.is_staff else "resident_dashboard")


@login_required
@require_safe
def resident_dashboard(request):
    if request.user.is_staff:
        raise PermissionDenied
    return render(request, "accounts/resident_dashboard.html", profile_overview(request.user))


def profile_overview(user):
    completed = sum(bool(getattr(user, field)) for field in ("full_name", "username", "email", "contact_number"))
    return {"profile_completed_fields": completed, "profile_completion": completed * 25}


@login_required
@require_safe
def admin_dashboard(request):
    if not request.user.is_staff:
        raise PermissionDenied
    counts = User.objects.filter(is_staff=False).aggregate(
        active_residents=Count("pk", filter=Q(is_active=True)),
        inactive_residents=Count("pk", filter=Q(is_active=False)),
    )
    return render(request, "accounts/admin_dashboard.html", counts)


@login_required
@require_safe
def profile(request):
    return render(
        request,
        "accounts/profile.html",
        {"has_profile_photo": ProfilePhoto.objects.filter(user=request.user).exists()},
    )


@login_required
@require_safe
@never_cache
def profile_photo(request):
    image = ProfilePhoto.objects.filter(user=request.user).values_list("image", flat=True).first()
    if image is None:
        raise Http404
    return HttpResponse(bytes(image), content_type="image/jpeg")


@login_required
@require_http_methods(["GET", "HEAD", "POST"])
def edit_profile(request):
    form = ProfileForm(
        request.POST if request.method == "POST" else None,
        request.FILES if request.method == "POST" else None,
        instance=request.user,
    )
    if form.is_valid():
        with transaction.atomic():
            if save_account_form(form):
                photo = form.cleaned_data["photo"]
                if photo is not None:
                    ProfilePhoto.objects.update_or_create(
                        user=request.user, defaults={"image": photo}
                    )
                messages.success(request, "Your profile was updated.")
                return redirect("profile")
    return render(
        request,
        "accounts/edit_profile.html",
        {
            "form": form,
            "has_profile_photo": ProfilePhoto.objects.filter(user=request.user).exists(),
        },
    )
