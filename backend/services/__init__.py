# backend/services/__init__.py
"""
Services Package - Business logic for CMT v2.5

Modules:
- f5: F5 LTM operations (new package, re-exports from f5_service_logic)
- f5_service_logic: Original F5 operations (legacy, use `f5` package instead)
- f5_service_tasks: Celery tasks for async F5 operations
- auth_service: Authentication and authorization
- certificate_service: Certificate parsing and validation
- encryption_service: Encryption utilities
- pfx_service: PFX/PKCS12 operations
- vips_service: VIP/Virtual Server management
- maintenance: Maintenance and cleanup tasks

Cache modules (DEPRECATED in v2.5, removal planned for v3.0):
- cache_builder: F5 cache building operations
"""
