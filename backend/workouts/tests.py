import uuid

from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from workouts.models import WorkoutSession


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
