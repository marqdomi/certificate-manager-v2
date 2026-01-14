# Azure AD Authentication Setup for Certificate Manager

## Overview

This document provides instructions to enable Azure AD (Microsoft Entra ID) authentication for the Certificate Manager application. This allows users to sign in with their Solera corporate credentials.

## Current Implementation Status

✅ **Backend Ready**: Azure AD token validation service implemented  
✅ **Frontend Ready**: Login page with Microsoft SSO button  
✅ **Hybrid Mode**: Supports both Azure AD and local authentication  
⏳ **Pending**: App Registration creation (requires Azure AD admin)

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│    Frontend     │────▶│   Azure AD      │────▶│    Backend      │
│    (React)      │     │  (Entra ID)     │     │   (FastAPI)     │
│                 │◀────│                 │◀────│                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │  1. Click "Sign in    │                       │
        │     with Microsoft"   │                       │
        │──────────────────────▶│                       │
        │                       │                       │
        │  2. User authenticates│                       │
        │◀──────────────────────│                       │
        │                       │                       │
        │  3. ID Token returned │                       │
        │◀──────────────────────│                       │
        │                       │                       │
        │  4. Exchange ID Token for App Token           │
        │──────────────────────────────────────────────▶│
        │                       │  5. Validate with     │
        │                       │     Azure JWKS        │
        │                       │◀─────────────────────▶│
        │                       │                       │
        │  6. App JWT Token                             │
        │◀──────────────────────────────────────────────│
```

## Quick Start (After Admin Setup)

Once an admin creates the App Registration, enable Azure AD by setting these environment variables:

```bash
# Backend environment variables
AUTH_MODE=hybrid                    # 'local', 'azure_ad', or 'hybrid'
AZURE_AD_TENANT_ID=c45b48f3-13bb-448b-9356-ba7b863c2189
AZURE_AD_CLIENT_ID=<your-client-id>
```

## Step 1: Create App Registration (Admin Required)

An Azure AD administrator needs to create the App Registration:

### 1.1 Via Azure Portal

1. Go to: https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade
2. Click **"New registration"**
3. Fill in:
   - **Name**: `Certificate Manager`
   - **Supported account types**: `Accounts in this organizational directory only (Solera Holdings, Inc. only - Single tenant)`
   - **Redirect URI**: 
     - Type: `Single-page application (SPA)`
     - URL: `https://ca-certmgr-frontend-prd.wonderfulsand-7d6f91a8.centralus.azurecontainerapps.io`
4. Click **"Register"**

### 1.2 Via Azure CLI (Admin)

```bash
# Create the App Registration
az ad app create \
  --display-name "Certificate Manager" \
  --sign-in-audience AzureADMyOrg \
  --web-redirect-uris \
    "https://ca-certmgr-frontend-prd.wonderfulsand-7d6f91a8.centralus.azurecontainerapps.io" \
    "http://localhost:5173" \
  --enable-id-token-issuance true \
  --enable-access-token-issuance true

# Get the App ID
APP_ID=$(az ad app list --filter "displayName eq 'Certificate Manager'" --query "[0].appId" -o tsv)
echo "Application (client) ID: $APP_ID"

# Create a Service Principal for the app
az ad sp create --id $APP_ID
```

## Step 2: Configure API Permissions

In the Azure Portal:

1. Go to your App Registration → **API permissions**
2. Click **"Add a permission"**
3. Select **"Microsoft Graph"**
4. Select **"Delegated permissions"**
5. Add:
   - `openid`
   - `profile`
   - `email`
   - `User.Read`
6. Click **"Grant admin consent for Solera Holdings, Inc."**

## Step 3: Configure Token Claims (Optional)

To include group membership in tokens:

1. Go to App Registration → **Token configuration**
2. Click **"Add groups claim"**
3. Select **"Security groups"**
4. Under "Customize token properties by type", check:
   - ID: Group ID
   - Access: Group ID

## Step 4: Create App Roles (For RBAC)

1. Go to App Registration → **App roles**
2. Create roles:

| Display Name | Value | Description |
|--------------|-------|-------------|
| Administrator | admin | Full access to all features |
| Operator | operator | Can manage certificates and renewals |
| Viewer | viewer | Read-only access |

### Via Manifest

Edit the App Registration manifest and add:

```json
"appRoles": [
  {
    "allowedMemberTypes": ["User"],
    "description": "Full access to all Certificate Manager features",
    "displayName": "Administrator",
    "id": "generate-new-guid-1",
    "isEnabled": true,
    "value": "admin"
  },
  {
    "allowedMemberTypes": ["User"],
    "description": "Can manage certificates and perform renewals",
    "displayName": "Operator", 
    "id": "generate-new-guid-2",
    "isEnabled": true,
    "value": "operator"
  },
  {
    "allowedMemberTypes": ["User"],
    "description": "Read-only access to Certificate Manager",
    "displayName": "Viewer",
    "id": "generate-new-guid-3",
    "isEnabled": true,
    "value": "viewer"
  }
]
```

## Step 5: Assign Users to Roles

1. Go to: Azure Portal → Enterprise Applications → Certificate Manager
2. Click **"Users and groups"**
3. Click **"Add user/group"**
4. Select users/groups and assign appropriate roles

