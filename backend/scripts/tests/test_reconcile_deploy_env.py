import os
import unittest
from unittest.mock import MagicMock, patch

from scripts.reconcile_deploy_env import (
    force_lambda_cold_start,
    main,
    reconcile_amplify_env_var,
    reconcile_cors_origins,
    resolve_amplify_url,
    resolve_api_gateway_url,
)


class ResolveApiGatewayUrlTests(unittest.TestCase):
    def test_returns_url_for_matching_rest_api(self):
        client = MagicMock()
        client.get_rest_apis.return_value = {
            "items": [
                {"id": "other000", "name": "some-other-api"},
                {"id": "abc123", "name": "gym-tracker-dev"},
            ]
        }

        url = resolve_api_gateway_url(client, "gym-tracker-dev", "dev", "us-east-1")

        self.assertEqual(
            url, "https://abc123.execute-api.us-east-1.amazonaws.com/dev/api"
        )
        client.get_rest_apis.assert_called_once_with(limit=500)

    def test_raises_when_no_match_found(self):
        client = MagicMock()
        client.get_rest_apis.return_value = {"items": []}

        with self.assertRaises(LookupError):
            resolve_api_gateway_url(client, "gym-tracker-dev", "dev", "us-east-1")

    def test_raises_when_multiple_matches_found(self):
        client = MagicMock()
        client.get_rest_apis.return_value = {
            "items": [
                {"id": "abc123", "name": "gym-tracker-dev"},
                {"id": "def456", "name": "gym-tracker-dev"},
            ]
        }

        with self.assertRaises(LookupError):
            resolve_api_gateway_url(client, "gym-tracker-dev", "dev", "us-east-1")


class ResolveAmplifyUrlTests(unittest.TestCase):
    def test_builds_url_from_app_and_branch(self):
        client = MagicMock()
        client.get_app.return_value = {
            "app": {"appId": "d123456abcdef", "defaultDomain": "d123456abcdef.amplifyapp.com"}
        }
        client.get_branch.return_value = {"branch": {"branchName": "main"}}

        url = resolve_amplify_url(client, "d123456abcdef", "main")

        self.assertEqual(url, "https://main.d123456abcdef.amplifyapp.com")
        client.get_app.assert_called_once_with(appId="d123456abcdef")
        client.get_branch.assert_called_once_with(
            appId="d123456abcdef", branchName="main"
        )


class ReconcileAmplifyEnvVarTests(unittest.TestCase):
    def test_no_change_when_value_already_matches(self):
        client = MagicMock()
        client.get_branch.return_value = {
            "branch": {"environmentVariables": {"VITE_API_URL": "https://same.example.com"}}
        }

        changed = reconcile_amplify_env_var(
            client, "app-id", "main", "VITE_API_URL", "https://same.example.com"
        )

        self.assertFalse(changed)
        client.update_branch.assert_not_called()
        client.start_job.assert_not_called()

    def test_updates_and_preserves_other_env_vars(self):
        client = MagicMock()
        client.get_branch.return_value = {
            "branch": {
                "environmentVariables": {
                    "VITE_API_URL": "https://old.example.com",
                    "SOME_OTHER_VAR": "keep-me",
                }
            }
        }

        changed = reconcile_amplify_env_var(
            client, "app-id", "main", "VITE_API_URL", "https://new.example.com"
        )

        self.assertTrue(changed)
        client.update_branch.assert_called_once_with(
            appId="app-id",
            branchName="main",
            environmentVariables={
                "VITE_API_URL": "https://new.example.com",
                "SOME_OTHER_VAR": "keep-me",
            },
        )
        client.start_job.assert_called_once_with(
            appId="app-id", branchName="main", jobType="RELEASE"
        )

    def test_sets_value_when_key_absent(self):
        client = MagicMock()
        client.get_branch.return_value = {"branch": {"environmentVariables": {}}}

        changed = reconcile_amplify_env_var(
            client, "app-id", "main", "VITE_API_URL", "https://new.example.com"
        )

        self.assertTrue(changed)
        client.update_branch.assert_called_once_with(
            appId="app-id",
            branchName="main",
            environmentVariables={"VITE_API_URL": "https://new.example.com"},
        )


class ReconcileCorsOriginsTests(unittest.TestCase):
    def test_no_change_when_origin_already_present(self):
        client = MagicMock()
        client.get_parameter.return_value = {
            "Parameter": {
                "Value": "http://localhost:5173,https://main.example.amplifyapp.com",
                "Type": "String",
            }
        }

        changed = reconcile_cors_origins(
            client, "/gym-tracker/dev/CORS_ALLOWED_ORIGINS",
            "https://main.example.amplifyapp.com",
        )

        self.assertFalse(changed)
        client.put_parameter.assert_not_called()

    def test_appends_missing_origin_and_preserves_existing(self):
        client = MagicMock()
        client.get_parameter.return_value = {
            "Parameter": {"Value": "http://localhost:5173", "Type": "String"}
        }

        changed = reconcile_cors_origins(
            client, "/gym-tracker/dev/CORS_ALLOWED_ORIGINS",
            "https://main.example.amplifyapp.com",
        )

        self.assertTrue(changed)
        client.put_parameter.assert_called_once_with(
            Name="/gym-tracker/dev/CORS_ALLOWED_ORIGINS",
            Value="http://localhost:5173,https://main.example.amplifyapp.com",
            Type="String",
            Overwrite=True,
        )

    def test_preserves_secure_string_type(self):
        client = MagicMock()
        client.get_parameter.return_value = {
            "Parameter": {"Value": "http://localhost:5173", "Type": "SecureString"}
        }

        reconcile_cors_origins(
            client, "/gym-tracker/dev/CORS_ALLOWED_ORIGINS",
            "https://main.example.amplifyapp.com",
        )

        client.put_parameter.assert_called_once_with(
            Name="/gym-tracker/dev/CORS_ALLOWED_ORIGINS",
            Value="http://localhost:5173,https://main.example.amplifyapp.com",
            Type="SecureString",
            Overwrite=True,
        )


