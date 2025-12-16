# core/rate_limiter.py
"""
Rate limiting configuration for sensitive endpoints.
Uses slowapi for FastAPI rate limiting with Redis backend for production.
Enhanced with admin-specific limits and per-user tracking.
"""
import os
import functools
from typing import Callable, Optional
from fastapi import Request, HTTPException, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import redis
import logging

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
# RATE LIMIT CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

# Rate limit for sensitive operations (private keys, credentials)
# Default: 10 requests per minute per IP
SENSITIVE_RATE_LIMIT = os.getenv("SENSITIVE_RATE_LIMIT", "10/minute")

# Standard rate limit for regular API calls
# Default: 100 requests per minute per IP
STANDARD_RATE_LIMIT = os.getenv("STANDARD_RATE_LIMIT", "100/minute")

# Admin operations rate limit (user management, system settings)
# Default: 30 requests per minute per IP
ADMIN_RATE_LIMIT = os.getenv("ADMIN_RATE_LIMIT", "30/minute")

# Batch operations rate limit (renewals, deployments)
# Default: 5 requests per minute per IP
BATCH_RATE_LIMIT = os.getenv("BATCH_RATE_LIMIT", "5/minute")

# Export operations rate limit (CSV/Excel exports)
# Default: 3 requests per minute per IP
EXPORT_RATE_LIMIT = os.getenv("EXPORT_RATE_LIMIT", "3/minute")


# ═══════════════════════════════════════════════════════════════════════════════
# REDIS CONFIGURATION FOR RATE LIMITING
# ═══════════════════════════════════════════════════════════════════════════════

def get_redis_storage():
    """Get Redis storage URI for rate limiting if available."""
    redis_url = os.getenv("REDIS_URL")
    if redis_url:
        # Convert to rate limiting compatible format
        return f"redis://{redis_url.replace('rediss://', '').split('@')[-1]}"
    return None


def get_key_func_with_user(request: Request) -> str:
    """
    Enhanced key function that uses user ID if authenticated, 
    otherwise falls back to IP address.
    """
    # Try to get user from request state (set by auth dependency)
    user = getattr(request.state, "user", None)
    if user and hasattr(user, "id"):
        return f"user:{user.id}"
    return get_remote_address(request)


# Initialize the limiter with IP-based key function
# Uses Redis in production, in-memory in development
redis_uri = get_redis_storage()
storage_uri = redis_uri if redis_uri else "memory://"

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=storage_uri,
    strategy="fixed-window"  # More predictable for users
)

# User-aware limiter for authenticated endpoints
user_limiter = Limiter(
    key_func=get_key_func_with_user,
    storage_uri=storage_uri,
    strategy="fixed-window"
)


# ═══════════════════════════════════════════════════════════════════════════════
# RATE LIMIT DECORATORS
# ═══════════════════════════════════════════════════════════════════════════════

def rate_limit_admin(func: Callable) -> Callable:
    """
    Rate limit decorator for admin endpoints.
    Applies ADMIN_RATE_LIMIT (default 30/minute).
    """
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        return await func(*args, **kwargs)
    
    return limiter.limit(ADMIN_RATE_LIMIT)(wrapper)


def rate_limit_batch(func: Callable) -> Callable:
    """
    Rate limit decorator for batch operations.
    Applies BATCH_RATE_LIMIT (default 5/minute).
    """
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        return await func(*args, **kwargs)
    
    return limiter.limit(BATCH_RATE_LIMIT)(wrapper)


def rate_limit_export(func: Callable) -> Callable:
    """
    Rate limit decorator for export operations.
    Applies EXPORT_RATE_LIMIT (default 3/minute).
    """
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        return await func(*args, **kwargs)
    
    return limiter.limit(EXPORT_RATE_LIMIT)(wrapper)


def rate_limit_sensitive(func: Callable) -> Callable:
    """
    Rate limit decorator for sensitive operations (keys, credentials).
    Applies SENSITIVE_RATE_LIMIT (default 10/minute).
    """
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        return await func(*args, **kwargs)
    
    return limiter.limit(SENSITIVE_RATE_LIMIT)(wrapper)


# ═══════════════════════════════════════════════════════════════════════════════
# RATE LIMIT EXCEPTION HANDLER
# ═══════════════════════════════════════════════════════════════════════════════

def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """
    Custom handler for rate limit exceeded errors.
    Returns a consistent JSON response with retry information.
    """
    logger.warning(
        f"Rate limit exceeded for {get_remote_address(request)}: {exc.detail}"
    )
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail={
            "error": "rate_limit_exceeded",
            "message": "Too many requests. Please try again later.",
            "limit": str(exc.detail),
            "retry_after": getattr(exc, "retry_after", 60)
        }
    )
