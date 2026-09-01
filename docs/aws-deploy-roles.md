# AWS IAM Roles for CI Lambda Deploy

Deploying the Zappa backend from CI uses two IAM roles. Create both once in
the AWS console (account `214182382176`, region `us-east-1`).

## A. GitHub Actions deploy role — `gym-tracker-github-deploy`

The workflow assumes this role via OIDC. Keep it least-privilege: it never
creates/deletes IAM roles (the Lambda execution role is pre-provisioned, see B).

### Trust policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::214182382176:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:bioflower/gym-tracker:*"
        }
      }
    }
  ]
}
```

> **Tighten before merging to main:** change the `StringLike` value to
> `"repo:bioflower/gym-tracker:ref:refs/heads/main"` so only the main branch
> can assume the role. The broad value is for bring-up testing from the feature
> branch.

### Permissions (inline policy)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket", "s3:GetBucketLocation", "s3:PutObject",
        "s3:GetObject", "s3:DeleteObject", "s3:CreateBucket"
      ],
      "Resource": ["arn:aws:s3:::gym-tracker-zappa-dev", "arn:aws:s3:::gym-tracker-zappa-dev/*"]
    },
    {
      "Effect": "Allow",
      "Action": [
        "lambda:GetFunction", "lambda:GetFunctionConfiguration",
        "lambda:UpdateFunctionCode", "lambda:UpdateFunctionConfiguration",
        "lambda:CreateFunction", "lambda:PublishVersion", "lambda:AddPermission",
        "lambda:RemovePermission", "lambda:UpdateAlias", "lambda:GetAlias", "lambda:CreateAlias"
      ],
      "Resource": ["arn:aws:lambda:us-east-1:214182382176:function:gym-tracker-dev"]
    },
    {
      "Effect": "Allow",
      "Action": ["apigateway:GET", "apigateway:POST", "apigateway:PUT", "apigateway:PATCH", "apigateway:DELETE"],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogGroups", "logs:TagResource", "logs:UntagResource", "logs:PutRetentionPolicy"],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"],
      "Resource": "arn:aws:ssm:us-east-1:214182382176:parameter/gym-tracker/dev/*"
    },
    {
      "Effect": "Allow",
      "Action": ["iam:PassRole", "iam:GetRole", "iam:GetRolePolicy", "iam:ListRolePolicies", "iam:ListAttachedRolePolicies"],
      "Resource": "arn:aws:iam::214182382176:role/gym-tracker-dev-ZappaLambdaExecutionRole"
    },
    {
      "Effect": "Allow",
      "Action": ["events:PutRule", "events:PutTargets", "events:RemoveTargets", "events:DeleteRule", "events:DescribeRule", "events:ListRules"],
      "Resource": "*"
    }
  ]
}
```

> `events:*` covers zappa's default `keep_warm` scheduled invocations. If a
> missing action surfaces during verification, add just that action rather than
> widening to `*` globally.

## B. Lambda execution role — `gym-tracker-dev-ZappaLambdaExecutionRole`

Pre-provisioned once so `zappa_settings.json` can set `manage_roles: false`.
The name matches what zappa would have auto-created, so the running function's
role is preserved.

### Trust policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "lambda.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

### Attached policies

1. AWS managed: `AWSLambdaBasicExecutionRole` (CloudWatch Logs).
2. Inline policy granting SSM reads for app config, scoped to the app prefix:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"],
      "Resource": "arn:aws:ssm:us-east-1:214182382176:parameter/gym-tracker/dev/*"
    }
  ]
}
```

> The running function's existing role may carry additional policies (e.g.
> PostgreSQL/Neon egress). Before creating B, diff it against the live function:
> `aws lambda get-function-configuration --function-name gym-tracker-dev --query Role`
> then inspect that role's attached policies, so the pre-provisioned role is
> equivalent to what the function currently uses.

## One-time setup order

1. Create role **B**, then update its trust/attached policies to match the live
   function's role.
2. Set `manage_roles: false` + `role_name` (already done in `zappa_settings.json`).
3. Create role **A** (OIDC + permissions).
4. Trigger the `deploy-lambda` workflow from the Actions tab.
5. Before merging to main, tighten A's trust policy `sub` to
   `ref:refs/heads/main`.
