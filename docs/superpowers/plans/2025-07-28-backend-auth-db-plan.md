# Backend + Auth + Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a serverless Django backend with JWT auth, Postgres database, and offline-first sync to the existing React gym tracker.

**Architecture:** Monorepo with `backend/` (Django 5 + DRF + simplejwt) deployed via Zappa to AWS Lambda, and `frontend/` (React SPA) modified to call the API when online, falling back to localStorage when offline. Neon.tech Postgres for the database. Per-set timing replaces exercise-level timing.

**Tech Stack:** Django 5, Django REST Framework, djangorestframework-simplejwt, Zappa, Neon.tech Postgres, AWS Lambda, React 19, TypeScript 6, Vite 8.

## Global Constraints

- All new backend code under `backend/` directory at repo root
- All database IDs are UUIDs
- JWT tokens (access 30min, refresh 1 day) for all authenticated endpoints
- Preset exercises are seeded via Django data migration (user=None, is_preset=True)
- Frontend must work fully offline — API calls are best-effort, localStorage is fallback
- Per-set timing: each set has its own started_at, completed_at, completed (togglable)
- No exercise-level timing — exercise "done" is derived from all sets being completed

---

### Task 1: Django Project Scaffold

**Files:**
- Create: `backend/manage.py`
- Create: `backend/config/__init__.py`
- Create: `backend/config/settings.py`
- Create: `backend/config/urls.py`
- Create: `backend/config/wsgi.py`
- Create: `backend/accounts/__init__.py`
- Create: `backend/requirements.txt`
- Create: `backend/startup.sh`

**Interfaces:**
- Consumes: Python 3.12+, pip
- Produces: A working Django project at `backend/` that runs `python manage.py runserver`

- [ ] **Step 1: Create backend directory structure**

```bash
mkdir -p backend/config backend/accounts backend/workouts
touch backend/config/__init__.py backend/accounts/__init__.py backend/workouts/__init__.py
```

- [ ] **Step 2: Create requirements.txt**

Write `backend/requirements.txt`:
```
Django>=5.1,<5.2
djangorestframework>=3.15,<3.16
djangorestframework-simplejwt>=5.4,<5.5
django-cors-headers>=4.6,<4.7
psycopg2-binary>=2.9,<2.10
zappa>=0.60,<0.61
python-dotenv>=1.0,<1.1
```

- [ ] **Step 3: Create manage.py**

Write `backend/manage.py`:
```python
#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys


def main():
    """Run administrative tasks."""
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django."
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Create config/settings.py**

Write `backend/config/settings.py`:
```python
import os
from pathlib import Path
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-secret-key-change-in-prod")
DEBUG = os.environ.get("DJANGO_DEBUG", "True").lower() == "true"
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "accounts",
    "workouts",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

if os.environ.get("DATABASE_URL"):
    import dj_database_url
    DATABASES["default"] = dj_database_url.config(default=os.environ["DATABASE_URL"])

AUTH_USER_MODEL = "accounts.User"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 100,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

CORS_ALLOW_ALL_ORIGINS = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
```

- [ ] **Step 5: Create config/urls.py**

Write `backend/config/urls.py`:
```python
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/workouts/", include("workouts.urls")),
]
```

- [ ] **Step 6: Create config/wsgi.py**

Write `backend/config/wsgi.py`:
```python
import os
from django.core.wsgi import get_wsgi_application
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
application = get_wsgi_application()
```

- [ ] **Step 7: Create startup.sh**

Write `backend/startup.sh`:
```bash
#!/bin/bash
python manage.py migrate --noinput
python manage.py collectstatic --noinput
```

- [ ] **Step 8: Verify Django project works**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py check
```

Expected: `System check identified no issues (0 silenced).`

- [ ] **Step 9: Commit**

```bash
git add backend/
git commit -m "feat: scaffold Django project with DRF and JWT config"
```

---

### Task 2: Accounts App — User Model + JWT Auth

**Files:**
- Create: `backend/accounts/models.py`
- Create: `backend/accounts/serializers.py`
- Create: `backend/accounts/views.py`
- Create: `backend/accounts/urls.py`
- Create: `backend/accounts/admin.py`

**Interfaces:**
- Consumes: Django project from Task 1
- Produces: Working auth endpoints: register, login, token-refresh, me

- [ ] **Step 1: Create accounts/models.py**

Write `backend/accounts/models.py`:
```python
import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **kwargs):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **kwargs)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **kwargs):
        kwargs.setdefault("is_staff", True)
        kwargs.setdefault("is_superuser", True)
        return self.create_user(email, password, **kwargs)


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.email
```

- [ ] **Step 2: Create accounts/serializers.py**

Write `backend/accounts/serializers.py`:
```python
from rest_framework import serializers
from .models import User


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ("email", "password")

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "email", "created_at")
```

- [ ] **Step 3: Create accounts/views.py**

Write `backend/accounts/views.py`:
```python
from rest_framework import generics, permissions
from rest_framework.response import Response
from .serializers import RegisterSerializer, UserSerializer
from .models import User


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer


class MeView(generics.RetrieveAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user
```

- [ ] **Step 4: Create accounts/urls.py**

Write `backend/accounts/urls.py`:
```python
from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from . import views

urlpatterns = [
    path("register/", views.RegisterView.as_view(), name="register"),
    path("login/", TokenObtainPairView.as_view(), name="login"),
    path("refresh/", TokenRefreshView.as_view(), name="refresh"),
    path("me/", views.MeView.as_view(), name="me"),
]
```

- [ ] **Step 5: Create accounts/admin.py**

Write `backend/accounts/admin.py`:
```python
from django.contrib import admin
from .models import User

admin.site.register(User)
```

- [ ] **Step 6: Run migrations and verify**

```bash
cd backend
python manage.py makemigrations accounts
python manage.py migrate
python manage.py check
```

Expected: `System check identified no issues (0 silenced).`

- [ ] **Step 7: Test register endpoint**

```bash
python manage.py shell -c "
from django.test import Client
c = Client()
resp = c.post('/api/auth/register/', {'email': 'test@test.com', 'password': 'testpass123'}, content_type='application/json')
print(resp.status_code, resp.json())
"
```

Expected: `201 {'id': '...', 'email': 'test@test.com', 'created_at': '...'}`

- [ ] **Step 8: Commit**

```bash
git add backend/accounts/
git commit -m "feat: add User model and JWT auth endpoints"
```

---

### Task 3: Workouts App — Models + Preset Data Migration

**Files:**
- Create: `backend/workouts/models.py`
- Create: `backend/workouts/admin.py`
- Create: `backend/workouts/migrations/__init__.py`

**Interfaces:**
- Consumes: User model from Task 2
- Produces: All workout models (Exercise, WorkoutDay, PlannedExercise, WorkoutSession, CompletedExercise, CompletedSet) and a data migration with 35+ preset exercises

- [ ] **Step 1: Create workouts/models.py**

