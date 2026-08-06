import unittest
from unittest.mock import MagicMock

from scripts.reconcile_deploy_env import resolve_api_gateway_url


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


if __name__ == "__main__":
    unittest.main()
