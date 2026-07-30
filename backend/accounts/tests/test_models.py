from django.test import TestCase

from accounts.models import User


class UserManagerTests(TestCase):
    def test_create_user_with_email(self) -> None:
        user = User.objects.create_user(email="test@example.com", password="pass1234")
        self.assertEqual(user.email, "test@example.com")
        self.assertTrue(user.check_password("pass1234"))
        self.assertTrue(user.is_active)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)

    def test_create_user_normalizes_email(self) -> None:
        user = User.objects.create_user(email="Test@Example.COM", password="pass1234")
        self.assertEqual(user.email, "Test@example.com")

    def test_create_user_without_email_raises_error(self) -> None:
        with self.assertRaisesMessage(ValueError, "Email is required"):
            User.objects.create_user(email="", password="pass1234")

    def test_create_superuser(self) -> None:
        user = User.objects.create_superuser(email="admin@example.com", password="admin123")
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)

    def test_str_returns_email(self) -> None:
        user = User.objects.create_user(email="test@example.com")
        self.assertEqual(str(user), "test@example.com")
