from django.urls import path
from . import views

urlpatterns = [
    path("exercises/", views.ExerciseListCreateView.as_view(), name="exercise-list"),
    path("exercises/<uuid:pk>/", views.ExerciseDetailView.as_view(), name="exercise-detail"),
    path("plan/", views.PlanGetUpdateView.as_view(), name="plan"),
    path("sessions/", views.SessionListCreateView.as_view(), name="session-list"),
]
