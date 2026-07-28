from rest_framework import generics, permissions, status
from rest_framework.response import Response
from .models import Exercise, WorkoutDay, WorkoutSession
from .serializers import ExerciseSerializer, WorkoutDaySerializer, WorkoutSessionSerializer


class ExerciseListCreateView(generics.ListCreateAPIView):
    serializer_class = ExerciseSerializer

    def get_queryset(self):
        return Exercise.objects.filter(
            user__isnull=True
        ) | Exercise.objects.filter(user=self.request.user)


class ExerciseDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ExerciseSerializer

    def get_queryset(self):
        return Exercise.objects.filter(user=self.request.user)


class PlanGetUpdateView(generics.GenericAPIView):
    serializer_class = WorkoutDaySerializer

    def get(self, request):
        days = WorkoutDay.objects.filter(user=request.user).prefetch_related("exercises")
        serializer = WorkoutDaySerializer(days, many=True)
        return Response(serializer.data)

    def put(self, request):
        WorkoutDay.objects.filter(user=request.user).delete()
        serializer = WorkoutDaySerializer(data=request.data, many=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)


class SessionListCreateView(generics.ListCreateAPIView):
    serializer_class = WorkoutSessionSerializer

    def get_queryset(self):
        return WorkoutSession.objects.filter(user=self.request.user).prefetch_related(
            "exercises__sets"
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
