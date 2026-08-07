import os
from functools import lru_cache
from typing import Dict

import boto3
from botocore.exceptions import BotoCoreError, ClientError


@lru_cache(maxsize=1)
def load_aws_parameters() -> Dict[str, str]:
    """
    Retrieve application configuration from AWS Parameter Store.

    The result is cached for the lifetime of the Lambda execution
    environment so AWS is not called on every HTTP request.
    """
    prefix: str = os.environ["AWS_PARAMETER_PREFIX"]
    region: str = os.environ.get("AWS_APP_REGION", "us-east-1")

    client = boto3.client("ssm", region_name=region)

    values: Dict[str, str] = {}
    next_token: str | None = None

    try:
        # Parameter Store may split a large result into multiple pages.
        # Keep requesting pages of parameters until AWS returns no NextToken
        while True:
            # Retrieves all parameters stored inside nested paths below the prefix
            # Decrypt SecureString parameters before returning them
            request = {
                "Path": prefix,
                "Recursive": True,
                "WithDecryption": True,
            }

            if next_token:
                request["NextToken"] = next_token

            response = client.get_parameters_by_path(**request)

            for parameter in response.get("Parameters", []):
                # Store the parameter using the short name as the dictionary key
                key = parameter["Name"].rsplit("/", 1)[-1]
                values[key] = parameter["Value"]

            # AWS includes NextToken when more pages are available
            # If there are no more pages, this returns None
            next_token = response.get("NextToken")
            
            # Stop the loop after the final page has been processed
            if not next_token:
                break

    except (ClientError, BotoCoreError) as exc:
        raise RuntimeError(
            f"Could not load AWS parameters from {prefix}: {exc}"
        ) from exc

    return values