# core/rate_limiter.py
"""
Rate limiting configuration for sensitive endpoints.
Uses slowapi for FastAPI rate limiting.
"""
import os
from slowapi import Limiter
from slowapi.util import get_remote_address

# Rate limit for sensitive operations (private keys, credentials)
# Default: 10 requests per minute per IP
SENSITIVE_RATE_LIMIT = os.getenv("SENSITIVE_RATE_LIMIT", "10/minute")

# Standard rate limit for regular API calls
# Default: 100 requests per minute per IP
STANDARD_RATE_LIMIT = os.getenv("STANDARD_RATE_LIMIT", "100/minute")

# Initialize the limiter with IP-based key function
limiter = Limiter(key_func=get_remote_address)
