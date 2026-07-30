"""URL configuration for the accounts app.

Defines authentication endpoints:
- register  – create a new user account
- login     – obtain a JWT token pair
- refresh   – refresh an expired access token
- me        – retrieve the authenticated user's profile
"""

from django.urls import URLPattern, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from . import views

urlpatterns: list[URLPattern] = [
    path("register/", views.RegisterView.as_view(), name="register"),
    path("login/", TokenObtainPairView.as_view(), name="login"),
    path("refresh/", TokenRefreshView.as_view(), name="refresh"),
    path("me/", views.MeView.as_view(), name="me"),
]
