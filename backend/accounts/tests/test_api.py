from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User


class RegistrationTests(APITestCase):
    def test_register_with_valid_data(self) -> None:
        data = {"email": "new@example.com", "password": "strongpass123"}
        response = self.client.post("/api/auth/register/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["email"], "new@example.com")
        self.assertNotIn("password", response.data)
        self.assertTrue(User.objects.filter(email="new@example.com").exists())

    def test_register_without_email_returns_error(self) -> None:
        data = {"password": "strongpass123"}
        response = self.client.post("/api/auth/register/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_with_short_password_returns_error(self) -> None:
        data = {"email": "test@example.com", "password": "short"}
        response = self.client.post("/api/auth/register/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_with_duplicate_email_returns_error(self) -> None:
        User.objects.create_user(email="dup@example.com", password="pass1234")
        data = {"email": "dup@example.com", "password": "anotherpass1"}
        response = self.client.post("/api/auth/register/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class LoginTests(APITestCase):
    def setUp(self) -> None:
        User.objects.create_user(email="user@example.com", password="correctpass1")

    def test_login_with_valid_credentials(self) -> None:
        data = {"email": "user@example.com", "password": "correctpass1"}
        response = self.client.post("/api/auth/login/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_login_with_wrong_password_returns_error(self) -> None:
        data = {"email": "user@example.com", "password": "wrongpass1"}
        response = self.client.post("/api/auth/login/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_with_nonexistent_email_returns_error(self) -> None:
        data = {"email": "nobody@example.com", "password": "somepass1"}
        response = self.client.post("/api/auth/login/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_expects_email_field(self) -> None:
        # simplejwt expects "username" by default if USERNAME_FIELD is not
        # mapped. Verify our custom user works with just email.
        data = {"email": "user@example.com", "password": "correctpass1"}
        response = self.client.post("/api/auth/login/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class MeEndpointTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(email="me@example.com", password="pass1234")

    def test_me_returns_user_when_authenticated(self) -> None:
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], "me@example.com")
        self.assertIn("id", response.data)
        self.assertIn("created_at", response.data)
        self.assertNotIn("password", response.data)

    def test_me_returns_401_when_unauthenticated(self) -> None:
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
