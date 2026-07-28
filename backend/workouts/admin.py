from django.contrib import admin
from .models import Exercise, WorkoutDay, PlannedExercise, WorkoutSession, CompletedExercise, CompletedSet

admin.site.register(Exercise)
admin.site.register(WorkoutDay)
admin.site.register(PlannedExercise)
admin.site.register(WorkoutSession)
admin.site.register(CompletedExercise)
admin.site.register(CompletedSet)