Write `backend/workouts/models.py`:
```python
import uuid
from django.db import models
from django.conf import settings


class Exercise(models.Model):
    CATEGORY_CHOICES = [
        ("lower-body", "Lower Body"),
        ("chest", "Chest"),
        ("back", "Back"),
        ("shoulders", "Shoulders"),
        ("arms", "Arms"),
        ("core", "Core"),
        ("cardio", "Cardio"),
        ("other", "Other"),
    ]
    TRACKING_CHOICES = [
        ("weight-reps", "Weight × Reps"),
        ("reps", "Reps"),
        ("duration", "Duration"),
        ("distance-duration", "Distance + Duration"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    tracking_type = models.CharField(max_length=20, choices=TRACKING_CHOICES)
    equipment = models.CharField(max_length=100, blank=True, default="")
    is_preset = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["category", "name"]

    def __str__(self):
        return self.name


class WorkoutDay(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    name = models.CharField(max_length=200)
    position = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["position"]

    def __str__(self):
        return self.name


class PlannedExercise(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workout_day = models.ForeignKey(WorkoutDay, on_delete=models.CASCADE, related_name="exercises")
    exercise = models.ForeignKey(Exercise, on_delete=models.CASCADE)
    position = models.IntegerField(default=0)
    target_sets = models.IntegerField(default=3)

    class Meta:
        ordering = ["position"]

    def __str__(self):
        return f"{self.workout_day.name} - {self.exercise.name}"


class WorkoutSession(models.Model):
    STATUS_CHOICES = [
        ("completed", "Completed"),
        ("skipped", "Skipped"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    workout_day = models.ForeignKey(WorkoutDay, on_delete=models.SET_NULL, null=True)
    workout_name = models.CharField(max_length=200, blank=True, default="")
    date = models.DateField()
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return f"{self.workout_name} - {self.date}"


class CompletedExercise(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workout_session = models.ForeignKey(WorkoutSession, on_delete=models.CASCADE, related_name="exercises")
    exercise = models.ForeignKey(Exercise, on_delete=models.SET_NULL, null=True)
    exercise_name = models.CharField(max_length=200)
    tracking_type = models.CharField(max_length=20)

    class Meta:
        ordering = ["id"]


class CompletedSet(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    completed_exercise = models.ForeignKey(CompletedExercise, on_delete=models.CASCADE, related_name="sets")
    type = models.CharField(max_length=20)
    weight = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    weight_unit = models.CharField(max_length=5, null=True, blank=True)
    reps = models.IntegerField(null=True, blank=True)
    duration_seconds = models.IntegerField(null=True, blank=True)
    distance = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    distance_unit = models.CharField(max_length=5, null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    completed = models.BooleanField(default=False)

    class Meta:
        ordering = ["id"]
```

- [ ] **Step 2: Create workouts/admin.py**

Write `backend/workouts/admin.py`:
```python
from django.contrib import admin
from .models import Exercise, WorkoutDay, PlannedExercise, WorkoutSession, CompletedExercise, CompletedSet

admin.site.register(Exercise)
admin.site.register(WorkoutDay)
admin.site.register(PlannedExercise)
admin.site.register(WorkoutSession)
admin.site.register(CompletedExercise)
admin.site.register(CompletedSet)
```

- [ ] **Step 3: Create preset exercises migration**

```bash
cd backend
python manage.py makemigrations workouts
python manage.py migrate
```

Then create a data migration:
```bash
python manage.py makemigrations workouts --name seed_preset_exercises --empty
```

Edit the generated migration file (find the correct file number):
```python
from django.db import migrations

PRESET_EXERCISES = [
    # Lower body
    {"id": "0a1b2c3d-0001-4000-8000-000000000001", "name": "Dumbbell Deadlift", "category": "lower-body", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0001-4000-8000-000000000002", "name": "Goblet Squat", "category": "lower-body", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0001-4000-8000-000000000003", "name": "Dumbbell Lunge", "category": "lower-body", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0001-4000-8000-000000000004", "name": "Romanian Deadlift", "category": "lower-body", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0001-4000-8000-000000000005", "name": "Barbell Squat", "category": "lower-body", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0001-4000-8000-000000000006", "name": "Leg Press", "category": "lower-body", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0001-4000-8000-000000000007", "name": "Hip Thrust", "category": "lower-body", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0001-4000-8000-000000000008", "name": "Calf Raise", "category": "lower-body", "tracking_type": "weight-reps", "is_preset": True},
    # Chest
    {"id": "0a1b2c3d-0002-4000-8000-000000000001", "name": "Push-up", "category": "chest", "tracking_type": "reps", "is_preset": True},
    {"id": "0a1b2c3d-0002-4000-8000-000000000002", "name": "Bench Press", "category": "chest", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0002-4000-8000-000000000003", "name": "Dumbbell Bench Press", "category": "chest", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0002-4000-8000-000000000004", "name": "Incline Dumbbell Press", "category": "chest", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0002-4000-8000-000000000005", "name": "Chest Fly", "category": "chest", "tracking_type": "weight-reps", "is_preset": True},
    # Back
    {"id": "0a1b2c3d-0003-4000-8000-000000000001", "name": "Dumbbell Row", "category": "back", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0003-4000-8000-000000000002", "name": "Barbell Row", "category": "back", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0003-4000-8000-000000000003", "name": "Lat Pulldown", "category": "back", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0003-4000-8000-000000000004", "name": "Pull-up", "category": "back", "tracking_type": "reps", "is_preset": True},
    {"id": "0a1b2c3d-0003-4000-8000-000000000005", "name": "Seated Cable Row", "category": "back", "tracking_type": "weight-reps", "is_preset": True},
    # Shoulders
    {"id": "0a1b2c3d-0004-4000-8000-000000000001", "name": "Shoulder Press", "category": "shoulders", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0004-4000-8000-000000000002", "name": "Lateral Raise", "category": "shoulders", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0004-4000-8000-000000000003", "name": "Front Raise", "category": "shoulders", "tracking_type": "weight-reps", "is_preset": True},
    # Arms
    {"id": "0a1b2c3d-0005-4000-8000-000000000001", "name": "Dumbbell Curl", "category": "arms", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0005-4000-8000-000000000002", "name": "Hammer Curl", "category": "arms", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0005-4000-8000-000000000003", "name": "Triceps Extension", "category": "arms", "tracking_type": "weight-reps", "is_preset": True},
    {"id": "0a1b2c3d-0005-4000-8000-000000000004", "name": "Triceps Pushdown", "category": "arms", "tracking_type": "weight-reps", "is_preset": True},
    # Core
    {"id": "0a1b2c3d-0006-4000-8000-000000000001", "name": "Crunch", "category": "core", "tracking_type": "reps", "is_preset": True},
    {"id": "0a1b2c3d-0006-4000-8000-000000000002", "name": "Plank", "category": "core", "tracking_type": "duration", "is_preset": True},
    {"id": "0a1b2c3d-0006-4000-8000-000000000003", "name": "Side Plank", "category": "core", "tracking_type": "duration", "is_preset": True},
    {"id": "0a1b2c3d-0006-4000-8000-000000000004", "name": "Lying Leg Raise", "category": "core", "tracking_type": "reps", "is_preset": True},
    {"id": "0a1b2c3d-0006-4000-8000-000000000005", "name": "Russian Twist", "category": "core", "tracking_type": "reps", "is_preset": True},
    # Cardio
    {"id": "0a1b2c3d-0007-4000-8000-000000000001", "name": "Running", "category": "cardio", "tracking_type": "distance-duration", "is_preset": True},
    {"id": "0a1b2c3d-0007-4000-8000-000000000002", "name": "Treadmill", "category": "cardio", "tracking_type": "distance-duration", "is_preset": True},
    {"id": "0a1b2c3d-0007-4000-8000-000000000003", "name": "Cycling", "category": "cardio", "tracking_type": "distance-duration", "is_preset": True},
    {"id": "0a1b2c3d-0007-4000-8000-000000000004", "name": "Rowing Machine", "category": "cardio", "tracking_type": "distance-duration", "is_preset": True},
    {"id": "0a1b2c3d-0007-4000-8000-000000000005", "name": "Stair Climber", "category": "cardio", "tracking_type": "distance-duration", "is_preset": True},
]


def seed_preset_exercises(apps, schema_editor):
    Exercise = apps.get_model("workouts", "Exercise")
    for ex in PRESET_EXERCISES:
        Exercise.objects.create(**ex)


def reverse_seed(apps, schema_editor):
    Exercise = apps.get_model("workouts", "Exercise")
    Exercise.objects.filter(is_preset=True).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("workouts", "0001_initial"),
    ]
    operations = [
        migrations.RunPython(seed_preset_exercises, reverse_seed),
    ]
```

