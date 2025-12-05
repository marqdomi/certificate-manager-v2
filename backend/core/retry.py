# core/retry.py
"""
Retry utilities with exponential backoff for resilient operations.
"""
import time
import functools
from typing import Tuple, Type, Callable, Any
from core.logger import setup_logger

logger = setup_logger("cmt.retry")


def retry_with_backoff(
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    exponential_base: float = 2.0,
    exceptions: Tuple[Type[Exception], ...] = (Exception,),
):
    """
    Decorator that retries a function with exponential backoff.
    
    Args:
        max_retries: Maximum number of retry attempts
        base_delay: Initial delay between retries (seconds)
        max_delay: Maximum delay between retries (seconds)
        exponential_base: Base for exponential backoff calculation
        exceptions: Tuple of exception types to catch and retry
    
    Usage:
        @retry_with_backoff(max_retries=3, exceptions=(ConnectionError,))
        def connect_to_f5(hostname):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            last_exception = None
            
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    
                    if attempt == max_retries:
                        logger.error(
                            f"{func.__name__} failed after {max_retries + 1} attempts: {e}"
                        )
                        raise
                    
                    # Calculate delay with exponential backoff
                    delay = min(
                        base_delay * (exponential_base ** attempt),
                        max_delay
                    )
                    
                    logger.warning(
                        f"{func.__name__} attempt {attempt + 1}/{max_retries + 1} failed: {e}. "
                        f"Retrying in {delay:.1f}s..."
                    )
                    time.sleep(delay)
            
            # Should not reach here, but just in case
            if last_exception:
                raise last_exception
                
        return wrapper
    return decorator


def retry_f5_connection(func: Callable) -> Callable:
    """
    Specialized retry decorator for F5 connections.
    Retries on connection errors with sensible defaults.
    """
    return retry_with_backoff(
        max_retries=2,
        base_delay=2.0,
        max_delay=10.0,
        exceptions=(
            ConnectionError,
            TimeoutError,
            OSError,  # Includes socket errors
        ),
    )(func)
