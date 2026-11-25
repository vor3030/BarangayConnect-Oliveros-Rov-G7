from django.urls import path

from . import views

app_name = "documents"

urlpatterns = [
    path("", views.request_list, name="list"),
    path("new/", views.request_create, name="create"),
    path("<int:pk>/", views.request_detail, name="detail"),
    path("<int:pk>/edit/", views.request_update, name="update"),
    path("<int:pk>/delete/", views.request_delete, name="delete"),
]
