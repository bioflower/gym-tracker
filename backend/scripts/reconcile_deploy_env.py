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
