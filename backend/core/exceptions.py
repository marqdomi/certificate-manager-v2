# core/exceptions.py
"""
Custom exception classes for CMT.
Provides structured error handling with codes for API responses.
"""
from typing import Optional


class CMTException(Exception):
    """Base exception for all CMT errors."""
    
    status_code: int = 400
    code: str = "CMT_ERROR"
    
    def __init__(self, message: str, code: str = None, status_code: int = None):
        self.message = message
        if code:
            self.code = code
        if status_code:
            self.status_code = status_code
        super().__init__(self.message)
    
    def to_dict(self) -> dict:
        """Convert exception to JSON-serializable dict."""
        return {
            "error": self.code,
            "message": self.message,
        }


# =============================================================================
# F5/Device Exceptions
# =============================================================================

class F5ConnectionError(CMTException):
    """Failed to connect to F5 device."""
    code = "F5_CONNECTION_ERROR"
    status_code = 502
    
    def __init__(self, device_ip: str, original_error: str = None):
        message = f"Failed to connect to F5 at {device_ip}"
        if original_error:
            message += f": {original_error}"
        super().__init__(message)


class F5AuthenticationError(CMTException):
    """Authentication failed on F5 device."""
    code = "F5_AUTH_ERROR"
    status_code = 401
    
    def __init__(self, device_ip: str):
        super().__init__(f"Authentication failed for F5 device {device_ip}")


class F5OperationError(CMTException):
    """Generic F5 operation failure."""
    code = "F5_OPERATION_ERROR"
    status_code = 500
    
    def __init__(self, operation: str, device_ip: str, detail: str = None):
        message = f"F5 operation '{operation}' failed on {device_ip}"
        if detail:
            message += f": {detail}"
        super().__init__(message)


class DeviceNotFoundError(CMTException):
    """Device not found in database."""
    code = "DEVICE_NOT_FOUND"
    status_code = 404
    
    def __init__(self, device_id: int = None, hostname: str = None):
        identifier = f"ID={device_id}" if device_id else f"hostname={hostname}"
        super().__init__(f"Device not found: {identifier}")


class DeviceCredentialsNotSetError(CMTException):
    """Device credentials not configured."""
    code = "DEVICE_CREDENTIALS_NOT_SET"
    status_code = 400
    
    def __init__(self, device_id: int):
        super().__init__(f"Credentials not set for device ID={device_id}")


# =============================================================================
# Certificate Exceptions
# =============================================================================

class CertificateNotFoundError(CMTException):
    """Certificate not found in database."""
    code = "CERT_NOT_FOUND"
    status_code = 404
    
    def __init__(self, cert_id: int = None, name: str = None):
        identifier = f"ID={cert_id}" if cert_id else f"name={name}"
        super().__init__(f"Certificate not found: {identifier}")


class CertificateValidationError(CMTException):
    """Certificate validation failed (format, expiry, etc)."""
    code = "CERT_VALIDATION_ERROR"
    status_code = 400
    
    def __init__(self, reason: str):
        super().__init__(f"Certificate validation failed: {reason}")


class CertificateInUseError(CMTException):
    """Cannot delete certificate that is in use."""
    code = "CERT_IN_USE"
    status_code = 409
    
    def __init__(self, cert_id: int, profiles_count: int, vips_count: int):
        super().__init__(
            f"Certificate {cert_id} is in use by {profiles_count} profile(s) "
            f"and {vips_count} VIP(s)"
        )


class RenewalNotFoundError(CMTException):
    """Renewal request not found."""
    code = "RENEWAL_NOT_FOUND"
    status_code = 404
    
    def __init__(self, renewal_id: int):
        super().__init__(f"Renewal request not found: ID={renewal_id}")


# =============================================================================
# Authentication Exceptions
# =============================================================================

class InvalidCredentialsError(CMTException):
    """Invalid username or password."""
    code = "INVALID_CREDENTIALS"
    status_code = 401
    
    def __init__(self):
        super().__init__("Invalid username or password")


class TokenExpiredError(CMTException):
    """JWT token has expired."""
    code = "TOKEN_EXPIRED"
    status_code = 401
    
    def __init__(self):
        super().__init__("Token has expired")


class InsufficientPermissionsError(CMTException):
    """User lacks required permissions."""
    code = "INSUFFICIENT_PERMISSIONS"
    status_code = 403
    
    def __init__(self, required_role: str = None):
        message = "Insufficient permissions"
        if required_role:
            message += f" - required role: {required_role}"
        super().__init__(message)


# =============================================================================
# PFX/Encryption Exceptions
# =============================================================================

class PFXParseError(CMTException):
    """Failed to parse PFX file."""
    code = "PFX_PARSE_ERROR"
    status_code = 400
    
    def __init__(self, detail: str = None):
        message = "Failed to parse PFX file"
        if detail:
            message += f": {detail}"
        super().__init__(message)


class EncryptionError(CMTException):
    """Encryption or decryption failed."""
    code = "ENCRYPTION_ERROR"
    status_code = 500
    
    def __init__(self, operation: str = "encrypt/decrypt"):
        super().__init__(f"Failed to {operation} data")


# =============================================================================
# Validation Exceptions
# =============================================================================

class ValidationError(CMTException):
    """Generic validation error."""
    code = "VALIDATION_ERROR"
    status_code = 400
    
    def __init__(self, field: str, reason: str):
        super().__init__(f"Validation error for '{field}': {reason}")
