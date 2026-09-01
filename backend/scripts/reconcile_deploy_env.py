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
    """Return the production URL for an Amplify branch.

    Prefers a custom-domain root mapping (e.g. `https://gym.andreado.me`)
    when the branch is attached to one, falling back to the default
    `https://<branch>.<defaultDomain>` URL otherwise.
    """
    app = amplify_client.get_app(appId=app_id)["app"]
    branch = amplify_client.get_branch(appId=app_id, branchName=branch_name)["branch"]

    associations = amplify_client.list_domain_associations(
        appId=app_id
    ).get("domainAssociations", [])
    for association in associations:
        domain = association["domainName"]
        for sub_domain in association.get("subDomains", []):
            setting = sub_domain.get("subDomainSetting", {})
            if setting.get("branchName") == branch_name and not setting.get("prefix"):
                return f"https://{domain}"

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
    try:
        parameter = ssm_client.get_parameter(
            Name=parameter_name, WithDecryption=True
        )["Parameter"]
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code")
        if code != "ParameterNotFound":
            raise
        parameter = {"Value": "", "Type": "String"}

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


def main() -> int:
    region = os.environ.get("AWS_REGION", "us-east-1")
    rest_api_name = os.environ["API_GATEWAY_NAME"]
    stage = os.environ.get("ZAPPA_STAGE", "dev")
    amplify_app_id = os.environ["AMPLIFY_APP_ID"]
    amplify_branch = os.environ.get("AMPLIFY_BRANCH_NAME", "main")
    ssm_parameter_name = os.environ["SSM_PARAMETER_NAME"]
    lambda_function_name = os.environ["LAMBDA_FUNCTION_NAME"]

    apigateway_client = boto3.client("apigateway", region_name=region)
    amplify_client = boto3.client("amplify", region_name=region)
    ssm_client = boto3.client("ssm", region_name=region)
    lambda_client = boto3.client("lambda", region_name=region)

    try:
        api_url = resolve_api_gateway_url(apigateway_client, rest_api_name, stage, region)
    except LookupError as exc:
        print(f"ERROR: {exc}")
        return 1
    print(f"Resolved API Gateway URL: {api_url}")

    try:
        amplify_changed = reconcile_amplify_env_var(
            amplify_client, amplify_app_id, amplify_branch, "VITE_API_URL", api_url
        )
        amplify_url = resolve_amplify_url(amplify_client, amplify_app_id, amplify_branch)
    except ClientError as exc:
        print(f"ERROR: {exc}")
        return 1
    print(f"Amplify VITE_API_URL {'updated' if amplify_changed else 'already up to date'}")
    print(f"Resolved Amplify URL: {amplify_url}")

    cors_changed = reconcile_cors_origins(ssm_client, ssm_parameter_name, amplify_url)
    print(f"CORS_ALLOWED_ORIGINS {'updated' if cors_changed else 'already up to date'}")

    if cors_changed:
        force_lambda_cold_start(lambda_client, lambda_function_name)
        print(f"Forced cold start on {lambda_function_name}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
