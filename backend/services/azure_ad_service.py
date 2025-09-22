# backend/services/azure_ad_service.py

import logging
import json
from typing import Optional, Dict, List, Any
from datetime import datetime, timedelta
import msal
from authlib.integrations.requests_client import OAuth2Session
from sqlalchemy.orm import Session

from core.config import get_settings
from db.models import User, UserRole, AuthType, SystemConfig
from services.encryption_service import EncryptionService

logger = logging.getLogger(__name__)

class AzureADService:
    """
    Service for Azure AD/Microsoft 365 authentication and user synchronization
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.settings = get_settings()
        self.encryption_service = EncryptionService()
        self._config_cache = {}
        self._config_cache_time = None
        
    def _get_config(self, category: str, key: str, default: Any = None) -> Any:
        """Get configuration value from database with caching"""
        cache_key = f"{category}.{key}"
        
        # Simple cache with 5-minute TTL
        if (self._config_cache_time and 
            datetime.utcnow() - self._config_cache_time < timedelta(minutes=5) and
            cache_key in self._config_cache):
            return self._config_cache[cache_key]
        
        config = self.db.query(SystemConfig).filter(
            SystemConfig.category == category,
            SystemConfig.key == key
        ).first()
        
        if not config:
            return default
            
        value = config.value
        if config.encrypted and value:
            try:
                value = self.encryption_service.decrypt(value)
            except Exception as e:
                logger.error(f"Failed to decrypt config {cache_key}: {e}")
                return default
        
        # Update cache
        if not self._config_cache_time:
            self._config_cache_time = datetime.utcnow()
        self._config_cache[cache_key] = value
        
        return value
    
    def _get_msal_app(self) -> Optional[msal.ConfidentialClientApplication]:
        """Create MSAL application instance"""
        try:
            client_id = self._get_config('azure_ad', 'client_id')
            client_secret = self._get_config('azure_ad', 'client_secret')
            tenant_id = self._get_config('azure_ad', 'tenant_id')
            
            if not all([client_id, client_secret, tenant_id]):
                logger.error("Azure AD configuration incomplete")
                return None
            
            authority = f"https://login.microsoftonline.com/{tenant_id}"
            
            app = msal.ConfidentialClientApplication(
                client_id=client_id,
                client_credential=client_secret,
                authority=authority
            )
            
            return app
            
        except Exception as e:
            logger.error(f"Failed to create MSAL app: {e}")
            return None
    
    def get_authorization_url(self, redirect_uri: str, state: str = None) -> Optional[str]:
        """
        Get authorization URL for OAuth2 flow
        """
        try:
            app = self._get_msal_app()
            if not app:
                return None
            
            scopes = ["User.Read", "User.ReadBasic.All", "Directory.Read.All"]
            
            auth_url = app.get_authorization_request_url(
                scopes=scopes,
                redirect_uri=redirect_uri,
                state=state
            )
            
            return auth_url
            
        except Exception as e:
            logger.error(f"Failed to get authorization URL: {e}")
            return None
    
    def authenticate_with_code(self, authorization_code: str, redirect_uri: str) -> Optional[Dict[str, Any]]:
        """
        Exchange authorization code for tokens and get user info
        """
        try:
            app = self._get_msal_app()
            if not app:
                return None
            
            scopes = ["User.Read", "User.ReadBasic.All", "Directory.Read.All"]
            
            # Exchange code for tokens
            result = app.acquire_token_by_authorization_code(
                authorization_code,
                scopes=scopes,
                redirect_uri=redirect_uri
            )
            
            if "error" in result:
                logger.error(f"Azure AD token exchange failed: {result.get('error_description')}")
                return None
            
            access_token = result.get("access_token")
            if not access_token:
                logger.error("No access token received from Azure AD")
                return None
            
            # Get user info from Microsoft Graph
            user_info = self._get_user_info_from_graph(access_token)
            if not user_info:
                return None
            
            # Get user groups
            groups = self._get_user_groups_from_graph(access_token, user_info.get('id'))
            user_info['ad_groups'] = groups
            
            return user_info
            
        except Exception as e:
            logger.error(f"Azure AD authentication failed: {e}")
            return None
    
    def _get_user_info_from_graph(self, access_token: str) -> Optional[Dict[str, Any]]:
        """
        Get user information from Microsoft Graph API
        """
        try:
            import requests
            
            headers = {'Authorization': f'Bearer {access_token}'}
            
            # Get user profile
            response = requests.get(
                'https://graph.microsoft.com/v1.0/me',
                headers=headers
            )
            
            if response.status_code != 200:
                logger.error(f"Failed to get user info from Graph: {response.status_code}")
                return None
            
            user_data = response.json()
            
            user_info = {
                'id': user_data.get('id'),
                'username': user_data.get('userPrincipalName', '').split('@')[0],
                'email': user_data.get('mail') or user_data.get('userPrincipalName'),
                'full_name': user_data.get('displayName'),
                'department': user_data.get('department'),
                'phone': user_data.get('businessPhones', [None])[0],
                'domain': self._get_config('azure_ad', 'domain'),
                'object_id': user_data.get('id')
            }
            
            return user_info
            
        except Exception as e:
            logger.error(f"Failed to get user info from Graph: {e}")
            return None
    
    def _get_user_groups_from_graph(self, access_token: str, user_id: str) -> List[str]:
        """
        Get user's group memberships from Microsoft Graph
        """
        try:
            import requests
            
            headers = {'Authorization': f'Bearer {access_token}'}
            
            # Get user's group memberships
            response = requests.get(
                f'https://graph.microsoft.com/v1.0/users/{user_id}/memberOf',
                headers=headers
            )
            
            if response.status_code != 200:
                logger.warning(f"Failed to get user groups from Graph: {response.status_code}")
                return []
            
            groups_data = response.json()
            groups = []
            
            for group in groups_data.get('value', []):
                if group.get('@odata.type') == '#microsoft.graph.group':
                    groups.append(group.get('displayName', ''))
            
            return groups
            
        except Exception as e:
            logger.warning(f"Failed to get user groups from Graph: {e}")
            return []
    
    def sync_user_from_azure_ad(self, user_info: Dict[str, Any], created_by: str = "system") -> User:
        """
        Create or update user from Azure AD information
        """
        try:
            # Check if user already exists
            user = self.db.query(User).filter(User.username == user_info['username']).first()
            
            # Determine role based on Azure AD groups
            role = self._map_azure_groups_to_role(user_info.get('ad_groups', []))
            
            if user:
                # Update existing user
                user.email = user_info.get('email')
                user.full_name = user_info.get('full_name')
                user.department = user_info.get('department')
                user.phone = user_info.get('phone')
                user.domain = user_info.get('domain')
                user.ad_groups = json.dumps(user_info.get('ad_groups', []))
                user.object_guid = user_info.get('object_id')
                user.role = role
                user.auth_type = AuthType.AZURE_AD
                user.last_ad_sync = datetime.utcnow()
                user.ad_sync_status = 'synced'
                user.last_modified_by = created_by
                user.is_active = True
                
                logger.info(f"Updated Azure AD user: {user.username}")
                
            else:
                # Create new user
                user = User(
                    username=user_info['username'],
                    email=user_info.get('email'),
                    full_name=user_info.get('full_name'),
                    department=user_info.get('department'),
                    phone=user_info.get('phone'),
                    domain=user_info.get('domain'),
                    ad_groups=json.dumps(user_info.get('ad_groups', [])),
                    object_guid=user_info.get('object_id'),
                    role=role,
                    auth_type=AuthType.AZURE_AD,
                    last_ad_sync=datetime.utcnow(),
                    ad_sync_status='synced',
                    created_by=created_by,
                    is_active=True,
                    hashed_password=None  # Azure AD users don't need local password
                )
                
                self.db.add(user)
                logger.info(f"Created new Azure AD user: {user.username}")
            
            self.db.commit()
            return user
            
        except Exception as e:
            logger.error(f"Failed to sync Azure AD user {user_info.get('username', 'unknown')}: {e}")
            self.db.rollback()
            raise
    
    def _map_azure_groups_to_role(self, azure_groups: List[str]) -> UserRole:
        """
        Map Azure AD group memberships to CMT user roles
        """
        # Get role mapping configuration
        role_mapping = self._get_config('azure_ad', 'role_mapping', '{}')
        if isinstance(role_mapping, str):
            try:
                role_mapping = json.loads(role_mapping)
            except json.JSONDecodeError:
                role_mapping = {}
        
        # Default mappings if not configured
        if not role_mapping:
            role_mapping = {
                'CMT-SuperAdmins': UserRole.SUPER_ADMIN,
                'CMT-Admins': UserRole.ADMIN,
                'CMT-CertManagers': UserRole.CERTIFICATE_MANAGER,
                'CMT-F5Operators': UserRole.F5_OPERATOR,
                'CMT-Auditors': UserRole.AUDITOR,
                'CMT-Operators': UserRole.OPERATOR,
                'CMT-Viewers': UserRole.VIEWER
            }
        
        # Check groups in priority order (highest role wins)
        role_priority = [
            UserRole.SUPER_ADMIN,
            UserRole.ADMIN,
            UserRole.CERTIFICATE_MANAGER,
            UserRole.F5_OPERATOR,
            UserRole.AUDITOR,
            UserRole.OPERATOR,
            UserRole.VIEWER
        ]
        
        for role in role_priority:
            for group_name, mapped_role in role_mapping.items():
                if mapped_role == role and group_name in azure_groups:
                    logger.info(f"Mapped Azure AD group '{group_name}' to role '{role.value}'")
                    return role
        
        # Default to viewer if no groups match
        logger.warning(f"No role mapping found for groups: {azure_groups}. Defaulting to viewer.")
        return UserRole.VIEWER
    
    def test_connection(self) -> Dict[str, Any]:
        """
        Test Azure AD connection and configuration
        """
        try:
            app = self._get_msal_app()
            if not app:
                return {
                    'success': False,
                    'error': 'Failed to create MSAL application',
                    'details': 'Check client_id, client_secret, and tenant_id configuration'
                }
            
            # Try to get an app-only token to test configuration
            result = app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])
            
            if "error" in result:
                return {
                    'success': False,
                    'error': result.get('error_description', 'Unknown error'),
                    'details': 'Check Azure AD app registration and permissions'
                }
            
            return {
                'success': True,
                'message': 'Azure AD connection successful',
                'config_info': {
                    'tenant_id': self._get_config('azure_ad', 'tenant_id'),
                    'client_id': self._get_config('azure_ad', 'client_id'),
                    'domain': self._get_config('azure_ad', 'domain'),
                    'token_type': result.get('token_type')
                }
            }
            
        except Exception as e:
            logger.error(f"Azure AD connection test failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'details': 'Check Azure AD configuration and network connectivity'
            }