- [ ] **Step 4: Apply migration and verify**

```bash
cd backend
python manage.py migrate
python manage.py shell -c "from workouts.models import Exercise; print(Exercise.objects.count())"
```

Expected: `35`

- [ ] **Step 5: Commit**

```bash
git add backend/workouts/
git commit -m "feat: add workout models and seed preset exercises"
```

---

### Task 4: Workouts API — Exercise CRUD, Plan, Sessions

**Files:**
- Create: `backend/workouts/serializers.py`
- Create: `backend/workouts/views.py`
- Create: `backend/workouts/urls.py`

**Interfaces:**
- Consumes: Models from Task 3
- Produces: REST API for exercises (CRUD), plan (GET/PUT), sessions (POST/GET)

- [ ] **Step 1: Create workouts/serializers.py**

Write `backend/workouts/serializers.py`:
```python
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


class CompletedExerciseSerializer(serializers.ModelSerializer):
    sets = CompletedSetSerializer(many=True)

    class Meta:
        model = CompletedExercise
        fields = "__all__"

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
        read_only_fields = ("id",)

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
```

- [ ] **Step 2: Create workouts/views.py**

Write `backend/workouts/views.py`:
```python
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from .models import Exercise, WorkoutDay, WorkoutSession
from .serializers import ExerciseSerializer, WorkoutDaySerializer, WorkoutSessionSerializer


class ExerciseListCreateView(generics.ListCreateAPIView):
    serializer_class = ExerciseSerializer

    def get_queryset(self):
        return Exercise.objects.filter(
            user__isnull=True
        ) | Exercise.objects.filter(user=self.request.user)


class ExerciseDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ExerciseSerializer

    def get_queryset(self):
        return Exercise.objects.filter(user=self.request.user)


class PlanGetUpdateView(generics.GenericAPIView):
    serializer_class = WorkoutDaySerializer

    def get(self, request):
        days = WorkoutDay.objects.filter(user=request.user).prefetch_related("exercises")
        serializer = WorkoutDaySerializer(days, many=True)
        return Response(serializer.data)

    def put(self, request):
        WorkoutDay.objects.filter(user=request.user).delete()
        serializer = WorkoutDaySerializer(data=request.data, many=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)


class SessionListCreateView(generics.ListCreateAPIView):
    serializer_class = WorkoutSessionSerializer

    def get_queryset(self):
        return WorkoutSession.objects.filter(user=self.request.user).prefetch_related(
            "exercises__sets"
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
```

- [ ] **Step 3: Create workouts/urls.py**

Write `backend/workouts/urls.py`:
```python
from django.urls import path
from . import views

urlpatterns = [
    path("exercises/", views.ExerciseListCreateView.as_view(), name="exercise-list"),
    path("exercises/<uuid:pk>/", views.ExerciseDetailView.as_view(), name="exercise-detail"),
    path("plan/", views.PlanGetUpdateView.as_view(), name="plan"),
    path("sessions/", views.SessionListCreateView.as_view(), name="session-list"),
]
```

- [ ] **Step 4: Run checks and verify API**

```bash
cd backend
python manage.py check
python manage.py runserver 0.0.0.0:8000 &
sleep 2
# Register a user
curl -s -X POST http://localhost:8000/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"testpass123"}'
# Login
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"testpass123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['access'])")
# List exercises (should include all 35 presets)
curl -s http://localhost:8000/api/workouts/exercises/ -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d))"
```

Expected: `35`

- [ ] **Step 5: Kill server and commit**

```bash
kill %1 2>/dev/null
git add backend/workouts/serializers.py backend/workouts/views.py backend/workouts/urls.py
git commit -m "feat: add workouts REST API endpoints"
```

---

### Task 5: Frontend Types Update (Per-Set Timing)

**Files:**
- Modify: `frontend/src/types/gym.ts`

**Interfaces:**
- Consumes: existing TypeScript types
- Produces: Updated types with per-set timing and removed exercise-level timing

- [ ] **Step 1: Update types/gym.ts**

Read `frontend/src/types/gym.ts` first, then make these changes:

- Each set type (WeightRepSet, RepsOnlySet, DurationSet, DistanceDurationSet): add `startedAt: string | null`, `completedAt: string | null`, toggle `completed` from `false` to `boolean`
- Remove `startedAt`, `completedAt`, `completed` from `ActiveExercise`
- Remove `startedAt`, `completedAt` from `CompletedExercise` (it now just groups sets)
- `CompletedSet` gains `startedAt`, `completedAt`, `completed`

Edit `frontend/src/types/gym.ts` — change each set interface to add timing fields:

```typescript
export interface WeightRepSet {
  id: string;
  weight: number | null;
  weightUnit: WeightUnit;
  reps: number | null;
  startedAt: string | null;
  completedAt: string | null;
  completed: boolean;
}

export interface RepsOnlySet {
  id: string;
  reps: number | null;
  startedAt: string | null;
  completedAt: string | null;
  completed: boolean;
}

export interface DurationSet {
  id: string;
  durationSeconds: number | null;
  startedAt: string | null;
  completedAt: string | null;
  completed: boolean;
}

export interface DistanceDurationSet {
  id: string;
  distance: number | null;
  distanceUnit: DistanceUnit;
  durationSeconds: number | null;
  notes: string;
  startedAt: string | null;
  completedAt: string | null;
  completed: boolean;
}
```

Change `ActiveExercise`:
```typescript
export interface ActiveExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  trackingType: TrackingType;
  sets: ExerciseSet[];
  notes: string;
}
```

Change `CompletedExercise`:
```typescript
export interface CompletedExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  trackingType: TrackingType;
  sets: CompletedSet[];
}
```

