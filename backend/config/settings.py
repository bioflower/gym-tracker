import os
from pathlib import Path
from datetime import timedelta
from typing import Dict
import dj_database_url
from dotenv import load_dotenv
from config.aws_parameters import load_aws_parameters

BASE_DIR = Path(__file__).resolve().parent.parent

# Zappa/Lamda sets AWS_EXECUTION_ENV automatically
RUNNING_IN_AWS_LAMBDA = bool(os.environ.get("AWS_EXECUTION_ENV"))

# Load the local .env file only during local development. 
# Lambda should use its execution role and Parameter Store instead
if not RUNNING_IN_AWS_LAMBDA:
    load_dotenv(BASE_DIR / ".env")

APP_ENV: str = os.environ.get("APP_ENV", "local")
remote_config: Dict[str, str] = dict()

if APP_ENV.startswith("aws-"):
    remote_config: Dict[str, str] = load_aws_parameters()

def get_config(name: str, default: str | None = None) -> str | None:
    """
    Resolution order:
    1. Process environment variable
    2. AWS Parameter Store
    3. Default value
    """
    return os.environ.get(name) or remote_config.get(name) or default


SECRET_KEY = get_config("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("DJANGO_SECRET_KEY is not configured")

DEBUG = get_config("DJANGO_DEBUG", "False").lower() == "true"

DATABASE_URL = get_config("DATABASE_URL")
if DATABASE_URL:
    DATABASES = {
        "default": dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=60,
            ssl_require=APP_ENV.startswith("aws-")
        )
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": os.path.join(BASE_DIR, "db.sqlite3")
        }

    }

ALLOWED_HOSTS = [
    host.strip() for host in os.environ.get(
        "DJANGO_ALLOWED_HOSTS",
        "localhost,127.0.0.1,.execute-api.us-east-1.amazonaws.com",
    ).split(",") if host.strip()
]

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

CORS_ALLOW_ALL_ORIGINS = DEBUG

CORS_ALLOWED_ORIGINS = [
    origin.strip() for origin in get_config(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:5173"
    ).split(",") if origin.strip()
]

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
