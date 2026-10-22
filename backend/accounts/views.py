from django.db.models.query import QuerySet
from rest_framework import generics, permissions, status
from rest_framework.request import Request
from rest_framework.response import Response

from .models import User
from .serializers import ChangePasswordSerializer, RegisterSerializer, UserSerializer


class RegisterView(generics.CreateAPIView):
    """Handle new user registration.

    Accepts email and password, creates a User, and returns
    the user data along with JWT tokens.
    """

    queryset: QuerySet[User] = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer


class MeView(generics.RetrieveAPIView):
    """Return the authenticated user's profile."""

    serializer_class = UserSerializer

    def get_object(self) -> User:
        """Override default GET to return the currently authenticated user."""
        return self.request.user


class ChangePasswordView(generics.GenericAPIView):
    """Let the authenticated user change their password."""

    serializer_class = ChangePasswordSerializer

    def post(self, request: Request) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        return Response(status=status.HTTP_204_NO_CONTENT)
