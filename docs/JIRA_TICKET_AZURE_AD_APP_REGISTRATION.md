# JIRA Ticket: Azure AD App Registration for Certificate Management Tool

## Ticket Information

**Project:** [Your Project Code]  
**Issue Type:** Task / Service Request  
**Priority:** Medium  
**Assignee:** Core Team / Azure AD Admin Team  
**Reporter:** Marco Dominguez  
**Labels:** azure-ad, app-registration, authentication, security, certificate-manager

---

## Summary

Request Azure AD App Registration creation for Certificate Management Tool to enable Microsoft SSO authentication for Solera users.

---

## Description

### Background

The Certificate Management Tool (CMT) is a production application that manages SSL/TLS certificates across Solera's F5 infrastructure. We are implementing Azure AD (Microsoft Entra ID) authentication to:

1. **Improve Security**: Replace local username/password authentication with corporate SSO
2. **Centralized Access Control**: Manage user access through Azure AD groups and roles
3. **Better User Experience**: Single sign-on with existing Solera credentials
4. **Audit Compliance**: Leverage Azure AD audit logs for authentication tracking

### Current Status

- ✅ Backend Azure AD integration code: **COMPLETE**
- ✅ Frontend Microsoft SSO button: **COMPLETE**  
- ✅ Token validation service: **COMPLETE**
- ⏳ App Registration in Azure AD: **PENDING** (requires Core team)

### Application Details

- **Application Name:** Certificate Management Tool (CMT)
- **Current Production URL:** https://ca-certmgr-frontend-prd.wonderfulsand-7d6f91a8.centralus.azurecontainerapps.io
- **Backend API:** https://ca-certmgr-backend-prd.wonderfulsand-7d6f91a8.centralus.azurecontainerapps.io
- **Tenant:** Solera Holdings, Inc.
- **Tenant ID:** `c45b48f3-13bb-448b-9356-ba7b863c2189`
- **Subscription:** Solera-Prod-Core_Infrastructure (`3299abb4-876d-4894-a305-2a438b0c7cfb`)

---

## Technical Requirements

### 1. App Registration Configuration

Please create an Azure AD App Registration with the following settings:

| Setting | Value |
|---------|-------|
| **Display Name** | `Certificate Management Tool` or `CMT-Production` |
| **Supported Account Types** | Accounts in this organizational directory only (Solera Holdings, Inc. - Single tenant) |
| **Application Type** | Single-page application (SPA) |

### 2. Redirect URIs (CRITICAL)

Configure these exact redirect URIs in the App Registration:

**Production:**
```
https://ca-certmgr-frontend-prd.wonderfulsand-7d6f91a8.centralus.azurecontainerapps.io/auth/callback
```

**Development/Testing:**
```
http://localhost:5173/auth/callback
```

⚠️ **Important:** The `/auth/callback` path is required. Do not use just the base URL.

### 3. API Permissions

Configure the following **Delegated permissions** from **Microsoft Graph**:

| Permission | Type | Purpose |
|------------|------|---------|
| `openid` | Delegated | OIDC authentication |
| `profile` | Delegated | User profile information |
| `email` | Delegated | User email address |
| `User.Read` | Delegated | Read user's basic profile |

**Action Required:** Please grant **Admin Consent** for these permissions on behalf of the organization.

### 4. Token Configuration

Enable the following token settings:

- ✅ Enable **ID tokens** for implicit flow and hybrid flows
- ✅ Enable **Access tokens** for implicit flow and hybrid flows
- ✅ Add **groups claim** to tokens (optional but recommended)

**Groups Claim Configuration (if enabled):**
- Token type: ID token
- Group types: Security groups
- Emit groups as: Group IDs

### 5. App Roles (RBAC)

Please create the following App Roles for role-based access control:

#### Administrator Role
```json
{
  "allowedMemberTypes": ["User"],
  "description": "Full administrative access to Certificate Manager including user management, system configuration, and all certificate operations",
  "displayName": "Administrator",
  "id": "<generate-new-guid>",
  "isEnabled": true,
  "value": "admin"
}
```

#### Operator Role
```json
{
  "allowedMemberTypes": ["User"],
  "description": "Can manage certificates, perform renewals, deploy to F5 devices, and generate CSRs",
  "displayName": "Operator",
  "id": "<generate-new-guid>",
  "isEnabled": true,
  "value": "operator"
}
```

#### Viewer Role
```json
{
  "allowedMemberTypes": ["User"],
  "description": "Read-only access to view certificates and system status",
  "displayName": "Viewer",
  "id": "<generate-new-guid>",
  "isEnabled": true,
  "value": "viewer"
}
```

### 6. Initial User Assignments

Please assign the following users to roles (or provide instructions for NetOps to do so):

| User / Group | Role | Justification |
|--------------|------|---------------|
| Marco Dominguez | Administrator | Application owner and primary admin |
| NetOps Team | Operator | Day-to-day certificate management |
| [Other stakeholders] | Viewer | Monitoring and reporting |

---

## Step-by-Step Instructions (For Core Team)

### Via Azure Portal

