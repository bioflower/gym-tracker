import uuid

from django.core.management import call_command
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from workouts.models import CompletedExercise, Exercise, WorkoutSession


class SessionRenameTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(email="a@example.com", password="pass1234")
        self.client.force_authenticate(self.user)

    def _create(self, **extra) -> dict:
        body = {"workout_name": "Chest", "date": "2026-10-22", "status": "completed", "exercises": [], **extra}
        response = self.client.post("/api/workouts/sessions/", body, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response.data

    def test_create_keeps_client_supplied_id(self) -> None:
        sid = str(uuid.uuid4())
        self.assertEqual(self._create(id=sid)["id"], sid)

    def test_rename_session(self) -> None:
        sid = self._create()["id"]
        response = self.client.patch(f"/api/workouts/sessions/{sid}/", {"workout_name": "Legs"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(WorkoutSession.objects.get(pk=sid).workout_name, "Legs")

    def test_cannot_rename_another_users_session(self) -> None:
        sid = self._create()["id"]
        self.client.force_authenticate(User.objects.create_user(email="b@example.com", password="pass1234"))
        response = self.client.patch(f"/api/workouts/sessions/{sid}/", {"workout_name": "x"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class MergeDuplicateExercisesTests(APITestCase):
    def test_custom_exercise_is_merged_into_same_named_preset(self) -> None:
        user = User.objects.create_user(email="a@example.com", password="pass1234")
        preset = Exercise.objects.create(name="Bench Press", category="chest", tracking_type="weight-reps", is_preset=True)
        dup = Exercise.objects.create(user=user, name="bench press", category="other", tracking_type="weight-reps")
        session = WorkoutSession.objects.create(user=user, date="2026-10-21", status="completed")
        ce = CompletedExercise.objects.create(workout_session=session, exercise=dup, exercise_name="Bench Press", tracking_type="weight-reps")

        call_command("merge_duplicate_exercises")

        ce.refresh_from_db()
        self.assertEqual(ce.exercise, preset)
        self.assertFalse(Exercise.objects.filter(pk=dup.pk).exists())