Change `CompletedSet` to add timing:
```typescript
export interface CompletedSet {
  id: string;
  type: TrackingType;
  weight?: number | null;
  weightUnit?: WeightUnit;
  reps?: number | null;
  durationSeconds?: number | null;
  distance?: number | null;
  distanceUnit?: DistanceUnit;
  startedAt?: string | null;
  completedAt?: string | null;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend
npx tsc --noEmit
```

Expected: compiles without errors (there will be errors — these are fixed in Tasks 6-10 as we update the components to use the new types)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/gym.ts
git commit -m "feat: update types for per-set timing (startedAt, completedAt, togglable completed)"
```

---

### Task 6: Frontend API Client and Auth Layer

**Files:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/auth.ts`
- Create: `frontend/src/api/workouts.ts`
- Create: `frontend/src/api/sync.ts`
- Create: `frontend/src/context/AuthContext.tsx`
- Create: `frontend/src/hooks/useAuth.ts`
- Create: `frontend/src/pages/LoginPage.tsx`
- Create: `frontend/src/pages/RegisterPage.tsx`
- Create: `frontend/src/components/AuthGuard.tsx`

**Interfaces:**
- Consumes: Updated types from Task 5
- Produces: Full API client and auth system for the frontend

- [ ] **Step 1: Create src/api/client.ts**

Write `frontend/src/api/client.ts`:
```typescript
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

interface Tokens {
  access: string;
  refresh: string;
}

function getTokens(): Tokens | null {
  const raw = localStorage.getItem('gym-tracker-tokens');
  if (!raw) return null;
  return JSON.parse(raw);
}

function setTokens(tokens: Tokens): void {
  localStorage.setItem('gym-tracker-tokens', JSON.stringify(tokens));
}

function clearTokens(): void {
  localStorage.removeItem('gym-tracker-tokens');
}

async function refreshAccessToken(refresh: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    setTokens({ access: data.access, refresh });
    return data.access;
  } catch {
    return null;
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const tokens = getTokens();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (tokens) {
    headers['Authorization'] = `Bearer ${tokens.access}`;
  }

  let res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

  if (res.status === 401 && tokens) {
    const newAccess = await refreshAccessToken(tokens.refresh);
    if (newAccess) {
      headers['Authorization'] = `Bearer ${newAccess}`;
      res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    } else {
      clearTokens();
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export { getTokens, setTokens, clearTokens, API_BASE };
```

- [ ] **Step 2: Create src/api/auth.ts**

Write `frontend/src/api/auth.ts`:
```typescript
import { apiRequest, setTokens, clearTokens, getTokens } from './client';

interface User {
  id: string;
  email: string;
  created_at: string;
}

export async function register(email: string, password: string): Promise<User> {
  return apiRequest<User>('/auth/register/', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function login(email: string, password: string): Promise<void> {
  const data = await apiRequest<{ access: string; refresh: string }>('/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setTokens(data);
}

export async function getMe(): Promise<User> {
  return apiRequest<User>('/auth/me/');
}

export function logout(): void {
  clearTokens();
}

export function isAuthenticated(): boolean {
  return getTokens() !== null;
}
```

- [ ] **Step 3: Create src/api/workouts.ts**

Write `frontend/src/api/workouts.ts`:
```typescript
import { apiRequest } from './client';
import type { Exercise, WorkoutDay, WorkoutSession } from '../types/gym';

export async function fetchExercises(): Promise<Exercise[]> {
  return apiRequest<Exercise[]>('/workouts/exercises/');
}

export async function createExercise(data: Partial<Exercise>): Promise<Exercise> {
  return apiRequest<Exercise>('/workouts/exercises/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateExercise(id: string, data: Partial<Exercise>): Promise<Exercise> {
  return apiRequest<Exercise>(`/workouts/exercises/${id}/`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteExercise(id: string): Promise<void> {
  return apiRequest<void>(`/workouts/exercises/${id}/`, { method: 'DELETE' });
}

export async function fetchPlan(): Promise<WorkoutDay[]> {
  return apiRequest<WorkoutDay[]>('/workouts/plan/');
}

export async function savePlan(days: WorkoutDay[]): Promise<WorkoutDay[]> {
  return apiRequest<WorkoutDay[]>('/workouts/plan/', {
    method: 'PUT',
    body: JSON.stringify(days),
  });
}

export async function fetchSessions(): Promise<WorkoutSession[]> {
  return apiRequest<WorkoutSession[]>('/workouts/sessions/');
}

export async function saveSession(session: Partial<WorkoutSession>): Promise<WorkoutSession> {
  return apiRequest<WorkoutSession>('/workouts/sessions/', {
    method: 'POST',
    body: JSON.stringify(session),
  });
}
```

- [ ] **Step 4: Create src/api/sync.ts**

Write `frontend/src/api/sync.ts`:
```typescript
const SYNC_QUEUE_KEY = 'gym-tracker-sync-queue';

interface SyncQueueItem {
  id: string;
  endpoint: string;
  method: string;
  body: unknown;
  timestamp: string;
}

function getQueue(): SyncQueueItem[] {
  const raw = localStorage.getItem(SYNC_QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function setQueue(queue: SyncQueueItem[]): void {
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
}

export function enqueue(item: Omit<SyncQueueItem, 'id' | 'timestamp'>): void {
  const queue = getQueue();
  queue.push({ ...item, id: crypto.randomUUID(), timestamp: new Date().toISOString() });
  setQueue(queue);
}

export function isOnline(): boolean {
  return navigator.onLine;
}

export async function processQueue(): Promise<void> {
  const queue = getQueue();
  if (queue.length === 0) return;

  const { apiRequest } = await import('./client');
  const remaining: SyncQueueItem[] = [];

  for (const item of queue) {
    try {
      await apiRequest(item.endpoint, {
        method: item.method,
        body: JSON.stringify(item.body),
      });
    } catch {
      remaining.push(item);
    }
  }

  setQueue(remaining);
}

export function setupSyncListener(): () => void {
  const handler = () => { if (navigator.onLine) processQueue(); };
  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}
```

- [ ] **Step 5: Create src/context/AuthContext.tsx**

Write `frontend/src/context/AuthContext.tsx`:
```typescript
import { createContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import * as auth from '../api/auth';

interface User {
  id: string;
  email: string;
  created_at: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (auth.isAuthenticated()) {
      auth.getMe()
        .then(setUser)
        .catch(() => auth.logout())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await auth.login(email, password);
    const me = await auth.getMe();
    setUser(me);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    await auth.register(email, password);
    await auth.login(email, password);
    const me = await auth.getMe();
    setUser(me);
  }, []);

  const logout = useCallback(() => {
    auth.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
```

- [ ] **Step 6: Create src/hooks/useAuth.ts**

