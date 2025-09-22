# backend/services/ldap_service.py

import logging
import json
from typing import Optional, Dict, List, Any
from datetime import datetime, timedelta
from ldap3 import Server, Connection, ALL, NTLM, SIMPLE, AUTO_BIND_TLS_BEFORE_BIND
from ldap3.core.exceptions import LDAPException, LDAPBindError, LDAPInvalidCredentialsError
from sqlalchemy.orm import Session

from core.config import get_settings
from db.models import User, UserRole, AuthType, SystemConfig
from services.encryption_service import EncryptionService

logger = logging.getLogger(__name__)

class LDAPService:
    """
    Service for LDAP/Active Directory authentication and user synchronization
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
    
    def _get_ldap_connection(self, bind_user: str = None, bind_password: str = None) -> Optional[Connection]:
        """Create LDAP connection"""
        try:
            server_url = self._get_config('ldap', 'server_url')
            if not server_url:
                logger.error("LDAP server URL not configured")
                return None
            
            # Create server object
            use_ssl = self._get_config('ldap', 'use_ssl', True)
            port = int(self._get_config('ldap', 'port', 636 if use_ssl else 389))
            
            server = Server(
                server_url,
                port=port,
                use_ssl=use_ssl,
                get_info=ALL
            )
            
            # Determine bind credentials
            if not bind_user:
                bind_user = self._get_config('ldap', 'bind_user')
                bind_password = self._get_config('ldap', 'bind_password')
            
            if not bind_user or not bind_password:
                logger.error("LDAP bind credentials not configured")
                return None
            
            # Create connection
            connection = Connection(
                server,
                user=bind_user,
                password=bind_password,
                authentication=NTLM if self._get_config('ldap', 'use_ntlm', True) else SIMPLE,
                auto_bind=AUTO_BIND_TLS_BEFORE_BIND if use_ssl else True
            )
            
            return connection
            
        except LDAPException as e:
            logger.error(f"LDAP connection failed: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error creating LDAP connection: {e}")
            return None
    
    def authenticate_user(self, username: str, password: str) -> Optional[Dict[str, Any]]:
        """
        Authenticate user against LDAP/AD
        Returns user info dict if successful, None if failed
        """
        try:
            # Get base DN and user search filter
            base_dn = self._get_config('ldap', 'base_dn')
            user_search_filter = self._get_config('ldap', 'user_search_filter', '(sAMAccountName={username})')
            user_search_filter = user_search_filter.format(username=username)
            
            if not base_dn:
                logger.error("LDAP base DN not configured")
                return None
            
            # First, search for the user to get their DN
            conn = self._get_ldap_connection()
            if not conn:
                return None
            
            # Search for user
            conn.search(
                search_base=base_dn,
                search_filter=user_search_filter,
                attributes=['distinguishedName', 'sAMAccountName', 'mail', 'displayName', 
                           'department', 'telephoneNumber', 'memberOf', 'objectGUID']
            )
            
            if not conn.entries:
                logger.warning(f"User {username} not found in LDAP")
                return None
            
            user_entry = conn.entries[0]
            user_dn = str(user_entry.distinguishedName)
            
            # Now try to bind with user's credentials
            user_conn = Connection(
                conn.server,
                user=user_dn,
                password=password,
                authentication=NTLM if self._get_config('ldap', 'use_ntlm', True) else SIMPLE
            )
            
            if not user_conn.bind():
                logger.warning(f"Authentication failed for user {username}")
                return None
            
            # Authentication successful, extract user info
            user_info = {
                'username': str(user_entry.sAMAccountName),
                'email': str(user_entry.mail) if user_entry.mail else None,
                'full_name': str(user_entry.displayName) if user_entry.displayName else None,
                'department': str(user_entry.department) if user_entry.department else None,
                'phone': str(user_entry.telephoneNumber) if user_entry.telephoneNumber else None,
                'distinguished_name': user_dn,
                'object_guid': str(user_entry.objectGUID) if user_entry.objectGUID else None,
                'domain': self._get_config('ldap', 'domain'),
                'ad_groups': [str(group) for group in user_entry.memberOf] if user_entry.memberOf else []
            }
            
            user_conn.unbind()
            conn.unbind()
            
            return user_info
            
        except LDAPInvalidCredentialsError:
            logger.warning(f"Invalid credentials for user {username}")
            return None
        except LDAPException as e:
            logger.error(f"LDAP authentication error for {username}: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error during LDAP authentication for {username}: {e}")
            return None
    
    def sync_user_from_ad(self, user_info: Dict[str, Any], created_by: str = "system") -> User:
        """
        Create or update user from AD information
        """
        try:
            # Check if user already exists
            user = self.db.query(User).filter(User.username == user_info['username']).first()
            
            # Determine role based on AD groups
            role = self._map_ad_groups_to_role(user_info.get('ad_groups', []))
            
            if user:
                # Update existing user
                user.email = user_info.get('email')
                user.full_name = user_info.get('full_name')
                user.department = user_info.get('department')
                user.phone = user_info.get('phone')
                user.domain = user_info.get('domain')
                user.distinguished_name = user_info.get('distinguished_name')
                user.ad_groups = json.dumps(user_info.get('ad_groups', []))
                user.object_guid = user_info.get('object_guid')
                user.role = role
                user.auth_type = AuthType.LDAP
                user.last_ad_sync = datetime.utcnow()
                user.ad_sync_status = 'synced'
                user.last_modified_by = created_by
                user.is_active = True
                
                logger.info(f"Updated AD user: {user.username}")
                
            else:
                # Create new user
                user = User(
                    username=user_info['username'],
                    email=user_info.get('email'),
                    full_name=user_info.get('full_name'),
                    department=user_info.get('department'),
                    phone=user_info.get('phone'),
                    domain=user_info.get('domain'),
                    distinguished_name=user_info.get('distinguished_name'),
                    ad_groups=json.dumps(user_info.get('ad_groups', [])),
                    object_guid=user_info.get('object_guid'),
                    role=role,
                    auth_type=AuthType.LDAP,
                    last_ad_sync=datetime.utcnow(),
                    ad_sync_status='synced',
                    created_by=created_by,
                    is_active=True,
                    hashed_password=None  # AD users don't need local password
                )
                
                self.db.add(user)
                logger.info(f"Created new AD user: {user.username}")
            
            self.db.commit()
            return user
            
        except Exception as e:
            logger.error(f"Failed to sync user {user_info.get('username', 'unknown')}: {e}")
            self.db.rollback()
            raise
    
    def _map_ad_groups_to_role(self, ad_groups: List[str]) -> UserRole:
        """
        Map AD group memberships to CMT user roles
        """
        # Get role mapping configuration
        role_mapping = self._get_config('ldap', 'role_mapping', '{}')
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
        
        user_groups = [group.split(',')[0].replace('CN=', '') for group in ad_groups]
        
        for role in role_priority:
            for group_name, mapped_role in role_mapping.items():
                if mapped_role == role and group_name in user_groups:
                    logger.info(f"Mapped AD group '{group_name}' to role '{role.value}'")
                    return role
        
        # Default to viewer if no groups match
        logger.warning(f"No role mapping found for groups: {user_groups}. Defaulting to viewer.")
        return UserRole.VIEWER
    
    def test_connection(self) -> Dict[str, Any]:
        """
        Test LDAP connection and return status
        """
        try:
            conn = self._get_ldap_connection()
            if not conn:
                return {
                    'success': False,
                    'error': 'Failed to create LDAP connection',
                    'details': 'Check server URL, port, and bind credentials'
                }
            
            # Try a simple search
            base_dn = self._get_config('ldap', 'base_dn')
            if base_dn:
                conn.search(base_dn, '(objectClass=*)', attributes=['distinguishedName'])
                result_count = len(conn.entries)
            else:
                result_count = 0
            
            conn.unbind()
            
            return {
                'success': True,
                'message': 'LDAP connection successful',
                'server_info': {
                    'server': self._get_config('ldap', 'server_url'),
                    'port': self._get_config('ldap', 'port'),
                    'ssl': self._get_config('ldap', 'use_ssl'),
                    'base_dn': base_dn,
                    'search_results': result_count
                }
            }
            
        except Exception as e:
            logger.error(f"LDAP connection test failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'details': 'Check LDAP configuration and network connectivity'
            }