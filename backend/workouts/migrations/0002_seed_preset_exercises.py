from django.db import migrations

PRESET_EXERCISES = [
    {"id": "0a1b2c3d-0001-4000-8000-000000000001", "name": "Dumbbell Deadlift", "category": "lower-body", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0001-4000-8000-000000000002", "name": "Goblet Squat", "category": "lower-body", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0001-4000-8000-000000000003", "name": "Dumbbell Lunge", "category": "lower-body", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0001-4000-8000-000000000004", "name": "Romanian Deadlift", "category": "lower-body", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0001-4000-8000-000000000005", "name": "Barbell Squat", "category": "lower-body", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0001-4000-8000-000000000006", "name": "Leg Press", "category": "lower-body", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0001-4000-8000-000000000007", "name": "Hip Thrust", "category": "lower-body", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0001-4000-8000-000000000008", "name": "Calf Raise", "category": "lower-body", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0002-4000-8000-000000000001", "name": "Push-up", "category": "chest", "tracking_type": "reps", "is_preset": True},
    {"id": "0a1b2c3d-0002-4000-8000-000000000002", "name": "Bench Press", "category": "chest", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0002-4000-8000-000000000003", "name": "Dumbbell Bench Press", "category": "chest", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0002-4000-8000-000000000004", "name": "Incline Dumbbell Press", "category": "chest", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0002-4000-8000-000000000005", "name": "Chest Fly", "category": "chest", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0003-4000-8000-000000000001", "name": "Dumbbell Row", "category": "back", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0003-4000-8000-000000000002", "name": "Barbell Row", "category": "back", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0003-4000-8000-000000000003", "name": "Lat Pulldown", "category": "back", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0003-4000-8000-000000000004", "name": "Pull-up", "category": "back", "tracking_type": "reps", "is_preset": True},
    {"id": "0a1b2c3d-0003-4000-8000-000000000005", "name": "Seated Cable Row", "category": "back", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0004-4000-8000-000000000001", "name": "Shoulder Press", "category": "shoulders", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0004-4000-8000-000000000002", "name": "Lateral Raise", "category": "shoulders", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0004-4000-8000-000000000003", "name": "Front Raise", "category": "shoulders", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0005-4000-8000-000000000001", "name": "Dumbbell Curl", "category": "arms", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0005-4000-8000-000000000002", "name": "Hammer Curl", "category": "arms", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0005-4000-8000-000000000003", "name": "Triceps Extension", "category": "arms", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0005-4000-8000-000000000004", "name": "Triceps Pushdown", "category": "arms", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0006-4000-8000-000000000001", "name": "Crunch", "category": "core", "tracking_type": "reps", "is_preset": True},
    {"id": "0a1b2c3d-0006-4000-8000-000000000002", "name": "Plank", "category": "core", "tracking_type": "duration", "is_preset": True},
    {"id": "0a1b2c3d-0006-4000-8000-000000000003", "name": "Side Plank", "category": "core", "tracking_type": "duration", "is_preset": True},
    {"id": "0a1b2c3d-0006-4000-8000-000000000004", "name": "Lying Leg Raise", "category": "core", "tracking_type": "reps", "is_preset": True},
    {"id": "0a1b2c3d-0006-4000-8000-000000000005", "name": "Russian Twist", "category": "core", "tracking_type": "reps", "is_preset": True},
    {"id": "0a1b2c3d-0007-4000-8000-000000000001", "name": "Running", "category": "cardio", "tracking_type": "distance-duration", "is_preset": True},
    {"id": "0a1b2c3d-0007-4000-8000-000000000002", "name": "Treadmill", "category": "cardio", "tracking_type": "distance-duration", "is_preset": True},
    {"id": "0a1b2c3d-0007-4000-8000-000000000003", "name": "Cycling", "category": "cardio", "tracking_type": "distance-duration", "is_preset": True},
    {"id": "0a1b2c3d-0007-4000-8000-000000000004", "name": "Rowing Machine", "category": "cardio", "tracking_type": "distance-duration", "is_preset": True},
    {"id": "0a1b2c3d-0007-4000-8000-000000000005", "name": "Stair Climber", "category": "cardio", "tracking_type": "distance-duration", "is_preset": True},
]


def seed_preset_exercises(apps, schema_editor):
    Exercise = apps.get_model("workouts", "Exercise")
    for ex in PRESET_EXERCISES:
        Exercise.objects.create(**ex)


def reverse_seed(apps, schema_editor):
    Exercise = apps.get_model("workouts", "Exercise")
    Exercise.objects.filter(is_preset=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("workouts", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_preset_exercises, reverse_seed),
    ]