Write `frontend/src/hooks/useAuth.ts`:
```typescript
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

- [ ] **Step 7: Create src/pages/LoginPage.tsx**

Write `frontend/src/pages/LoginPage.tsx`:
```typescript
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/');
    } catch {
      setError('Invalid email or password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <h1>Log In</h1>
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-field">
          <label htmlFor="email">Email</label>
          <input id="email" className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div className="form-field">
          <label htmlFor="password">Password</label>
          <input id="password" className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        {error && <p className="error-message">{error}</p>}
        <button className="btn btn-primary btn-large" type="submit" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log In'}
        </button>
      </form>
      <p className="auth-alt">Don't have an account? <Link to="/register">Register</Link></p>
    </div>
  );
}
```

- [ ] **Step 8: Create src/pages/RegisterPage.tsx**

Write `frontend/src/pages/RegisterPage.tsx`:
```typescript
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    try {
      await register(email, password);
      navigate('/');
    } catch {
      setError('Registration failed. Email may already be in use.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <h1>Register</h1>
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-field">
          <label htmlFor="email">Email</label>
          <input id="email" className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div className="form-field">
          <label htmlFor="password">Password</label>
          <input id="password" className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
        </div>
        <div className="form-field">
          <label htmlFor="confirm">Confirm Password</label>
          <input id="confirm" className="input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
        </div>
        {error && <p className="error-message">{error}</p>}
        <button className="btn btn-primary btn-large" type="submit" disabled={submitting}>
          {submitting ? 'Registering…' : 'Register'}
        </button>
      </form>
      <p className="auth-alt">Already have an account? <Link to="/login">Log In</Link></p>
    </div>
  );
}
```

- [ ] **Step 9: Create src/components/AuthGuard.tsx**

Write `frontend/src/components/AuthGuard.tsx`:
```typescript
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { ReactNode } from 'react';

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
```

- [ ] **Step 10: Commit**

```bash
git add frontend/src/api/ frontend/src/context/ frontend/src/hooks/useAuth.ts frontend/src/pages/LoginPage.tsx frontend/src/pages/RegisterPage.tsx frontend/src/components/AuthGuard.tsx
git commit -m "feat: add API client, auth system, login/register pages"
```

---

### Task 7: Modify ExerciseSetRow for Per-Set Start/Done

**Files:**
- Modify: `frontend/src/components/ExerciseSetRow.tsx`
- Modify: `frontend/src/components/ExerciseCard.tsx`

**Interfaces:**
- Consumes: Updated types from Task 5
- Produces: Set rows with start/done toggle per set, exercise card without exercise-level controls

- [ ] **Step 1: Read and update ExerciseSetRow.tsx**

Read `frontend/src/components/ExerciseSetRow.tsx` first, then replace with:
```typescript
import { ExerciseSet, TrackingType, WeightRepSet, RepsOnlySet, DurationSet, DistanceDurationSet } from '../types/gym';

interface ExerciseSetRowProps {
  set: ExerciseSet;
  trackingType: TrackingType;
  onUpdate: (setId: string, updates: Partial<ExerciseSet>) => void;
  onRemove: (setId: string) => void;
  setIndex: number;
}

export function ExerciseSetRow({ set, trackingType, onUpdate, onRemove, setIndex }: ExerciseSetRowProps) {
  function handleToggleDone() {
    const now = new Date().toISOString();
    if (set.completed) {
      onUpdate(set.id, { completed: false, completedAt: null });
    } else {
      onUpdate(set.id, {
        completed: true,
        completedAt: now,
        startedAt: set.startedAt || now,
      });
    }
  }

  function handleStart() {
    onUpdate(set.id, { startedAt: new Date().toISOString() });
  }

  return (
    <div className={`set-row ${set.completed ? 'completed' : ''}`}>
      <span className="set-label">Set {setIndex + 1}</span>
      {trackingType === 'weight-reps' && renderWeightReps(set as WeightRepSet, onUpdate)}
      {trackingType === 'reps' && renderRepsOnly(set as RepsOnlySet, onUpdate)}
      {trackingType === 'duration' && renderDuration(set as DurationSet, onUpdate)}
      {trackingType === 'distance-duration' && renderDistanceDuration(set as DistanceDurationSet, onUpdate)}
      <div className="set-actions">
        {!set.startedAt && !set.completed && (
          <button className="btn btn-small btn-primary" onClick={handleStart}>Start</button>
        )}
        {(set.startedAt || set.completed) && (
          <button className={`btn btn-small ${set.completed ? 'btn-success' : 'btn-outline'}`} onClick={handleToggleDone}>
            {set.completed ? 'Done' : 'Mark Done'}
          </button>
        )}
        <button className="btn btn-small btn-danger-outline" onClick={() => onRemove(set.id)} aria-label={`Remove set ${setIndex + 1}`}>✕</button>
      </div>
    </div>
  );
}

function renderWeightReps(set: WeightRepSet, onUpdate: (id: string, u: Partial<ExerciseSet>) => void) {
  return (
    <>
      <div className="set-input-group">
        <label htmlFor={`weight-${set.id}`} className="sr-only">Weight</label>
        <input id={`weight-${set.id}`} className="input input-small" type="number" min="0" step="0.5" placeholder="Weight"
          value={set.weight ?? ''}
          onChange={e => onUpdate(set.id, { weight: e.target.value ? parseFloat(e.target.value) : null })} />
        <select className="input input-small input-unit" value={set.weightUnit}
          onChange={e => onUpdate(set.id, { weightUnit: e.target.value as 'kg' | 'lb' })}
          aria-label="Weight unit">
          <option value="kg">kg</option><option value="lb">lb</option>
        </select>
      </div>
      <div className="set-input-group">
        <label htmlFor={`reps-${set.id}`} className="sr-only">Reps</label>
        <input id={`reps-${set.id}`} className="input input-small" type="number" min="0" step="1" placeholder="Reps"
          value={set.reps ?? ''}
          onChange={e => onUpdate(set.id, { reps: e.target.value ? parseInt(e.target.value, 10) : null })} />
      </div>
    </>
  );
}

function renderRepsOnly(set: RepsOnlySet, onUpdate: (id: string, u: Partial<ExerciseSet>) => void) {
  return (
    <div className="set-input-group">
      <label htmlFor={`reps-${set.id}`} className="sr-only">Reps</label>
      <input id={`reps-${set.id}`} className="input input-small" type="number" min="0" step="1" placeholder="Reps"
        value={set.reps ?? ''}
        onChange={e => onUpdate(set.id, { reps: e.target.value ? parseInt(e.target.value, 10) : null })} />
    </div>
  );
}

function renderDuration(set: DurationSet, onUpdate: (id: string, u: Partial<ExerciseSet>) => void) {
  return (
    <div className="set-input-group">
      <label htmlFor={`duration-${set.id}`} className="sr-only">Duration (seconds)</label>
      <input id={`duration-${set.id}`} className="input input-small" type="number" min="0" step="1" placeholder="Seconds"
        value={set.durationSeconds ?? ''}
        onChange={e => onUpdate(set.id, { durationSeconds: e.target.value ? parseInt(e.target.value, 10) : null })} />
    </div>
  );
}

