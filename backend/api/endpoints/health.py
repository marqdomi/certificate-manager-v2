# backend/api/endpoints/health.py
"""
Health Check API endpoints for CMT Enterprise Admin Panel.
Provides system health monitoring for all CMT components.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Annotated, Optional
from datetime import datetime
import time
import os
import redis
import logging

from db.base import get_db
from db.models import User
from services import auth_service
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class ComponentHealth(BaseModel):
    """Health status of a single component."""
    name: str
    status: str  # "healthy", "degraded", "unhealthy"
    latency_ms: Optional[float] = None
    message: Optional[str] = None
    details: Optional[dict] = None


class SystemHealth(BaseModel):
    """Overall system health response."""
    status: str  # "healthy", "degraded", "unhealthy"
    timestamp: datetime
    version: str
    environment: str
    components: list[ComponentHealth]
    uptime_seconds: Optional[float] = None


class QuickHealth(BaseModel):
    """Quick health check response (for load balancers)."""
    status: str
    timestamp: datetime


# Track application start time for uptime calculation
APP_START_TIME = time.time()


# ═══════════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def check_database(db: Session) -> ComponentHealth:
    """Check PostgreSQL database connectivity and latency."""
    try:
        start = time.time()
        result = db.execute(text("SELECT 1")).fetchone()
        latency = (time.time() - start) * 1000
        
        # Get some DB stats
        db_version = db.execute(text("SELECT version()")).fetchone()[0]
        
        return ComponentHealth(
            name="PostgreSQL",
            status="healthy",
            latency_ms=round(latency, 2),
            message="Connected",
            details={"version": db_version.split(',')[0] if db_version else None}
        )
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return ComponentHealth(
            name="PostgreSQL",
            status="unhealthy",
            message=str(e)
        )


def check_redis() -> ComponentHealth:
    """Check Redis connectivity and latency."""
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
    if not redis_url:
        return ComponentHealth(
            name="Redis",
            status="unhealthy",
            message="REDIS_URL not configured"
        )
    
    try:
        start = time.time()
        
        # Parse Redis URL
        r = redis.from_url(
            redis_url,
            socket_connect_timeout=5,
            socket_timeout=5,
            ssl=True if redis_url.startswith("rediss://") else False
        )
        
        # Ping Redis
        r.ping()
        latency = (time.time() - start) * 1000
        
        # Get Redis info
        info = r.info(section="server")
        redis_version = info.get("redis_version", "unknown")
        
        r.close()
        
        return ComponentHealth(
            name="Redis",
            status="healthy",
            latency_ms=round(latency, 2),
            message="Connected",
            details={"version": redis_version}
        )
    except redis.ConnectionError as e:
        logger.error(f"Redis connection failed: {e}")
        return ComponentHealth(
            name="Redis",
            status="unhealthy",
            message=f"Connection failed: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        return ComponentHealth(
            name="Redis",
            status="degraded",
            message=str(e)
        )


def check_celery() -> ComponentHealth:
    """Check Celery worker status."""
    try:
        from core.celery_worker import celery_app
        
        start = time.time()
        
        # Get active workers
        inspect = celery_app.control.inspect(timeout=5.0)
        active_workers = inspect.active()
        latency = (time.time() - start) * 1000
        
        if active_workers:
            worker_count = len(active_workers)
            active_tasks = sum(len(tasks) for tasks in active_workers.values())
            
            return ComponentHealth(
                name="Celery Workers",
                status="healthy",
                latency_ms=round(latency, 2),
                message=f"{worker_count} worker(s) active",
                details={
                    "workers": list(active_workers.keys()),
                    "active_tasks": active_tasks
                }
            )
        else:
            return ComponentHealth(
                name="Celery Workers",
                status="degraded",
                latency_ms=round(latency, 2),
                message="No active workers found"
            )
    except Exception as e:
        logger.error(f"Celery health check failed: {e}")
        return ComponentHealth(
            name="Celery Workers",
            status="unhealthy",
            message=str(e)
        )


def check_celery_beat() -> ComponentHealth:
    """Check Celery Beat scheduler status."""
    try:
        from core.celery_worker import celery_app
        
        # Check if beat is running by looking at scheduled tasks
        inspect = celery_app.control.inspect(timeout=5.0)
        scheduled = inspect.scheduled()
        
        if scheduled is not None:
            return ComponentHealth(
                name="Celery Beat",
                status="healthy",
                message="Scheduler running",
                details={
                    "scheduled_tasks": sum(len(tasks) for tasks in scheduled.values())
                }
            )
        else:
            return ComponentHealth(
                name="Celery Beat",
                status="degraded",
                message="Unable to verify scheduler status"
            )
    except Exception as e:
        logger.error(f"Celery Beat health check failed: {e}")
        return ComponentHealth(
            name="Celery Beat",
            status="unhealthy",
            message=str(e)
        )


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/live", response_model=QuickHealth, summary="Liveness probe")
async def liveness_probe():
    """
    Quick liveness check for Kubernetes/container orchestration.
    Returns 200 if the application is running.
    """
    return QuickHealth(
        status="ok",
        timestamp=datetime.utcnow()
    )


@router.get("/ready", response_model=QuickHealth, summary="Readiness probe")
async def readiness_probe(db: Session = Depends(get_db)):
    """
    Readiness check for Kubernetes/container orchestration.
    Returns 200 if the application is ready to accept traffic.
    """
    try:
        # Quick DB check
        db.execute(text("SELECT 1"))
        return QuickHealth(
            status="ready",
            timestamp=datetime.utcnow()
        )
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        raise HTTPException(status_code=503, detail="Service not ready")


@router.get("", response_model=SystemHealth, summary="Full system health check")
async def full_health_check(
    current_user: Annotated[User, Depends(auth_service.get_current_active_user)],
    db: Session = Depends(get_db)
):
    """
    Comprehensive health check of all CMT components.
    Requires authentication.
    Returns detailed status of database, Redis, Celery workers, and scheduler.
    """
    components = []
    
    # Check all components
    components.append(check_database(db))
    components.append(check_redis())
    components.append(check_celery())
    components.append(check_celery_beat())
    
    # Determine overall status
    statuses = [c.status for c in components]
    if all(s == "healthy" for s in statuses):
        overall_status = "healthy"
    elif "unhealthy" in statuses:
        overall_status = "unhealthy"
    else:
        overall_status = "degraded"
    
    return SystemHealth(
        status=overall_status,
        timestamp=datetime.utcnow(),
        version=os.getenv("APP_VERSION", "2.5.0"),
        environment=os.getenv("ENVIRONMENT", "development"),
        components=components,
        uptime_seconds=round(time.time() - APP_START_TIME, 2)
    )


@router.get("/db", response_model=ComponentHealth, summary="Database health check")
async def database_health(
    current_user: Annotated[User, Depends(auth_service.require_admin)],
    db: Session = Depends(get_db)
):
    """
    Detailed PostgreSQL database health check.
    Requires admin role.
    """
    health = check_database(db)
    
    # Add extended database statistics
    try:
        # Get connection count
        conn_result = db.execute(text(
            "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()"
        )).fetchone()
        
        # Get database size
        size_result = db.execute(text(
            "SELECT pg_size_pretty(pg_database_size(current_database()))"
        )).fetchone()
        
        if health.details:
            health.details["active_connections"] = conn_result[0] if conn_result else None
            health.details["database_size"] = size_result[0] if size_result else None
    except Exception as e:
        logger.warning(f"Could not get extended DB stats: {e}")
    
    return health


@router.get("/redis", response_model=ComponentHealth, summary="Redis health check")
async def redis_health(
    current_user: Annotated[User, Depends(auth_service.require_admin)]
):
    """
    Detailed Redis health check.
    Requires admin role.
    """
    health = check_redis()
    
    # Add extended Redis statistics
    redis_url = os.getenv("REDIS_URL")
    if redis_url and health.status == "healthy":
        try:
            r = redis.from_url(
                redis_url,
                socket_connect_timeout=5,
                ssl=True if redis_url.startswith("rediss://") else False
            )
            info = r.info(section="memory")
            
            if health.details:
                health.details["used_memory"] = info.get("used_memory_human", "unknown")
                health.details["peak_memory"] = info.get("used_memory_peak_human", "unknown")
            
            r.close()
        except Exception as e:
            logger.warning(f"Could not get extended Redis stats: {e}")
    
    return health


@router.get("/celery", response_model=ComponentHealth, summary="Celery workers health check")
async def celery_health(
    current_user: Annotated[User, Depends(auth_service.require_admin)]
):
    """
    Detailed Celery workers health check.
    Requires admin role.
    """
    return check_celery()


@router.get("/scheduler", response_model=ComponentHealth, summary="Celery Beat health check")
async def scheduler_health(
    current_user: Annotated[User, Depends(auth_service.require_admin)]
):
    """
    Detailed Celery Beat scheduler health check.
    Requires admin role.
    """
    return check_celery_beat()
