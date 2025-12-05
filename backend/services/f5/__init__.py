# backend/services/f5/__init__.py
"""
F5 Service Module - Proxy to f5_service_logic.py

This module provides backwards-compatible imports from the refactored F5 service.
For now, it re-exports everything from f5_service_logic.py to allow gradual migration.

Usage:
    from services.f5 import connect_to_f5, get_batch_usage_state
    # or
    from services import f5_service_logic  # legacy, still works

Future versions will have individual submodules:
- connection.py: F5 device connection management  
- utils.py: Helper utilities (PEM parsing, name derivation, etc.)
- upload.py: Certificate/key upload operations
- certificates.py: Certificate CRUD and scanning
- profiles.py: SSL profile management
- deployment.py: Certificate deployment workflows
- queries.py: Read-only queries (usage, VIPs, etc.)
"""

# Import everything from the original module for backwards compatibility
from services.f5_service_logic import (
    # Security
    sanitize_f5_object_name,
    # Utils
    derive_object_name_from_pem,
    derive_object_name_from_pfx,
    _sanitize_pem_cert,
    _get_not_after_dt,
    _parse_openssl_text,
    _parse_tmsh_oneline_cert,
    _safe_tail,
    # Connection
    _connect_to_f5,
    # Upload
    _rest_upload_bytes,
    _tmsh_run,
    _install_cert_and_key_from_local,
    _install_chain_from_local,
    upload_cert_and_key,
    # Certificates
    _perform_scan,
    get_realtime_certs_from_f5,
    get_realtime_chains_from_f5,
    verify_cert_object,
    verify_installed_certificate,
    delete_certificate_from_f5,
    export_key_and_create_csr,
    # Profiles
    _list_client_ssl_profiles,
    list_client_ssl_profiles_bulk,
    get_all_ssl_profiles,
    _update_profiles_reference,
    normalize_object_names,
    get_certificate_ssl_profiles_simple,
    _rename_cert_object,
    _rename_key_object,
    # Deployment
    deploy_from_pem_and_update_profiles,
    deploy_from_pfx_and_update_profiles,
    deploy_and_update_f5,
    update_profiles_with_new_cert,
    # Queries
    get_certificate_usage,
    get_batch_usage_state,
    preview_certificate_usage,
    list_virtuals_min,
    get_ssl_profile_vips,
)

# Public API aliases (without underscore prefix)
connect_to_f5 = _connect_to_f5
sanitize_pem_cert = _sanitize_pem_cert
get_not_after_dt = _get_not_after_dt
parse_openssl_text = _parse_openssl_text
parse_tmsh_oneline_cert = _parse_tmsh_oneline_cert
safe_tail = _safe_tail
rest_upload_bytes = _rest_upload_bytes
tmsh_run = _tmsh_run
install_cert_and_key_from_local = _install_cert_and_key_from_local
install_chain_from_local = _install_chain_from_local
perform_scan = _perform_scan
list_client_ssl_profiles = _list_client_ssl_profiles
update_profiles_reference = _update_profiles_reference
rename_cert_object = _rename_cert_object
rename_key_object = _rename_key_object

__all__ = [
    # Security
    'sanitize_f5_object_name',
    # Connection
    'connect_to_f5', '_connect_to_f5',
    # Utils
    'derive_object_name_from_pem', 'derive_object_name_from_pfx',
    'sanitize_pem_cert', '_sanitize_pem_cert',
    'get_not_after_dt', '_get_not_after_dt',
    'safe_tail', '_safe_tail',
    'parse_openssl_text', '_parse_openssl_text',
    'parse_tmsh_oneline_cert', '_parse_tmsh_oneline_cert',
    # Upload
    'rest_upload_bytes', '_rest_upload_bytes',
    'tmsh_run', '_tmsh_run',
    'install_cert_and_key_from_local', '_install_cert_and_key_from_local',
    'install_chain_from_local', '_install_chain_from_local',
    'upload_cert_and_key',
    # Certificates
    'perform_scan', '_perform_scan',
    'get_realtime_certs_from_f5',
    'get_realtime_chains_from_f5',
    'verify_cert_object',
    'verify_installed_certificate',
    'delete_certificate_from_f5',
    'export_key_and_create_csr',
    # Profiles
    'list_client_ssl_profiles', '_list_client_ssl_profiles',
    'list_client_ssl_profiles_bulk',
    'get_all_ssl_profiles',
    'update_profiles_reference', '_update_profiles_reference',
    'normalize_object_names',
    'get_certificate_ssl_profiles_simple',
    'rename_cert_object', '_rename_cert_object',
    'rename_key_object', '_rename_key_object',
    # Deployment
    'deploy_from_pem_and_update_profiles',
    'deploy_from_pfx_and_update_profiles',
    'deploy_and_update_f5',
    'update_profiles_with_new_cert',
    # Queries
    'get_certificate_usage',
    'get_batch_usage_state',
    'preview_certificate_usage',
    'list_virtuals_min',
    'get_ssl_profile_vips',
]