function renderDistanceDuration(set: DistanceDurationSet, onUpdate: (id: string, u: Partial<ExerciseSet>) => void) {
  return (
    <>
      <div className="set-input-group">
        <label htmlFor={`dist-${set.id}`} className="sr-only">Distance</label>
        <input id={`dist-${set.id}`} className="input input-small" type="number" min="0" step="0.1" placeholder="Distance"
          value={set.distance ?? ''}
          onChange={e => onUpdate(set.id, { distance: e.target.value ? parseFloat(e.target.value) : null })} />
        <select className="input input-small input-unit" value={set.distanceUnit}
          onChange={e => onUpdate(set.id, { distanceUnit: e.target.value as 'km' | 'm' | 'mi' })}
          aria-label="Distance unit">
          <option value="km">km</option><option value="m">m</option><option value="mi">mi</option>
        </select>
      </div>
      <div className="set-input-group">
        <label htmlFor={`dur-${set.id}`} className="sr-only">Duration (seconds)</label>
        <input id={`dur-${set.id}`} className="input input-small" type="number" min="0" step="1" placeholder="Seconds"
          value={set.durationSeconds ?? ''}
          onChange={e => onUpdate(set.id, { durationSeconds: e.target.value ? parseInt(e.target.value, 10) : null })} />
      </div>
    </>
  );
}
```

- [ ] **Step 2: Read and update ExerciseCard.tsx**

Read `frontend/src/components/ExerciseCard.tsx` first, then edit:

Remove `onStart`, `onComplete` props and the start/complete buttons. Remove `startedAt`/`completedAt`/`completed` references from ActiveExercise. The exercise status is now derived from sets:

Edit:
- Remove `onStart`, `onComplete` from `ExerciseCardProps`
- Change the header status badge to show "Done" only when all sets are completed
- Remove the "Start Exercise"/"Complete Exercise" buttons at the bottom

```typescript
import { useState } from 'react';
import { ActiveExercise, ExerciseSet } from '../types/gym';
import { ExerciseSetRow } from './ExerciseSetRow';

interface ExerciseCardProps {
  exercise: ActiveExercise;
  onUpdateSet: (setId: string, updates: Partial<ExerciseSet>) => void;
  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
}

export function ExerciseCard({ exercise, onUpdateSet, onAddSet, onRemoveSet }: ExerciseCardProps) {
  const [expanded, setExpanded] = useState(false);
  const allSetsDone = exercise.sets.length > 0 && exercise.sets.every(s => s.completed);

  const categoryLabels: Record<string, string> = {
    'lower-body': 'Lower Body', chest: 'Chest', back: 'Back',
    shoulders: 'Shoulders', arms: 'Arms', core: 'Core', cardio: 'Cardio', other: 'Other',
  };

  return (
    <div className={`exercise-card ${allSetsDone ? 'completed' : ''}`}>
      <div className="exercise-card-header" onClick={() => setExpanded(!expanded)}>
        <div>
          <h3 className="exercise-name">{exercise.exerciseName}</h3>
          <span className="exercise-meta">{trackingLabel(exercise.trackingType)}</span>
        </div>
        <div className="exercise-status">
          {allSetsDone ? (
            <span className="badge badge-success">Done</span>
          ) : exercise.sets.some(s => s.startedAt) ? (
            <span className="badge badge-active">In Progress</span>
          ) : (
            <span className="badge badge-pending">Not Started</span>
          )}
        </div>
      </div>
      {expanded && (
        <div className="exercise-card-body">
          <div className="sets-list">
            {exercise.sets.map((set, i) => (
              <ExerciseSetRow
                key={set.id}
                set={set}
                trackingType={exercise.trackingType}
                onUpdate={onUpdateSet}
                onRemove={onRemoveSet}
                setIndex={i}
              />
            ))}
          </div>
          <button className="btn btn-small btn-outline" onClick={onAddSet}>+ Add Set</button>
        </div>
      )}
    </div>
  );
}

function trackingLabel(type: string): string {
  switch (type) {
    case 'weight-reps': return 'Weight × Reps';
    case 'reps': return 'Reps';
    case 'duration': return 'Duration';
    case 'distance-duration': return 'Distance + Duration';
    default: return '';
  }
}
```

- [ ] **Step 3: Type-check**

```bash
cd frontend
npx tsc --noEmit
```

Fix any type errors that arise from the changed types/props.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ExerciseSetRow.tsx frontend/src/components/ExerciseCard.tsx
git commit -m "feat: per-set start/done timing in ExerciseSetRow and ExerciseCard"
```

---

### Task 8: Modify useGymTracker Hook (API + Sync + Per-Set)

**Files:**
- Modify: `frontend/src/hooks/useGymTracker.ts`
- Modify: `frontend/src/utils/storage.ts` (update for per-set types)
- Modify: `frontend/src/utils/exerciseHistory.ts` (keep working with new types)

**Interfaces:**
- Consumes: API client (Task 6), updated types (Task 5), updated ExerciseCard/SetRow (Task 7)
- Produces: Hook that transparently calls API when online, falls back to localStorage, and syncs

- [ ] **Step 1: Read and modify useGymTracker.ts**

Read `frontend/src/hooks/useGymTracker.ts` first, then replace with API-backed version:

