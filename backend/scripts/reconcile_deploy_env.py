"""Reconciles deploy-time configuration drift between the Zappa backend
(Lambda + API Gateway) and the Amplify frontend.

See docs/superpowers/specs/2026-08-06-deploy-env-reconciliation-design.md
for the full design.
"""

import os
import sys
import time

import boto3
from botocore.exceptions import ClientError


def resolve_api_gateway_url(
    apigateway_client, rest_api_name: str, stage: str, region: str
) -> str:
    """Find the REST API named `rest_api_name` and return its invoke URL.

    Assumes fewer than 500 REST APIs exist in the account/region (a single
    un-paginated call is used for simplicity — see design doc open questions
    if this account ever needs pagination).
    """
    response = apigateway_client.get_rest_apis(limit=500)
    matches = [
        item for item in response.get("items", []) if item.get("name") == rest_api_name
    ]

    if not matches:
        raise LookupError(
            f"No API Gateway REST API found with name '{rest_api_name}'"
        )
    if len(matches) > 1:
        ids = [match["id"] for match in matches]
        raise LookupError(
            f"Multiple API Gateway REST APIs found with name '{rest_api_name}': {ids}"
        )

    api_id = matches[0]["id"]
    return f"https://{api_id}.execute-api.{region}.amazonaws.com/{stage}/api"


def resolve_amplify_url(amplify_client, app_id: str, branch_name: str) -> str:
    """Return the default (non-custom-domain) URL for an Amplify branch."""
    app = amplify_client.get_app(appId=app_id)["app"]
    branch = amplify_client.get_branch(appId=app_id, branchName=branch_name)["branch"]
    return f"https://{branch['branchName']}.{app['defaultDomain']}"


def reconcile_amplify_env_var(
    amplify_client, app_id: str, branch_name: str, key: str, value: str
) -> bool:
    """Ensure `key=value` is set in the Amplify branch's env vars.

    Preserves every other existing environment variable on the branch —
    `amplify:UpdateBranch` replaces the whole map, so this always
    fetch-merges before writing. Returns True if a write was made.
    """
    branch = amplify_client.get_branch(appId=app_id, branchName=branch_name)["branch"]
    current_env = dict(branch.get("environmentVariables", {}))

    if current_env.get(key) == value:
        return False

    current_env[key] = value
    amplify_client.update_branch(
        appId=app_id, branchName=branch_name, environmentVariables=current_env
    )
    # Amplify does not auto-rebuild on an env var change; trigger it explicitly.
    amplify_client.start_job(appId=app_id, branchName=branch_name, jobType="RELEASE")
    return True


def reconcile_cors_origins(
    ssm_client, parameter_name: str, origin_to_ensure: str
) -> bool:
    """Ensure `origin_to_ensure` is present in the comma-separated
    CORS_ALLOWED_ORIGINS SSM parameter, without removing anything already
    there. Preserves the parameter's original Type (e.g. SecureString) on
    write. Returns True if a write was made.
    """
    parameter = ssm_client.get_parameter(Name=parameter_name, WithDecryption=True)[
        "Parameter"
    ]
    origins = [origin.strip() for origin in parameter["Value"].split(",") if origin.strip()]

    if origin_to_ensure in origins:
        return False

    origins.append(origin_to_ensure)
    ssm_client.put_parameter(
        Name=parameter_name,
        Value=",".join(origins),
        Type=parameter["Type"],
        Overwrite=True,
    )
    return True


def force_lambda_cold_start(lambda_client, function_name: str) -> None:
    """Force a new Lambda execution environment so warm containers pick up
    freshly-written SSM parameter values immediately, instead of waiting
    for their next natural cold start (config/aws_parameters.py caches
    Parameter Store reads for the life of a warm container via
    @lru_cache).
    """
    lambda_client.update_function_configuration(
        FunctionName=function_name,
        Description=f"force-cold-{int(time.time())}",
    )
