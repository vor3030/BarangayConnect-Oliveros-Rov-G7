from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_http_methods, require_safe

from .forms import DocumentRequestForm
from .models import DocumentRequest, DocumentRequestLog

VALID_STATUSES = {choice for choice, _ in DocumentRequest.Status.choices}


def summarize_requests(queryset):
    return queryset.aggregate(
        total_requests=Count("pk"),
        pending_requests=Count("pk", filter=Q(status=DocumentRequest.Status.PENDING)),
        approved_requests=Count("pk", filter=Q(status=DocumentRequest.Status.APPROVED)),
        completed_requests=Count("pk", filter=Q(status=DocumentRequest.Status.COMPLETED)),
        rejected_requests=Count("pk", filter=Q(status=DocumentRequest.Status.REJECTED)),
    )


def build_status_steps(doc_request):
    status = doc_request.status
    if status == DocumentRequest.Status.REJECTED:
        return [
            {
                "label": "Submitted",
                "detail": "Received and logged as Pending.",
                "state": "done",
            },
            {
                "label": "Rejected",
                "detail": doc_request.staff_remarks or "Returned by barangay staff.",
                "state": "rejected",
            },
        ]

    return [
        {
            "label": "Pending review",
            "detail": "Waiting for barangay staff verification.",
            "state": "current" if status == DocumentRequest.Status.PENDING else "done",
        },
        {
            "label": "Approved",
            "detail": "Verified and prepared for barangay hall release.",
            "state": (
                "current"
                if status == DocumentRequest.Status.APPROVED
                else ("done" if status == DocumentRequest.Status.COMPLETED else "upcoming")
            ),
        },
        {
            "label": "Completed",
            "detail": "Document issued and transaction closed.",
            "state": "done" if status == DocumentRequest.Status.COMPLETED else "upcoming",
        },
    ]


def _save_resident_request(form, user, is_create):
    try:
        with transaction.atomic():
            if is_create:
                doc_request = form.save(commit=False)
                doc_request.user = user
                doc_request.status = DocumentRequest.Status.PENDING
                doc_request.save()
                DocumentRequestLog.objects.create(
                    request=doc_request,
                    changed_by=user,
                    previous_status="",
                    new_status=DocumentRequest.Status.PENDING,
                    note="Document request submitted by resident.",
                )
                return doc_request

            locked = DocumentRequest.objects.select_for_update().get(pk=form.instance.pk)
            if not locked.is_editable_by_resident:
                form.add_error(
                    None,
                    f"This request is already {locked.status} and can no longer be edited.",
                )
                return None

            changed_labels = [
                form.fields[name].label or name
                for name in form.changed_data
                if name in form.Meta.fields
            ]
            doc_request = form.save(commit=False)
            doc_request.status = DocumentRequest.Status.PENDING
            doc_request.save(
                update_fields=["document_type", "purpose", "copies", "notes", "updated_at"]
            )
            if changed_labels:
                DocumentRequestLog.objects.create(
                    request=doc_request,
                    changed_by=user,
                    previous_status=DocumentRequest.Status.PENDING,
                    new_status=DocumentRequest.Status.PENDING,
                    note=f"Resident updated: {', '.join(changed_labels)}.",
                )
            return doc_request
    except IntegrityError as error:
        constraint = getattr(getattr(error.__cause__, "diag", None), "constraint_name", None)
        if constraint == "documents_unique_pending_per_user_type":
            doc_type = form.cleaned_data.get("document_type", "this document")
            form.add_error(
                "document_type",
                f"You already have a pending request for {doc_type}. "
                "Edit your existing request or wait for barangay staff to process it.",
            )
            return None
        raise