```typescript
import { useState, useCallback, useEffect } from 'react';
import {
  AppData, ActiveWorkoutSession, ActiveExercise,
  WorkoutDay, Exercise, ExerciseSet,
} from '../types/gym';
import { loadAppData, saveAppData, clearAppData, getDefaultAppData } from '../utils/storage';
import { advanceWorkout, getCurrentWorkout } from '../utils/rotation';
import { generateId, getTodayISO, nowISO } from '../utils/validation';
import { presetExercises } from '../data/presetExercises';
import * as workouts from '../api/workouts';
import { isOnline, enqueue, processQueue, setupSyncListener } from '../api/sync';

export function useGymTracker() {
  const [data, setData] = useState<AppData>(() => loadAppData());

  // Sync on mount and when coming online
  useEffect(() => {
    const cleanup = setupSyncListener();
    if (isOnline()) {
      syncFromServer();
    }
    return cleanup;
  }, []);

  // Persist to localStorage on every change (offline cache)
  useEffect(() => {
    saveAppData(data);
  }, [data]);

  async function syncFromServer() {
    try {
      const [exercises, plan, sessions] = await Promise.all([
        workouts.fetchExercises(),
        workouts.fetchPlan(),
        workouts.fetchSessions(),
      ]);
      const customExercises = exercises.filter(e => !e.is_preset);
      setData(prev => ({
        ...prev,
        customExercises,
        workoutPlan: plan,
        workoutHistory: sessions,
      }));
    } catch {
      // offline — use localStorage cache
    }
  }

  const createEmptySets = useCallback((trackingType: string, count: number = 3): ExerciseSet[] => {
    const sets: ExerciseSet[] = [];
    for (let i = 0; i < count; i++) {
      const id = generateId();
      const base = { id, startedAt: null as string | null, completedAt: null as string | null, completed: false };
      if (trackingType === 'weight-reps') {
        sets.push({ ...base, weight: null, weightUnit: 'kg', reps: null } as ExerciseSet);
      } else if (trackingType === 'reps') {
        sets.push({ ...base, reps: null } as ExerciseSet);
      } else if (trackingType === 'duration') {
        sets.push({ ...base, durationSeconds: null } as ExerciseSet);
      } else {
        sets.push({ ...base, distance: null, distanceUnit: 'km', durationSeconds: null, notes: '' } as ExerciseSet);
      }
    }
    return sets;
  }, []);

  const startWorkout = useCallback(() => {
    const workout = getCurrentWorkout(data.workoutPlan, data.currentWorkoutIndex);
    if (!workout) return;
    const allExercises: Exercise[] = [...presetExercises, ...data.customExercises];
    const exercises: ActiveExercise[] = workout.exercises.map(pe => {
      const exerciseDef = allExercises.find(e => e.id === pe.exerciseId);
      return {
        id: generateId(),
        exerciseId: pe.exerciseId,
        exerciseName: exerciseDef?.name ?? 'Unknown',
        trackingType: exerciseDef?.trackingType ?? ('reps' as const),
        sets: createEmptySets(exerciseDef?.trackingType ?? 'reps', pe.targetSets),
        notes: pe.notes ?? '',
      };
    });
    const session: ActiveWorkoutSession = {
      id: generateId(),
      workoutDayId: workout.id,
      workoutName: workout.name,
      date: getTodayISO(),
      startedAt: nowISO(),
      completedAt: null,
      status: 'in-progress',
      exercises,
    };
    setData(prev => ({ ...prev, activeWorkout: session }));
  }, [data.workoutPlan, data.currentWorkoutIndex, data.customExercises, createEmptySets]);

  const getCurrentWorkoutDay = useCallback((): WorkoutDay | null => {
    return getCurrentWorkout(data.workoutPlan, data.currentWorkoutIndex);
  }, [data.workoutPlan, data.currentWorkoutIndex]);

  const finishWorkout = useCallback(async () => {
    if (!data.activeWorkout) return;
    const sessionData = {
      workout_day: data.activeWorkout.workoutDayId,
      workout_name: data.activeWorkout.workoutName,
      date: data.activeWorkout.date,
      started_at: data.activeWorkout.startedAt,
      completed_at: nowISO(),
      status: 'completed' as const,
      exercises: data.activeWorkout.exercises.map(e => ({
        exercise: e.exerciseId,
        exercise_name: e.exerciseName,
        tracking_type: e.trackingType,
        sets: e.sets.map(s => ({
          type: e.trackingType,
          weight: 'weight' in s ? s.weight : null,
          weight_unit: 'weightUnit' in s ? s.weightUnit : null,
          reps: 'reps' in s ? s.reps : null,
          duration_seconds: 'durationSeconds' in s ? s.durationSeconds : null,
          distance: 'distance' in s ? s.distance : null,
          distance_unit: 'distanceUnit' in s ? s.distanceUnit : null,
          started_at: s.startedAt,
          completed_at: s.completedAt,
          completed: s.completed,
        })),
      })),
    };

    if (isOnline()) {
      try {
        await workouts.saveSession(sessionData);
      } catch {
        enqueue({ endpoint: '/workouts/sessions/', method: 'POST', body: sessionData });
      }
    } else {
      enqueue({ endpoint: '/workouts/sessions/', method: 'POST', body: sessionData });
    }

    setData(prev => ({
      ...prev,
      activeWorkout: null,
      currentWorkoutIndex: advanceWorkout(prev.workoutPlan, prev.currentWorkoutIndex),
    }));
  }, [data.activeWorkout, data.workoutPlan, data.currentWorkoutIndex]);

  const skipWorkout = useCallback(async () => {
    const workout = getCurrentWorkout(data.workoutPlan, data.currentWorkoutIndex);
    if (!workout) return;
    const sessionData = {
      workout_day: workout.id,
      workout_name: workout.name,
      date: getTodayISO(),
      started_at: null,
      completed_at: null,
      status: 'skipped' as const,
      exercises: [],
    };

    if (isOnline()) {
      try {
        await workouts.saveSession(sessionData);
      } catch {
        enqueue({ endpoint: '/workouts/sessions/', method: 'POST', body: sessionData });
      }
    } else {
      enqueue({ endpoint: '/workouts/sessions/', method: 'POST', body: sessionData });
    }

    setData(prev => ({
      ...prev,
      activeWorkout: null,
      currentWorkoutIndex: advanceWorkout(prev.workoutPlan, prev.currentWorkoutIndex),
    }));
  }, [data.workoutPlan, data.currentWorkoutIndex]);

  const updateSet = useCallback((exerciseId: string, setId: string, updates: Partial<ExerciseSet>) => {
    setData(prev => {
      if (!prev.activeWorkout) return prev;
      return {
        ...prev,
        activeWorkout: {
          ...prev.activeWorkout,
          exercises: prev.activeWorkout.exercises.map(e =>
            e.id === exerciseId
              ? { ...e, sets: e.sets.map(s => (s.id === setId ? { ...s, ...updates } : s)) }
              : e
          ),
        },
      };
    });
  }, []);

  const addSet = useCallback((exerciseId: string) => {
    setData(prev => {
      if (!prev.activeWorkout) return prev;
      return {
        ...prev,
        activeWorkout: {
          ...prev.activeWorkout,
          exercises: prev.activeWorkout.exercises.map(e => {
            if (e.id !== exerciseId) return e;
            const newSet = createEmptySets(e.trackingType, 1)[0];
            return { ...e, sets: [...e.sets, newSet] };
          }),
        },
      };
    });
  }, [createEmptySets]);

  const removeSet = useCallback((exerciseId: string, setId: string) => {
    setData(prev => {
      if (!prev.activeWorkout) return prev;
      return {
        ...prev,
        activeWorkout: {
          ...prev.activeWorkout,
          exercises: prev.activeWorkout.exercises.map(e =>
            e.id === exerciseId
              ? { ...e, sets: e.sets.filter(s => s.id !== setId) }
              : e
          ),
        },
      };
    });
  }, []);

  const addCustomExercise = useCallback(async (exercise: Exercise) => {
    setData(prev => ({
      ...prev,
      customExercises: [...prev.customExercises, exercise],
    }));
  }, []);

  const editCustomExercise = useCallback(async (id: string, updates: Partial<Exercise>) => {
    setData(prev => ({
      ...prev,
      customExercises: prev.customExercises.map(e =>
        e.id === id ? { ...e, ...updates } : e
      ),
    }));
  }, []);

  const removeCustomExercise = useCallback(async (id: string) => {
    setData(prev => ({
      ...prev,
      customExercises: prev.customExercises.filter(e => e.id !== id),
    }));
  }, []);

  const updateWorkoutPlan = useCallback(async (plan: WorkoutDay[]) => {
    setData(prev => ({ ...prev, workoutPlan: plan }));
    if (isOnline()) {
      try {
        await workouts.savePlan(plan);
      } catch {
        enqueue({ endpoint: '/workouts/plan/', method: 'PUT', body: plan });
      }
    } else {
      enqueue({ endpoint: '/workouts/plan/', method: 'PUT', body: plan });
    }
  }, []);

  const addWorkoutDay = useCallback(async (day: WorkoutDay) => {
    setData(prev => ({ ...prev, workoutPlan: [...prev.workoutPlan, day] }));
  }, []);

  const resetAll = useCallback(() => {
    clearAppData();
    setData(getDefaultAppData());
  }, []);

  const getNextWorkout = useCallback((): WorkoutDay | null => {
    const nextIndex = advanceWorkout(data.workoutPlan, data.currentWorkoutIndex);
    return getCurrentWorkout(data.workoutPlan, nextIndex);
  }, [data.workoutPlan, data.currentWorkoutIndex]);

  const getAllExercises = useCallback((): Exercise[] => {
    return [...presetExercises, ...data.customExercises];
  }, [data.customExercises]);

  return {
    data,
    startWorkout,
    getCurrentWorkoutDay,
    finishWorkout,
    skipWorkout,
    updateSet,
    addSet,
    removeSet,
    addCustomExercise,
    editCustomExercise,
    removeCustomExercise,
    updateWorkoutPlan,
    addWorkoutDay,
    resetAll,
    getAllExercises,
    getNextWorkout,
    syncFromServer,
  };
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend
npx tsc --noEmit
```

