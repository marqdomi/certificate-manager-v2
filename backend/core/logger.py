# core/logger.py
"""
Centralized logging configuration for CMT.
Replaces scattered print() statements with structured logging.
"""
import os
import sys
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

# Log level from environment (default INFO)
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

# Log directory (create if doesn't exist)
LOG_DIR = Path(os.getenv("LOG_DIR", "/var/log/cmt"))
if not LOG_DIR.exists():
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
    except PermissionError:
        # Fall back to current directory in dev
        LOG_DIR = Path("./logs")
        LOG_DIR.mkdir(exist_ok=True)

# Standard format for all loggers
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s"
LOG_FORMAT_SIMPLE = "%(asctime)s - %(levelname)s - %(message)s"


def setup_logger(name: str, level: str = None) -> logging.Logger:
    """
    Create a logger with console and file handlers.
    
    Args:
        name: Logger name (typically __name__)
        level: Override log level (default from LOG_LEVEL env var)
    
    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    
    # Avoid duplicate handlers if called multiple times
    if logger.handlers:
        return logger
    
    effective_level = getattr(logging, level or LOG_LEVEL, logging.INFO)
    logger.setLevel(effective_level)
    
    # Console handler - simpler format for readability
    console = logging.StreamHandler(sys.stdout)
    console.setLevel(effective_level)
    console.setFormatter(logging.Formatter(LOG_FORMAT_SIMPLE))
    logger.addHandler(console)
    
    # File handler with rotation (10MB, keep 5 backups)
    try:
        log_file = LOG_DIR / "cmt.log"
        file_handler = RotatingFileHandler(
            str(log_file),
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=5,
            encoding="utf-8"
        )
        file_handler.setLevel(effective_level)
        file_handler.setFormatter(logging.Formatter(LOG_FORMAT))
        logger.addHandler(file_handler)
    except Exception as e:
        # Don't crash if file logging fails (e.g., permissions)
        logger.warning(f"Could not set up file logging: {e}")
    
    return logger


# Pre-configured loggers for main modules
def get_api_logger() -> logging.Logger:
    """Logger for API endpoints."""
    return setup_logger("cmt.api")


def get_service_logger() -> logging.Logger:
    """Logger for business logic services."""
    return setup_logger("cmt.service")


def get_f5_logger() -> logging.Logger:
    """Logger for F5 operations."""
    return setup_logger("cmt.f5")


def get_db_logger() -> logging.Logger:
    """Logger for database operations."""
    return setup_logger("cmt.db")


def get_celery_logger() -> logging.Logger:
    """Logger for Celery tasks."""
    return setup_logger("cmt.celery")
