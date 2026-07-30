from django.db.models.query import QuerySet
from rest_framework import generics, status
from rest_framework.request import Request
from rest_framework.response import Response

from .models import Exercise, WorkoutDay, WorkoutSession
from .serializers import (
    ExerciseSerializer,
    WorkoutDaySerializer,
    WorkoutSessionSerializer,
)


class ExerciseListCreateView(generics.ListCreateAPIView):
    """List built-in + user's custom exercises, or create a new custom exercise."""

    serializer_class = ExerciseSerializer

    def get_queryset(self) -> QuerySet[Exercise]:
        """Return preset exercises (user=None) combined with the user's own."""
        return Exercise.objects.filter(
            user__isnull=True
        ) | Exercise.objects.filter(user=self.request.user)


class ExerciseDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a single user-owned exercise."""

    serializer_class = ExerciseSerializer

    def get_queryset(self) -> QuerySet[Exercise]:
        """Scope to only the authenticated user's exercises."""
        return Exercise.objects.filter(user=self.request.user)


class PlanGetUpdateView(generics.GenericAPIView):
    """Get or replace the full workout plan (list of workout days)."""

    serializer_class = WorkoutDaySerializer

    def get(self, request: Request) -> Response:
        """Return all workout days for the user, with nested exercises."""
        days = WorkoutDay.objects.filter(user=request.user).prefetch_related("exercises")
        serializer = WorkoutDaySerializer(days, many=True)
        return Response(serializer.data)

    def put(self, request: Request) -> Response:
        """Replace the user's entire workout plan (destructive)."""
        WorkoutDay.objects.filter(user=request.user).delete()
        serializer = WorkoutDaySerializer(data=request.data, many=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)


class SessionListCreateView(generics.ListCreateAPIView):
    """List past workout sessions or create a new one."""

    serializer_class = WorkoutSessionSerializer

    def get_queryset(self) -> QuerySet[WorkoutSession]:
        """Return the user's sessions, eagerly loading exercises and sets."""
        return WorkoutSession.objects.filter(user=self.request.user).prefetch_related(
            "exercises__sets"
        )

    def perform_create(self, serializer: WorkoutSessionSerializer) -> None:
        """Assign the session to the currently authenticated user."""
        serializer.save(user=self.request.user)
