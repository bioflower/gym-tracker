from django.db.models.query import QuerySet
from rest_framework import generics, permissions

from .models import User
from .serializers import RegisterSerializer, UserSerializer


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
