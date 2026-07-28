from rest_framework import serializers
from .models import Exercise, WorkoutDay, PlannedExercise, WorkoutSession, CompletedExercise, CompletedSet


class ExerciseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Exercise
        fields = ("id", "name", "category", "tracking_type", "equipment", "is_preset")
        read_only_fields = ("id", "is_preset")

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)


class PlannedExerciseSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlannedExercise
        fields = ("id", "exercise", "position", "target_sets")


class WorkoutDaySerializer(serializers.ModelSerializer):
    exercises = PlannedExerciseSerializer(many=True)

    class Meta:
        model = WorkoutDay
        fields = ("id", "name", "position", "exercises")

    def create(self, validated_data):
        exercises_data = validated_data.pop("exercises", [])
        validated_data["user"] = self.context["request"].user
        day = WorkoutDay.objects.create(**validated_data)
        for ex_data in exercises_data:
            PlannedExercise.objects.create(workout_day=day, **ex_data)
        return day


class CompletedSetSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompletedSet
        fields = "__all__"
        read_only_fields = ("completed_exercise",)


class CompletedExerciseSerializer(serializers.ModelSerializer):
    sets = CompletedSetSerializer(many=True)

    class Meta:
        model = CompletedExercise
        fields = "__all__"
        read_only_fields = ("workout_session",)

    def create(self, validated_data):
        sets_data = validated_data.pop("sets", [])
        ce = CompletedExercise.objects.create(**validated_data)
        for s_data in sets_data:
            CompletedSet.objects.create(completed_exercise=ce, **s_data)
        return ce


class WorkoutSessionSerializer(serializers.ModelSerializer):
    exercises = CompletedExerciseSerializer(many=True, required=False)

    class Meta:
        model = WorkoutSession
        fields = "__all__"
        read_only_fields = ("id", "user")

    def create(self, validated_data):
        exercises_data = validated_data.pop("exercises", [])
        validated_data["user"] = self.context["request"].user
        session = WorkoutSession.objects.create(**validated_data)
        for ex_data in exercises_data:
            sets_data = ex_data.pop("sets", [])
            ce = CompletedExercise.objects.create(workout_session=session, **ex_data)
            for s_data in sets_data:
                CompletedSet.objects.create(completed_exercise=ce, **s_data)
        return session