class ForceLambdaColdStartTests(unittest.TestCase):
    def test_updates_function_description_with_force_cold_prefix(self):
        client = MagicMock()

        force_lambda_cold_start(client, "gym-tracker-dev")

        client.update_function_configuration.assert_called_once()
        _, kwargs = client.update_function_configuration.call_args
        self.assertEqual(kwargs["FunctionName"], "gym-tracker-dev")
        self.assertTrue(kwargs["Description"].startswith("force-cold-"))


class MainTests(unittest.TestCase):
    ENV = {
        "AWS_REGION": "us-east-1",
        "API_GATEWAY_NAME": "gym-tracker-dev",
        "ZAPPA_STAGE": "dev",
        "AMPLIFY_APP_ID": "app-id",
        "AMPLIFY_BRANCH_NAME": "main",
        "SSM_PARAMETER_NAME": "/gym-tracker/dev/CORS_ALLOWED_ORIGINS",
        "LAMBDA_FUNCTION_NAME": "gym-tracker-dev",
    }

    def _make_clients(self, apigateway, amplify, ssm, lambda_):
        clients = {
            "apigateway": apigateway,
            "amplify": amplify,
            "ssm": ssm,
            "lambda": lambda_,
        }
        return lambda service_name, region_name=None: clients[service_name]

    @patch("scripts.reconcile_deploy_env.boto3")
    @patch.dict(os.environ, ENV, clear=True)
    def test_success_path_reconciles_both_sides_and_forces_cold_start(self, mock_boto3):
        apigateway = MagicMock()
        apigateway.get_rest_apis.return_value = {
            "items": [{"id": "abc123", "name": "gym-tracker-dev"}]
        }

        amplify = MagicMock()
        amplify.get_branch.return_value = {
            "branch": {"branchName": "main", "environmentVariables": {}}
        }
        amplify.get_app.return_value = {
            "app": {"defaultDomain": "app-id.amplifyapp.com"}
        }

        ssm = MagicMock()
        ssm.get_parameter.return_value = {
            "Parameter": {"Value": "http://localhost:5173", "Type": "String"}
        }

        lambda_client = MagicMock()

        mock_boto3.client.side_effect = self._make_clients(
            apigateway, amplify, ssm, lambda_client
        )

        exit_code = main()

        self.assertEqual(exit_code, 0)
        amplify.update_branch.assert_called_once()
        ssm.put_parameter.assert_called_once()
        lambda_client.update_function_configuration.assert_called_once()

    @patch("scripts.reconcile_deploy_env.boto3")
    @patch.dict(os.environ, ENV, clear=True)
    def test_returns_1_when_api_gateway_not_found(self, mock_boto3):
        apigateway = MagicMock()
        apigateway.get_rest_apis.return_value = {"items": []}

        mock_boto3.client.side_effect = self._make_clients(
            apigateway, MagicMock(), MagicMock(), MagicMock()
        )

        exit_code = main()

        self.assertEqual(exit_code, 1)

    @patch("scripts.reconcile_deploy_env.boto3")
    @patch.dict(os.environ, ENV, clear=True)
    def test_skips_cold_start_when_cors_already_up_to_date(self, mock_boto3):
        apigateway = MagicMock()
        apigateway.get_rest_apis.return_value = {
            "items": [{"id": "abc123", "name": "gym-tracker-dev"}]
        }

        amplify = MagicMock()
        amplify.get_branch.return_value = {
            "branch": {
                "branchName": "main",
                "environmentVariables": {
                    "VITE_API_URL": "https://abc123.execute-api.us-east-1.amazonaws.com/dev/api"
                },
            }
        }
        amplify.get_app.return_value = {
            "app": {"defaultDomain": "app-id.amplifyapp.com"}
        }

        ssm = MagicMock()
        ssm.get_parameter.return_value = {
            "Parameter": {
                "Value": "https://main.app-id.amplifyapp.com",
                "Type": "String",
            }
        }

        lambda_client = MagicMock()

        mock_boto3.client.side_effect = self._make_clients(
            apigateway, amplify, ssm, lambda_client
        )

        exit_code = main()

        self.assertEqual(exit_code, 0)
        amplify.update_branch.assert_not_called()
        ssm.put_parameter.assert_not_called()
        lambda_client.update_function_configuration.assert_not_called()


if __name__ == "__main__":
    unittest.main()
