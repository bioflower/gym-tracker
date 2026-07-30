import uuid

from django.conf import settings
from django.db import models


class Exercise(models.Model):
    """Catalog of exercises that users can log in their workouts.

    Includes built-in preset exercises (is_preset=True) and user-created
    custom exercises linked to a specific user.
    """

    CATEGORY_CHOICES: list[tuple[str, str]] = [
        ("lower-body", "Lower Body"),
        ("chest", "Chest"),
        ("back", "Back"),
        ("shoulders", "Shoulders"),
        ("arms", "Arms"),
        ("core", "Core"),
        ("cardio", "Cardio"),
        ("other", "Other"),
    ]
    TRACKING_CHOICES: list[tuple[str, str]] = [
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

    def __str__(self) -> str:
        return self.name


class WorkoutDay(models.Model):
    """A named workout template (e.g. 'Push Day', 'Leg Day').

    Contains a sequence of PlannedExercises. Each user can have multiple
    workout days ordered by their position field.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    name = models.CharField(max_length=200)
    position = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["position"]

    def __str__(self) -> str:
        return self.name


class PlannedExercise(models.Model):
    """Links an Exercise to a WorkoutDay with ordering and target set count."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workout_day = models.ForeignKey(WorkoutDay, on_delete=models.CASCADE, related_name="exercises")
    exercise = models.ForeignKey(Exercise, on_delete=models.CASCADE)
    position = models.IntegerField(default=0)
    target_sets = models.IntegerField(default=3)

    class Meta:
        ordering = ["position"]

    def __str__(self) -> str:
        return f"{self.workout_day.name} - {self.exercise.name}"


class WorkoutSession(models.Model):
    """A single logged workout on a specific date.

    Records what was done during a workout, including start/end times
    and whether it was completed or skipped.
    """

    STATUS_CHOICES: list[tuple[str, str]] = [
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

    def __str__(self) -> str:
        return f"{self.workout_name} - {self.date}"


class CompletedExercise(models.Model):
    """Records which exercise was performed in a workout session.

    Stores a snapshot of the exercise name at the time (in case the Exercise
    definition changes later), plus the tracking type used.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workout_session = models.ForeignKey(WorkoutSession, on_delete=models.CASCADE, related_name="exercises")
    exercise = models.ForeignKey(Exercise, on_delete=models.SET_NULL, null=True)
    exercise_name = models.CharField(max_length=200)
    tracking_type = models.CharField(max_length=20)

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return self.exercise_name


class CompletedSet(models.Model):
    """An individual set within a CompletedExercise.

    Supports multiple tracking modes:
    - Weight × Reps (weight + reps)
    - Reps only (reps)
    - Duration (duration_seconds)
    - Distance + Duration (distance + duration_seconds)
    """

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
