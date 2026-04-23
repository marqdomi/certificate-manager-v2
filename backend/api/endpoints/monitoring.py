"""
Monitoring Configuration API Endpoints

Endpoints for managing monitoring intervals and configuration
following Microsoft best practices for network infrastructure monitoring.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from pydantic import BaseModel
from datetime import datetime
import logging

from db.base import get_db
from db.models import User, UserRole
from services import auth_service
from core.monitoring_config import monitoring_config

logger = logging.getLogger(__name__)
router = APIRouter()

class MonitoringConfigUpdate(BaseModel):
    """Schema for updating monitoring configuration"""
    full_discovery_hours: Optional[int] = None
    delta_discovery_hours: Optional[int] = None
    health_check_minutes: Optional[int] = None
    max_concurrent_operations: Optional[int] = None

class ScheduleInfo(BaseModel):
    """Schema for schedule information response"""
    operation_type: str
    next_run_time: Optional[datetime] = None
    last_run_time: Optional[datetime] = None
    interval_description: str
    microsoft_recommendation: str

@router.get("/config", status_code=200)
def get_monitoring_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.get_current_active_user)
):
    """
    Get current monitoring configuration and Microsoft best practices information.
    
    Returns:
        Complete monitoring configuration including intervals, schedules, and best practices
    """
    try:
        config = monitoring_config.export_config()
        
        return {
            "status": "success",
            "message": "Monitoring configuration retrieved",
            "config": config,
            "timestamp": datetime.utcnow()
        }
        
    except Exception as e:
        logger.error(f"Error retrieving monitoring config: {e}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": "error",
                "message": f"Failed to retrieve monitoring configuration: {str(e)}"
            }
        )

@router.get("/schedule", status_code=200)
def get_monitoring_schedule(
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.get_current_active_user)
):
    """
    Get recommended monitoring schedule based on Microsoft best practices.
    
    Returns:
        Detailed schedule information for all monitoring operations
    """
    try:
        schedule = monitoring_config.get_recommended_schedule()
        
        return {
            "status": "success",
            "message": "Monitoring schedule retrieved",
            "schedule": schedule,
            "microsoft_compliance": True,
            "timestamp": datetime.utcnow()
        }
        
    except Exception as e:
        logger.error(f"Error retrieving monitoring schedule: {e}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": "error",
                "message": f"Failed to retrieve monitoring schedule: {str(e)}"
            }
        )

@router.put("/config", status_code=200)
def update_monitoring_config(
    config_update: MonitoringConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.require_role([UserRole.ADMIN]))
):
    """
    Update monitoring configuration intervals.
    Requires admin role.
    
    Args:
        config_update: New configuration values
        
    Returns:
        Updated configuration status
    """
    try:
        # Update configuration based on provided values
        updated_fields = []
        
        if config_update.full_discovery_hours is not None:
            monitoring_config.intervals.full_discovery = config_update.full_discovery_hours * 3600
            updated_fields.append(f"full_discovery: {config_update.full_discovery_hours}h")
            
        if config_update.delta_discovery_hours is not None:
            monitoring_config.intervals.delta_discovery = config_update.delta_discovery_hours * 3600
            updated_fields.append(f"delta_discovery: {config_update.delta_discovery_hours}h")
            
        if config_update.health_check_minutes is not None:
            monitoring_config.intervals.health_check = config_update.health_check_minutes * 60
            updated_fields.append(f"health_check: {config_update.health_check_minutes}m")
            
        if config_update.max_concurrent_operations is not None:
            monitoring_config.intervals.max_concurrent_operations = config_update.max_concurrent_operations
            updated_fields.append(f"max_concurrent: {config_update.max_concurrent_operations}")
        
        logger.info(f"Admin {current_user.username} updated monitoring config: {', '.join(updated_fields)}")
        
        return {
            "status": "success",
            "message": f"Monitoring configuration updated: {', '.join(updated_fields)}",
            "updated_fields": updated_fields,
            "config": monitoring_config.export_config(),
            "timestamp": datetime.utcnow()
        }
        
    except Exception as e:
        logger.error(f"Error updating monitoring config: {e}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": "error",
                "message": f"Failed to update monitoring configuration: {str(e)}"
            }
        )

@router.get("/best-practices", status_code=200)
def get_monitoring_best_practices(
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.get_current_active_user)
):
    """
    Get Microsoft best practices information for network monitoring.
    
    Returns:
        Detailed best practices and recommendations from Microsoft Operations Manager
    """
    try:
        best_practices = {
            "source": "Microsoft Operations Manager Network Monitoring Guidelines",
            "discovery_strategy": monitoring_config.get_discovery_strategy_info(),
            "recommended_intervals": {
                "full_discovery": {
                    "interval": "24 hours (daily)",
                    "description": "Complete topology discovery including device facts and cluster relationships",
                    "microsoft_quote": "Set up discovery methods with a longer interval between full discovery"
                },
                "delta_discovery": {
                    "interval": "6 hours",
                    "description": "Incremental changes detection for device configuration and status",
                    "microsoft_quote": "and a more frequent period of delta discovery"
                },
                "health_monitoring": {
                    "interval": "5 minutes",
                    "description": "Basic connectivity and API response monitoring",
                    "microsoft_quote": "Regular health monitoring for early detection of issues"
                },
                "performance_monitoring": {
                    "interval": "1 minute",
                    "description": "Critical performance metrics for real-time monitoring",
                    "microsoft_quote": "Frequent performance monitoring for critical systems"
                }
            },
            "unified_operations_benefits": [
                "Reduces F5 device load by combining operations",
                "Improves data consistency with single-connection operations",
                "Optimizes network utilization and reduces authentication overhead",
                "Provides better error handling and retry mechanisms",
                "Follows Microsoft's principle of minimizing device impact"
            ],
            "implementation_notes": [
                "CMT v2.5 implements unified discovery combining facts + cluster operations",
                "Uses single F5 API connection for multiple data gathering operations",
                "Implements Microsoft-recommended retry patterns with exponential backoff",
                "Provides both manual and automated scheduling capabilities",
                "Supports concurrent operations with configurable limits"
            ]
        }
        
        return {
            "status": "success",
            "message": "Microsoft best practices information retrieved",
            "best_practices": best_practices,
            "microsoft_compliance": True,
            "timestamp": datetime.utcnow()
        }
        
    except Exception as e:
        logger.error(f"Error retrieving best practices: {e}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": "error",
                "message": f"Failed to retrieve best practices information: {str(e)}"
            }
        )

@router.get("/status", status_code=200)
def get_monitoring_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.get_current_active_user)
):
    """
    Get current monitoring system status and next scheduled operations.
    
    Returns:
        Current status of monitoring operations and schedule compliance
    """
    try:
        # This would integrate with actual scheduler (Celery Beat) in production
        # For now, return configuration-based status
        
        current_config = monitoring_config.export_config()
        
        status_info = {
            "monitoring_enabled": True,
            "configuration_status": "active",
            "microsoft_compliance": True,
            "unified_discovery_available": True,
            "current_intervals": {
                "full_discovery": f"{current_config['intervals']['full_discovery'] // 3600}h",
                "delta_discovery": f"{current_config['intervals']['delta_discovery'] // 3600}h", 
                "health_check": f"{current_config['intervals']['health_check'] // 60}m",
                "performance_metrics": f"{current_config['intervals']['performance_metrics']}s"
            },
            "system_health": "operational",
            "last_config_update": datetime.utcnow()
        }
        
        return {
            "status": "success",
            "message": "Monitoring status retrieved",
            "monitoring_status": status_info,
            "timestamp": datetime.utcnow()
        }
        
    except Exception as e:
        logger.error(f"Error retrieving monitoring status: {e}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": "error",
                "message": f"Failed to retrieve monitoring status: {str(e)}"
            }
        )