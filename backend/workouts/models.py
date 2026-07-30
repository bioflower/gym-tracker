import uuid
from django.db import models
from django.conf import settings


class Exercise(models.Model):
    CATEGORY_CHOICES = [
        ("lower-body", "Lower Body"),
        ("chest", "Chest"),
        ("back", "Back"),
        ("shoulders", "Shoulders"),
        ("arms", "Arms"),
        ("core", "Core"),
        ("cardio", "Cardio"),
        ("other", "Other"),
    ]
    TRACKING_CHOICES = [
        ("weight-reps", "Weight × Reps"),
        ("reps", "Reps"),
        ("duration", "Duration"),
        ("distance-duration", "Distance + Duration"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    tracking_type = models.CharField(max_length=20, choices=TRACKING_CHOICES)
    equipment = models.CharField(max_length=100, blank=True, default="")
    is_preset = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["category", "name"]

    def __str__(self):
        return self.name


class WorkoutDay(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    name = models.CharField(max_length=200)
    position = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["position"]

    def __str__(self):
        return self.name


class PlannedExercise(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workout_day = models.ForeignKey(WorkoutDay, on_delete=models.CASCADE, related_name="exercises")
    exercise = models.ForeignKey(Exercise, on_delete=models.CASCADE)
    position = models.IntegerField(default=0)
    target_sets = models.IntegerField(default=3)

    class Meta:
        ordering = ["position"]

    def __str__(self):
        return f"{self.workout_day.name} - {self.exercise.name}"


class WorkoutSession(models.Model):
    STATUS_CHOICES = [
        ("completed", "Completed"),
        ("skipped", "Skipped"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    workout_day = models.ForeignKey(WorkoutDay, on_delete=models.SET_NULL, null=True)
    workout_name = models.CharField(max_length=200, blank=True, default="")
    date = models.DateField()
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return f"{self.workout_name} - {self.date}"


class CompletedExercise(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workout_session = models.ForeignKey(WorkoutSession, on_delete=models.CASCADE, related_name="exercises")
    exercise = models.ForeignKey(Exercise, on_delete=models.SET_NULL, null=True)
    exercise_name = models.CharField(max_length=200)
    tracking_type = models.CharField(max_length=20)

    class Meta:
        ordering = ["id"]


class CompletedSet(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    completed_exercise = models.ForeignKey(CompletedExercise, on_delete=models.CASCADE, related_name="sets")
    type = models.CharField(max_length=20)
    weight = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    weight_unit = models.CharField(max_length=5, null=True, blank=True)
    reps = models.IntegerField(null=True, blank=True)
    duration_seconds = models.IntegerField(null=True, blank=True)
    distance = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    distance_unit = models.CharField(max_length=5, null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    completed = models.BooleanField(default=False)

    class Meta:
        ordering = ["id"]
