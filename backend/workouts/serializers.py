from rest_framework import serializers

from .models import (
    CompletedExercise,
    CompletedSet,
    Exercise,
    PlannedExercise,
    WorkoutDay,
    WorkoutSession,
)


class ExerciseSerializer(serializers.ModelSerializer):
    """Serializer for creating and listing exercises.

    Automatically sets the exercise's user to the requesting user on creation.
    """

    class Meta:
        model = Exercise
        fields = ("id", "name", "category", "tracking_type", "equipment", "is_preset")
        read_only_fields = ("id", "is_preset")

    def create(self, validated_data: dict) -> Exercise:
        """Set the owner to the current user before saving."""
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)


class PlannedExerciseSerializer(serializers.ModelSerializer):
    """Serializer for exercises planned within a workout day."""

    class Meta:
        model = PlannedExercise
        fields = ("id", "exercise", "position", "target_sets")


class WorkoutDaySerializer(serializers.ModelSerializer):
    """Serializer for workout day templates with nested planned exercises."""

    exercises = PlannedExerciseSerializer(many=True)

    class Meta:
        model = WorkoutDay
        fields = ("id", "name", "position", "exercises")

    def create(self, validated_data: dict) -> WorkoutDay:
        """Create a workout day along with its nested planned exercises."""
        exercises_data = validated_data.pop("exercises", [])
        validated_data["user"] = self.context["request"].user
        day = WorkoutDay.objects.create(**validated_data)
        for ex_data in exercises_data:
            PlannedExercise.objects.create(workout_day=day, **ex_data)
        return day


class CompletedSetSerializer(serializers.ModelSerializer):
    """Serializer for individual completed sets within an exercise."""

    class Meta:
        model = CompletedSet
        fields = "__all__"
        read_only_fields = ("completed_exercise",)


class CompletedExerciseSerializer(serializers.ModelSerializer):
    """Serializer for completed exercises with nested sets."""

    sets = CompletedSetSerializer(many=True)

    class Meta:
        model = CompletedExercise
        fields = "__all__"
        read_only_fields = ("workout_session",)

    def create(self, validated_data: dict) -> CompletedExercise:
        """Create a completed exercise and its nested sets."""
        sets_data = validated_data.pop("sets", [])
        ce = CompletedExercise.objects.create(**validated_data)
        for s_data in sets_data:
            CompletedSet.objects.create(completed_exercise=ce, **s_data)
        return ce


class WorkoutSessionSerializer(serializers.ModelSerializer):
    """Serializer for workout sessions with nested exercises and sets."""

    exercises = CompletedExerciseSerializer(many=True, required=False)

    class Meta:
        model = WorkoutSession
        fields = "__all__"
        read_only_fields = ("id", "user")

    def create(self, validated_data: dict) -> WorkoutSession:
        """Create a full workout session including its nested exercises and sets."""
        exercises_data = validated_data.pop("exercises", [])
        validated_data["user"] = self.context["request"].user
        session = WorkoutSession.objects.create(**validated_data)
        for ex_data in exercises_data:
            sets_data = ex_data.pop("sets", [])
            ce = CompletedExercise.objects.create(workout_session=session, **ex_data)
            for s_data in sets_data:
                CompletedSet.objects.create(completed_exercise=ce, **s_data)
        return session