Fix any type errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useGymTracker.ts
git commit -m "feat: add API sync and per-set timing to useGymTracker"
```

---

### Task 9: Update App.tsx — Auth Routes and Providers

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/main.tsx` (if needed)

- [ ] **Step 1: Read and modify App.tsx**

Read `frontend/src/App.tsx` first, then replace:
```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AuthGuard } from './components/AuthGuard';
import { Navigation } from './components/Navigation';
import { TodayPage } from './pages/TodayPage';
import { PlanPage } from './pages/PlanPage';
import { ExerciseLibraryPage } from './pages/ExerciseLibraryPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/*" element={
            <AuthGuard>
              <div className="app">
                <Navigation />
                <main className="main-content">
                  <Routes>
                    <Route path="/" element={<TodayPage />} />
                    <Route path="/plan" element={<PlanPage />} />
                    <Route path="/exercises" element={<ExerciseLibraryPage />} />
                    <Route path="/history" element={<HistoryPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                  </Routes>
                </main>
              </div>
            </AuthGuard>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: Read and modify main.tsx** if needed — check if any provider wrapping is required

Read `frontend/src/main.tsx` — if it already wraps App, no changes needed.

- [ ] **Step 3: Type-check**

```bash
cd frontend
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: add auth routes and AuthProvider to App shell"
```

---

### Task 10: Fix Remaining Frontend Compilation Errors

**Files:**
- Fix type errors across: `frontend/src/pages/TodayPage.tsx`, `frontend/src/pages/PlanPage.tsx`, `frontend/src/utils/exerciseHistory.ts`, `frontend/src/utils/validation.ts`, `frontend/src/utils/storage.ts`, `frontend/src/components/WorkoutCompletionModal.tsx`, `frontend/src/components/WorkoutHeader.tsx`

- [ ] **Step 1: Run TypeScript check**

```bash
cd frontend
npx tsc --noEmit 2>&1 | head -60
```

List all errors and fix them one by one. Key areas likely needing fixes:
- `TodayPage.tsx` — remove `startExercise`, `completeExercise` from hook destructuring
- `PlanPage.tsx` — ensure it calls `savePlan` from the API via hook
- `exerciseHistory.ts` — update to work without `startedAt`/`completedAt` on `CompletedExercise`

- [ ] **Step 2: Fix TodayPage.tsx**

Remove `startExercise` and `completeExercise` from the destructured hook values and from the ExerciseCard props:
```typescript
const {
  data, startWorkout, getCurrentWorkoutDay,
  finishWorkout, skipWorkout,
  updateSet, addSet, removeSet,
  getNextWorkout,
} = useGymTracker();
```

Remove `onStart` and `onComplete` props from ExerciseCard usage:
```typescript
<ExerciseCard
  key={exercise.id}
  exercise={exercise}
  onUpdateSet={(setId, updates) => updateSet(exercise.id, setId, updates)}
  onAddSet={() => addSet(exercise.id)}
  onRemoveSet={(setId) => removeSet(exercise.id, setId)}
/>
```

- [ ] **Step 3: Fix any remaining type errors**

Run `npx tsc --noEmit` after each fix until clean.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/TodayPage.tsx frontend/src/utils/exerciseHistory.ts frontend/src/utils/storage.ts frontend/src/utils/validation.ts
git commit -m "fix: resolve type errors from per-set timing refactor"
```

---

### Task 11: Zappa Deployment Config

**Files:**
- Create: `zappa_settings.json` (at repo root)
- Create: `backend/.env.example`
- Modify: `backend/requirements.txt` (add dj-database-url)
- Modify: `frontend/.env.example`

- [ ] **Step 1: Add dj-database-url to requirements**

Add to `backend/requirements.txt`:
```
dj-database-url>=2.2,<2.3
```

- [ ] **Step 2: Create zappa_settings.json at repo root**

Write `zappa_settings.json`:
```json
{
  "dev": {
    "project_name": "gym-tracker",
    "runtime": "python3.12",
    "aws_region": "us-east-1",
    "django_settings": "config.settings",
    "s3_bucket": "gym-tracker-zappa-dev",
    "manage_roles": false,
    "role_name": "gym-tracker-ZappaLambdaExecutionRole",
    "timeout_seconds": 30,
    "memory_size": 512,
    "environment_variables": {
      "DJANGO_SECRET_KEY": "change-me-in-production",
      "DATABASE_URL": "",
      "DJANGO_DEBUG": "False"
    },
    "remote_env": "s3://gym-tracker-env-dev/env.json"
  }
}
```

- [ ] **Step 3: Create backend/.env.example**

Write `backend/.env.example`:
```
DJANGO_SECRET_KEY=your-secret-key-here
DATABASE_URL=postgresql://user:pass@neon-host/db
DJANGO_DEBUG=False
```

- [ ] **Step 4: Create frontend/.env.example**

Write `frontend/.env.example`:
```
VITE_API_URL=https://your-api-gateway-url/dev/api
```

- [ ] **Step 5: Commit**

```bash
git add zappa_settings.json backend/.env.example frontend/.env.example backend/requirements.txt
git commit -m "chore: add deployment config for Zappa and Neon"
```

---

### Task 12: End-to-End Verification

- [ ] **Step 1: Start backend locally**

```bash
cd backend
source .venv/bin/activate
python manage.py runserver &
```

- [ ] **Step 2: Start frontend**

```bash
cd frontend
npm run dev &
```

- [ ] **Step 3: Test registration + login flow**

```bash
# Register
curl -s -X POST http://localhost:8000/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"testpass123"}'
# Login
curl -s -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"testpass123"}' | python3 -m json.tool
```

Expected: 201 for register, 200 with tokens for login.

- [ ] **Step 4: Test authenticated API**

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"testpass123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['access'])")

# List exercises
curl -s http://localhost:8000/api/workouts/exercises/ -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json;d=json.load(sys.stdin);print(f'{len(d)} exercises')"

# Save a plan
curl -s -X PUT http://localhost:8000/api/workouts/plan/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '[]'

# Save a session
curl -s -X POST http://localhost:8000/api/workouts/sessions/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"workout_name":"Test","date":"2025-07-28","status":"completed","exercises":[]}'
```

Expected: All return 200.

- [ ] **Step 5: Run frontend tests**

```bash
cd frontend
npx vitest run
```

Fix any test failures from the type changes.

- [ ] **Step 6: Run full TypeScript check**

```bash
cd frontend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Kill servers and commit**

```bash
kill %1 %2 2>/dev/null || true
git add -A
git commit -m "fix: e2e fixes after backend integration"
```
