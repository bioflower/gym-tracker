from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models.functions import Lower

from workouts.models import CompletedExercise, Exercise, PlannedExercise


class Command(BaseCommand):
    help = "Merge custom exercises into the preset with the same name, keeping all history and plans."

    @transaction.atomic
    def handle(self, *args, **options) -> None:
        presets = {(e.name.lower(), e.tracking_type): e for e in Exercise.objects.filter(is_preset=True)}
        merged = 0
        for dup in Exercise.objects.filter(is_preset=False).annotate(key=Lower("name")):
            preset = presets.get((dup.key, dup.tracking_type))
            if not preset:
                continue
            CompletedExercise.objects.filter(exercise=dup).update(exercise=preset)
            PlannedExercise.objects.filter(exercise=dup).update(exercise=preset)
            dup.delete()
            merged += 1
        self.stdout.write(f"Merged {merged} duplicate exercise(s).")
