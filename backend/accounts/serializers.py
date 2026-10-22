from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import User


class RegisterSerializer(serializers.ModelSerializer):
    """Serializer for creating new user accounts.

    Accepts email + password and returns the created user
    (excluding the password, which is write-only).
    """

    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ("id", "email", "password", "created_at")
        read_only_fields = ("id", "created_at")

    def create(self, validated_data: dict) -> User:
        """Delegate user creation to the custom UserManager."""
        return User.objects.create_user(**validated_data)


class UserSerializer(serializers.ModelSerializer):
    """Serializer for reading user profile data (read-only)."""

    class Meta:
        model = User
        fields = ("id", "email", "created_at")


class ChangePasswordSerializer(serializers.Serializer):
    """Validate the current password and the new one."""

    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_old_password(self, value: str) -> str:
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Incorrect password.")
        return value

    def validate_new_password(self, value: str) -> str:
        validate_password(value, self.context["request"].user)
        return value