@login_required
@require_safe
def request_list(request):
    if request.user.is_staff:
        return redirect("admin_dashboard")

    base_qs = DocumentRequest.objects.filter(user=request.user).select_related("reviewed_by")
    counts = summarize_requests(base_qs)

    selected_status = request.GET.get("status", "").strip()
    search_query = request.GET.get("q", "").strip()

    filtered_qs = base_qs
    if selected_status in VALID_STATUSES:
        filtered_qs = filtered_qs.filter(status=selected_status)
    else:
        selected_status = ""

    if search_query:
        query_filter = Q(document_type__icontains=search_query) | Q(purpose__icontains=search_query)
        digits = "".join(ch for ch in search_query if ch.isdigit())
        if digits and (search_query.isdigit() or search_query.upper().startswith("REQ")):
            try:
                query_filter |= Q(pk=int(digits[-4:] if search_query.upper().startswith("REQ") else digits))
            except ValueError:
                pass
        filtered_qs = filtered_qs.filter(query_filter)

    return render(
        request,
        "documents/request_list.html",
        {
            "requests": filtered_qs,
            "counts": counts,
            "selected_status": selected_status,
            "search_query": search_query,
            "status_choices": DocumentRequest.Status.choices,
        },
    )


@login_required
@require_http_methods(["GET", "HEAD", "POST"])
def request_create(request):
    if request.user.is_staff:
        raise PermissionDenied

    form = DocumentRequestForm(
        request.POST if request.method == "POST" else None,
        user=request.user,
    )
    if form.is_valid():
        doc_request = _save_resident_request(form, request.user, is_create=True)
        if doc_request is not None:
            messages.success(
                request,
                f"Request {doc_request.reference_code} for {doc_request.document_type} was submitted and is now Pending review.",
            )
            return redirect("documents:detail", pk=doc_request.pk)

    return render(
        request,
        "documents/request_form.html",
        {
            "form": form,
            "is_edit": False,
        },
    )


@login_required
@require_safe
def request_detail(request, pk):
    doc_request = get_object_or_404(
        DocumentRequest.objects.select_related("user", "reviewed_by").prefetch_related(
            "status_logs__changed_by"
        ),
        pk=pk,
    )
    if not request.user.is_staff and doc_request.user_id != request.user.pk:
        raise PermissionDenied

    return render(
        request,
        "documents/request_detail.html",
        {
            "doc_request": doc_request,
            "status_steps": build_status_steps(doc_request),
            "status_logs": doc_request.status_logs.all(),
        },
    )


@login_required
@require_http_methods(["GET", "HEAD", "POST"])
def request_update(request, pk):
    if request.user.is_staff:
        raise PermissionDenied

    doc_request = get_object_or_404(DocumentRequest, pk=pk)
    if doc_request.user_id != request.user.pk:
        raise PermissionDenied

    if not doc_request.is_editable_by_resident:
        messages.error(
            request,
            f"Request {doc_request.reference_code} is already {doc_request.status} and can no longer be edited.",
        )
        return redirect("documents:detail", pk=doc_request.pk)

    form = DocumentRequestForm(
        request.POST if request.method == "POST" else None,
        instance=doc_request,
        user=request.user,
    )
    if form.is_valid():
        updated = _save_resident_request(form, request.user, is_create=False)
        if updated is not None:
            messages.success(request, f"Request {updated.reference_code} was updated.")
            return redirect("documents:detail", pk=updated.pk)

    return render(
        request,
        "documents/request_form.html",
        {
            "form": form,
            "doc_request": doc_request,
            "is_edit": True,
        },
    )


@login_required
@require_http_methods(["GET", "HEAD", "POST"])
def request_delete(request, pk):
    if request.user.is_staff:
        raise PermissionDenied

    doc_request = get_object_or_404(DocumentRequest, pk=pk)
    if doc_request.user_id != request.user.pk:
        raise PermissionDenied

    if not doc_request.is_deletable_by_resident:
        messages.error(
            request,
            f"Request {doc_request.reference_code} is already {doc_request.status} and cannot be cancelled.",
        )
        return redirect("documents:detail", pk=doc_request.pk)

    if request.method == "POST":
        with transaction.atomic():
            locked = get_object_or_404(
                DocumentRequest.objects.select_for_update(),
                pk=doc_request.pk,
                user=request.user,
            )
            if not locked.is_deletable_by_resident:
                messages.error(
                    request,
                    f"Request {locked.reference_code} is already {locked.status} and cannot be cancelled.",
                )
                return redirect("documents:detail", pk=locked.pk)
            reference_code = locked.reference_code
            document_type = locked.document_type
            locked.delete()
        messages.success(
            request,
            f"Request {reference_code} ({document_type}) was cancelled and removed.",
        )
        return redirect("documents:list")

    return render(
        request,
        "documents/request_confirm_delete.html",
        {"doc_request": doc_request},
    )