## Step 6: Get Configuration Values

After setup, you'll need these values for the application:

| Setting | Where to find |
|---------|--------------|
| Client ID | App Registration → Overview → Application (client) ID |
| Tenant ID | App Registration → Overview → Directory (tenant) ID |
| Authority | `https://login.microsoftonline.com/{tenant-id}` |

**Expected values for Solera:**
- Tenant ID: `c45b48f3-13bb-448b-9356-ba7b863c2189`
- Authority: `https://login.microsoftonline.com/c45b48f3-13bb-448b-9356-ba7b863c2189`

## Step 7: Update Application Configuration

Once the App Registration is created, update these files:

### Backend: Environment Variables

Add to Container App configuration:
```bash
AZURE_AD_TENANT_ID=c45b48f3-13bb-448b-9356-ba7b863c2189
AZURE_AD_CLIENT_ID=<your-app-client-id>
AZURE_AD_AUDIENCE=api://<your-app-client-id>
AUTH_MODE=azure_ad  # Enable Azure AD authentication
```

### Frontend: Configuration

The frontend will automatically detect Azure AD configuration from the backend.

## Security Considerations

1. **Token Validation**: Backend validates tokens against Azure AD's public keys
2. **Role Mapping**: Azure AD roles are mapped to application roles
3. **Hybrid Auth**: Users without Azure AD can still use local accounts (optional)
4. **Session Duration**: Configurable token lifetimes in Azure AD

## Fallback Authentication

The application supports both Azure AD and local authentication:
- Azure AD users: SSO with corporate credentials
- Local users: Username/password (for service accounts, emergency access)

## Troubleshooting

### Common Issues

1. **"AADSTS50011: Reply URL mismatch"**
   - Ensure redirect URIs match exactly (including trailing slashes)

2. **"AADSTS65001: User needs to consent"**
   - Admin needs to grant consent for the organization

3. **"Token validation failed"**
   - Check that tenant ID and client ID are correct
   - Verify the token audience matches

### Debug Mode

Enable debug logging in backend:
```bash
LOG_LEVEL=DEBUG
AZURE_AD_DEBUG=true
```

---

## Implementation Details

### Files Modified/Created for Azure AD Support

#### Backend

| File | Purpose |
|------|---------|
| `services/azure_ad_auth.py` | Azure AD token validation and user sync |
| `api/endpoints/auth.py` | Updated with `/auth/config` and `/auth/azure-ad/token` endpoints |
| `core/config.py` | Added Azure AD configuration variables |
| `db/models.py` | Added `azure_oid`, `auth_provider`, `email`, `full_name`, `last_login` to User model |
| `requirements.txt` | Added `httpx` for JWKS fetching |
| `alembic/versions/add_azure_ad_fields.py` | Database migration for new User fields |

#### Frontend

| File | Purpose |
|------|---------|
| `services/azureAuthService.js` | Azure AD login popup flow |
| `services/azureAuthConfig.js` | MSAL configuration |
| `pages/LoginPage.jsx` | Updated with "Sign in with Microsoft" button |
| `pages/AuthCallback.jsx` | OAuth callback handler |
| `App.jsx` | Added `/auth/callback` route |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/auth/config` | GET | Returns auth configuration (modes, Azure AD enabled, etc.) |
| `/auth/token` | POST | Local username/password login |
| `/auth/azure-ad/token` | POST | Exchange Azure AD ID token for app token |

### Authentication Modes

| Mode | Description |
|------|-------------|
| `local` | Only username/password authentication |
| `azure_ad` | Only Azure AD SSO |
| `hybrid` | Both Azure AD and local auth available |

### Environment Variables

```bash
# Required for Azure AD
AUTH_MODE=hybrid                                          # local, azure_ad, or hybrid
AZURE_AD_TENANT_ID=c45b48f3-13bb-448b-9356-ba7b863c2189  # Solera tenant
AZURE_AD_CLIENT_ID=<from-app-registration>               # App Registration client ID
```

---

## Request for Admin Action

**To:** Azure AD Administrator  
**Subject:** Request for App Registration - Certificate Management Tool

Please create an Azure AD App Registration with the following configuration:

1. **Application Name:** Certificate Manager
2. **Account Type:** Single tenant (Solera only)
3. **Platform:** Single-page application (SPA)
4. **Redirect URIs:**
   - Production: `https://ca-certmgr-frontend-prd.wonderfulsand-7d6f91a8.centralus.azurecontainerapps.io/auth/callback`
   - Development: `http://localhost:5173/auth/callback`
5. **API Permissions:** OpenID, profile, email, User.Read
6. **Token Configuration:** Enable ID tokens, include groups claim

Once created, please provide:
- [ ] Application (Client) ID
- [ ] Confirmation of admin consent granted

Thank you!

## Next Steps After Setup

1. Admin creates App Registration and provides Client ID
2. Update backend environment variables
3. Deploy updated configuration
4. Test with a pilot group of users
5. Roll out to all users

## Contact

For Azure AD configuration assistance, contact:
- Azure AD Admin Team
- NetOps Team (for application issues)
