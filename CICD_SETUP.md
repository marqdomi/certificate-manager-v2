# CI/CD Setup for Certificate Manager

## Overview

This document explains how to configure GitHub Actions for automatic deployment to Azure Container Apps.

## Architecture

```
GitHub Push → GitHub Actions → Build Images (ACR Tasks) → Deploy to Container Apps
     │              │                    │                         │
     └── main/v2.5  └── Workflow         └── Cloud Build           └── Rolling Update
```

## Prerequisites

1. **Azure Resources** (Already created ✅):
   - Resource Groups: `rg-netops-hub-prd-usc`, `rg-netops-certmgr-prd-usc`
   - Container Registry: `acrnetopshubprdusc`
   - Container Apps: `ca-certmgr-backend-prd`, `ca-certmgr-worker-prd`, `ca-certmgr-beat-prd`, `ca-certmgr-frontend-prd`

2. **GitHub Repository**: `marqdomi/certificate-manager-v2`

## Step 1: Create Service Principal (Admin Required)

An Azure administrator needs to run this command to create credentials for GitHub:

```bash
# Login as admin
az login

# Set subscription
az account set --subscription "Solera-Prod-Core_Infrastructure"

# Create Service Principal with necessary permissions
az ad sp create-for-rbac \
  --name "sp-certmgr-github-cicd" \
  --role contributor \
  --scopes \
    /subscriptions/3299abb4-876d-4894-a305-2a438b0c7cfb/resourceGroups/rg-netops-certmgr-prd-usc \
    /subscriptions/3299abb4-876d-4894-a305-2a438b0c7cfb/resourceGroups/rg-netops-hub-prd-usc \
  --sdk-auth
```

This will output JSON credentials like:
```json
{
  "clientId": "xxx",
  "clientSecret": "xxx",
  "subscriptionId": "3299abb4-876d-4894-a305-2a438b0c7cfb",
  "tenantId": "xxx",
  ...
}
```

## Step 2: Add Secret to GitHub Repository

1. Go to: https://github.com/marqdomi/certificate-manager-v2/settings/secrets/actions
2. Click **"New repository secret"**
3. Name: `AZURE_CREDENTIALS`
4. Value: Paste the entire JSON output from Step 1
5. Click **"Add secret"**

## Step 3: Create Production Environment (Optional)

For approval workflows:

1. Go to: https://github.com/marqdomi/certificate-manager-v2/settings/environments
2. Click **"New environment"**
3. Name: `production`
4. Configure protection rules if desired (required reviewers, etc.)

## Step 4: Trigger Deployment

Deployments trigger automatically when:
- Push to `main` branch
- Push to `v2.5` branch
- Manual trigger via GitHub Actions UI

### Manual Trigger:
1. Go to: https://github.com/marqdomi/certificate-manager-v2/actions
2. Select **"Deploy to Azure Container Apps"**
3. Click **"Run workflow"**

## Workflow Details

### Jobs

| Job | Description | Duration |
|-----|-------------|----------|
| `build-and-test` | Install dependencies, run tests | ~2 min |
| `build-images` | Build Docker images with ACR Tasks | ~10 min |
| `deploy` | Update Container Apps with new images | ~3 min |

### Image Tagging

- Each build creates images tagged with the Git commit SHA (e.g., `abc1234`)
- Also updates `latest` tag for easy rollback

### Rollback

To rollback to a previous version:
```bash
az containerapp update \
  --name ca-certmgr-backend-prd \
  --resource-group rg-netops-certmgr-prd-usc \
  --image acrnetopshubprdusc.azurecr.io/certmgr/backend:<previous-tag>
```

## Monitoring Deployments

### GitHub Actions
- View runs: https://github.com/marqdomi/certificate-manager-v2/actions

### Azure Portal
- Container Apps: https://portal.azure.com/#@/resource/subscriptions/3299abb4-876d-4894-a305-2a438b0c7cfb/resourceGroups/rg-netops-certmgr-prd-usc

### Application URLs
- **Frontend**: https://ca-certmgr-frontend-prd.wonderfulsand-7d6f91a8.centralus.azurecontainerapps.io
- **API Docs**: https://ca-certmgr-backend-prd.wonderfulsand-7d6f91a8.centralus.azurecontainerapps.io/docs

## Troubleshooting

### Common Issues

1. **ACR Build Fails**: Check Dockerfile syntax and dependencies
2. **Container App Update Fails**: Verify image path and permissions
3. **Migrations Fail**: Check database connectivity and migration scripts

### View Logs
```bash
# Container App logs
az containerapp logs show \
  --name ca-certmgr-backend-prd \
  --resource-group rg-netops-certmgr-prd-usc \
  --follow

# ACR Build logs
az acr task logs --registry acrnetopshubprdusc
```

## Security Notes

- Service Principal has Contributor role only on the two resource groups
- Credentials are stored as GitHub encrypted secrets
- No secrets are logged in workflow output
- Consider using OIDC/Federated Identity for enhanced security

## Contact

For issues with the CI/CD pipeline, contact the NetOps team.