1. Navigate to: https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade
2. Click **"New registration"**
3. Enter:
   - Name: `Certificate Management Tool`
   - Supported account types: `Accounts in this organizational directory only`
   - Redirect URI: Select **Single-page application (SPA)**
   - Add URI: `https://ca-certmgr-frontend-prd.wonderfulsand-7d6f91a8.centralus.azurecontainerapps.io/auth/callback`
4. Click **"Register"**
5. Go to **Authentication** → Add platform → **Single-page application**
   - Add URI: `http://localhost:5173/auth/callback`
6. Go to **Token configuration**:
   - Enable ID tokens
   - Enable Access tokens
   - (Optional) Add groups claim
7. Go to **API permissions**:
   - Click "Add a permission" → Microsoft Graph → Delegated permissions
   - Add: openid, profile, email, User.Read
   - Click "Grant admin consent for Solera Holdings, Inc."
8. Go to **App roles** → Create roles as specified above
9. Go to **Overview** → Copy the **Application (client) ID**

### Via Azure CLI (Alternative)

```bash
# Create App Registration
az ad app create \
  --display-name "Certificate Management Tool" \
  --sign-in-audience AzureADMyOrg \
  --web-redirect-uris \
    "https://ca-certmgr-frontend-prd.wonderfulsand-7d6f91a8.centralus.azurecontainerapps.io/auth/callback" \
    "http://localhost:5173/auth/callback" \
  --enable-id-token-issuance true \
  --enable-access-token-issuance true

# Get the Application ID
APP_ID=$(az ad app list --filter "displayName eq 'Certificate Management Tool'" --query "[0].appId" -o tsv)
echo "Application (client) ID: $APP_ID"

# Create Service Principal
az ad sp create --id $APP_ID

# Grant admin consent for Microsoft Graph permissions
az ad app permission admin-consent --id $APP_ID
```

---

## Deliverables

Please provide the following information once the App Registration is created:

1. ✅ **Application (Client) ID** - We need this to configure the application
2. ✅ **Confirmation that Admin Consent was granted** for API permissions
3. ✅ **Screenshot or confirmation** of configured redirect URIs
4. ✅ **App Roles created** and available for user assignment
5. ✅ (Optional) Instructions for NetOps to assign users to roles

---

## Post-Creation Configuration (NetOps)

Once we receive the Client ID, NetOps will:

1. Update backend environment variables:
   ```bash
   az containerapp update \
     --name ca-certmgr-backend-prd \
     --resource-group rg-certmgr-prd-usc \
     --set-env-vars \
       AUTH_MODE=hybrid \
       AZURE_AD_TENANT_ID=c45b48f3-13bb-448b-9356-ba7b863c2189 \
       AZURE_AD_CLIENT_ID=<client-id-from-core-team>
   ```

2. Restart Container Apps to apply new configuration
3. Test authentication with a pilot user
4. Monitor logs for any authentication errors

---

## Testing Plan

1. **Smoke Test**: Verify "Sign in with Microsoft" button appears on login page
2. **Authentication Test**: Test login with Azure AD credentials
3. **Role Test**: Verify user roles are correctly mapped from Azure AD
4. **Fallback Test**: Ensure local authentication still works (hybrid mode)
5. **Token Validation**: Verify backend correctly validates Azure AD tokens

---

## Security & Compliance

- ✅ No secrets or passwords stored in application code
- ✅ Tokens validated against Azure AD's public keys (JWKS)
- ✅ Session duration controlled by Azure AD token lifetime
- ✅ Supports MFA through Azure AD policies
- ✅ All authentication events logged in Azure AD audit logs
- ✅ Hybrid mode allows emergency access via local accounts

---

## Timeline

- **Requested by:** January 15, 2026
- **Desired completion:** Within 5 business days
- **Deployment window:** After receiving Client ID (1-2 days for testing)

---

## Support & Documentation

- **Full Setup Guide:** [app/docs/AZURE_AD_SETUP.md](./AZURE_AD_SETUP.md)
- **Architecture Diagram:** Included in setup guide
- **Implementation Details:** All code committed to `v2.5` branch

---

## Contact Information

**Primary Contact:**  
Marco Dominguez  
Email: marco.dominguez@solera.com  
Team: NetOps

**Secondary Contact:**  
[Your Manager/Team Lead]  
Email: [email]

---

## Additional Notes

- The application supports **hybrid authentication mode**, meaning both Azure AD and local username/password authentication can coexist
- This allows for gradual rollout and emergency access if Azure AD is unavailable
- No changes to existing user accounts are required; Azure AD users will be automatically created/synced on first login
- Existing local users can continue using username/password authentication

---

## Acceptance Criteria

- [ ] App Registration created with correct name and settings
- [ ] Redirect URIs configured exactly as specified
- [ ] API permissions added and admin consent granted
- [ ] App Roles created (admin, operator, viewer)
- [ ] Client ID provided to NetOps team
- [ ] Initial test user assigned to Administrator role

---

## References

- Azure AD App Registration Documentation: https://learn.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app
- Microsoft Identity Platform: https://learn.microsoft.com/en-us/azure/active-directory/develop/
- Certificate Manager Repository: https://github.com/marqdomi/certificate-manager-v2

---

**Thank you for your assistance with this request!** 🙏
